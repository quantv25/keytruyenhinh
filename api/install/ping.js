// api/install/ping.js
import { withCors, readJson, tzPeriodKey } from "../_lib/util.js";
import { hllAdd, sAdd } from "../_lib/upstash.js";

export default withCors(async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  const body = await readJson(req);
  const device = (body.device || "").toString().trim();
  const app = (body.app || "PachiaTV").toString().trim();
  if (!device) return res.status(400).json({ ok: false, error: "device_required" });

  const now = new Date();
  const { day, month, year } = tzPeriodKey(now, +(process.env.TZ_OFFSET_MINUTES || 420));

  // Đếm unique theo từng kỳ
  await hllAdd(`installs:day:${day}`, device);
  await hllAdd(`installs:month:${month}`, device);
  await hllAdd(`installs:year:${year}`, device);

  // (tuỳ chọn) lưu set all devices
  await sAdd(`installs:devices:${app}`, device);

  res.json({ ok: true, device, app, day, month, year });
});
