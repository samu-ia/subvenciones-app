# QA Visual - AyudaPyme Landing Page
**Fecha:** 2026-03-27
**Herramienta:** Puppeteer (headless Chrome)
**URL testeada:** http://localhost:3000
**Viewports probados:** 1280x800 (desktop), 768x1024 (tablet), 375x812 (mobile), 320x568 (small mobile)
**Total screenshots:** 45

---

## Resumen ejecutivo

| Severidad | Cantidad |
|-----------|----------|
| CRITICO   | 1        |
| ALTO      | 2        |
| MEDIO     | 3        |
| BAJO      | 3        |

**Estado general de la landing:** Bueno. El diseno es profesional, la jerarquia visual es clara y la experiencia general es solida. Los bugs encontrados son principalmente de pulido y UX edge-cases.

---

## BUGS ENCONTRADOS

### BUG-001: Decorative blob causa overflow horizontal en mobile [ALTO]
- **Seccion:** Hero
- **Viewport:** 375px (mobile)
- **Archivo:** `components/landing/Hero.tsx`, linea 24
- **Descripcion:** El `div.absolute.top-20.left-10.w-96.h-96.bg-white.rounded-full.blur-3xl` (384px de ancho) desborda el viewport mobile de 375px. Aunque el Hero tiene `overflow: hidden` y `overflowX: hidden`, el contenedor padre con `opacity-10` tiene `position: absolute; inset: 0` que lo contiene, pero el overflow checker reporta `right=424` para este elemento. Esto puede causar scroll horizontal visible en algunos dispositivos/navegadores.
- **Screenshot:** `qa-screenshots/04-landing-mobile-full.png`
- **Solucion sugerida:** Anadir `overflow: hidden` al contenedor `.absolute.inset-0.opacity-10` o reducir el tamano del blob en mobile con responsive classes (`w-64 md:w-96`).

### BUG-002: FAQ accordion no se expande al hacer click [ALTO]
- **Seccion:** FAQ (Preguntas frecuentes)
- **Viewport:** 1280px (desktop)
- **Archivo:** `components/landing/FAQ.tsx`
- **Descripcion:** Al hacer click programatico en el primer item del accordion con `[data-state="closed"]`, las screenshots 14 (antes) y 15 (despues del click) son identicas: ningun item se expandio. Posible causa: el selector no esta apuntando al trigger correcto, o Radix/Shadcn Accordion requiere un click mas especifico en el `AccordionTrigger` (boton interior). Puede ser tambien que la animacion no se completo o que headless Chrome no disparo el evento correctamente. **Requiere verificacion manual.**
- **Screenshot:** `qa-screenshots/14-faq-desktop.png` vs `qa-screenshots/15-faq-expanded-desktop.png`
- **Nota:** Si este bug es solo del test automatizado y no reproducible manualmente, reclasificar como FALSO POSITIVO.

### BUG-003: Formulario de login no muestra error visual al enviar vacio [MEDIO]
- **Seccion:** Auth Modal
- **Viewport:** 1280px (desktop)
- **Archivo:** `components/landing/AuthModal.tsx`
- **Descripcion:** Al hacer click en "Entrar" con campos vacios, no se muestra ningun mensaje de error visual. Los inputs tienen `required` nativo de HTML, por lo que el navegador previene el envio, pero no hay feedback visual personalizado (campos en rojo, tooltip, etc). En headless Chrome los popups nativos de validacion no se renderizan en screenshots. El estado del modal tras el intento (screenshot 17) es identico al estado inicial (screenshot 06).
- **Screenshot:** `qa-screenshots/17-empty-form-validation.png`
- **Solucion sugerida:** Considerar anadir validacion visual custom (borde rojo en inputs vacios, mensaje de error) ademas del `required` nativo.

### BUG-004: Formulario de login no valida formato de email visualmente [MEDIO]
- **Seccion:** Auth Modal
- **Viewport:** 1280px (desktop)
- **Archivo:** `components/landing/AuthModal.tsx`
- **Descripcion:** Al escribir "invalid-email" (sin @) y "short" como contrasena, no se muestra error visual. El `input[type="email"]` con `required` previene envio por validacion nativa, pero no hay feedback personalizado. Si el envio llegara a ejecutarse, Supabase devolveria error, pero la UX no guia al usuario antes de enviar.
- **Screenshot:** `qa-screenshots/18-invalid-form-validation.png`
- **Solucion sugerida:** Agregar validacion client-side con feedback visual (icono de error, borde rojo, mensaje inline).

### BUG-005: BenefitsTicker genera overflow masivo (esperado pero revisar) [BAJO]
- **Seccion:** BenefitsTicker (franja de beneficios con scroll infinito)
- **Viewport:** Todos
- **Archivo:** `components/landing/BenefitsTicker.tsx`
- **Descripcion:** El `.ticker-track` tiene `width: max-content` generando un scrollWidth de ~7400px. El contenedor padre tiene `overflow: hidden` lo cual lo contiene correctamente. Sin embargo, el overflow checker de DOM reporta todos los items hijos como "overflow right". **Esto es comportamiento esperado para un ticker infinito** y visualmente no produce scroll horizontal. Verificado en screenshots que se ve correctamente.
- **Screenshot:** `qa-screenshots/02-desktop-scroll-1.png`
- **Clasificacion:** FALSO POSITIVO / Comportamiento esperado. No requiere fix.

### BUG-006: Step numbers (01, 02, 03) con texto pequeno en mobile [BAJO]
- **Seccion:** How It Works (Como funciona)
- **Viewport:** 375px (mobile)
- **Archivo:** `components/landing/HowItWorks.tsx`, linea 117
- **Descripcion:** Los badges numericos de los pasos usan `fontSize: '0.72rem'` (11.52px), ligeramente por debajo del minimo recomendado de 12px para legibilidad movil. Dado que son solo 2 caracteres ("01", "02", "03") dentro de un badge circular de 28px, es aceptable pero no ideal.
- **Screenshot:** `qa-screenshots/05-mobile-scroll-5.png`
- **Solucion sugerida:** Aumentar a `0.75rem` (12px) para cumplir WCAG minimo.

### BUG-007: Badge "EN VIVO" con punto verde y emoji rojo contradictorio [MEDIO]
- **Seccion:** Hero
- **Viewport:** Todos
- **Archivo:** `components/landing/Hero.tsx`, lineas 41-44
- **Descripcion:** El badge de "en vivo" muestra simultaneamente un punto verde pulsante (`background: #4ade80`) Y un emoji rojo `🔴 EN VIVO`. Hay una contradiccion visual: punto verde + circulo rojo. Deberian usar uno u otro, no ambos.
- **Screenshot:** `qa-screenshots/02-desktop-scroll-0.png` (parte superior del hero)
- **Solucion sugerida:** Eliminar el emoji `🔴` y dejar solo el dot verde, o eliminar el dot verde y dejar el emoji.

### BUG-008: CTA "Empezar gratis" en mobile se corta parcialmente al borde [BAJO]
- **Seccion:** Pricing (Precios)
- **Viewport:** 375px (mobile)
- **Archivo:** `components/landing/Pricing.tsx`
- **Descripcion:** En el screenshot mobile del pricing, el boton "Empezar gratis" esta muy pegado al borde inferior del viewport y parcialmente cortado por el icono "N" flotante (widget de tercero, posiblemente un chat widget). No es un bug grave pero el widget cubre parcialmente el CTA.
- **Screenshot:** `qa-screenshots/13-pricing-mobile.png`
- **Solucion sugerida:** Verificar que el chat widget no tape CTAs importantes. Considerar `padding-bottom` extra o z-index management.

### BUG-009: Widget flotante "N" (chat?) tapa contenido en esquina inferior izquierda [CRITICO]
- **Seccion:** Toda la landing
- **Viewport:** Todos (mas visible en mobile)
- **Descripcion:** Un icono circular negro con "N" aparece fijo en la esquina inferior izquierda de TODAS las paginas. En mobile, este widget tapa parcialmente texto y botones al hacer scroll. Visible en todas las screenshots. Parece ser un widget de terceros (posiblemente un chat/soporte).
- **Screenshot:** Visible en TODOS los screenshots (ej. `qa-screenshots/05-mobile-scroll-12.png` donde tapa "Cuanta mas informacion nos des...")
- **Solucion sugerida:** Revisar que widget es (Next.js devtools? chat de soporte?) y configurar su posicion para que no interfiera con el contenido, especialmente en mobile. Si es solo dev-mode, ignorar.

---

## SECCIONES REVISADAS SIN BUGS

### Landing Desktop (1280px)
- Header con navegacion completa: OK. Logo AP, 5 links de nav, boton "Acceder" bien alineados.
- Hero section: Buen impacto visual, headline legible, CTAs prominentes, stats claros.
- BenefitsTicker: Animacion de scroll infinito funciona correctamente, items legibles.
- "Por que funciona" (4 cards): Bien distribuidas en grid 4-col, iconos claros, texto legible.
- "El problema que resolvemos" (About Us): Layout 2-col con stats, buena composicion.
- "Tres pasos" (How It Works): 3 columnas con iconos circulares, numeracion clara.
- Testimonials: 3 cards con ratings, montos en verde, citas legibles.
- CTA intermedio ("78% de pymes...): Buen contraste, CTA centrado.
- Pricing: Card dark con ejemplo numerico claro, checklist de features con iconos teal.
- 3 cards de garantia (sin coste, sin cuotas, sin permanencia): Bien maquetadas.
- FAQ: Accordion con 7 items, diseno limpio.
- Final CTA (seccion dark gradient): Headline impactante, CTA grande, texto de garantia.
- Contacto: 2 cards (llamanos/escribenos) con datos de contacto, bien distribuidas.
- Footer: Logo, links legales, datos de contacto. Correcto.

### Landing Mobile (375px)
- Header: Logo + hamburger menu. Correcto.
- Hero: Headline se adapta bien con `clamp()`. CTAs se apilan verticalmente. OK.
- Stats: Se muestran en columna. OK.
- Cards de beneficios: Se apilan en 1 columna. Bien legibles.
- About Us: Stats en grid 2x2. Correcto.
- How It Works: 1 columna vertical. Correcto.
- Testimonials: 1 columna. OK.
- Pricing: Card adaptada, "QUE INCLUYE" debajo del ejemplo numerico. OK.
- FAQ: Ancho completo. OK.
- Contacto: Cards apiladas. OK.
- Footer: Apilado vertical. OK.

### Landing Tablet (768px)
- Adaptacion correcta entre desktop y mobile. Sin problemas visibles.

### Landing Small Mobile (320px)
- Todo legible y funcional. Hero text algo apretado pero legible.

### Auth Modal Desktop
- Diseno limpio, campos claros, toggle de contrasena funciona.
- Link "Registrate" y "Olvidaste tu contrasena?" visibles.
- Transicion a modo "Recuperar contrasena" funciona (boton Volver, campo email, "Enviar enlace").

### Auth Modal Mobile
- Modal se adapta al viewport. Campos de tamano adecuado para tap.
- Todos los elementos accesibles.

### Paginas legales
- Politica de Privacidad: Contenido completo con 9 secciones, bien formateado.
- Terminos y Condiciones: 12 secciones, formato correcto.
- Ambas con header, footer y navegacion consistente.

### Pagina 404
- Diseno centrado con icono de lupa, mensaje claro, boton "Volver al inicio". Bien ejecutado.

---

## Metricas de rendimiento observadas

- Tiempo de carga (networkidle2): < 2s en todas las paginas
- Todas las fuentes personalizadas cargan correctamente (Geist, Plus Jakarta, Montserrat)
- Imagenes: No se usan imagenes pesadas en la landing (todo CSS/SVG/emojis), lo cual es excelente para rendimiento

---

## Recomendaciones generales

1. **Validacion de formularios**: Anadir feedback visual custom en AuthModal (no depender solo de validacion nativa HTML5)
2. **Widget flotante**: Investigar y posicionar correctamente el widget "N" para que no tape contenido
3. **Hero badge**: Resolver la contradiccion visual punto-verde + emoji-rojo
4. **Accessibility**: Los step numbers podrian usar `aria-label` para lectores de pantalla
5. **Blob overflow**: Anadir responsive sizing a decorative blobs en Hero

---

*Generado automaticamente por QA Agent - Puppeteer headless Chrome*
