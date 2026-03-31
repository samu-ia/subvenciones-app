const BASE = 'https://www.infosubvenciones.es/bdnstrans/api';

// ID 1095989 is in our DB — it was ingested around 2026-03-25 per DB
// Let's paginate through results around that date
let found = null;
for (let page = 0; page < 30 && !found; page++) {
  const res = await fetch(`${BASE}/convocatorias/busqueda?vpd=GE&pageSize=200&page=${page}`, 
    { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
  if (!res.ok) break;
  const d = await res.json();
  const items = d.content ?? [];
  if (items.length === 0) break;
  
  const match = items.find(i => i.id === 1095989 || i.id === 1096299);
  if (match) { found = match; break; }
  
  const minId = Math.min(...items.map(i => i.id));
  process.stdout.write(`p${page}(minId=${minId}) `);
  if (minId < 1094000) break; // gone past the range
}

if (found) console.log('\nFOUND:', found);
else console.log('\nNot found');
