# Supabase Migrations

Este directorio contiene las migraciones de la base de datos.

## Estructura de tablas

- **cliente**: Información básica de los clientes
- **einforma**: Datos empresariales enriquecidos
- **ayudas**: Catálogo de ayudas y subvenciones
- **expediente**: Expedientes de solicitudes de subvenciones
- **matches**: Coincidencias entre clientes y ayudas
- **checklist_items**: Items de checklist por expediente
- **documentos**: Documentos asociados a clientes/expedientes
- **notas**: Notas internas

## Cómo aplicar migraciones

Si tienes Supabase CLI instalado:

```bash
npx supabase db push
```

O aplica manualmente desde el SQL Editor en Supabase Dashboard.
