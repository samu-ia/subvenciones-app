const https = require('https');
const http = require('http');

async function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'Accept': 'application/json, text/html', 'User-Agent': 'Mozilla/5.0' }, ...opts }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, ct: res.headers['content-type'] || '', body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  // 1. Ver la página HTML de una convocatoria para encontrar el PDF
  const r = await fetchUrl('https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/893737');
  const html = r.body;
  
  const pdfMatches = (html.match(/href="[^"]*\.pdf[^"]*"/gi) || []).slice(0,5);
  const docMatches = (html.match(/href="[^"]*document[^"]*"/gi) || []).slice(0,5);
  const apiMatches = [...new Set((html.match(/\/api\/[^\s"'<>]*/gi) || []))].slice(0,15);
  const extractoMatches = (html.match(/extracto[^"'<>\s]*/gi) || []).slice(0,5);
  
  console.log('pdf hrefs:', pdfMatches);
  console.log('doc hrefs:', docMatches);
  console.log('api paths:', apiMatches);
  console.log('extracto:', extractoMatches);

  // 2. Probar el endpoint real de extracto de la API
  const r2 = await fetchUrl('https://www.infosubvenciones.es/bdnstrans/api/convocatorias/893737/extracto');
  console.log('extracto api:', r2.status, r2.ct, r2.body.substring(0,200));
  
  // 3. El extracto en PDF via la URL del sistema antiguo
  const r3 = await fetchUrl('https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/893737/extracto');
  console.log('extracto html:', r3.status, r3.ct, 'len:', r3.body.length);
  if (r3.status === 200) {
    const pdfLinks = (r3.body.match(/href="[^"]*"/gi) || []).slice(0,10);
    console.log('links en extracto:', pdfLinks);
  }
}
main().catch(console.error);
