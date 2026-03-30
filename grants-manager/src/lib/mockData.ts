import type { Cliente, Convocatoria, Expediente, Alerta, Gestor, Presupuesto } from '../types'

export const gestores: Gestor[] = [
  { id: 'g1', nombre: 'Laura Martínez', email: 'laura@ayudapyme.es' },
  { id: 'g2', nombre: 'Carlos Ruiz', email: 'carlos@ayudapyme.es' },
  { id: 'g3', nombre: 'Ana Torres', email: 'ana@ayudapyme.es' },
]

export const clientes: Cliente[] = [
  {
    id: 'c1', nombre: 'Hostelería Atlántica S.L.', nif: 'B15234567',
    sector: 'Hostelería', cnae: '5610', comunidadAutonoma: 'Galicia',
    tamano: 'pyme', certificadoDigital: 'FNMT-RCM', caducidadCertificado: new Date('2024-11-15'),
    contacto: 'María González', email: 'maria@hosteleria-atlantica.es', telefono: '981 234 567',
    fechaAlta: new Date('2023-03-12'),
    cumplimientoHacienda: 'ok', cumplimientoSS: 'ok',
  },
  {
    id: 'c2', nombre: 'Industrias Metálicas del Norte S.A.', nif: 'A33456789',
    sector: 'Industria Manufacturera', cnae: '2511', comunidadAutonoma: 'Asturias',
    tamano: 'pyme', certificadoDigital: 'Camerfirma', caducidadCertificado: new Date('2025-06-30'),
    contacto: 'Pedro Álvarez', email: 'pedro@metalicas-norte.es', telefono: '985 678 901',
    fechaAlta: new Date('2023-05-20'),
    cumplimientoHacienda: 'revisar', cumplimientoSS: 'ok',
  },
  {
    id: 'c3', nombre: 'Fundación Horizonte Social', nif: 'G28901234',
    sector: 'Servicios Sociales', cnae: '8899', comunidadAutonoma: 'Madrid',
    tamano: 'ong', certificadoDigital: 'FNMT-RCM', caducidadCertificado: new Date('2025-09-01'),
    contacto: 'Rosa Jiménez', email: 'rosa@horizontesocial.org', telefono: '914 321 765',
    fechaAlta: new Date('2023-01-08'),
    cumplimientoHacienda: 'ok', cumplimientoSS: 'ok',
  },
  {
    id: 'c4', nombre: 'Comercial Valencia Fresh S.L.', nif: 'B46789012',
    sector: 'Comercio Minorista', cnae: '4711', comunidadAutonoma: 'Valencia',
    tamano: 'micropyme', certificadoDigital: 'Izenpe', caducidadCertificado: new Date('2025-03-15'),
    contacto: 'Jordi Ferrer', email: 'jordi@valenciafresh.es', telefono: '963 456 789',
    fechaAlta: new Date('2023-07-14'),
    cumplimientoHacienda: 'ok', cumplimientoSS: 'revisar',
  },
  {
    id: 'c5', nombre: 'Agro Extremadura Bio S.C.', nif: 'F10234567',
    sector: 'Agricultura', cnae: '0111', comunidadAutonoma: 'Extremadura',
    tamano: 'micropyme', certificadoDigital: 'FNMT-RCM', caducidadCertificado: new Date('2025-12-01'),
    contacto: 'Antonio Morales', email: 'antonio@agroextremadura.es', telefono: '927 111 222',
    fechaAlta: new Date('2023-09-03'),
    cumplimientoHacienda: 'ok', cumplimientoSS: 'ok',
  },
  {
    id: 'c6', nombre: 'Tech Innovate BCN S.L.', nif: 'B08567890',
    sector: 'Tecnología', cnae: '6201', comunidadAutonoma: 'Cataluña',
    tamano: 'pyme', certificadoDigital: 'Camerfirma', caducidadCertificado: new Date('2026-02-28'),
    contacto: 'Marc Puigdomènech', email: 'marc@techinnovate.es', telefono: '932 567 890',
    fechaAlta: new Date('2023-11-22'),
    cumplimientoHacienda: 'ok', cumplimientoSS: 'ok',
  },
  {
    id: 'c7', nombre: 'Turismo Rural La Rioja S.L.', nif: 'B26345678',
    sector: 'Turismo', cnae: '5510', comunidadAutonoma: 'La Rioja',
    tamano: 'micropyme', certificadoDigital: 'FNMT-RCM', caducidadCertificado: new Date('2025-07-20'),
    contacto: 'Elena Navarrete', email: 'elena@turismorioja.es', telefono: '941 234 567',
    fechaAlta: new Date('2024-01-15'),
    cumplimientoHacienda: 'ok', cumplimientoSS: 'ok',
  },
  {
    id: 'c8', nombre: 'Construcciones Levante 2000 S.A.', nif: 'A03123456',
    sector: 'Construcción', cnae: '4120', comunidadAutonoma: 'Murcia',
    tamano: 'pyme', certificadoDigital: 'FNMT-RCM', caducidadCertificado: new Date('2025-10-31'),
    contacto: 'Francisco López', email: 'flopez@construlevante.es', telefono: '968 345 678',
    fechaAlta: new Date('2024-02-28'),
    cumplimientoHacienda: 'revisar', cumplimientoSS: 'ok',
  },
  {
    id: 'c9', nombre: 'Centro Educativo Innovación S.L.', nif: 'B41678901',
    sector: 'Educación', cnae: '8559', comunidadAutonoma: 'Andalucía',
    tamano: 'pyme', certificadoDigital: 'Camerfirma', caducidadCertificado: new Date('2026-01-10'),
    contacto: 'Isabel Reyes', email: 'ireyes@centroinnovacion.es', telefono: '954 789 012',
    fechaAlta: new Date('2024-03-10'),
    cumplimientoHacienda: 'ok', cumplimientoSS: 'ok',
  },
  {
    id: 'c10', nombre: 'Distribuciones Vasco-Navarras S.A.', nif: 'A20456789',
    sector: 'Transporte y Logística', cnae: '4941', comunidadAutonoma: 'País Vasco',
    tamano: 'gran_empresa', certificadoDigital: 'Izenpe', caducidadCertificado: new Date('2025-08-15'),
    contacto: 'Iñaki Zubicaray', email: 'izubicaray@vasconavarras.es', telefono: '944 567 890',
    fechaAlta: new Date('2023-06-01'),
    cumplimientoHacienda: 'ok', cumplimientoSS: 'ok',
  },
]

export const convocatorias: Convocatoria[] = [
  {
    idBdns: '731245', nombre: 'Ayudas a la modernización del comercio minorista 2024',
    organismo: 'Ministerio de Industria y Turismo', tipo: 'estatal',
    fechaApertura: new Date('2024-01-15'), fechaCierre: new Date('2024-04-15'),
    fechaJustificacion: new Date('2024-10-31'),
    importeMax: 50000, porcentajeSubvencionable: 50,
    urlSede: 'https://sede.mincotur.gob.es', requisitos: ['PYME', 'Sector comercio', 'Antigüedad > 2 años'],
    descripcion: 'Subvenciones para digitalización y modernización de establecimientos comerciales.',
  },
  {
    idBdns: '731890', nombre: 'Programa Kit Digital — Segmento II (3-9 empleados)',
    organismo: 'Red.es — Ministerio de Transformación Digital', tipo: 'estatal',
    fechaApertura: new Date('2023-09-01'), fechaCierre: new Date('2024-05-31'),
    fechaJustificacion: new Date('2025-03-31'),
    importeMax: 6000, porcentajeSubvencionable: 100,
    urlSede: 'https://acelerapyme.gob.es', requisitos: ['3-9 empleados', 'Actividad en España', 'No en crisis'],
    descripcion: 'Digitalización de pequeñas empresas mediante soluciones tecnológicas.',
  },
  {
    idBdns: '698432', nombre: 'Ayudas a proyectos I+D empresarial — CDTI 2024',
    organismo: 'Centro para el Desarrollo Tecnológico Industrial (CDTI)', tipo: 'estatal',
    fechaApertura: new Date('2024-02-01'), fechaCierre: new Date('2024-06-30'),
    fechaJustificacion: new Date('2025-12-31'),
    importeMax: 1500000, porcentajeSubvencionable: 75,
    urlSede: 'https://www.cdti.es', requisitos: ['Empresa española', 'Proyecto I+D', 'Presupuesto > 175.000€'],
    descripcion: 'Financiación de proyectos de Investigación Industrial y Desarrollo Experimental.',
  },
  {
    idBdns: '745001', nombre: 'Incentivos a la inversión en Andalucía — Orden INN-B',
    organismo: 'Junta de Andalucía — Consejería de Industria', tipo: 'autonomica',
    fechaApertura: new Date('2024-01-08'), fechaCierre: new Date('2024-07-08'),
    fechaJustificacion: new Date('2025-06-30'),
    importeMax: 200000, porcentajeSubvencionable: 40,
    urlSede: 'https://www.juntadeandalucia.es', requisitos: ['Empresa con sede en Andalucía', 'Inversión productiva', 'Creación de empleo'],
    descripcion: 'Incentivos a proyectos de inversión empresarial en la Comunidad Autónoma de Andalucía.',
  },
  {
    idBdns: '752340', nombre: 'FEDER Galicia 2021-2027 — Pyme Digital',
    organismo: 'Xunta de Galicia — Axencia Galega de Innovación', tipo: 'europea',
    fechaApertura: new Date('2024-03-01'), fechaCierre: new Date('2024-08-15'),
    fechaJustificacion: new Date('2026-03-01'),
    importeMax: 80000, porcentajeSubvencionable: 60,
    urlSede: 'https://gain.xunta.gal', requisitos: ['PYME en Galicia', 'Proyecto de digitalización', 'Cofinanciación FEDER'],
    descripcion: 'Cofinanciación con Fondos FEDER para digitalización de PYMEs gallegas.',
  },
  {
    idBdns: '718956', nombre: 'Ayudas a la contratación de parados de larga duración — SEPE',
    organismo: 'Servicio Público de Empleo Estatal (SEPE)', tipo: 'estatal',
    fechaApertura: new Date('2024-01-01'), fechaCierre: new Date('2024-12-31'),
    fechaJustificacion: new Date('2025-06-30'),
    importeMax: 20000, porcentajeSubvencionable: 100,
    urlSede: 'https://www.sepe.es', requisitos: ['Cualquier empresa', 'Contratar desempleado > 12 meses'],
    descripcion: 'Bonificaciones en cuotas de Seguridad Social por contratación de desempleados de larga duración.',
  },
  {
    idBdns: '763201', nombre: 'Horizon Europe — EIC Accelerator 2024',
    organismo: 'Comisión Europea — EIC', tipo: 'europea',
    fechaApertura: new Date('2024-01-17'), fechaCierre: new Date('2024-10-04'),
    fechaJustificacion: new Date('2026-12-31'),
    importeMax: 2500000, porcentajeSubvencionable: 70,
    urlSede: 'https://eic.ec.europa.eu', requisitos: ['Start-up o PYME', 'Tecnología disruptiva', 'Potencial de escala'],
    descripcion: 'Financiación europea para start-ups y PYMEs con tecnologías disruptivas de alto impacto.',
  },
  {
    idBdns: '741567', nombre: 'Ayudas a la eficiencia energética en industria — IDAE',
    organismo: 'Instituto para la Diversificación y Ahorro de la Energía (IDAE)', tipo: 'estatal',
    fechaApertura: new Date('2024-02-15'), fechaCierre: new Date('2024-09-15'),
    fechaJustificacion: new Date('2025-09-30'),
    importeMax: 300000, porcentajeSubvencionable: 55,
    urlSede: 'https://www.idae.es', requisitos: ['Empresa industrial', 'Ahorro energético > 10%', 'Auditoría previa'],
    descripcion: 'Subvenciones para proyectos de mejora de la eficiencia energética en el sector industrial.',
  },
  {
    idBdns: '729888', nombre: 'Subvenciones a entidades del tercer sector social — IMSERSO',
    organismo: 'IMSERSO — Ministerio de Derechos Sociales', tipo: 'estatal',
    fechaApertura: new Date('2024-01-10'), fechaCierre: new Date('2024-03-31'),
    fechaJustificacion: new Date('2024-12-31'),
    importeMax: 150000, porcentajeSubvencionable: 80,
    urlSede: 'https://www.imserso.es', requisitos: ['Entidad sin ánimo de lucro', 'Actividad social', 'Inscrita en registro'],
    descripcion: 'Financiación de programas sociales para personas mayores y con discapacidad.',
  },
  {
    idBdns: '755670', nombre: 'Plan Renove Maquinaria Agrícola — MAPA 2024',
    organismo: 'Ministerio de Agricultura, Pesca y Alimentación', tipo: 'estatal',
    fechaApertura: new Date('2024-04-01'), fechaCierre: new Date('2024-07-31'),
    fechaJustificacion: new Date('2025-04-30'),
    importeMax: 30000, porcentajeSubvencionable: 30,
    urlSede: 'https://www.mapa.gob.es', requisitos: ['Agricultor activo', 'Dar de baja maquinaria antigua', 'Uso profesional'],
    descripcion: 'Ayudas para la adquisición de nueva maquinaria agrícola con baja de la antigua.',
  },
  {
    idBdns: '748932', nombre: 'Fomento del turismo rural sostenible — Comunitat Valenciana',
    organismo: 'Turisme Comunitat Valenciana', tipo: 'autonomica',
    fechaApertura: new Date('2024-02-20'), fechaCierre: new Date('2024-05-20'),
    fechaJustificacion: new Date('2025-01-31'),
    importeMax: 40000, porcentajeSubvencionable: 50,
    urlSede: 'https://turisme.gva.es', requisitos: ['Alojamiento rural en CV', 'Certificación sostenibilidad', 'Menos de 20 plazas'],
    descripcion: 'Subvenciones para establecimientos de turismo rural con criterios de sostenibilidad.',
  },
  {
    idBdns: '762180', nombre: 'Digitalización de autónomos y microempresas — Comunidad de Madrid',
    organismo: 'Comunidad de Madrid — Consejería de Economía', tipo: 'autonomica',
    fechaApertura: new Date('2024-03-11'), fechaCierre: new Date('2024-06-11'),
    fechaJustificacion: new Date('2025-03-31'),
    importeMax: 12000, porcentajeSubvencionable: 80,
    urlSede: 'https://www.comunidad.madrid', requisitos: ['Autónomo o empresa < 10 trabajadores', 'Sede en Madrid', 'Sin ayudas similares'],
    descripcion: 'Ayudas para la digitalización de negocios con menos de 10 trabajadores en la Comunidad de Madrid.',
  },
  {
    idBdns: '736710', nombre: 'Apoyo a la internacionalización empresarial — ICEX Next',
    organismo: 'ICEX España Exportación e Inversiones', tipo: 'estatal',
    fechaApertura: new Date('2024-01-15'), fechaCierre: new Date('2024-04-30'),
    fechaJustificacion: new Date('2025-04-30'),
    importeMax: 100000, porcentajeSubvencionable: 50,
    urlSede: 'https://www.icex.es', requisitos: ['PYME', 'Facturación < 10M€', 'Proyecto de internacionalización viable'],
    descripcion: 'Financiación de proyectos de internacionalización para PYMEs con potencial exportador.',
  },
  {
    idBdns: '771234', nombre: 'Rehabilitación energética en edificios — Programa PREE',
    organismo: 'IDAE — Plan de Recuperación (PRTR)', tipo: 'estatal',
    fechaApertura: new Date('2024-04-15'), fechaCierre: new Date('2024-11-30'),
    fechaJustificacion: new Date('2026-06-30'),
    importeMax: 1000000, porcentajeSubvencionable: 35,
    urlSede: 'https://www.idae.es/pree', requisitos: ['Propietario de edificio', 'Reducción de emisiones > 30%', 'Certificado energético'],
    descripcion: 'Ayudas NEXT GENERATION para rehabilitación energética de edificios existentes.',
  },
  {
    idBdns: '709876', nombre: 'Emprendimiento social — Programa Impulsa — Basque Gov',
    organismo: 'Gobierno Vasco — Departamento de Trabajo', tipo: 'autonomica',
    fechaApertura: new Date('2024-02-01'), fechaCierre: new Date('2024-04-30'),
    fechaJustificacion: new Date('2025-02-28'),
    importeMax: 60000, porcentajeSubvencionable: 65,
    urlSede: 'https://www.euskadi.eus', requisitos: ['Empresa de economía social', 'Domicilio en Euskadi', 'Creación de empleo'],
    descripcion: 'Apoyo a iniciativas de emprendimiento social y cooperativas en el País Vasco.',
  },
]

const d = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date
}

export const expedientes: Expediente[] = [
  {
    id: 'e1', clienteId: 'c6', convocatoriaId: '731890', estado: 'CONCEDIDA',
    fechaSolicitud: new Date('2024-02-10'), numeroOficial: 'KIT-2024-00341',
    importeSolicitado: 6000, importeConcedido: 6000, gestorId: 'g1',
    fechaVencimiento: d(45),
    documentos: [
      { id: 'd1', expedienteId: 'e1', tipo: 'Solicitud firmada', nombreArchivo: 'solicitud_kit_digital.pdf', fechaSubida: new Date('2024-02-10'), estado: 'validado', tamanio: '2.3 MB' },
      { id: 'd2', expedienteId: 'e1', tipo: 'Certificado AEAT', nombreArchivo: 'cert_aeat_2024.pdf', fechaSubida: new Date('2024-02-12'), fechaCaducidad: d(30), estado: 'validado', tamanio: '1.1 MB' },
      { id: 'd3', expedienteId: 'e1', tipo: 'Factura agente digitalizador', nombreArchivo: 'factura_agente_001.pdf', fechaSubida: new Date('2024-03-01'), estado: 'subido', tamanio: '0.8 MB' },
    ],
    notas: [
      { id: 'n1', texto: 'Resolución favorable recibida. Cliente notificado.', fecha: new Date('2024-03-15'), autor: 'Laura Martínez' },
    ],
    historial: [
      { id: 'h1', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-01-20'), usuario: 'Laura Martínez' },
      { id: 'h2', estadoAnterior: 'DETECCION', estadoNuevo: 'EVALUACION', fecha: new Date('2024-01-25'), usuario: 'Laura Martínez' },
      { id: 'h3', estadoAnterior: 'EVALUACION', estadoNuevo: 'PREPARACION', fecha: new Date('2024-02-01'), usuario: 'Laura Martínez' },
      { id: 'h4', estadoAnterior: 'PREPARACION', estadoNuevo: 'PRESENTADA', fecha: new Date('2024-02-10'), usuario: 'Laura Martínez' },
      { id: 'h5', estadoAnterior: 'PRESENTADA', estadoNuevo: 'CONCEDIDA', fecha: new Date('2024-03-15'), usuario: 'Sistema BDNS' },
    ],
  },
  {
    id: 'e2', clienteId: 'c6', convocatoriaId: '763201', estado: 'EVALUACION',
    fechaSolicitud: new Date('2024-03-01'), numeroOficial: '',
    importeSolicitado: 1200000, importeConcedido: 0, gestorId: 'g1',
    fechaVencimiento: d(60),
    documentos: [
      { id: 'd4', expedienteId: 'e2', tipo: 'Business Plan', nombreArchivo: 'business_plan_v3.pdf', fechaSubida: new Date('2024-03-01'), estado: 'validado', tamanio: '5.7 MB' },
      { id: 'd5', expedienteId: 'e2', tipo: 'Pitch Deck', nombreArchivo: 'pitch_deck_eic.pdf', fechaSubida: new Date('2024-03-01'), estado: 'pendiente', tamanio: '12.1 MB' },
    ],
    notas: [
      { id: 'n2', texto: 'Expediente muy prometedor. Alta probabilidad de concesión según scoring EIC.', fecha: new Date('2024-03-05'), autor: 'Carlos Ruiz' },
    ],
    historial: [
      { id: 'h6', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-02-01'), usuario: 'Carlos Ruiz' },
      { id: 'h7', estadoAnterior: 'DETECCION', estadoNuevo: 'EVALUACION', fecha: new Date('2024-02-20'), usuario: 'Carlos Ruiz' },
    ],
  },
  {
    id: 'e3', clienteId: 'c2', convocatoriaId: '741567', estado: 'PRESENTADA',
    fechaSolicitud: new Date('2024-03-20'), numeroOficial: 'IDAE-EE-2024-1122',
    importeSolicitado: 180000, importeConcedido: 0, gestorId: 'g2',
    fechaVencimiento: d(15),
    documentos: [
      { id: 'd6', expedienteId: 'e3', tipo: 'Auditoría energética', nombreArchivo: 'auditoria_energetica.pdf', fechaSubida: new Date('2024-03-18'), estado: 'validado', tamanio: '8.2 MB' },
      { id: 'd7', expedienteId: 'e3', tipo: 'Presupuesto obras', nombreArchivo: 'presupuesto_eficiencia.pdf', fechaSubida: new Date('2024-03-19'), estado: 'validado', tamanio: '3.4 MB' },
    ],
    notas: [],
    historial: [
      { id: 'h8', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-02-15'), usuario: 'Carlos Ruiz' },
      { id: 'h9', estadoAnterior: 'DETECCION', estadoNuevo: 'PREPARACION', fecha: new Date('2024-03-01'), usuario: 'Carlos Ruiz' },
      { id: 'h10', estadoAnterior: 'PREPARACION', estadoNuevo: 'PRESENTADA', fecha: new Date('2024-03-20'), usuario: 'Carlos Ruiz' },
    ],
  },
  {
    id: 'e4', clienteId: 'c3', convocatoriaId: '729888', estado: 'JUSTIFICACION',
    fechaSolicitud: new Date('2024-02-01'), numeroOficial: 'IMSERSO-2024-00089',
    importeSolicitado: 120000, importeConcedido: 98000, gestorId: 'g3',
    fechaVencimiento: d(8),
    documentos: [
      { id: 'd8', expedienteId: 'e4', tipo: 'Memoria técnica', nombreArchivo: 'memoria_tecnica_final.pdf', fechaSubida: new Date('2024-03-01'), estado: 'validado', tamanio: '4.1 MB' },
      { id: 'd9', expedienteId: 'e4', tipo: 'Facturas gastos', nombreArchivo: 'facturas_2024_q1.zip', fechaSubida: new Date('2024-03-28'), estado: 'subido', tamanio: '18.5 MB' },
      { id: 'd10', expedienteId: 'e4', tipo: 'Informe de ejecución', nombreArchivo: 'informe_ejecucion.pdf', fechaSubida: new Date(''), estado: 'pendiente' },
    ],
    notas: [
      { id: 'n3', texto: 'Quedan 2 facturas por subir. Avisar al cliente.', fecha: new Date('2024-03-25'), autor: 'Ana Torres' },
      { id: 'n4', texto: 'Cliente confirma que sube resto de documentación esta semana.', fecha: new Date('2024-03-27'), autor: 'Ana Torres' },
    ],
    historial: [
      { id: 'h11', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-01-05'), usuario: 'Ana Torres' },
      { id: 'h12', estadoAnterior: 'DETECCION', estadoNuevo: 'PREPARACION', fecha: new Date('2024-01-15'), usuario: 'Ana Torres' },
      { id: 'h13', estadoAnterior: 'PREPARACION', estadoNuevo: 'PRESENTADA', fecha: new Date('2024-02-01'), usuario: 'Ana Torres' },
      { id: 'h14', estadoAnterior: 'PRESENTADA', estadoNuevo: 'CONCEDIDA', fecha: new Date('2024-02-20'), usuario: 'IMSERSO' },
      { id: 'h15', estadoAnterior: 'CONCEDIDA', estadoNuevo: 'JUSTIFICACION', fecha: new Date('2024-03-10'), usuario: 'Ana Torres' },
    ],
  },
  {
    id: 'e5', clienteId: 'c1', convocatoriaId: '748932', estado: 'SUBSANACION',
    fechaSolicitud: new Date('2024-03-05'), numeroOficial: 'TURISME-2024-00234',
    importeSolicitado: 35000, importeConcedido: 0, gestorId: 'g1',
    fechaVencimiento: d(5),
    fechaSubsanacion: d(10),
    documentos: [
      { id: 'd11', expedienteId: 'e5', tipo: 'Certificado sostenibilidad', nombreArchivo: 'cert_sostenibilidad.pdf', fechaSubida: new Date('2024-03-05'), estado: 'rechazado', tamanio: '1.5 MB' },
      { id: 'd12', expedienteId: 'e5', tipo: 'Planos establecimiento', nombreArchivo: 'planos_hosteleria.pdf', fechaSubida: new Date('2024-03-05'), estado: 'validado', tamanio: '7.8 MB' },
      { id: 'd13', expedienteId: 'e5', tipo: 'Certificado sostenibilidad actualizado', nombreArchivo: '', fechaSubida: new Date(''), estado: 'pendiente' },
    ],
    notas: [
      { id: 'n5', texto: 'Organismo requiere certificado de sostenibilidad más reciente (< 6 meses). El aportado es de 2022.', fecha: new Date('2024-03-22'), autor: 'Laura Martínez' },
    ],
    historial: [
      { id: 'h16', estadoAnterior: null, estadoNuevo: 'PREPARACION', fecha: new Date('2024-02-20'), usuario: 'Laura Martínez' },
      { id: 'h17', estadoAnterior: 'PREPARACION', estadoNuevo: 'PRESENTADA', fecha: new Date('2024-03-05'), usuario: 'Laura Martínez' },
      { id: 'h18', estadoAnterior: 'PRESENTADA', estadoNuevo: 'SUBSANACION', fecha: new Date('2024-03-22'), usuario: 'Turisme CV' },
    ],
  },
  {
    id: 'e6', clienteId: 'c5', convocatoriaId: '755670', estado: 'PREPARACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 18000, importeConcedido: 0, gestorId: 'g2',
    fechaVencimiento: d(30),
    documentos: [
      { id: 'd14', expedienteId: 'e6', tipo: 'DNI titular', nombreArchivo: 'dni_antonio.pdf', fechaSubida: new Date('2024-03-20'), estado: 'validado', tamanio: '0.4 MB' },
      { id: 'd15', expedienteId: 'e6', tipo: 'Ficha técnica maquinaria', nombreArchivo: '', fechaSubida: new Date(''), estado: 'pendiente' },
    ],
    notas: [
      { id: 'n6', texto: 'Pendiente de ficha técnica del tractor nuevo.', fecha: new Date('2024-03-20'), autor: 'Carlos Ruiz' },
    ],
    historial: [
      { id: 'h19', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-03-01'), usuario: 'Carlos Ruiz' },
      { id: 'h20', estadoAnterior: 'DETECCION', estadoNuevo: 'PREPARACION', fecha: new Date('2024-03-15'), usuario: 'Carlos Ruiz' },
    ],
  },
  {
    id: 'e7', clienteId: 'c4', convocatoriaId: '731245', estado: 'DETECCION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 25000, importeConcedido: 0, gestorId: 'g3',
    fechaVencimiento: d(20),
    documentos: [],
    notas: [
      { id: 'n7', texto: 'Cliente muy interesado. Encaja perfectamente con su perfil.', fecha: new Date('2024-03-25'), autor: 'Ana Torres' },
    ],
    historial: [
      { id: 'h21', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-03-25'), usuario: 'Ana Torres' },
    ],
  },
  {
    id: 'e8', clienteId: 'c9', convocatoriaId: '762180', estado: 'PRESENTADA',
    fechaSolicitud: new Date('2024-03-15'), numeroOficial: 'CAM-DIG-2024-5501',
    importeSolicitado: 9600, importeConcedido: 0, gestorId: 'g3',
    fechaVencimiento: d(25),
    documentos: [
      { id: 'd16', expedienteId: 'e8', tipo: 'Solicitud completa', nombreArchivo: 'solicitud_cam_dig.pdf', fechaSubida: new Date('2024-03-15'), estado: 'validado', tamanio: '3.2 MB' },
    ],
    notas: [],
    historial: [
      { id: 'h22', estadoAnterior: null, estadoNuevo: 'PREPARACION', fecha: new Date('2024-03-01'), usuario: 'Ana Torres' },
      { id: 'h23', estadoAnterior: 'PREPARACION', estadoNuevo: 'PRESENTADA', fecha: new Date('2024-03-15'), usuario: 'Ana Torres' },
    ],
  },
  {
    id: 'e9', clienteId: 'c10', convocatoriaId: '698432', estado: 'EVALUACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 850000, importeConcedido: 0, gestorId: 'g2',
    fechaVencimiento: d(40),
    documentos: [
      { id: 'd17', expedienteId: 'e9', tipo: 'Memoria proyecto I+D', nombreArchivo: 'memoria_idi_dvn.pdf', fechaSubida: new Date('2024-03-10'), estado: 'validado', tamanio: '12.3 MB' },
      { id: 'd18', expedienteId: 'e9', tipo: 'Plan financiero', nombreArchivo: 'plan_financiero_cdti.xlsx', fechaSubida: new Date('2024-03-12'), estado: 'subido', tamanio: '0.9 MB' },
    ],
    notas: [
      { id: 'n8', texto: 'Proyecto de alto impacto. Coordinado con el equipo técnico del cliente.', fecha: new Date('2024-03-12'), autor: 'Carlos Ruiz' },
    ],
    historial: [
      { id: 'h24', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-02-15'), usuario: 'Carlos Ruiz' },
      { id: 'h25', estadoAnterior: 'DETECCION', estadoNuevo: 'EVALUACION', fecha: new Date('2024-03-05'), usuario: 'Carlos Ruiz' },
    ],
  },
  {
    id: 'e10', clienteId: 'c8', convocatoriaId: '771234', estado: 'PREPARACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 420000, importeConcedido: 0, gestorId: 'g1',
    fechaVencimiento: d(35),
    documentos: [
      { id: 'd19', expedienteId: 'e10', tipo: 'Certificado energético actual', nombreArchivo: 'cert_energetico_edificio.pdf', fechaSubida: new Date('2024-03-22'), estado: 'validado', tamanio: '2.1 MB' },
      { id: 'd20', expedienteId: 'e10', tipo: 'Proyecto técnico', nombreArchivo: '', fechaSubida: new Date(''), estado: 'pendiente' },
    ],
    notas: [
      { id: 'n9', texto: 'Edificio con calificación G. Gran potencial de ahorro energético.', fecha: new Date('2024-03-22'), autor: 'Laura Martínez' },
    ],
    historial: [
      { id: 'h26', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-03-10'), usuario: 'Laura Martínez' },
      { id: 'h27', estadoAnterior: 'DETECCION', estadoNuevo: 'PREPARACION', fecha: new Date('2024-03-20'), usuario: 'Laura Martínez' },
    ],
  },
  {
    id: 'e11', clienteId: 'c7', convocatoriaId: '709876', estado: 'DENEGADA',
    fechaSolicitud: new Date('2024-02-15'), numeroOficial: 'IMPULSA-2024-00077',
    importeSolicitado: 45000, importeConcedido: 0, gestorId: 'g3',
    fechaVencimiento: undefined,
    documentos: [],
    notas: [
      { id: 'n10', texto: 'Denegada por no cumplir requisito de empresa de economía social. Revisar alternativas.', fecha: new Date('2024-03-25'), autor: 'Ana Torres' },
    ],
    historial: [
      { id: 'h28', estadoAnterior: null, estadoNuevo: 'PREPARACION', fecha: new Date('2024-02-01'), usuario: 'Ana Torres' },
      { id: 'h29', estadoAnterior: 'PREPARACION', estadoNuevo: 'PRESENTADA', fecha: new Date('2024-02-15'), usuario: 'Ana Torres' },
      { id: 'h30', estadoAnterior: 'PRESENTADA', estadoNuevo: 'DENEGADA', fecha: new Date('2024-03-25'), usuario: 'Gobierno Vasco' },
    ],
  },
  {
    id: 'e12', clienteId: 'c2', convocatoriaId: '718956', estado: 'CERRADA',
    fechaSolicitud: new Date('2023-11-01'), numeroOficial: 'SEPE-2023-44231',
    importeSolicitado: 16000, importeConcedido: 16000, gestorId: 'g2',
    fechaVencimiento: undefined,
    documentos: [
      { id: 'd21', expedienteId: 'e12', tipo: 'Contrato trabajo', nombreArchivo: 'contrato_trabajador.pdf', fechaSubida: new Date('2023-11-05'), estado: 'validado', tamanio: '1.2 MB' },
    ],
    notas: [],
    historial: [
      { id: 'h31', estadoAnterior: null, estadoNuevo: 'CONCEDIDA', fecha: new Date('2023-11-15'), usuario: 'Carlos Ruiz' },
      { id: 'h32', estadoAnterior: 'CONCEDIDA', estadoNuevo: 'JUSTIFICACION', fecha: new Date('2024-01-10'), usuario: 'Carlos Ruiz' },
      { id: 'h33', estadoAnterior: 'JUSTIFICACION', estadoNuevo: 'CERRADA', fecha: new Date('2024-02-28'), usuario: 'Carlos Ruiz' },
    ],
  },
  {
    id: 'e13', clienteId: 'c3', convocatoriaId: '736710', estado: 'DETECCION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 80000, importeConcedido: 0, gestorId: 'g3',
    fechaVencimiento: d(15),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h34', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-03-28'), usuario: 'Ana Torres' },
    ],
  },
  {
    id: 'e14', clienteId: 'c10', convocatoriaId: '736710', estado: 'EVALUACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 100000, importeConcedido: 0, gestorId: 'g2',
    fechaVencimiento: d(10),
    documentos: [
      { id: 'd22', expedienteId: 'e14', tipo: 'Plan de internacionalización', nombreArchivo: 'plan_intl_dvn.pdf', fechaSubida: new Date('2024-03-25'), estado: 'subido', tamanio: '4.5 MB' },
    ],
    notas: [
      { id: 'n11', texto: 'Buena puntuación en criterios previos ICEX.', fecha: new Date('2024-03-26'), autor: 'Carlos Ruiz' },
    ],
    historial: [
      { id: 'h35', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-03-15'), usuario: 'Carlos Ruiz' },
      { id: 'h36', estadoAnterior: 'DETECCION', estadoNuevo: 'EVALUACION', fecha: new Date('2024-03-25'), usuario: 'Carlos Ruiz' },
    ],
  },
  {
    id: 'e15', clienteId: 'c9', convocatoriaId: '745001', estado: 'PREPARACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 150000, importeConcedido: 0, gestorId: 'g3',
    fechaVencimiento: d(50),
    documentos: [],
    notas: [
      { id: 'n12', texto: 'Expediente alineado con expansión prevista a Andalucía.', fecha: new Date('2024-03-27'), autor: 'Ana Torres' },
    ],
    historial: [
      { id: 'h37', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-03-20'), usuario: 'Ana Torres' },
      { id: 'h38', estadoAnterior: 'DETECCION', estadoNuevo: 'PREPARACION', fecha: new Date('2024-03-27'), usuario: 'Ana Torres' },
    ],
  },
  {
    id: 'e16', clienteId: 'c1', convocatoriaId: '752340', estado: 'EVALUACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 48000, importeConcedido: 0, gestorId: 'g1',
    fechaVencimiento: d(55),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h39', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: new Date('2024-03-10'), usuario: 'Laura Martínez' },
      { id: 'h40', estadoAnterior: 'DETECCION', estadoNuevo: 'EVALUACION', fecha: new Date('2024-03-28'), usuario: 'Laura Martínez' },
    ],
  },
  // Additional expedientes to have 25
  {
    id: 'e17', clienteId: 'c4', convocatoriaId: '762180', estado: 'PRESENTADA',
    fechaSolicitud: new Date('2024-03-18'), numeroOficial: 'CAM-DIG-2024-5892',
    importeSolicitado: 9600, importeConcedido: 0, gestorId: 'g3',
    fechaVencimiento: d(22),
    documentos: [
      { id: 'd23', expedienteId: 'e17', tipo: 'Solicitud', nombreArchivo: 'solicitud_cam.pdf', fechaSubida: new Date('2024-03-18'), estado: 'validado', tamanio: '2.8 MB' },
    ],
    notas: [],
    historial: [
      { id: 'h41', estadoAnterior: null, estadoNuevo: 'PRESENTADA', fecha: new Date('2024-03-18'), usuario: 'Ana Torres' },
    ],
  },
  {
    id: 'e18', clienteId: 'c5', convocatoriaId: '718956', estado: 'CONCEDIDA',
    fechaSolicitud: new Date('2024-02-20'), numeroOficial: 'SEPE-2024-12341',
    importeSolicitado: 12000, importeConcedido: 12000, gestorId: 'g2',
    fechaVencimiento: d(18),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h42', estadoAnterior: null, estadoNuevo: 'PRESENTADA', fecha: new Date('2024-02-20'), usuario: 'Carlos Ruiz' },
      { id: 'h43', estadoAnterior: 'PRESENTADA', estadoNuevo: 'CONCEDIDA', fecha: new Date('2024-03-10'), usuario: 'SEPE' },
    ],
  },
  {
    id: 'e19', clienteId: 'c7', convocatoriaId: '748932', estado: 'DETECCION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 40000, importeConcedido: 0, gestorId: 'g1',
    fechaVencimiento: d(28),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h44', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: d(-5), usuario: 'Laura Martínez' },
    ],
  },
  {
    id: 'e20', clienteId: 'c8', convocatoriaId: '745001', estado: 'EVALUACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 200000, importeConcedido: 0, gestorId: 'g1',
    fechaVencimiento: d(42),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h45', estadoAnterior: null, estadoNuevo: 'DETECCION', fecha: d(-10), usuario: 'Laura Martínez' },
      { id: 'h46', estadoAnterior: 'DETECCION', estadoNuevo: 'EVALUACION', fecha: d(-3), usuario: 'Laura Martínez' },
    ],
  },
  {
    id: 'e21', clienteId: 'c6', convocatoriaId: '698432', estado: 'PREPARACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 350000, importeConcedido: 0, gestorId: 'g1',
    fechaVencimiento: d(38),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h47', estadoAnterior: null, estadoNuevo: 'PREPARACION', fecha: d(-7), usuario: 'Laura Martínez' },
    ],
  },
  {
    id: 'e22', clienteId: 'c3', convocatoriaId: '752340', estado: 'PRESENTADA',
    fechaSolicitud: d(-5), numeroOficial: 'GAIN-FEDER-2024-0091',
    importeSolicitado: 72000, importeConcedido: 0, gestorId: 'g3',
    fechaVencimiento: d(58),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h48', estadoAnterior: null, estadoNuevo: 'PRESENTADA', fecha: d(-5), usuario: 'Ana Torres' },
    ],
  },
  {
    id: 'e23', clienteId: 'c10', convocatoriaId: '771234', estado: 'EVALUACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 750000, importeConcedido: 0, gestorId: 'g2',
    fechaVencimiento: d(62),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h49', estadoAnterior: null, estadoNuevo: 'EVALUACION', fecha: d(-2), usuario: 'Carlos Ruiz' },
    ],
  },
  {
    id: 'e24', clienteId: 'c2', convocatoriaId: '698432', estado: 'PREPARACION',
    fechaSolicitud: new Date(''), numeroOficial: '',
    importeSolicitado: 600000, importeConcedido: 0, gestorId: 'g2',
    fechaVencimiento: d(44),
    documentos: [],
    notas: [],
    historial: [
      { id: 'h50', estadoAnterior: null, estadoNuevo: 'PREPARACION', fecha: d(-4), usuario: 'Carlos Ruiz' },
    ],
  },
  {
    id: 'e25', clienteId: 'c1', convocatoriaId: '731245', estado: 'JUSTIFICACION',
    fechaSolicitud: new Date('2024-01-10'), numeroOficial: 'IND-COM-2024-0456',
    importeSolicitado: 50000, importeConcedido: 22000, gestorId: 'g1',
    fechaVencimiento: d(3),
    documentos: [
      { id: 'd24', expedienteId: 'e25', tipo: 'Memoria justificativa', nombreArchivo: 'memoria_justificativa.pdf', fechaSubida: d(-2), estado: 'subido', tamanio: '3.1 MB' },
      { id: 'd25', expedienteId: 'e25', tipo: 'Facturas', nombreArchivo: 'facturas_remodelacion.pdf', fechaSubida: d(-1), estado: 'pendiente' },
    ],
    notas: [
      { id: 'n13', texto: 'Urgente: plazo de justificación en 3 días.', fecha: d(-1), autor: 'Laura Martínez' },
    ],
    historial: [
      { id: 'h51', estadoAnterior: null, estadoNuevo: 'CONCEDIDA', fecha: new Date('2024-02-05'), usuario: 'Sistema' },
      { id: 'h52', estadoAnterior: 'CONCEDIDA', estadoNuevo: 'JUSTIFICACION', fecha: new Date('2024-03-01'), usuario: 'Laura Martínez' },
    ],
  },
]

export const alertas: Alerta[] = [
  {
    id: 'a1', expedienteId: 'e25', tipo: 'vencimiento_justificacion',
    fechaDisparo: d(3), mensaje: 'Plazo de justificación de "Ayudas modernización comercio" vence en 3 días',
    estado: 'pendiente', diasRestantes: 3,
  },
  {
    id: 'a2', expedienteId: 'e5', tipo: 'vencimiento_convocatoria',
    fechaDisparo: d(5), mensaje: 'Subsanación de "Turismo rural CV" debe presentarse en 5 días',
    estado: 'pendiente', diasRestantes: 5,
  },
  {
    id: 'a3', expedienteId: 'e4', tipo: 'vencimiento_justificacion',
    fechaDisparo: d(8), mensaje: 'Plazo de justificación de "IMSERSO tercer sector" vence en 8 días',
    estado: 'pendiente', diasRestantes: 8,
  },
  {
    id: 'a4', expedienteId: 'e14', tipo: 'vencimiento_convocatoria',
    fechaDisparo: d(10), mensaje: 'Convocatoria ICEX Next cierra en 10 días — expediente en evaluación',
    estado: 'enviada', diasRestantes: 10,
  },
  {
    id: 'a5', expedienteId: 'e3', tipo: 'vencimiento_convocatoria',
    fechaDisparo: d(15), mensaje: 'Convocatoria IDAE Eficiencia Energética cierra en 15 días',
    estado: 'enviada', diasRestantes: 15,
  },
  {
    id: 'a6', expedienteId: 'e1', tipo: 'vencimiento_justificacion',
    fechaDisparo: d(45), mensaje: 'Plazo justificación Kit Digital vence en 45 días',
    estado: 'vista', diasRestantes: 45,
  },
  {
    id: 'a7', expedienteId: 'e13', tipo: 'vencimiento_convocatoria',
    fechaDisparo: d(15), mensaje: 'Plazo de solicitud ICEX Next cierra en 15 días — expediente solo en detección',
    estado: 'pendiente', diasRestantes: 15,
  },
  {
    id: 'a8', expedienteId: 'e1', tipo: 'certificado_caducado',
    fechaDisparo: d(-45), mensaje: 'Certificado digital de Tech Innovate BCN caducó hace 45 días',
    estado: 'vista', diasRestantes: -45,
  },
]

// Mock presupuestos for expediente e4 (JUSTIFICACION) — 3 proveedores
export const presupuestos: Presupuesto[] = [
  {
    id: 'p1',
    expedienteId: 'e4',
    proveedorNombre: 'Servicios Técnicos Horizonte S.L.',
    proveedorCif: 'B28123456',
    importe: 42000,
    estado: 'recibido',
    fechaSolicitud: d(-20),
    fechaRecepcion: d(-12),
    descripcion: 'Servicios de consultoría social y gestión de programas para mayores.',
    notas: 'Oferta más económica. Buenas referencias.',
  },
  {
    id: 'p2',
    expedienteId: 'e4',
    proveedorNombre: 'Consultora Solidaria Ibérica S.A.',
    proveedorCif: 'A28987654',
    importe: 55000,
    estado: 'recibido',
    fechaSolicitud: d(-20),
    fechaRecepcion: d(-10),
    descripcion: 'Programa integral de apoyo a personas mayores y discapacidad.',
    notas: 'Mayor experiencia acreditada, pero precio más elevado.',
  },
  {
    id: 'p3',
    expedienteId: 'e4',
    proveedorNombre: 'AsociaServicios Comunidad Madrid S.C.',
    proveedorCif: 'F28345678',
    estado: 'pendiente',
    fechaSolicitud: d(-15),
    descripcion: 'Pendiente de recibir presupuesto formal.',
  },
  // Presupuestos pendientes para el Portal Proveedor (Sistemas Digitales Norte S.L.)
  {
    id: 'p4',
    expedienteId: 'e7',
    proveedorNombre: 'Sistemas Digitales Norte S.L.',
    proveedorCif: 'B12345678',
    estado: 'pendiente',
    fechaSolicitud: d(-3),
    descripcion: 'Solicitud de presupuesto para digitalización del sistema de gestión de stock y punto de venta.',
  },
  {
    id: 'p5',
    expedienteId: 'e25',
    proveedorNombre: 'Sistemas Digitales Norte S.L.',
    proveedorCif: 'B12345678',
    estado: 'pendiente',
    fechaSolicitud: d(-5),
    descripcion: 'Solicitud de presupuesto para modernización y digitalización del establecimiento comercial.',
  },
  // Trabajo en curso — seleccionado previamente
  {
    id: 'p6',
    expedienteId: 'e1',
    proveedorNombre: 'Sistemas Digitales Norte S.L.',
    proveedorCif: 'B12345678',
    importe: 5800,
    estado: 'seleccionado',
    fechaSolicitud: d(-60),
    fechaRecepcion: d(-55),
    descripcion: 'Implementación Kit Digital: CRM + página web + factura electrónica.',
    notas: 'Proyecto en ejecución. Entrega prevista fin de mes.',
  },
]

// Mock proveedor data
export const mockProveedor = {
  id: 'prov_001',
  nombre: 'Sistemas Digitales Norte S.L.',
  cif: 'B12345678',
  contacto: 'Marta Iglesias',
  email: 'marta@sdnorte.es',
  especialidades: ['Digitalización', 'Formación', 'Software ERP'],
  zona: 'Norte (Galicia, Asturias, Cantabria)',
  valoracion: 4.8,
  expedientesCompletados: 12,
  tasaExito: 91,
}
