const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';
const ids = ['1096299', '1096368', '1096406'];
for (const id of ids) {
  try {
    const res = await fetch(`${BDNS_BASE}/convocatorias?numConv=${id}&vpd=GE`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) { console.log(`${id}: ${res.status}`); continue; }
    const d = await res.json();
    console.log(`${id}: importeMaximo=${d.importeMaximo}, importeTotal=${d.importeTotal}, presupuesto=${d.presupuesto}`);
    // Show all keys with "importe" or "presupuesto"
    Object.entries(d).filter(([k]) => k.toLowerCase().includes('importe') || k.toLowerCase().includes('presupuesto')).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  } catch(e) { console.log(`${id}: ERROR ${e.message}`); }
}
