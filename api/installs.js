// V2 MỚI: GỘP 4 file installs (count, daily, monthly, yearly) vào 1 file
import { withCors } from "./_lib/util.js";
import { hllCount, sCard } from "./_lib/upstash.js";
import { Calendar } from "./_lib/calendar.js";

// --- Logic từ installs/count.js ---
async function handleCount(app) {
  const count = await sCard(`installs:devices:${app}`);
  return { ok:true, count: Number(count) || 0 };
}

// --- Logic từ installs/daily.js ---
async function handleDaily(app, year, month) {
  const daysInMonth = Calendar.getDaysInMonth(year, month);
  const keys = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const day = String(i).padStart(2, "0");
    const y = String(year);
    const m = String(month).padStart(2, "0");
    keys.push(`installs:day:${y}-${m}-${day}`);
  }
  const counts = await Promise.all(keys.map(k => hllCount(k).then(x=>Number(x)||0)));
  return { ok:true, year, month, days: counts };
}

// --- Logic từ installs/monthly.js ---
async function handleMonthly(app, year) {
  const keys = [];
  for (let i = 1; i <= 12; i++) {
    const m = String(i).padStart(2, "0");
    keys.push(`installs:month:${year}-${m}`);
  }
  const counts = await Promise.all(keys.map(k => hllCount(k).then(x=>Number(x)||0)));
  return { ok:true, year, months: counts };
}

// --- Logic từ installs/yearly.js ---
async function handleYearly(app, fromYear, toYear) {
  const keys = [];
  const yearsList = [];
  for (let y = fromYear; y <= toYear; y++) {
    keys.push(`installs:year:${y}`);
    yearsList.push(String(y));
  }
  const counts = await Promise.all(keys.map(k => hllCount(k).then(x=>Number(x)||0)));
  const series = yearsList.map((y, i) => ({ year: y, count: counts[i] || 0 }));
  return { ok:true, from: fromYear, to: toYear, years: series };
}

// --- Main Handler ---
export default withCors(async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const app = (req.query.app || "mh.q.truyenhinh").toString().trim();
  const reportType = (req.query.report || "count").toString();

  try {
    if (reportType === "count") {
      const data = await handleCount(app);
      return res.json(data);
    }

    if (reportType === "daily") {
      const year = parseInt(req.query.year || "0", 10) || new Date().getFullYear();
      const month = parseInt(req.query.month || "0", 10) || (new Date().getMonth() + 1);
      const data = await handleDaily(app, year, month);
      return res.json(data);
    }

    if (reportType === "monthly") {
      const year = parseInt(req.query.year || "0", 10) || new Date().getFullYear();
      const data = await handleMonthly(app, year);
      return res.json(data);
    }

    if (reportType === "yearly") {
      const toYear = parseInt(req.query.to || "0", 10) || new Date().getFullYear();
      const fromYear = parseInt(req.query.from || "0", 10) || (toYear - 5);
      const data = await handleYearly(app, fromYear, toYear);
      return res.json(data);
    }

    return res.status(400).json({ ok: false, error: "invalid_report_type" });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});
