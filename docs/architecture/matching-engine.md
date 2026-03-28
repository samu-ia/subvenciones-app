# Revision de dominio: Motor de Matching v1

Fecha: 2026-03-26
Revisor: Domain Expert (agente IA)
Archivo analizado: `lib/matching/engine.ts` (426 lineas)

---

## Resumen ejecutivo

El motor de matching es un scoring determinista 0-100 puntos con cinco dimensiones ponderadas y un sistema de hard excludes. La arquitectura general es correcta y el enfoque determinista (sin IA) es apropiado para esta fase. Sin embargo, el analisis de dominio revela **problemas significativos** en la clasificacion de empresas (uso de OR en lugar de AND, contrario a la definicion UE), la **ausencia del ambito europeo** (FEDER, FSE, Next Generation), y varias dimensiones criticas de elegibilidad que no se evaluan (de minimis, antigueedad, finalidad del proyecto). Tambien se identifican bugs concretos en el codigo.

**Hallazgos criticos:**
- Bug en clasificacion de empresa: OR en vez de AND (lineas 132-133) clasifica a casi todas las empresas como micropyme/pyme simultaneamente.
- Falta ambito europeo/FEDER que canaliza miles de millones anuales a PYMEs.
- No se evalua acumulacion de minimis (Reglamento UE 2023/2831, techo 300.000 EUR en 3 anios).
- Penalizacion injusta a convocatorias abiertas con plazo corto (linea 320): se reduce puntuacion justo cuando deberian priorizarse.

---

## Analisis por dimension

### 1. Pesos de las dimensiones (30-25-20-15-10)

**Valoracion: Razonable con matices.**

Los pesos reflejan una logica sensata: la geografia es lo primero que descarta, seguida del tipo de beneficiario. Sin embargo, en la practica de subvenciones espaniolas, la relevancia de cada dimension varia segun el tipo de convocatoria:

| Dimension | Peso actual | Peso sugerido | Justificacion |
|-----------|------------|---------------|---------------|
| Geografia | 30 | 25 | Correcto como filtro, pero los hard excludes ya hacen el trabajo pesado. 30 pts es excesivo para el scoring positivo. |
| Tipo empresa | 25 | 25 | Adecuado. Kit Digital, por ejemplo, excluye a grandes empresas; ENISA solo acepta startups/pymes. |
| Sector CNAE | 20 | 25 | Infraponderad. Muchas convocatorias (ej. CDTI Neotec, ayudas al comercio minorista) son 100% sectoriales. Un mismatch sectorial deberia pesar mas. |
| Estado | 15 | 10 | Sobreponderado. El estado es informativo pero no deberia sesgar tanto el ranking. Una subvención proxima con buen encaje es mejor que una abierta sin encaje. |
| Importe | 10 | 15 | Infraponderado. Para PYMEs, que el importe sea proporcionado a su tamano es muy relevante. Una micro de 50K EUR no va a pedir un proyecto CDTI de 2M EUR. |

**Ejemplo real:** Kit Digital (BDNS 610512) es nacional, para micropymes/pymes, multisectorial, con importes segmentados por tamano (2.000-12.000 EUR). En este caso geografia y tipo son los discriminantes principales. Pero para CDTI Linea Directa de Innovacion, el sector tecnologico/industrial es el factor decisivo.

### 2. Criterios geograficos

#### 2.1 Modelo de ambitos

**Problema critico: Falta el ambito europeo.**

El motor solo contempla `nacional`, `autonomico` y `local` (linea 44). Esto ignora:

- **Fondos FEDER/FSE+**: canalizados a traves de Programas Operativos regionales (ej. FEDER Andalucia 2021-2027 con 6.200M EUR). Aunque los gestiona la CA, el ambito es "europeo cofinanciado" y las reglas de elegibilidad difieren.
- **Fondos Next Generation EU / PRTR**: mecanismo de recuperacion con convocatorias gestionadas tanto por ministerios (nacional) como por CCAA. Ejemplo: convocatorias de digitalizacion PYME del PRTR.
- **Programas europeos directos**: Horizon Europe, COSME/Single Market Programme, InvestEU. Empresas espaniolas pueden solicitar directamente a Bruselas.
- **Fondos interregionales**: INTERREG, POCTEP (Espana-Portugal). Requieren cooperacion transfronteriza.

**Recomendacion:** Anadir al menos `europeo` y `europeo_cofinanciado` como valores de `ambito_geografico`.

#### 2.2 Exclusiones geograficas

**Problema: No todas las convocatorias autonomicas excluyen a empresas de otras CCAA.**

Linea 213 aplica un hard exclude cuando `clienteCA !== subvCA` en ambito autonomico. Esto es incorrecto en varios casos:

- **IGAPE (Galicia)**: Algunas lineas de IGAPE permiten empresas con domicilio social fuera de Galicia si tienen centro de trabajo en Galicia.
- **ACCIO (Cataluna)**: Convocatorias de internacionalizacion aceptan empresas con establecimiento permanente en Cataluña, no necesariamente domicilio social.
- **ICF/IVACE/SPRI**: Subvenciones que exigen actividad en la CA, no domicilio.

**Recomendacion:** El hard exclude de linea 213 deberia ser un soft penalty salvo que la subvencion lo marque explicitamente como exclusion estricta. Sugerencia: anadir campo `exclusion_geografica_estricta: boolean` al `SubvencionMatchProfile`.

#### 2.3 Bug en matching local

**Linea 219:** `subvProv.includes(clienteProv.slice(0, 5))` es fragil. Comparar los primeros 5 caracteres de la provincia no es fiable:
- "Alicante" vs "Alicante/Alacant" -> `"alica"` match correcto.
- "Santa Cruz de Tenerife" -> `"santa"` podria matchear con cualquier cosa que contenga "santa".
- "Las Palmas" -> `"las p"` podria dar falsos positivos.

**Recomendacion:** Usar normalizacion de provincias con un mapa similar a `CA_ALIAS`.

### 3. Sector CNAE

#### 3.1 Nivel de digitos CNAE

**Linea 260-261:** Se usa CNAE a 4 digitos (grupo) y 2 digitos (division). Esto es correcto en principio, pero incompleto:

- Muchas convocatorias definen elegibilidad a nivel de **seccion CNAE** (letra A-U). Ejemplo: "Sectores industriales" = secciones B, C, D, E. Kit Digital acepta practicamente todas las secciones excepto K (financiero).
- Algunas convocatorias usan CNAE a **3 digitos** (grupo). Ejemplo: subvenciones de comercio minorista (grupo 47x).
- Convocatorias CDTI Neotec exigen "contenido tecnologico" que mapea a secciones J, M y ciertos codigos de C.

**Recomendacion:** Anadir matching por seccion CNAE (primer digito / letra) y por 3 digitos. La jerarquia completa seria: seccion > division (2d) > grupo (3d) > clase (4d).

#### 3.2 Keyword matching bidireccional

**Lineas 276-286:** El keyword matching solo se activa cuando `permitidosConCnae.length === 0`, lo cual es correcto para evitar falsos positivos. Sin embargo:

- **Umbral de longitud de palabra (>5 caracteres, linea 282):** Excluye palabras sectoriales clave como "pesca", "moda", "vino", "carne", "cacao", "salud", "turismo" (7, pasa), pero "pesca" (5, no pasa), "moda" (4, no pasa).
- **Stop words insuficientes (linea 280):** Faltan: "general", "desarrollo", "fomento", "programa", "ayuda", "ayudas", "subvencion", "convocatoria", "bases", "reguladoras".

**Bug menor linea 282:** `w.length > 5` deberia ser `w.length >= 4` o mejor, usar un set de keywords sectoriales curados en vez de un heuristico de longitud.

#### 3.3 Validacion de exclusion sectorial

**Lineas 170-179:** La exclusion por sector solo compara CNAE a 4 digitos exactos. Si una subvencion excluye la division 64 (servicios financieros) pero el cliente tiene CNAE 6419, la comparacion `'6419' === '64'` falla porque se hace `.slice(0, 4)` en ambos lados, convirtiendo '64' en '64' (2 chars) vs '6419' (4 chars). El cliente no seria excluido cuando deberia.

**Bug confirmado:** Si `exc.cnae_codigo` es '64' (2 digitos), `slice(0, 4)` devuelve '64', y `clienteCnae` es '6419' (4 digitos). La comparacion `'6419' === '64'` es false. La exclusion no se aplica.

**Recomendacion:** Comparar tambien a nivel de 2 digitos en las exclusiones:
```typescript
if (cnaeExc && clienteCnae && (clienteCnae === cnaeExc || clienteCnae.startsWith(cnaeExc))) {
```

### 4. Tipo de empresa

#### 4.1 Bug critico: OR en lugar de AND

**Lineas 132-133:**
```typescript
if (emp <= 10 || fac <= 2_000_000) tipos.add('micropyme');
if (emp <= 250 || fac <= 50_000_000) tipos.add('pyme');
```

La definicion oficial de la UE (Recomendacion 2003/361/CE, Anexo I, articulo 2) establece:

- **Microempresa:** empleados < 10 **Y** (facturacion <= 2M EUR **O** balance <= 2M EUR)
- **Pequena empresa:** empleados < 50 **Y** (facturacion <= 10M EUR **O** balance <= 10M EUR)
- **Mediana empresa:** empleados < 250 **Y** (facturacion <= 50M EUR **O** balance <= 43M EUR)

El uso de OR hace que:
- Una empresa con 500 empleados pero facturacion de 1.5M EUR se clasifique como micropyme (imposible en la realidad).
- Una empresa con 3 empleados pero 100M EUR de facturacion se clasifique como micropyme (deberia ser grande o al menos no micro).
- **Practicamente todas las empresas** acaban teniendo simultaneamente los tipos `micropyme` Y `pyme`, haciendo la discriminacion inutil.

**Impacto real:** Kit Digital segmenta por tamano (Segmento I: 10-49 empleados, 12.000 EUR; Segmento II: 3-9, 6.000 EUR; Segmento III: 0-2, 2.000 EUR). Con el OR actual, una empresa de 200 empleados con facturacion baja seria clasificada como micropyme y matchearia con segmentos incorrectos.

**Correccion:**
```typescript
if (emp <= 10 && fac <= 2_000_000) tipos.add('micropyme');
if (emp <= 50 && fac <= 10_000_000) tipos.add('pequeña');
if (emp <= 250 && fac <= 50_000_000) tipos.add('pyme');
if (emp > 250 || fac > 50_000_000) tipos.add('grande');
```

Nota: Falta la categoria "pequena" (< 50 empleados, < 10M facturacion) que es distinta de "mediana" en la definicion UE y en muchas convocatorias.

#### 4.2 Clasificacion incompleta

**Linea 139:** `cooperativa`, `asociacion` y `fundacion` se clasifican como `'otro'`. Esto es problematico:

- **Cooperativas**: Tienen convocatorias especificas (ej. ayudas del Ministerio de Trabajo para economia social, FOMENTO DE LA ECONOMIA SOCIAL). Ademas, las cooperativas de trabajo asociado son pymes a todos los efectos.
- **Asociaciones y fundaciones**: Son entidades sin animo de lucro. Muchas convocatorias las excluyen explicitamente, y otras estan disenadas para ellas (ej. subvenciones a asociaciones empresariales de CEOE/CEPYME).
- **Comunidades de bienes y sociedades civiles**: No contempladas pero son formas juridicas comunes entre PYMEs espanolas, especialmente en agricultura y profesiones liberales.
- **Sociedades laborales**: Forma juridica de economia social con convocatorias propias.

**Recomendacion:** Expandir los tipos a: `micropyme`, `pequeña`, `mediana`, `grande`, `autonomo`, `startup`, `cooperativa`, `asociacion`, `fundacion`, `comunidad_bienes`, `sociedad_civil`, `sociedad_laboral`.

#### 4.3 Concepto de startup

**Linea 138:** `(cliente.anos_antiguedad ?? 99) <= 5` clasifica como startup. Esto tiene sentido parcial:

- **ENISA** (lineas de financiacion publica): define "empresa de reciente creacion" como <= 24 meses para Jovenes Emprendedores y <= 5 anios para Emprendedores.
- **CDTI Neotec**: empresas innovadoras de menos de 3 anios.
- **Ley 28/2022 de startups**: define startup como empresa de nueva creacion (< 5 anios, < 7 para biotech) con caracter innovador.

El umbral de 5 anios es razonable como default, pero deberia ser configurable. El default de 99 anios cuando no hay dato es correcto (no clasifica como startup por defecto).

### 5. Dimensiones ausentes

#### 5.1 CRITICA: Acumulacion de minimis

El Reglamento (UE) 2023/2831 establece un techo de **300.000 EUR en 3 ejercicios fiscales** para ayudas de minimis. Muchas subvenciones espanolas son de minimis (ej. la mayoria de ayudas autonomicas, Kit Digital, ayudas a la contratacion). Si una empresa ya ha recibido 280.000 EUR en minimis, solo puede recibir 20.000 EUR mas.

**Impacto:** Sin este control, el motor puede recomendar subvenciones para las que el cliente no es elegible.

**Recomendacion:** Anadir campo `acumulado_minimis` al perfil de cliente y `es_minimis` a la subvencion. Si el acumulado supera el techo, hard exclude o alerta fuerte.

#### 5.2 IMPORTANTE: Finalidad/tipo de proyecto

Muchas subvenciones estan vinculadas a una finalidad concreta:
- **Digitalizacion**: Kit Digital, ayudas CDTI para transformacion digital.
- **Internacionalizacion**: ICEX Next, PIPE, ayudas ACCIO.
- **I+D+i**: CDTI PID, Linea Directa de Innovacion, deducciones fiscales art. 35 LIS.
- **Contratacion**: bonificaciones SS, ayudas a la contratacion autonomica.
- **Formacion**: FUNDAE, ayudas formativas.
- **Sostenibilidad/eficiencia energetica**: IDAE, MOVES, PREE.

Sin saber que quiere hacer el cliente (digitalizar, exportar, contratar, innovar), el motor no puede discriminar entre subvenciones que son elegibles pero irrelevantes.

**Recomendacion:** Anadir `finalidades_interes: string[]` al perfil de cliente (ej. `['digitalizacion', 'contratacion', 'internacionalizacion']`).

#### 5.3 IMPORTANTE: Antiguedad minima/maxima

Muchas convocatorias exigen:
- Antiguedad minima: "al menos 1 anio de actividad" (frecuente en programas CDTI, ICEX Next).
- Antiguedad maxima: "empresas de reciente creacion" (ENISA Jovenes Emprendedores: < 24 meses; Neotec: < 3 anios).

El perfil de cliente ya tiene `anos_antiguedad` pero no se usa en el scoring (solo para clasificar como startup). Deberia cruzarse con requisitos de la subvencion.

#### 5.4 MEJORA: Plazo de presentacion y urgencia

**Lineas 314-316:** Se calcula `diasCierre` con `plazo_fin`, pero la tabla tiene tambien `plazo_presentacion`. En la practica, el plazo relevante para el solicitante es `plazo_presentacion`, no `plazo_fin` (que puede referirse al periodo de ejecucion).

Ademas, la urgencia deberia **aumentar** la puntuacion, no reducirla (ver seccion de bugs).

#### 5.5 MEJORA: Porcentaje de financiacion

La tabla tiene `porcentaje_financiacion` pero el motor no lo usa. Para una PYME, una subvencion a fondo perdido del 80% es mucho mas atractiva que una del 20%. Esto podria integrarse en la dimension de importe.

### 6. Hard excludes

#### 6.1 Excludes actuales: correctos pero incompletos

Los hard excludes implementados son:
1. Convocatoria cerrada/suspendida (correcto)
2. Sector CNAE excluido (correcto, pero con bug de nivel de digitos - ver seccion 3.3)
3. Tipo empresa excluido (correcto)
4. CA no coincide en autonomica (demasiado estricto - ver seccion 2.2)
5. Provincia no coincide en local (correcto en concepto, fragil en implementacion)

#### 6.2 Hard excludes que faltan

- **Plazo de presentacion vencido**: Si `plazo_presentacion` es pasado, deberia ser hard exclude aunque `estado_convocatoria` no este actualizado a 'cerrada'. Los datos de BDNS a veces se actualizan con retraso.
- **Requisitos obligatorios no cumplidos**: La interfaz `SubvencionMatchProfile` tiene `requisitos` (linea 55) pero nunca se usan en el scoring. Si un requisito obligatorio es "certificacion ISO 9001" y el cliente no la tiene, deberia al menos generar una alerta fuerte.
- **Presupuesto agotado**: Algunas convocatorias se cierran por agotamiento de presupuesto antes del plazo. No hay campo para esto pero seria util.
- **Incompatibilidad juridica con forma juridica**: Una comunidad de bienes no puede solicitar determinadas ayudas que exigen personalidad juridica propia.

---

## Bugs y errores logicos detectados

### Bug 1 (CRITICO): OR en clasificacion de empresa

- **Lineas 132-133**
- **Descripcion:** Usa `||` en vez de `&&` para clasificar micropyme/pyme, contradiciendo la definicion oficial de la UE.
- **Impacto:** Casi toda empresa recibe simultaneamente los tipos micropyme y pyme, anulando la discriminacion por tamano.
- **Correccion:** Cambiar a `&&` y anadir categoria "pequena" (< 50 emp, < 10M fac).

### Bug 2 (IMPORTANTE): Exclusion sectorial no funciona con CNAE de 2 digitos

- **Lineas 174-175**
- **Descripcion:** `(exc.cnae_codigo ?? '').slice(0, 4)` sobre un CNAE de 2 digitos (ej. '64') devuelve '64', que nunca iguala a un CNAE de 4 digitos del cliente (ej. '6419').
- **Impacto:** Subvenciones que excluyen divisiones CNAE completas (ej. "sector financiero", CNAE 64-66) no excluyen correctamente a empresas de esos sectores.
- **Correccion:** Usar `clienteCnae.startsWith(cnaeExc)` ademas de igualdad exacta.

### Bug 3 (IMPORTANTE): Penalizacion a convocatorias con plazo corto

- **Linea 320:** `estado = diasCierre !== null && diasCierre <= 15 ? 12 : 15`
- **Descripcion:** Una convocatoria abierta con <= 15 dias recibe 12 puntos en vez de 15. Esto REDUCE su puntuacion total, haciendo que aparezca mas abajo en el ranking.
- **Impacto:** Exactamente las convocatorias mas urgentes (donde el cliente debe actuar YA) se penalizan. Esto es contrario a la experiencia de usuario deseada.
- **Correccion:** Mantener 15 puntos (o incluso dar un bonus de urgencia) y usar la alerta solo para informar, no para penalizar.

### Bug 4 (MENOR): Comparacion de provincia por substring fragil

- **Linea 219:** `subvProv.includes(clienteProv.slice(0, 5))`
- **Descripcion:** Comparar los primeros 5 caracteres puede dar falsos positivos ("Santa Cruz de Tenerife" matchearia con cualquier provincia que contenga "santa").
- **Correccion:** Usar un mapa de normalizacion de provincias similar a `CA_ALIAS`.

### Bug 5 (MENOR): `diasCierre` puede ser negativo

- **Lineas 314-316:** Si `plazo_fin` es una fecha pasada y `estado_convocatoria` no es 'cerrada' (datos desactualizados), `diasCierre` sera negativo. El codigo no maneja este caso: una convocatoria con plazo vencido recibiria 12 puntos (< 15 dias) y la alerta diria "Quedan solo -5 dias".
- **Correccion:** Si `diasCierre < 0`, tratar como hard exclude o al menos como `estado = 0`.

### Bug 6 (MENOR): Default 99 en antiguedad oculta startups sin dato

- **Linea 138:** `(cliente.anos_antiguedad ?? 99) <= 5` -- correcto en la intencion (sin dato = no es startup), pero si una empresa real tiene exactamente 99 anios de antiguedad, seria incorrectamente evaluada. Usar `Infinity` o un check explicito de `null`/`undefined` seria mas robusto.

---

## Recomendaciones priorizadas

### Criticas (implementar ya)

1. **Corregir OR -> AND en clasificacion de empresa (lineas 132-133).** Este bug afecta a TODOS los matches y anula la discriminacion por tamano. Anadir categoria "pequena". Tiempo estimado: 1 hora.

2. **Corregir exclusion sectorial por CNAE de 2 digitos (lineas 174-175).** Anadir `startsWith` para que exclusiones a nivel de division funcionen. Tiempo estimado: 15 minutos.

3. **Corregir penalizacion por plazo corto (linea 320).** Invertir la logica: plazo corto = misma o mayor puntuacion, no menor. Tiempo estimado: 10 minutos.

4. **Manejar `diasCierre` negativo (linea 314).** Si el plazo ha vencido, aplicar hard exclude o score 0 en estado. Tiempo estimado: 15 minutos.

### Importantes (siguiente iteracion)

5. **Anadir ambito geografico europeo/FEDER.** Crear valores `europeo` y `europeo_cofinanciado` en `ambito_geografico`. Las convocatorias europeas directas son nacionales de facto (aplican a toda Espana). Las cofinanciadas FEDER suelen estar acotadas a una CA pero con reglas distintas.

6. **Suavizar hard exclude geografico autonomico.** Convertir en soft penalty o anadir flag `exclusion_geografica_estricta` para distinguir convocatorias que exigen domicilio social (estricto) vs. centro de trabajo (flexible).

7. **Anadir dimension de finalidad/proyecto.** Campo `finalidades_interes` en cliente, campo `finalidad` en subvencion. Dimensiones: digitalizacion, internacionalizacion, i+d+i, contratacion, formacion, sostenibilidad, inversion_productiva.

8. **Anadir matching por seccion CNAE (A-U).** Muchas convocatorias definen elegibilidad por seccion ("sector industrial" = B+C+D+E). Implementar jerarquia seccion > division > grupo > clase.

9. **Usar `plazo_presentacion` en vez de (o ademas de) `plazo_fin` para calcular urgencia.** El plazo relevante para el solicitante es el de presentacion.

### Mejoras futuras (nice to have)

10. **Integrar control de minimis.** Requiere almacenar ayudas recibidas por el cliente en los ultimos 3 ejercicios. Anadir campo `acumulado_minimis` al perfil y cruzar con flag `es_minimis` de la subvencion.

11. **Expandir tipos de entidad.** Anadir: cooperativa (como tipo propio, no "otro"), comunidad_bienes, sociedad_civil, sociedad_laboral, asociacion, fundacion. Cada uno tiene un ecosistema de ayudas diferente.

12. **Integrar `porcentaje_financiacion` en la dimension de importe.** Una subvencion a fondo perdido del 80% es objetivamente mejor que una del 20% a igualdad de condiciones.

13. **Mejorar keyword matching sectorial (linea 282).** Reducir umbral de longitud de palabra de >5 a >=4 caracteres. Expandir stop words con terminos genericos de convocatorias.

14. **Evaluar requisitos obligatorios.** La interfaz ya tiene `requisitos` (linea 55) pero no se usa. Cruzar requisitos de tipo "certificacion", "antiguedad_minima", "plan_empresa" con datos del cliente.

15. **Cache de normalizacion de provincias.** Crear un mapa `PROVINCIA_ALIAS` similar a `CA_ALIAS` para evitar el substring matching fragil de linea 219.

---

## Validaciones de dominio

A continuacion se presentan escenarios reales de subvenciones espanolas y como se comportaria el motor actual vs. el comportamiento esperado:

| Escenario | Subvencion real | Comportamiento actual | Comportamiento esperado |
|-----------|----------------|----------------------|------------------------|
| Micropyme de Madrid, CNAE 6201, solicita Kit Digital | Kit Digital (nacional, pymes, multisectorial) | Score alto (~85). Match correcto. | Correcto. |
| Empresa de 300 empleados, facturacion 1M EUR | Cualquier ayuda "solo PYMEs" | Clasificada como micropyme+pyme (por fac < 2M). No se excluye. | Deberia clasificarse como grande (>250 emp) y excluirse. |
| Startup de 2 anios en Barcelona, CNAE 6201 | CDTI Neotec (nacional, startups tech, < 3 anios) | Matchea como startup (correcto). Sector 6201 matchea si esta definido. | Correcto, pero faltaria validar antiguedad maxima de 3 anios (Neotec) vs. 5 (motor). |
| PYME de Sevilla | Ayuda IGAPE (autonomica, Galicia) | Hard exclude: CA no coincide. | Correcto en la mayoria de casos, pero si la PYME tiene centro de trabajo en Galicia, deberia matchear. |
| PYME sector financiero (CNAE 6419) | Subvencion que excluye CNAE 64 | No se excluye (bug: '6419' !== '64'). | Deberia excluirse. |
| PYME con 290K EUR en minimis acumulados | Subvencion de minimis de 50K EUR | Score positivo, sin alerta. | Deberia alertar: superaria el techo de 300K EUR. |
| Convocatoria abierta, cierra en 3 dias | Cualquier convocatoria urgente | Score reducido en 3 puntos vs. convocatoria sin urgencia. | Score igual o mayor. Alerta informativa de urgencia sin penalizacion. |
| Cooperativa de trabajo asociado, 15 socios | Ayuda PYME generica | Clasificada como "otro". No matchea con tipo pyme. | Deberia clasificarse como pyme (las cooperativas de TA lo son a efectos de ayudas). |
| PYME solicita subvencion FEDER Andalucia | Convocatoria con ambito "europeo_cofinanciado" | Ambito no reconocido, recibe 15 pts (desconocido). | Deberia reconocer ambito europeo cofinanciado y matchear con CA Andalucia. |

---

*Fin del informe. Las correcciones criticas (bugs 1-4) deberian implementarse antes de cualquier despliegue a produccion, ya que afectan directamente a la calidad de las recomendaciones mostradas a los usuarios.*
