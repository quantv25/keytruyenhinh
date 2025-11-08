// Lấy từ file check.txt (Kiểm tra ad-free)
import { withCors } from "../_lib/util.js";
import { sIsMember } from "../_lib/upstash.js";

export default withCors(async function handler(req, res) {
  const device = (req.query.device || "").toString().trim();
  if (!device) return res.status(400).json({ ok:false, error:"device_required" });
  // Key "adfree:devices" này được ghi bởi verify-code.js
  const yes = await sIsMember("adfree:devices", device);
  res.json({ ok:true, adfree: !!yes });
});
