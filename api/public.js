import { withCors, readJson, periodKey, nowIso } from './_lib/util.js';
import { hllAdd, sAdd, sIsMember } from './_lib/upstash.js';
import { readCodes, writeCodes } from './_lib/gh.js';

// HÀM MỚI: Quyết định key Upstash dựa trên SERVER_MODE
function getAdfreeSetKey() {
  const serverMode = (process.env.SERVER_MODE || "ADS").toUpperCase();
  return (serverMode === "VIP") ? "adfree:devices:vip" : "adfree:devices:ads";
}

async function handlePing(req, res) {
// ... (Giữ nguyên hàm này) ...
  const b = await readJson(req);
  const device = (b.device || b.deviceId || b.android_id || "").toString().trim();
  const app = (b.app || "default").toString().trim();
  if (!device) return res.status(400).json({ ok:false, error:"device_required" });
  const now = new Date();
  const day = periodKey(now, "day");
  const mon = periodKey(now, "month");
  const yr  = periodKey(now, "year");
  await Promise.all([
    hllAdd(`installs:day:${app}:${day}`, device),
    hllAdd(`installs:month:${app}:${mon}`, device),
    hllAdd(`installs:year:${app}:${yr}`, device),
    hllAdd(`installs:devices:${app}`, device)
  ]).catch(()=>{});
  res.json({ ok:true, device, app, day, month:mon, year:yr });
}

async function handleCheck(req, res) {
  const device = (req.query.device || "").toString().trim();
  if (!device) return res.status(400).json({ ok:false, error:"device_required" });

  // SỬA: Check cả 2 key
  const keyAds = "adfree:devices:ads";
  const keyVip = "adfree:devices:vip";
  
  const [isAds, isVip] = await Promise.all([
      sIsMember(keyAds, device),
      sIsMember(keyVip, device)
  ]);
  
  res.json({ ok:true, adfree: !!(isAds || isVip) }); // Trả về true nếu 1 trong 2 là true
}

async function handleVerify(req, res) {
  const b = await readJson(req);
  const code = (b.code || "").toString().trim();
  const deviceId = (b.deviceId || b.device || "").toString().trim();
  if (!code) return res.status(400).json({ ok:false, error:"code_required" });
  if (!deviceId) return res.status(400).json({ ok:false, error:"device_required" });

  // SỬA: Lấy key Upstash riêng (ADS hoặc VIP)
  const upstashSetKey = getAdfreeSetKey();

  if (await sIsMember(upstashSetKey, deviceId)) {
    // Sửa: Thêm "type" để app Admin biết (nếu cần)
    return res.json({ ok:true, adfree:true, type: process.env.SERVER_MODE || "ADS", note:"device_whitelisted" });
  }

  const { sha, list } = await readCodes();
  const idx = list.findIndex(x => x.code?.toLowerCase() === code.toLowerCase());
  if (idx < 0) return res.status(400).json({ ok:false, error:"invalid_code" });

  const it = list[idx];
  if (!it.usedAt) {
    it.usedAt = nowIso(); // Dùng ISO String (V2)
    it.usedBy = deviceId;
    it.used = true;
    list[idx] = it;
    
    await Promise.all([
      writeCodes(list, sha, `verify ${it.code} by ${deviceId}`),
      // SỬA: Ghi vào key riêng (ADS hoặc VIP)
      sAdd(upstashSetKey, deviceId)
    ]);
        
    return res.json({ ok:true, adfree:true, type: process.env.SERVER_MODE || "ADS", linked:true });

  } else {
    if ((it.usedBy || "").toString() === deviceId) {
      // SỬA: Ghi vào key riêng (ADS hoặc VIP)
      await sAdd(upstashSetKey, deviceId);
      return res.json({ ok:true, adfree:true, type: process.env.SERVER_MODE || "ADS", note:"already_linked" });
    } else {
      return res.status(400).json({ ok:false, error:"invalid_device", usedBy: it.usedBy });
    }
  }
}

export default withCors(async function handler(req, res) {
// ... (Giữ nguyên phần export) ...
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
