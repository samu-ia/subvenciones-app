# 🗄️ Estructura de Base de Datos - AyudaPyme

## 📋 Resumen

Base de datos simplificada enfocada en **3 módulos esenciales**:
1. **Clientes** - Gestión de empresas cliente
2. **Reuniones** - Seguimiento de reuniones
3. **Expedientes** - Gestión de expedientes de subvenciones

---

## 🏗️ Tablas Principales

### 1️⃣ `cliente`
Información básica de las empresas cliente.

```sql
nif                  TEXT PRIMARY KEY
nombre_normalizado   TEXT
email_normalizado    TEXT
tamano_empresa       TEXT
actividad            TEXT
domicilio_fiscal     TEXT
codigo_postal        TEXT
ciudad               TEXT
telefono             TEXT
ubicacion            TEXT
created_at           TIMESTAMPTZ
```

**Relaciones:**
- 1:1 con `einforma` (datos enriquecidos)
- 1:N con `expediente`
- 1:N con `reuniones`
- 1:N con `documentos`
- 1:N con `notas`

---

### 2️⃣ `einforma`
Datos empresariales enriquecidos (de API eInforma).

```sql
nif                     TEXT PRIMARY KEY → cliente(nif)
denominacion            TEXT
forma_juridica          TEXT
cnae                    TEXT
situacion               TEXT
capital_social          NUMERIC
ventas                  NUMERIC
anio_ventas             INTEGER
empleados               INTEGER
fecha_constitucion      DATE
fecha_ultimo_balance    DATE
cargo_principal         TEXT
cargo_principal_puesto  TEXT
domicilio_social        TEXT
localidad               TEXT
telefono                TEXT[]
web                     TEXT[]
email                   TEXT
```

---

### 3️⃣ `expediente`
Expedientes de subvenciones de cada cliente.

```sql
id                  UUID PRIMARY KEY
nif                 TEXT → cliente(nif)
numero_bdns         INTEGER
estado              TEXT (lead_caliente, en_proceso, presentado, resuelto, descartado)
drive_folder_id     TEXT
drive_folder_url    TEXT
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

**Estados:**
- `lead_caliente` - Cliente interesado
- `en_proceso` - Expediente en preparación
- `presentado` - Ya presentado
- `resuelto` - Finalizado (aprobado/rechazado)
- `descartado` - Cliente descartó continuar

---

### 4️⃣ `reuniones`
Sistema de gestión de reuniones con clientes.

```sql
id                      UUID PRIMARY KEY
cliente_nif             TEXT → cliente(nif)
titulo                  TEXT
tipo                    TEXT (exploratoria, seguimiento, presentacion, firma, otro)
estado                  TEXT (pendiente, confirmada, realizada, cancelada)
fecha_programada        TIMESTAMPTZ
duracion_minutos        INTEGER
ubicacion               TEXT
modo                    TEXT (presencial, videollamada, telefonica)
objetivo                TEXT
contexto_previo         TEXT
preguntas_preparadas    TEXT[]
documentos_necesarios   TEXT[]
notas                   TEXT (cuaderno de la reunión)
conclusiones            TEXT
proximos_pasos          TEXT[]
fecha_realizada         TIMESTAMPTZ
asistentes              TEXT[]
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
```

**Tipos de reunión:**
- `exploratoria` - Primera reunión
- `seguimiento` - Check-in del progreso
- `presentacion` - Presentar propuesta
- `firma` - Firma de documentos
- `otro` - Otras reuniones

---

### 5️⃣ `documentos`
Documentos asociados a clientes y expedientes.

```sql
id               UUID PRIMARY KEY
nif              TEXT → cliente(nif)
expediente_id    UUID → expediente(id)
nombre           TEXT
descripcion      TEXT
tipo_documento   TEXT (memoria_proyecto, presupuesto, certificado, etc.)
contenido        TEXT (para editor inline)
uploaded_at      TIMESTAMPTZ
```

**Tipos de documento:**
- `memoria_proyecto`
- `presupuesto`
- `cuentas_anuales`
- `certificado`
- `factura`
- `contrato`
- `presentacion`
- `email`
- `informe`
- `guion`
- `checklist`
- `otro`

---

### 6️⃣ `notas`
Notas y anotaciones sobre clientes y expedientes.

```sql
id               UUID PRIMARY KEY
contenido        TEXT
nif              TEXT → cliente(nif)
expediente_id    UUID → expediente(id)
created_at       TIMESTAMPTZ
```

---

## 🗑️ Tablas Eliminadas

Las siguientes tablas fueron eliminadas en la limpieza del 2026-03-16:

- ❌ `ayudas` - Sistema de catálogo de ayudas (no usado)
- ❌ `matches` - Sistema de matching automático (no usado)
- ❌ `oportunidades` - Gestión de oportunidades (no usado)
- ❌ `asistentes` - Configuración de asistentes IA (no usado)
- ❌ `configuracion_ia` - Settings de IA (no usado)
- ❌ `proveedores_ia` - Proveedores de IA (no usado)
- ❌ `checklist_items` - Items de checklist (no usado)

---

## 🔐 Seguridad

Todas las tablas tienen **Row Level Security (RLS)** habilitado:

```sql
ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE einforma ENABLE ROW LEVEL SECURITY;
ALTER TABLE expediente ENABLE ROW LEVEL SECURITY;
ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notas ENABLE ROW LEVEL SECURITY;
```

---

## 📊 Índices

### Clientes
```sql
idx_cliente_nombre    - Búsqueda por nombre
idx_cliente_ciudad    - Filtrado por ciudad
```

### Reuniones
```sql
idx_reuniones_cliente - Reuniones por cliente
idx_reuniones_fecha   - Ordenar por fecha
idx_reuniones_estado  - Filtrar por estado
```

### Expedientes
```sql
idx_expediente_nif    - Expedientes por cliente
idx_expediente_estado - Filtrar por estado
```

### Documentos
```sql
idx_documentos_expediente - Documentos por expediente
idx_documentos_cliente    - Documentos por cliente
```

### Notas
```sql
idx_notas_expediente - Notas por expediente
idx_notas_cliente    - Notas por cliente
```

---

## 🚀 Migración

Para aplicar la limpieza de base de datos:

```bash
# Desde Supabase CLI
npx supabase db push

# O manualmente desde SQL Editor
# Ejecutar: 20260316000000_cleanup_database.sql
```

---

## 📝 Changelog

### 2026-03-16 - Limpieza Major
- ✅ Eliminadas 7 tablas obsoletas
- ✅ Limpiados campos innecesarios
- ✅ Optimizados índices
- ✅ Simplificada estructura de documentos
- ✅ Mantenidas solo tablas esenciales

---

## 💡 Uso en la App

### Clientes
- **Lista:** `/clientes`
- **Detalle:** `/clientes/[nif]`
- **Nuevo:** `/clientes/nuevo`

### Reuniones
- **Lista:** `/reuniones`
- **Detalle:** `/reuniones/[id]` (con cuaderno auto-guardado)
- **Nueva:** `/reuniones/nueva`

### Expedientes
- **Lista:** `/expedientes`
- **Detalle:** `/expedientes/[id]` (editor de documentos)
- **Nuevo:** `/expedientes/nuevo`

---

**Última actualización:** 16 de marzo de 2026
