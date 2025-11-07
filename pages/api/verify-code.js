// api/verify-code.js — LEGACY-ONLY (V1), no-ads, always HTTP 200
// Hỗ trợ: JSON / x-www-form-urlencoded / GET
// Response: { ok: boolean, adFree: boolean, message?: string }

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";
const OK_CODES = (process.env.LEGACY_OK_CODES || "1990,vip").split(',').map(s=>s.trim()).filter(Boolean);

// Tuỳ chọn: dùng Upstash Redis để giữ one-time theo thiết bị
const UP_URL = process.env.UPSTASH_REDIS_REST_URL;
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function firstNonEmpty(...vals) { for (const v of vals) if (typeof v === 'string' && v.trim()) return v.trim(); return ''; }

async function parseBody(req) {
  if (req.method === 'GET') return req.query || {};
  const ct = (req.headers['content-type'] || '').toLowerCase();
  let b = req.body;
  if (!b) {
    const chunks = [];
    for await (const c of req) chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c));
    const raw = Buffer.concat(chunks).toString('utf8');
    if (ct.includes('application/json')) { try { b = JSON.parse(raw); } catch { b = {}; } }
    else if (ct.includes('application/x-www-form-urlencoded')) { b = Object.fromEntries(new URLSearchParams(raw)); }
    else { try { b = JSON.parse(raw); } catch { b = {}; } }
  }
  return b || {};
}

async function upstash(cmd, ...args) {
  if (!UP_URL || !UP_TOKEN) return null;
  const url = `${UP_URL}/${[cmd, ...args].map(encodeURIComponent).join('/')}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UP_TOKEN}` } });
  if (!r.ok) return null;
  return r.json(); // { result: number | string }
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Cache-Control', 'no-store');

  try {
    const body = await parseBody(req);
    const code = firstNonEmpty(body.code, body.vip, body.vipCode, req.query?.code, req.query?.vip, req.query?.vipCode);
    const device = firstNonEmpty(body.device, body.deviceHash, body.device_id, req.query?.device, req.query?.deviceHash, req.query?.device_id);
    const app = firstNonEmpty(body.app, body.pkg, body.package, req.query?.app, req.query?.pkg, req.query?.package) || 'truyenhinh';

    if (!code || !device) {
      return res.status(200).json({ ok: false, adFree: false, message: 'Missing code/device' });
    }

    // Chỉ hỗ trợ mã trong LEGACY_OK_CODES (vd: 1990, vip) cho V1
    if (!OK_CODES.includes(code)) {
      return res.status(200).json({ ok: false, adFree: false, message: 'Invalid code' });
    }

    // One-time theo (code + app): cho phép 1 device/1 code (tùy chọn). Nếu không cấu hình Upstash sẽ luôn OK.
    if (UP_URL && UP_TOKEN) {
      const key = `vip:${code}:${app}`;
      // Đã dùng cho device này chưa?
      const exist = await upstash('SISMEMBER', key, device);
      if (exist && Number(exist.result) === 1) {
        return res.status(200).json({ ok: true, adFree: true, message: 'OK (repeat device)' });
      }
      // Nếu cho phép nhiều device? Ở V1 gốc là 1 lần/thiết bị ⇒ cứ SADD, không cần giới hạn số lượng ở đây.
      await upstash('SADD', key, device);
      // set TTL 365d nếu cần
      await upstash('EXPIRE', key, String(60*60*24*365));
    }

    return res.status(200).json({ ok: true, adFree: true, message: 'OK' });
  } catch (e) {
    console.error('[verify-code:v1] fatal', e?.stack || e?.message || e);
    return res.status(200).json({ ok: false, adFree: false, message: 'Server error' });
  }
};
