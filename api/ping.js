// Lấy từ file ping.txt (Ghi log cài đặt)
import { withCors, readJson, periodKey } from "../_lib/util.js";
import { hllAdd, sAdd } from "../_lib/upstash.js";

export default withCors(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });
  const b = await readJson(req);
  const device = (b.device || b.deviceId || b.android_id || "").toString().trim();
  const app = (b.app || "mh.q.truyenhinh").toString().trim(); // V2: Đổi app mặc định
  if (!device) return res.status(400).json({ ok:false, error:"device_required" });

  const now = new Date();
  const day = periodKey(now, "day");
  const mon = periodKey(now, "month");
  const yr  = periodKey(now, "year");

  await Promise.all([
    hllAdd(`installs:day:${day}`, device),
    hllAdd(`installs:month:${mon}`, device),
    hllAdd(`installs:year:${yr}`, device),
    sAdd(`installs:devices:${app}`, device) // Ghi vào set theo app
  ]).catch(()=>{});

  res.json({ ok:true, device, app, day, month:mon, year:yr });
});
