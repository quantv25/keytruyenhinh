// V2 MỚI: Bổ sung file bị thiếu
import { withCors } from "../../_lib/util.js";
import { hllCount } from "../../_lib/upstash.js";

export default withCors(async function handler(req, res) {
  const app = (req.query.app || "mh.q.truyenhinh").toString().trim();
  const toYear = parseInt(req.query.to || "0", 10) || new Date().getFullYear();
  const fromYear = parseInt(req.query.from || "0", 10) || (toYear - 5);

  const keys = [];
  const yearsList = [];
  for (let y = fromYear; y <= toYear; y++) {
    keys.push(`installs:year:${y}`);
    yearsList.push(String(y));
  }

  const counts = await Promise.all(keys.map(k => hllCount(k).then(x=>Number(x)||0)));
  const series = yearsList.map((y, i) => ({ year: y, count: counts[i] || 0 }));

  res.json({ ok:true, from: fromYear, to: toYear, years: series });
});
