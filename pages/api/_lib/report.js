import { tzPeriodKey, makePeriods } from "./util.js";

export function calcSeries(codesMap, gran, n) {
  const periods = makePeriods(gran, n);
  const idx = new Map(periods.map(p => [p, { period:p, exported:0, active:0, unused:0 }]));

  for (const rec of codesMap.values()) {
    if (rec.exported_at) {
      const pk = tzPeriodKey(rec.exported_at, gran);
      const row = idx.get(pk);
      if (row) row.exported++;
    }
    if (rec.used && rec.used_at) {
      const pk2 = tzPeriodKey(rec.used_at, gran);
      const row2 = idx.get(pk2);
      if (row2) row2.active++;
    }
  }
  for (const row of idx.values()) {
    row.unused = Math.max(0, row.exported - row.active);
  }
  return periods.map(p => idx.get(p));
}
