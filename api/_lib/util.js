// Lấy từ file util.txt
// Helpers chung (CORS, đọc JSON, thời gian, kỳ báo cáo theo múi giờ VN)
const TZ_OFF_MIN = parseInt(process.env.TZ_OFFSET_MINUTES || "420", 10); // +07:00

export function withCors(handler) {
  return async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Admin-Key");
    if (req.method === "OPTIONS") return res.status(204).end();
    try { await handler(req, res); }
    catch (e) {
      console.error(e);
      res.status(500).json({ ok:false, error:"internal_error" });
    }
  };
}

export async function readJson(req) {
  try {
    const bufs = [];
    for await (const c of req) bufs.push(c);
    const s = Buffer.concat(bufs).toString("utf8");
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

export function nowIso() { return new Date().toISOString(); }

function shiftByTz(d) { return new Date(d.getTime() + TZ_OFF_MIN*60000); }

export function periodKey(isoOrDate, granularity) {
  const d0 = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const d  = shiftByTz(d0);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,"0");
  const day = String(d.getUTCDate()).padStart(2,"0");
  if (granularity === "year")  return `${y}`;
  if (granularity === "month") return `${y}-${m}`;
  return `${y}-${m}-${day}`; // day
}

export function makePeriods(granularity, n) {
  const out = [];
  const today = shiftByTz(new Date());
  for (let i=n-1; i>=0; i--) {
    const d = new Date(today);
    if (granularity === "year")  d.setUTCFullYear(d.getUTCFullYear()-i, 0, 1);
    else if (granularity === "month") d.setUTCMonth(d.getUTCMonth()-i, 1);
    else d.setUTCDate(d.getUTCDate()-i);
    out.push(periodKey(d, granularity));
  }
  return out;
}

// Kiểm tra Admin Key: lấy từ header hoặc ?key=
export function requireAdmin(req, res) {
  const headerKey = (req.headers?.["x-admin-key"] ?? "").toString().trim();
  const queryKey  = (req.query?.key ?? "").toString().trim();
  const got = headerKey || queryKey;
  const expect = (process.env.ADMIN_KEY || "").toString().trim();
  if (!expect) { res.status(500).json({ ok:false, error:"ADMIN_KEY_not_configured" }); return false; }
  if (got !== expect) { res.status(401).json({ ok:false, error:"unauthorized" }); return false; }
  return true;
}
