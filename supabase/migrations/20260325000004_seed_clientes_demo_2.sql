-- Seed de clientes demo (batch 2) - 10 empresas ficticias adicionales

INSERT INTO cliente (
  nif, nombre_empresa, nombre_normalizado,
  forma_juridica, cnae_codigo, cnae_descripcion,
  comunidad_autonoma, provincia, ciudad,
  num_empleados, facturacion_anual, tamano_empresa,
  actividad, descripcion_actividad, anos_antiguedad
) VALUES
  (
    'B13579246', 'Renovables del Atlantico SL', 'renovables del atlantico',
    'SL', '3511', 'Produccion de energia electrica',
    'Galicia', 'Pontevedra', 'Vigo',
    31, 2400000, 'pequeña',
    'Instalacion y operacion de parques eolicos y solares',
    'Empresa promotora de proyectos de energia renovable en el noroeste peninsular. Gestiona tres parques solares y tiene dos proyectos eolicos en tramitacion administrativa.',
    6
  ),
  (
    'B24681357', 'Pasteleria Artesana Navarra SL', 'pasteleria artesana navarra',
    'SL', '1071', 'Fabricacion de pan y pasteleria',
    'Navarra', 'Navarra', 'Pamplona',
    9, 480000, 'micro',
    'Elaboracion y venta de productos de pasteleria artesanal',
    'Obrador familiar con 3 tiendas en Pamplona. Especializado en productos tradicionales navarros. Quiere abrir una linea de exportacion a Francia y Alemania.',
    18
  ),
  (
    'B36925814', 'Robotica Industrial Vasca SL', 'robotica industrial vasca',
    'SL', '2825', 'Fabricacion de maquinaria industrial',
    'Pais Vasco', 'Guipuzcoa', 'San Sebastian',
    17, 1650000, 'pequeña',
    'Diseno e integracion de sistemas roboticos para industria',
    'Integradora de robots industriales especializada en el sector agroalimentario. Desarrolla celdas robotizadas a medida y ofrece servicio de mantenimiento preventivo.',
    9
  ),
  (
    'B47036925', 'Ecoturismo Sierra Nevada SL', 'ecoturismo sierra nevada',
    'SL', '7912', 'Actividades de operadores turisticos',
    'Andalucia', 'Granada', 'Granada',
    7, 310000, 'micro',
    'Turismo activo y experiencial en entorno natural',
    'Operador de turismo de montana con base en Sierra Nevada. Ofrece rutas guiadas, esqui, senderismo y estancias rurales. Trabaja con grupos escolares y corporativos.',
    5
  ),
  (
    'B58147036', 'Textil Innovacion Cataluna SL', 'textil innovacion cataluna',
    'SL', '1392', 'Fabricacion de articulos textiles tecnicos',
    'Cataluna', 'Girona', 'Girona',
    24, 1950000, 'pequeña',
    'Fabricacion de tejidos tecnicos para sector medico y deportivo',
    'Empresa especializada en textiles funcionales con propiedades antimicrobianas y termoreguladoras. Colabora con la UPC en proyectos de I+D.',
    13
  ),
  (
    'B69258147', 'Acuicultura Marina Canaria SL', 'acuicultura marina canaria',
    'SL', '0321', 'Acuicultura marina',
    'Canarias', 'Las Palmas', 'Las Palmas de Gran Canaria',
    38, 2800000, 'pequeña',
    'Cria y engorde de dorada y lubina en jaulas marinas',
    'Empresa acuicola con dos concesiones en aguas de Gran Canaria. Produce 400 toneladas anuales. Exporta a mercados europeos con certificacion ASC.',
    14
  ),
  (
    'B70369258', 'EdTech Bilingue SL', 'edtech bilingue',
    'SL', '8559', 'Otras actividades de educacion',
    'Madrid', 'Madrid', 'Madrid',
    4, 220000, 'micro',
    'Plataforma digital de aprendizaje de idiomas para empresas',
    'Startup educativa con plataforma SaaS para formacion en ingles corporativo con IA. Tiene 15 empresas cliente y 800 alumnos activos.',
    2
  ),
  (
    'B81470369', 'Construccion Sostenible Aragon SL', 'construccion sostenible aragon',
    'SL', '4120', 'Construccion de edificios residenciales',
    'Aragon', 'Zaragoza', 'Zaragoza',
    52, 5100000, 'mediana',
    'Promocion y construccion de viviendas con certificacion energetica A',
    'Promotora especializada en edificios de consumo energetico casi nulo (nZEB) con materiales de bajo impacto y energias renovables integradas. Tres promociones en curso.',
    11
  ),
  (
    'B92581470', 'Biotecnologia Vegetal Murcia SL', 'biotecnologia vegetal murcia',
    'SL', '7211', 'Investigacion y desarrollo en biotecnologia',
    'Region de Murcia', 'Murcia', 'Murcia',
    11, 730000, 'pequeña',
    'I+D en mejora genetica de variedades horticolas resistentes a sequia',
    'Spin-off de la Universidad de Murcia. Desarrolla variedades de tomate y pimiento resistentes a estres hidrico. Tiene dos patentes y acuerdo con semillero europeo.',
    4
  ),
  (
    'B03692581', 'Transporte Frigorifico Levante SL', 'transporte frigorifico levante',
    'SL', '4941', 'Transporte de mercancias por carretera',
    'Comunidad Valenciana', 'Alicante', 'Alicante',
    43, 3600000, 'mediana',
    'Transporte y distribucion de productos agroalimentarios en frio',
    'Operador logistico especializado en cadena de frio. Flota de 28 vehiculos frigorificos. Distribuye para cooperativas citricolas y exportadores del sureste espanol.',
    20
  )
ON CONFLICT (nif) DO NOTHING;
