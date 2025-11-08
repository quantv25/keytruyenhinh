// Lấy từ file verify-code.txt (Kích hoạt mã)
import { withCors, readJson, nowIso } from "../_lib/util.js";
import { readCodes, writeCodes } from "../_lib/gh.js";
import { sAdd, sIsMember } from "../_lib/upstash.js";

export default withCors(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const b = await readJson(req);
  const code = (b.code || "").toString().trim();
  const deviceId = (b.deviceId || b.device || "").toString().trim();
  if (!code) return res.status(400).json({ ok:false, error:"code_required" });
  if (!deviceId) return res.status(400).json({ ok:false, error:"device_required" });

  // Nếu thiết bị đã có ad-free -> OK luôn
  if (await sIsMember("adfree:devices", deviceId)) {
    return res.json({ ok:true, adfree:true, note:"device_whitelisted" });
  }

  const { sha, list } = await readCodes();
  const idx = list.findIndex(x => x.code?.toLowerCase() === code.toLowerCase());
  if (idx < 0) return res.status(400).json({ ok:false, error:"invalid_code" });

  const it = list[idx];
  if (!it.usedAt) {
    // Kích hoạt mã lần đầu
    it.usedAt = nowIso();
    it.usedBy = deviceId;
    it.used = true;
    list[idx] = it;
    await writeCodes(list, sha, `verify ${it.code} by ${deviceId}`);
    await sAdd("adfree:devices", deviceId); // Thêm thiết bị vào set ad-free
    return res.json({ ok:true, adfree:true, linked:true });
  } else {
    // Mã đã dùng
    if ((it.usedBy || "").toString() === deviceId) {
      // Dùng đúng thiết bị cũ -> cho phép
      await sAdd("adfree:devices", deviceId); // Đảm bảo trong set
      return res.json({ ok:true, adfree:true, note:"already_linked" });
    } else {
      // Mã đã bị dùng bởi thiết bị khác
      return res.status(400).json({ ok:false, error:"invalid_device", usedBy: it.usedBy });
    }
  }
});
