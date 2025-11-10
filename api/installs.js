import { withCors } from './_lib/util.js';
import { hllCount, sCard } from './_lib/upstash.js'; // Đã import sCard
import { getCalendarKeys, getYearlyKeys } from './_lib/calendar.js';

async function handleCount(req, res) {
// ... (Giữ nguyên hàm này) ...
  const app = (req.query.app || "default").toString();
  const key = `installs:devices:${app}`;
  const count = await hllCount(key).then(x => Number(x) || 0);
  res.json({ ok: true, data: { count } });
}

async function handleCountAdfree(req, res) {
  // SỬA: Đọc key dựa trên SERVER_MODE của chính server
  const serverMode = (process.env.SERVER_MODE || "ADS").toUpperCase();
  const upstashSetKey = (serverMode === "VIP") ? "adfree:devices:vip" : "adfree:devices:ads";
  
  const count = await sCard(upstashSetKey).then(x => Number(x) || 0);
  res.json({ ok: true, data: { count } });
}

async function handleDaily(req, res) {
// ... (Giữ nguyên hàm này) ...
  const app = (req.query.app || "default").toString();
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || (new Date().getMonth() + 1);
  
  const { keys, labels } = getCalendarKeys(year, month, 'day', app);
  const counts = await Promise.all(keys.map(k => hllCount(k).then(x => Number(x) || 0)));
  const series = labels.map((label, i) => ({ period: label, installs: counts[i] || 0 }));
  
  res.json({ ok: true, data: { year, month, series } });
}

async function handleMonthly(req, res) {
// ... (Giữ nguyên hàm này) ...
  const app = (req.query.app || "default").toString();
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const { keys, labels } = getCalendarKeys(year, null, 'month', app);
  const counts = await Promise.all(keys.map(k => hllCount(k).then(x => Number(x) || 0)));
  const series = labels.map((label, i) => ({ period: label, installs: counts[i] || 0 }));
  
  res.json({ ok: true, data: { year, series } });
}

async function handleYearly(req, res) {
// ... (Giữ nguyên hàm này) ...
  const app = (req.query.app || "default").toString();
  const toYear = parseInt(req.query.to, 10) || new Date().getFullYear();
  const fromYear = parseInt(req.query.from, 10) || (toYear - 5);
  const { keys, labels } = getYearlyKeys(fromYear, toYear, app);
  const counts = await Promise.all(keys.map(k => hllCount(k).then(x => Number(x) || 0)));
  const series = labels.map((label, i) => ({ period: label, installs: counts[i] || 0 }));
  res.json({ ok: true, data: { from: fromYear, to: toYear, series } });
}

export default withCors(async function handler(req, res) {
// ... (Giữ nguyên phần export, case 'count-adfree' đã đúng) ...
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  const reportType = (req.query.report || "count").toString();
  try {
    switch (reportType) {
      case 'count':
        await handleCount(req, res);
        break;
      case 'count-adfree':
        await handleCountAdfree(req, res);
        break;
      case 'daily':
        await handleDaily(req, res);
        break;
      case 'monthly':
        await handleMonthly(req, res);
        break;
      case 'yearly':
        await handleYearly(req, res);
        break;
      default:
        res.status(400).json({ ok: false, error: "invalid_report_type" });
    }
  } catch (e) {
    console.error(`Error in /api/installs (report=${reportType}):`, e);
    res.status(500).json({ ok: false, error: "internal_server_error", message: e.message });
  }
});
