// V2 MỚI: Bổ sung file bị thiếu
import { withCors } from "../../_lib/util.js";
import { hllCount } from "../../_lib/upstash.js";
import { Calendar } from "../../_lib/calendar.js"; // Dùng calendar helper

export default withCors(async function handler(req, res) {
  const app = (req.query.app || "mh.q.truyenhinh").toString().trim();
  const year = parseInt(req.query.year || "0", 10) || new Date().getFullYear();
  const month = parseInt(req.query.month || "0", 10) || (new Date().getMonth() + 1);

  const daysInMonth = Calendar.getDaysInMonth(year, month);
  const keys = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const day = String(i).padStart(2, "0");
    const y = String(year);
    const m = String(month).padStart(2, "0");
    keys.push(`installs:day:${y}-${m}-${day}`);
  }

  const counts = await Promise.all(keys.map(k => hllCount(k).then(x=>Number(x)||0)));
  res.json({ ok:true, year, month, days: counts });
});
