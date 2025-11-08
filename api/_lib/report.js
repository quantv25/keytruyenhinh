// Lấy từ file report.txt
import { periodKey, makePeriods } from "./util.js";

export function buildSeries(list, granularity, n) {
  const periods = makePeriods(granularity, n);
  const map = new Map(periods.map(p => [p, { period:p, exported:0, active:0, unused:0 }]));

  for (const it of list) {
    if (it.exportedAt) {
      const pk = periodKey(it.exportedAt, granularity);
      const row = map.get(pk); if (row) row.exported++;
    }
    if (it.usedAt) {
      const pk2 = periodKey(it.usedAt, granularity);
      const row2 = map.get(pk2); if (row2) row2.active++;
    }
  }
  for (const row of map.values()) row.unused = Math.max(0, row.exported - row.active);
  return periods.map(p => map.get(p));
}
