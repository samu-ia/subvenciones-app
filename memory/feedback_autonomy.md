---
name: Autonomía total — no pedir permiso
description: El usuario no quiere confirmaciones para ninguna acción en el proyecto
type: feedback
---

No pedir permiso para ninguna acción dentro del proyecto: screenshots con Puppeteer, navegación, editar archivos, ejecutar comandos, git push, instalar paquetes, etc.

**Why:** El usuario lo ha indicado explícitamente dos veces. Interrumpir el flujo para confirmar acciones reversibles es molesto e innecesario.

**How to apply:** Actuar directamente siempre. Solo preguntar si se va a borrar datos de clientes reales o hacer algo genuinamente irreversible fuera del repo (coincide con CLAUDE.md).
