# Simulación 4 Roles Reales — AyudaPyme
**Fecha:** 2026-03-26 | **Agente:** Lead + domain_expert + QA + product (476 turnos)

---

## ROL 1 — CLIENTE (PYME, dueño empresa 15 empleados, Galicia, alimentación)

### Lo que funciona
- La landing explica bien el modelo success fee — "solo pagas si consigues"
- El registro es simple, pide NIF y datos básicos
- Los matches aparecen con score y motivos comprensibles

### Fricciones críticas 🔴
- **No llega ningún email tras registrarse** — el usuario piensa que la web está rota o que nadie lo ha visto
- **El importe "Presupuesto del programa: 29,9M€" confunde** — el cliente no sabe si eso es lo que puede pedir él o el total del programa. Falta un texto como "Tu empresa podría optar a hasta X€"
- **El botón "Solicitar" no explica qué pasa después** — el cliente no sabe si firmará algo, si le llamarán, cuánto tardará. Genera desconfianza
- **Sin teléfono ni persona real visible en ningún lado** — para una PYME mayor que desconfía de lo digital, no hay forma de hablar con alguien

### Fricciones importantes 🟡
- El FAQ no responde "¿Cuánto tarda en resolverse una subvención?" — es la pregunta más frecuente
- No hay casos de éxito con empresas reales y nombres reales (los testimonios son genéricos)
- El porcentaje de éxito no aparece en ningún sitio — ¿cuántas de las subvenciones que presentáis se conceden?

---

## ROL 2 — GESTOR (empleado AyudaPyme gestionando expedientes)

### Lo que funciona
- Puede ver la lista de clientes y sus matches
- Puede ver el detalle de cada cliente con sus subvenciones

### Gaps críticos 🔴
- **No hay vista "qué tengo que hacer hoy"** — el gestor entra y ve una lista plana sin prioridad. No sabe cuál expediente es urgente
- **No puede comunicarse con el cliente desde el panel** — el chat existe en el portal del cliente pero no hay contrapartida clara en el panel admin
- **No ve qué documentos ha subido el cliente** — tiene que ir expediente por expediente
- **No hay alerta de plazo inminente** — si una convocatoria cierra en 3 días, no hay nada que lo avise
- **No puede cambiar el estado del expediente** — la tabla expediente tiene estados pero no hay UI para actualizarlos

### Gaps importantes 🟡
- No puede añadir notas internas al expediente
- No puede ver el historial de cambios de un expediente
- No hay forma de asignar un expediente a un partner específico

---

## ROL 3 — ADMINISTRACIÓN PÚBLICA (funcionario que recibe la solicitud)

### Lo que falta en el expediente generado
- **Memoria descriptiva del proyecto** — todas las convocatorias la exigen, no hay campo ni plantilla
- **Declaración responsable** — documento obligatorio en casi todas las subvenciones
- **Datos fiscales completos** — el sistema tiene NIF y nombre pero le falta la forma jurídica, fecha constitución, domicilio social
- **Justificación del cumplimiento de requisitos** — sección específica que varía por convocatoria

### Flujo de subsanación no existe 🔴
- Si la administración pide correcciones, no hay estado "en subsanación" con plazo
- El gestor no tiene forma de enviar documentación adicional de forma trazada
- El cliente no sabe que hay una subsanación en curso

---

## ROL 4 — ADMIN PLATAFORMA (CEO viendo el negocio)

### Lo que funciona
- Dashboard con número de clientes, matches, expedientes
- Puede ver todos los clientes y sus estados

### Gaps críticos 🔴
- **No ve cuánto va a cobrar** — no hay proyección de success fees pendientes
- **No hay pipeline de ingresos** — cuántos expedientes en cada fase, cuánto dinero representa cada uno
- **Las métricas no reflejan la salud real** — ve "2 expedientes" pero no sabe si están avanzando o parados
- **No hay alerta de clientes inactivos** — clientes que se registraron hace 2 semanas y no han vuelto

### Gaps importantes 🟡
- No hay forma de ver el rendimiento del matching (% de matches que acaban en solicitud)
- No hay informe exportable para presentar a inversores
- No hay vista de qué subvenciones tienen más éxito (para optimizar el foco)

---

## Prioridad de qué construir ahora

### CRÍTICO — Sin esto no se puede operar
1. **Email de bienvenida** — el más urgente, es lo primero que ve el cliente
2. **Panel gestor: vista "acción requerida"** — sin esto el gestor trabaja a ciegas
3. **Cambio de estado de expediente** — sin esto el flujo está roto

### IMPORTANTE — Para escalar
4. Chat gestor↔cliente bidireccional
5. Alerta de plazos (email + panel)
6. Pipeline de ingresos en dashboard admin

### NICE TO HAVE — Cuando haya clientes reales
7. Generación automática de memoria descriptiva con IA
8. Plantillas de documentos por tipo de convocatoria
9. Flujo de subsanación
