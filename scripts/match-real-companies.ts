import { runMatchingForClient } from '../lib/matching/run-for-client';

const nifs = [
  'B86661756', 'A15000109', 'B15986474', 'A78980718', 'B64117805',
  'B95105489', 'A20013364', 'B27210603', 'B46675442', 'B08668821',
];

(async () => {
  for (const nif of nifs) {
    try {
      const r = await runMatchingForClient(nif);
      console.log(`✓ ${nif} → ${r.nuevos} nuevos, ${r.actualizados} actualizados, ${r.excluidos} excluidos`);
    } catch (e) {
      console.log(`✗ ${nif} — ${(e as Error).message}`);
    }
  }
  console.log('Done.');
  process.exit(0);
})();
