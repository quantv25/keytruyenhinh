// V2 MỚI: Bổ sung file bị thiếu
import { withCors } from "../../_lib/util.js";
import { hllCount } from "../../_lib/upstash.js";

export default withCors(async function handler(req, res) {
  const app = (req.query.app || "mh.q.truyenhinh").toString().trim();
  const year = parseInt(req.query.year || "0", 10) || new Date().getFullYear();

  const keys = [];
  for (let i = 1; i <= 12; i++) {
    const m = String(i).padStart(2, "0");
    keys.push(`installs:month:${year}-${m}`);
  }

  const counts = await Promise.all(keys.map(k => hllCount(k).then(x=>Number(x)||0)));
  res.json({ ok:true, year, months: counts });
});
