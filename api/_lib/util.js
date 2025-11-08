// ESM helpers
export async function readJson(req) {
  try {
    const bufs = [];
    for await (const c of req) bufs.push(c);
    const s = Buffer.concat(bufs).toString("utf8");
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

export function requireAdmin(req, res) {
  const ok = (req.headers["x-admin-key"] || "") === process.env.ADMIN_KEY;
  if (!ok) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return false;
  }
  return true;
}

export function nowIso() { return new Date().toISOString(); }

export function withCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Admin-Key");
  if (req.method === "OPTIONS") { res.status(204).end(); return false; }
  return true;
}

export function tzPeriodKey(iso, gran) {
  const off = parseInt(process.env.TZ_OFFSET_MINUTES || "420", 10);
  const d = new Date(iso);
  const t = d.getTime() + off * 60000;
  const z = new Date(t);
  const y = z.getUTCFullYear();
  const m = String(z.getUTCMonth()+1).padStart(2,"0");
  const day = String(z.getUTCDate()).padStart(2,"0");
  if (gran === "year")  return `${y}`;
  if (gran === "month") return `${y}-${m}`;
  return `${y}-${m}-${day}`; // day
}

export function makePeriods(gran, n) {
  const off = parseInt(process.env.TZ_OFFSET_MINUTES || "420", 10);
  const a = [];
  let base = Date.now() + off*60000;
  for (let i=n-1; i>=0; i--) {
    const z = new Date(base);
    if (gran === "year")  { const d = new Date(z.getUTCFullYear()-i,0,1); a.push(tzPeriodKey(d.toISOString(),"year")); }
    else if (gran==="month"){ const d = new Date(z.getUTCFullYear(), z.getUTCMonth()-i, 1); a.push(tzPeriodKey(d.toISOString(),"month")); }
    else { const d = new Date(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate()-i); a.push(tzPeriodKey(d.toISOString(),"day")); }
  }
  return a;
}
