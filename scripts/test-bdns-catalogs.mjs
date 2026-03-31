const BASE = 'https://www.infosubvenciones.es/bdnstrans/api';
const regs = await fetch(`${BASE}/regiones?vpd=GE`, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then(r => r.json());
const regArr = Array.isArray(regs) ? regs : regs.content ?? [];
// Show all - what's the structure like?
console.log('Total regions:', regArr.length);
console.log('First 5:', JSON.stringify(regArr.slice(0, 5), null, 2));
// Check if there are sub-regions
const spain = regArr.filter(r => r.id === 1);
console.log('Spain entry:', JSON.stringify(spain));
// Show items 450-480 which might be Spanish CCAA
regArr.slice(450, 480).forEach(r => console.log(`  ${r.id}: ${r.descripcion}`));
