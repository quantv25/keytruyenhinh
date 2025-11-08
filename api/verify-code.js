// api/verify-code.js
import { withCors, readJson, nowIso } from "./_lib/util.js";
import { ghGetFile, ghPutFile, parseCodes, serializeCodes } from "./_lib/gh.js";
import { sAdd, sIsMember } from "./_lib/upstash.js";

export default withCors(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });
  const body = await readJson(req);
  const code = (body.code || "").toString().trim();
  const deviceId = (body.deviceId || body.device || "").toString().trim();

  if (!code) return res.status(400).json({ ok:false, error:"code_required" });
  if (!deviceId) return res.status(400).json({ ok:false, error:"device_required" });

  // Nếu thiết bị đã có ad-free => trả OK luôn (đảm bảo cài lại vẫn không quảng cáo)
  if (await sIsMember("adfree:devices", deviceId)) {
    return res.json({ ok:true, adfree:true, note:"device_whitelisted" });
  }

  // Đọc codes.json trên GitHub
  const raw = await ghGetFile();
  const list = parseCodes(raw);

  const idx = list.findIndex(x => (x.code || "").trim() === code);
  if (idx < 0) return res.status(400).json({ ok:false, error:"invalid_code" });

  const item = list[idx];
  const usedAt = item.usedAt || "";
  const usedBy = item.usedBy || "";

  if (!usedAt) {
    // CHƯA DÙNG: gán thiết bị này
    item.usedAt = nowIso();
    item.usedBy = deviceId;
    list[idx] = item;
    await ghPutFile(serializeCodes(list), `verify ${code} by ${deviceId}`);
    await sAdd("adfree:devices", deviceId);
    return res.json({ ok:true, adfree:true, linked:true });
  } else {
    // ĐÃ DÙNG: chỉ cho cùng thiết bị
    if (usedBy === deviceId) {
      await sAdd("adfree:devices", deviceId); // đảm bảo có trong set
      return res.json({ ok:true, adfree:true, note:"already_linked" });
    } else {
      return res.status(400).json({ ok:false, error:"invalid_device", usedBy });
    }
  }
});
