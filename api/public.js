import { withCors, readJson, periodKey } from './_lib/util.js';
import { hllAdd, sAdd, sIsMember } from './_lib/upstash.js';
import { readCodes, writeCodes } from './_lib/gh.js';

// --- Xử lý các action ---

// POST /api/public?action=ping
async function handlePing(req, res) {
  const b = await readJson(req);
  const device = (b.device || b.deviceId || b.android_id || "").toString().trim();
  const app = (b.app || "default").toString().trim(); // Dùng app ID từ request
  if (!device) return res.status(400).json({ ok:false, error:"device_required" });

  const now = new Date();
  const day = periodKey(now, "day");
  const mon = periodKey(now, "month");
  const yr  = periodKey(now, "year");

  // Ghi vào các key HLL theo app
  await Promise.all([
    hllAdd(`installs:day:${app}:${day}`, device),
    hllAdd(`installs:month:${app}:${mon}`, device),
    hllAdd(`installs:year:${app}:${yr}`, device),
    hllAdd(`installs:devices:${app}`, device) // Key tổng theo app
  ]).catch(()=>{});

  res.json({ ok:true, device, app, day, month:mon, year:yr });
}

// GET /api/public?action=check&device=...
async function handleCheck(req, res) {
  const device = (req.query.device || "").toString().trim();
  if (!device) return res.status(400).json({ ok:false, error:"device_required" });
  
  // Lưu ý: key này đang là key chung, không phân biệt app
  const yes = await sIsMember("adfree:devices", device);
  res.json({ ok:true, adfree: !!yes });
}

// POST /api/public?action=verify-code
async function handleVerify(req, res) {
  const b = await readJson(req);
  const code = (b.code || "").toString().trim();
  const deviceId = (b.deviceId || b.device || "").toString().trim();
  if (!code) return res.status(400).json({ ok:false, error:"code_required" });
  if (!deviceId) return res.status(400).json({ ok:false, error:"device_required" });

  // 1. Kiểm tra xem device đã active chưa
  if (await sIsMember("adfree:devices", deviceId)) {
    return res.json({ ok:true, adfree:true, note:"device_whitelisted" });
  }

  // 2. Đọc file code
  const { sha, list } = await readCodes();
  const idx = list.findIndex(x => x.code?.toLowerCase() === code.toLowerCase());
  if (idx < 0) return res.status(400).json({ ok:false, error:"invalid_code" });

  // 3. Xử lý code
  const it = list[idx];
  if (!it.usedAt) {
    // Code mới, kích hoạt
    it.usedAt = periodKey(new Date(), "day"); // Chỉ lưu ngày, không cần time
    it.usedBy = deviceId;
    it.used = true;
    list[idx] = it;
    
    // Ghi lại file codes.json và thêm device vào Upstash
    await Promise.all([
      writeCodes(list, sha, `verify ${it.code} by ${deviceId}`),
      sAdd("adfree:devices", deviceId)
    ]);
    
    return res.json({ ok:true, adfree:true, linked:true });
  } else {
    // Code đã dùng
    if ((it.usedBy || "").toString() === deviceId) {
      // Đã dùng bởi chính device này -> OK, thêm lại vào Upstash (phòng trường hợp mất)
      await sAdd("adfree:devices", deviceId);
      return res.json({ ok:true, adfree:true, note:"already_linked" });
    } else {
      // Đã dùng bởi device khác
      return res.status(400).json({ ok:false, error:"invalid_device", usedBy: it.usedBy });
    }
  }
}

// --- Bộ định tuyến (Router) ---
export default withCors(async function handler(req, res) {
  const action = (req.query.action || "ping").toString();

  try {
    if (req.method === 'POST') {
      switch (action) {
        case 'ping':
          await handlePing(req, res);
          break;
        case 'verify-code':
          await handleVerify(req, res);
          break;
        default:
          res.status(400).json({ ok: false, error: "invalid_action_for_post" });
      }
    } else if (req.method === 'GET') {
      switch (action) {
        case 'check':
          await handleCheck(req, res);
          break;
        default:
          res.status(400).json({ ok: false, error: "invalid_action_for_get" });
      }
    } else {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
  } catch (e) {
    console.error(`Error in /api/public (action=${action}):`, e);
    res.status(500).json({ ok: false, error: "internal_server_error", message: e.message });
  }
});
