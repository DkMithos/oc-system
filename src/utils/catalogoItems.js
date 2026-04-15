/**
 * Catálogo de ítems estandarizados por categoría.
 * Código: [PREFIJO]-[número de 3 dígitos]
 */
export const CATALOGO_ITEMS = [
  // HERRAMIENTAS MANUALES
  { codigo: "HM-001", nombre: "Llave ajustable 12\"", unidad: "UND", categoria: "Herramientas" },
  { codigo: "HM-002", nombre: "Destornillador plano", unidad: "UND", categoria: "Herramientas" },
  { codigo: "HM-003", nombre: "Destornillador estrella", unidad: "UND", categoria: "Herramientas" },
  { codigo: "HM-004", nombre: "Alicate universal 8\"", unidad: "UND", categoria: "Herramientas" },
  { codigo: "HM-005", nombre: "Martillo 16 oz", unidad: "UND", categoria: "Herramientas" },
  { codigo: "HM-006", nombre: "Cinta métrica 5m", unidad: "UND", categoria: "Herramientas" },
  { codigo: "HM-007", nombre: "Nivel de burbuja 60cm", unidad: "UND", categoria: "Herramientas" },
  { codigo: "HM-008", nombre: "Juego de llaves hexagonales", unidad: "JGO", categoria: "Herramientas" },
  // REPUESTOS Y PARTES
  { codigo: "REP-001", nombre: "Filtro de aceite motor", unidad: "UND", categoria: "Repuestos" },
  { codigo: "REP-002", nombre: "Filtro de combustible", unidad: "UND", categoria: "Repuestos" },
  { codigo: "REP-003", nombre: "Filtro de aire", unidad: "UND", categoria: "Repuestos" },
  { codigo: "REP-004", nombre: "Correa de distribución", unidad: "UND", categoria: "Repuestos" },
  { codigo: "REP-005", nombre: "Pastillas de freno", unidad: "PAR", categoria: "Repuestos" },
  { codigo: "REP-006", nombre: "Batería 12V", unidad: "UND", categoria: "Repuestos" },
  { codigo: "REP-007", nombre: "Bujías (juego)", unidad: "JGO", categoria: "Repuestos" },
  { codigo: "REP-008", nombre: "Aceite de motor 15W-40 GL-4", unidad: "GLN", categoria: "Repuestos" },
  { codigo: "REP-009", nombre: "Refrigerante / Anticongelante", unidad: "GLN", categoria: "Repuestos" },
  { codigo: "REP-010", nombre: "Grasa multipropósito", unidad: "KG", categoria: "Repuestos" },
  // EQUIPOS Y MAQUINARIA
  { codigo: "EQU-001", nombre: "Taladro percutor 1/2\"", unidad: "UND", categoria: "Equipos" },
  { codigo: "EQU-002", nombre: "Amoladora angular 4.5\"", unidad: "UND", categoria: "Equipos" },
  { codigo: "EQU-003", nombre: "Compresor de aire 50L", unidad: "UND", categoria: "Equipos" },
  { codigo: "EQU-004", nombre: "Soldadora MIG 220A", unidad: "UND", categoria: "Equipos" },
  { codigo: "EQU-005", nombre: "Esmeril de banco 8\"", unidad: "UND", categoria: "Equipos" },
  { codigo: "EQU-006", nombre: "Gato hidráulico 3 ton", unidad: "UND", categoria: "Equipos" },
  { codigo: "EQU-007", nombre: "Bomba de agua 1HP", unidad: "UND", categoria: "Equipos" },
  // MATERIALES Y SUMINISTROS
  { codigo: "MAT-001", nombre: "Pernos hexagonales 1/2\" x 2\" (100 und)", unidad: "CJ", categoria: "Materiales" },
  { codigo: "MAT-002", nombre: "Tuercas hexagonales 1/2\" (100 und)", unidad: "CJ", categoria: "Materiales" },
  { codigo: "MAT-003", nombre: "Arandelas planas 1/2\" (100 und)", unidad: "CJ", categoria: "Materiales" },
  { codigo: "MAT-004", nombre: "Cable eléctrico THHN 14 AWG", unidad: "MT", categoria: "Materiales" },
  { codigo: "MAT-005", nombre: "Cinta aislante", unidad: "UND", categoria: "Materiales" },
  { codigo: "MAT-006", nombre: "Disco de corte 4.5\"", unidad: "UND", categoria: "Materiales" },
  { codigo: "MAT-007", nombre: "Disco de desbaste 4.5\"", unidad: "UND", categoria: "Materiales" },
  { codigo: "MAT-008", nombre: "Electrodo de soldadura 1/8\"", unidad: "KG", categoria: "Materiales" },
  { codigo: "MAT-009", nombre: "Pintura anticorrosiva", unidad: "GLN", categoria: "Materiales" },
  { codigo: "MAT-010", nombre: "Thinner industrial", unidad: "GLN", categoria: "Materiales" },
  { codigo: "MAT-011", nombre: "Cinta teflón 1/2\"", unidad: "UND", categoria: "Materiales" },
  { codigo: "MAT-012", nombre: "Silicona selladora", unidad: "UND", categoria: "Materiales" },
  // SEGURIDAD Y EPP
  { codigo: "EPP-001", nombre: "Casco de seguridad", unidad: "UND", categoria: "EPP" },
  { codigo: "EPP-002", nombre: "Lentes de seguridad", unidad: "UND", categoria: "EPP" },
  { codigo: "EPP-003", nombre: "Guantes de cuero", unidad: "PAR", categoria: "EPP" },
  { codigo: "EPP-004", nombre: "Guantes de nitrilo (caja x 100)", unidad: "CJ", categoria: "EPP" },
  { codigo: "EPP-005", nombre: "Botas de seguridad punta de acero", unidad: "PAR", categoria: "EPP" },
  { codigo: "EPP-006", nombre: "Chaleco reflectivo", unidad: "UND", categoria: "EPP" },
  { codigo: "EPP-007", nombre: "Arnés de seguridad", unidad: "UND", categoria: "EPP" },
  { codigo: "EPP-008", nombre: "Mascarilla respirador N95", unidad: "UND", categoria: "EPP" },
  // SERVICIOS
  { codigo: "SRV-001", nombre: "Servicio de mantenimiento preventivo", unidad: "SERV", categoria: "Servicios" },
  { codigo: "SRV-002", nombre: "Servicio de mantenimiento correctivo", unidad: "SERV", categoria: "Servicios" },
  { codigo: "SRV-003", nombre: "Servicio de transporte", unidad: "SERV", categoria: "Servicios" },
  { codigo: "SRV-004", nombre: "Servicio de alquiler de equipo", unidad: "SERV", categoria: "Servicios" },
  { codigo: "SRV-005", nombre: "Servicio de instalación", unidad: "SERV", categoria: "Servicios" },
  { codigo: "SRV-006", nombre: "Servicio de capacitación", unidad: "HRS", categoria: "Servicios" },
  { codigo: "SRV-007", nombre: "Honorarios profesionales", unidad: "SERV", categoria: "Servicios" },
  { codigo: "SRV-008", nombre: "Servicio de limpieza", unidad: "SERV", categoria: "Servicios" },
  // COMBUSTIBLES Y LUBRICANTES
  { codigo: "CMB-001", nombre: "Gasolina 97 octanos", unidad: "GLN", categoria: "Combustibles" },
  { codigo: "CMB-002", nombre: "Diesel B5", unidad: "GLN", categoria: "Combustibles" },
  { codigo: "CMB-003", nombre: "Gas GLP", unidad: "KG", categoria: "Combustibles" },
  { codigo: "CMB-004", nombre: "Aceite hidráulico ISO 46", unidad: "GLN", categoria: "Combustibles" },
  { codigo: "CMB-005", nombre: "Aceite de transmisión", unidad: "GLN", categoria: "Combustibles" },
  // OFICINA Y ADMINISTRATIVOS
  { codigo: "OFI-001", nombre: "Papel bond A4 (resma x 500)", unidad: "UND", categoria: "Oficina" },
  { codigo: "OFI-002", nombre: "Tóner impresora", unidad: "UND", categoria: "Oficina" },
  { codigo: "OFI-003", nombre: "Lapiceros (caja x 12)", unidad: "CJ", categoria: "Oficina" },
  { codigo: "OFI-004", nombre: "Folder Manila (paquete x 50)", unidad: "PAQ", categoria: "Oficina" },
  { codigo: "OFI-005", nombre: "Archivador lomo ancho", unidad: "UND", categoria: "Oficina" },
  { codigo: "OFI-006", nombre: "Cinta de embalaje", unidad: "UND", categoria: "Oficina" },
];

// Categorías únicas para filtrado
export const CATEGORIAS_CATALOGO = [...new Set(CATALOGO_ITEMS.map(i => i.categoria))].sort();

// Búsqueda en el catálogo (por código, nombre o categoría)
export const buscarEnCatalogo = (q) => {
  if (!q || q.length < 2) return [];
  const texto = q.toLowerCase();
  return CATALOGO_ITEMS.filter(
    (i) =>
      i.codigo.toLowerCase().includes(texto) ||
      i.nombre.toLowerCase().includes(texto) ||
      i.categoria.toLowerCase().includes(texto)
  ).slice(0, 15); // máximo 15 resultados
};
