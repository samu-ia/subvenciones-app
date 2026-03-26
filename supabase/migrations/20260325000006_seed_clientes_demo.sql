-- Seed de clientes demo para desarrollo y demos comerciales
-- NIFs ficticios con formato válido (letra de control correcta)

INSERT INTO cliente (
  nif, nombre_empresa, nombre_normalizado,
  forma_juridica, cnae_codigo, cnae_descripcion,
  comunidad_autonoma, provincia, ciudad,
  num_empleados, facturacion_anual,
  actividad, tamano_empresa,
  descripcion_actividad, anos_antiguedad
) VALUES
  (
    'B12345674', 'Tecnologías Verdes del Sur SL', 'tecnologias verdes del sur',
    'SL', '6201', 'Actividades de programación informática',
    'Andalucía', 'Sevilla', 'Sevilla',
    12, 850000,
    'Desarrollo de software de gestión energética para instalaciones industriales',
    'pequeña',
    'Empresa especializada en soluciones software para monitorización y optimización del consumo energético en plantas industriales. Clientes en sector agroalimentario y manufacturero.',
    8
  ),
  (
    'A87654321', 'Agroinnova Mediterráneo SA', 'agroinnova mediterraneo',
    'SA', '0111', 'Cultivo de cereales (excepto arroz), leguminosas y semillas oleaginosas',
    'Comunidad Valenciana', 'Valencia', 'Valencia',
    45, 3200000,
    'Agricultura de precisión y transformación agroalimentaria',
    'mediana',
    'Grupo agrícola con explotaciones en la Comunitat Valenciana dedicado a la producción de cítricos y hortalizas con tecnología de agricultura de precisión. Dispone de planta de envasado propia.',
    22
  ),
  (
    'B98765432', 'Digital Crafters Barcelona SL', 'digital crafters barcelona',
    'SL', '7311', 'Agencias de publicidad',
    'Cataluña', 'Barcelona', 'Barcelona',
    8, 620000,
    'Marketing digital, diseño UX/UI y consultoría de transformación digital',
    'micro',
    'Agencia boutique de transformación digital especializada en ecommerce y experiencia de usuario. Trabaja con marcas de moda, retail y gastronomía.',
    4
  ),
  (
    'B11223344', 'Fabricaciones Metálicas Rioja SL', 'fabricaciones metalicas rioja',
    'SL', '2511', 'Fabricación de estructuras metálicas y sus componentes',
    'La Rioja', 'La Rioja', 'Logroño',
    28, 1800000,
    'Fabricación de estructuras metálicas para construcción e industria',
    'pequeña',
    'Taller de fabricación y montaje de estructuras metálicas industriales. Especialistas en cubiertas industriales, pasarelas y equipamiento para bodegas vitivinícolas.',
    15
  ),
  (
    'B55667788', 'ClimaTech Galicia SL', 'climatech galicia',
    'SL', '4322', 'Fontanería, instalaciones de sistemas de calefacción y aire acondicionado',
    'Galicia', 'A Coruña', 'A Coruña',
    19, 1100000,
    'Instalación y mantenimiento de sistemas de climatización y energía renovable',
    'pequeña',
    'Empresa instaladora certificada en geotermia, aerotermia y solar térmica. Cubre todo el noroeste peninsular con equipos de instalación y mantenimiento.',
    11
  ),
  (
    'B44556677', 'Logística Express Castilla SL', 'logistica express castilla',
    'SL', '5229', 'Otras actividades anexas al transporte',
    'Castilla y León', 'Valladolid', 'Valladolid',
    62, 4500000,
    'Transporte de mercancías y logística de última milla',
    'mediana',
    'Operador logístico con flota propia de 40 vehículos. Especializado en distribución capilar en zonas rurales de Castilla y León. Socio de varias plataformas ecommerce nacionales.',
    9
  ),
  (
    'B33445566', 'Biofarma Naturales SL', 'biofarma naturales',
    'SL', '2120', 'Fabricación de especialidades farmacéuticas',
    'Madrid', 'Madrid', 'Madrid',
    6, 390000,
    'I+D en extractos vegetales y suplementos nutracéuticos',
    'micro',
    'Startup en fase de crecimiento centrada en el desarrollo y comercialización de suplementos basados en plantas adaptógenas. Tiene dos productos registrados y pipeline de 4 más en desarrollo.',
    3
  ),
  (
    'B22334455', 'Turismo Rural Extremadura SL', 'turismo rural extremadura',
    'SL', '5510', 'Hoteles y alojamientos similares',
    'Extremadura', 'Cáceres', 'Cáceres',
    14, 720000,
    'Gestión de alojamientos rurales y turismo experiencial',
    'pequeña',
    'Gestora de 3 complejos de turismo rural en la comarca de Las Hurdes y Monfragüe. Ofrece experiencias de naturaleza, gastronomía y cultura extremeña a turistas nacionales e internacionales.',
    7
  ),
  (
    'B99887766', 'Consultoría Energética Vasca SL', 'consultoria energetica vasca',
    'SL', '7112', 'Servicios de ingeniería',
    'País Vasco', 'Vizcaya', 'Bilbao',
    23, 2100000,
    'Ingeniería y consultoría en transición energética e industria 4.0',
    'pequeña',
    'Ingeniería especializada en auditorías energéticas, proyectos de autoconsumo fotovoltaico industrial y eficiencia en procesos productivos. Trabaja principalmente con el tejido industrial vasco.',
    12
  ),
  (
    'B77889900', 'HealthTech Murcia SL', 'healthtech murcia',
    'SL', '6202', 'Actividades de consultoría informática',
    'Región de Murcia', 'Murcia', 'Murcia',
    5, 280000,
    'Desarrollo de software para gestión clínica y telemedicina',
    'micro',
    'Empresa de base tecnológica que desarrolla soluciones de historia clínica electrónica y teleconsulta para clínicas privadas y mutuas de accidentes laborales. En proceso de certificación CE.',
    2
  )
ON CONFLICT (nif) DO NOTHING;
