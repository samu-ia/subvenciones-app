// Test a few bdns_ids to see which ones have attached documents
const BDNS_BASE = 'https://www.infosubvenciones.es/bdnstrans/api';
const ids = ['895052', '895063', '1095895', '1096272', '1095923'];

for (const id of ids) {
  try {
    const url = `${BDNS_BASE}/convocatorias?numConv=${id}&vpd=GE`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const docs = data.documentos?.length ?? 0;
    const bases = data.urlBasesReguladoras ? '✓bases' : '';
    console.log(`${id}: internalId=${data.id}, docs=${docs} ${bases}`);
    if (docs > 0) data.documentos.forEach(d => console.log(`  → ${d.id}: ${d.descripcion} (${Math.round(d.long/1024)}KB)`));
  } catch(e) {
    console.log(`${id}: ERROR ${e.message}`);
  }
}
