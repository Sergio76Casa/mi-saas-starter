// --- PDF Specific Data ---
export const PDF_PRODUCTS = [
  { id: 'cf09', name: 'COMFEE CF 09', price: 829.00, desc: 'Eficiencia A++ en refrigeración, ideal para estancias pequeñas.' },
  { id: 'cf12', name: 'COMFEE CF 12', price: 889.00, desc: 'Clasificación A++, perfecto equilibrio entre potencia y consumo.' },
  { id: 'cf18', name: 'COMFEE CF 18', price: 1139.00, desc: 'Alta capacidad de refrigeración (4601 kcal/h) para grandes espacios.' },
  { id: 'cf2x1', name: 'COMFEE CF 2X1', price: 1489.00, desc: 'Sistema multi-split para climatizar dos estancias con una unidad exterior.' },
];

export const PDF_KITS = [
  { name: 'KIT INSTALACIÓN ITE-3', price: 149.00 },
  { name: 'KIT INSTALACIÓN ITE-3 2X1', price: 249.00 },
];

export const PDF_EXTRAS = [
  { name: 'METRO LINIAL (3/8)', price: 90.00 },
  { name: 'METRO LINIAL (1/2)', price: 100.00 },
  { name: 'METRO LINIAL (5/8)', price: 110.00 },
  { name: 'MANGUERA 3x2,5mm', price: 10.00 },
  { name: 'MANGUERA 5x1,5mm', price: 10.00 },
  { name: 'TUBERÍA 1/4 - 3/8', price: 35.00 },
  { name: 'TUBERÍA 1/4 - 1/2', price: 45.00 },
  { name: 'TUBERÍA 3/8 - 5/8', price: 55.00 },
  { name: 'CANAL 60x60', price: 35.00 },
  { name: 'CANAL 80x60', price: 45.00 },
  { name: 'CANAL 100x60', price: 55.00 },
  { name: 'TRABAJOS EN ALTURA', price: 80.00 },
  { name: 'BOMBA DE CONDENSADOS', price: 180.00 },
  { name: 'TUBO CRISTAL PARA BOMBA', price: 5.00 },
  { name: 'CANAL FINA TOMA CORRIENTE', price: 20.00 },
  { name: 'CURVA EXTERIOR CANAL', price: 20.00 },
  { name: 'CURVA INTERIOR CANAL', price: 20.00 },
  { name: 'TAPA CIEGA CANAL', price: 20.00 },
  { name: 'MANO DE OBRA ADICIONAL', price: 0.00 },
];

export const FINANCING_COEFFICIENTS: Record<number, number> = {
  12: 0.087,
  24: 0.045104,
  36: 0.032206,
  48: 0.0253,
  60: 0.021183,
};