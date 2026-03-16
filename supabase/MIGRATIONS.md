# 🔧 Cómo Ejecutar Migraciones en Supabase

## ⚠️ Problema Conocido: Conexión PostgreSQL Directa

**NO funciona la conexión directa** desde scripts locales debido a:
- Restricciones de Supabase en conexiones externas
- Problemas de DNS/IPv6 con `db.xxxxx.supabase.co`
- VPN puede interferir con la conexión

## ✅ Solución: SQL Editor del Dashboard

La forma **más confiable** de ejecutar migraciones:

### Pasos:

1. **Abre el SQL Editor**:
   ```
   https://supabase.com/dashboard/project/whvmobuyydpxdpuffiuw/sql/new
   ```

2. **Copia el contenido** del archivo de migración:
   ```
   supabase/migrations/20260316000000_cleanup_database.sql
   ```

3. **Pega** en el editor y haz clic en **RUN**

4. **Verifica** que se ejecutó correctamente viendo la salida

---

## 🔌 Alternativa: Session Pooler (requiere configuración)

Si necesitas automatizar, usa el **Session Pooler IPv4-compatible**:

```bash
# Formato correcto:
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres

# Tu caso específico:
postgresql://postgres.whvmobuyydpxdpuffiuw:<PASSWORD>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**Importante**:
- Usuario: `postgres.whvmobuyydpxdpuffiuw` (no solo `postgres`)
- Puerto: `5432` (Session mode)
- Región: `eu-west-1` (West EU Ireland)
- Password: codificar caracteres especiales (`@` → `%40`, `:` → `%3A`)

---

## 📝 Notas para Claude

Cuando ejecutes migraciones en el futuro:

1. **NO intentes** conexión directa a `db.xxxxx.supabase.co`
2. **Recomienda primero** usar el SQL Editor del Dashboard
3. Si automatización es necesaria, usa **Session Pooler** con formato correcto
4. Recuerda que la **VPN puede causar problemas**

---

## 🚀 Script Disponible

Existe `scripts/run-migration.js` pero **requiere configuración adicional de Supabase**.

Para uso normal, siempre usa el **SQL Editor del Dashboard**.
