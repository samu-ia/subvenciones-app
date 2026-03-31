const res = await fetch('https://www.infosubvenciones.es/bdnstrans/estaticos/doc/snpsap-api.json', { headers: { 'User-Agent': 'Mozilla/5.0' } });
const spec = await res.json();
// Get busqueda params
const busqueda = spec.paths['/convocatorias/busqueda']?.get;
console.log('=== /convocatorias/busqueda params ===');
(busqueda?.parameters || []).forEach(p => {
  console.log(`  ${p.name}${p.required?'*':''} (${p.in}): ${p.description ?? ''}`);
});

// Check tiposBeneficiario possible values via /beneficiarios
console.log('\n=== /beneficiarios (types) ===');
const bens = spec.paths['/beneficiarios']?.get;
(bens?.parameters || []).forEach(p => console.log(`  ${p.name}: ${p.description}`));
console.log('Response schema:', JSON.stringify(bens?.responses?.['200']?.content, null, 2).slice(0, 300));
