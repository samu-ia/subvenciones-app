/**
 * POST /api/portal/setup
 * Primera vez que el cliente entra al portal sin empresa vinculada.
 *
 * Flujo:
 *   1. Crear registro cliente (si no existe)
 *   2. Vincular NIF al perfil del usuario
 *   3. Enriquecer datos con eInforma (async, no bloquea si falla)
 *   4. Calcular matching automáticamente
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { consultarEmpresa } from '@/lib/einforma/client';
import { runMatchingForClient } from '@/lib/matching/run-for-client';
import { sendWelcomeEmail, sendMatchNotificationEmail } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const nif = body?.nif?.toUpperCase().trim();
  if (!nif) return NextResponse.json({ error: 'NIF requerido' }, { status: 400 });

  const sb = createServiceClient();

  // VULN-04: Verificar que el NIF no esté ya vinculado a otro usuario
  const { data: perfilExistente } = await sb
    .from('perfiles')
    .select('id')
    .eq('nif', nif)
    .neq('id', user.id)
    .maybeSingle();

  if (perfilExistente) {
    return NextResponse.json(
      { error: 'Este NIF ya está vinculado a otro usuario' },
      { status: 409 }
    );
  }

  // ── 1. Crear cliente si no existe ────────────────────────────────────────────
  const { data: clienteExistente } = await sb
    .from('cliente').select('nif').eq('nif', nif).maybeSingle();

  if (!clienteExistente) {
    await sb.from('cliente').insert({
      nif,
      nombre_empresa:      body.nombre_empresa?.trim()  || null,
      nombre_normalizado:  body.nombre_empresa?.trim()  || null,
      email_normalizado:   user.email                   ?? null,
      telefono:            body.telefono?.trim()        || null,
      actividad:           body.actividad?.trim()       || null,
      tamano_empresa:      body.tamano_empresa           || null,
      cnae_descripcion:    body.actividad?.trim()       || null,
    });
  }

  // ── 2. Vincular NIF al perfil del usuario ────────────────────────────────────
  await sb.from('perfiles').upsert({
    id:  user.id,
    nif,
    rol: 'cliente',
  }, { onConflict: 'id' });

  // ── 3 + 4. Enriquecer con eInforma y calcular matching (en paralelo) ─────────
  // Corremos en background sin bloquear la respuesta al usuario.
  // Los errores se loguean pero no rompen el flujo de registro.
  (async () => {
    try {
      const [einforma] = await Promise.allSettled([
        consultarEmpresa(nif),
      ]);

      // 3a. Guardar datos eInforma en tabla einforma
      if (einforma.status === 'fulfilled' && einforma.value) {
        const e = einforma.value;
        await sb.from('einforma').upsert({
          nif,
          denominacion:           e.denominacion,
          forma_juridica:         e.forma_juridica,
          cnae:                   e.cnae,
          situacion:              e.situacion,
          capital_social:         e.capital_social,
          ventas:                 e.ventas,
          anio_ventas:            e.anio_ventas,
          empleados:              e.empleados,
          fecha_constitucion:     e.fecha_constitucion,
          fecha_ultimo_balance:   e.fecha_ultimo_balance,
          cargo_principal:        e.cargo_principal,
          cargo_principal_puesto: e.cargo_principal_puesto,
          domicilio_social:       e.domicilio_social,
          localidad:              e.localidad,
          telefono:               e.telefono.length ? e.telefono : null,
          web:                    e.web.length      ? e.web      : null,
          email:                  e.email,
        }, { onConflict: 'nif' });

        // 3b. Rellenar campos de cliente que mejoran el matching
        const updateCliente: Record<string, unknown> = {};
        if (e.cnae)             updateCliente.cnae_codigo       = e.cnae;
        if (e.cnae_descripcion) updateCliente.cnae_descripcion  = e.cnae_descripcion;
        if (e.empleados)        updateCliente.num_empleados      = e.empleados;
        if (e.ventas)           updateCliente.facturacion_anual  = e.ventas;
        if (e.forma_juridica)   updateCliente.forma_juridica     = e.forma_juridica;
        if (e.localidad)        updateCliente.ciudad             = e.localidad;
        if (e.provincia)        updateCliente.provincia          = e.provincia;
        if (e.comunidad_autonoma) updateCliente.comunidad_autonoma = e.comunidad_autonoma;
        if (e.codigo_postal)    updateCliente.codigo_postal      = e.codigo_postal;
        if (e.denominacion && !body.nombre_empresa) {
          updateCliente.nombre_empresa     = e.denominacion;
          updateCliente.nombre_normalizado = e.denominacion;
        }
        if (e.fecha_constitucion) {
          const anio = new Date().getFullYear() - new Date(e.fecha_constitucion).getFullYear();
          updateCliente.anos_antiguedad = anio;
        }

        if (Object.keys(updateCliente).length) {
          await sb.from('cliente').update(updateCliente).eq('nif', nif);
        }
      }

      // 4. Calcular matching con los datos (ya enriquecidos si eInforma respondió)
      await runMatchingForClient(nif);

      // 5. Enviar email de bienvenida
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ayudapyme.es';
      const clienteNombre = body.nombre_empresa?.trim() || nif;
      try {
        await sendWelcomeEmail(
          user.email!,
          clienteNombre,
          `${siteUrl}/portal`,
        );
      } catch (err) {
        console.error('[setup] Error enviando bienvenida:', (err as Error).message);
      }

      // 6. Enviar email de notificación de matches encontrados
      try {
        const matchResult = await sendMatchNotificationEmail(
          user.email!,
          clienteNombre,
          nif,
          `${siteUrl}/portal`,
        );
        if (matchResult.ok) {
          console.log(`[setup] Email de matches enviado a ${user.email} (${matchResult.totalMatches} matches)`);
        } else if (matchResult.totalMatches === 0) {
          console.log('[setup] Sin matches para notificar, email omitido');
        } else {
          console.warn('[setup] Error enviando email de matches:', matchResult.error);
        }
      } catch (err) {
        console.error('[setup] Error enviando notificación de matches:', (err as Error).message);
      }

    } catch (err) {
      console.error('[setup] Error en enriquecimiento/matching:', (err as Error).message);
    }
  })();

  return NextResponse.json({ ok: true, nif });
}
