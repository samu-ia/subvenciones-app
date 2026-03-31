// Test the numConv detail for bdns IDs that do respond
const ids = ['893737', '895052', '895063'];
for (const id of ids) {
  const res = await fetch(`https://www.infosubvenciones.es/bdnstrans/api/convocatorias?numConv=${id}&vpd=GE`, 
    { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
  if (!res.ok) { console.log(`${id}: ${res.status}`); continue; }
  const d = await res.json();
  // Show all keys
  const importeFields = Object.entries(d).filter(([k]) => /importe|presupuesto|financiacion|total/i.test(k));
  console.log(`${id} (internalId=${d.id}):`);
  importeFields.forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  if (importeFields.length === 0) console.log('  (no importe fields)');
}
