import crypto from "node:crypto";
import { withCors, readJson, tzPeriodKey } from "../_lib/util.js";
import { hllAdd } from "../_lib/upstash.js";

const sha256 = s => crypto.createHash("sha256").update(String(s)).digest("hex");

export default async function handler(req, res) {
  if (!withCors(req,res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const b = await readJson(req);
  let dev = (b.device || b.deviceId || b.device_id || b.android_id || "").toString().trim();
  if (!/^[a-f0-9]{64}$/i.test(dev)) dev = sha256(dev || (req.headers["user-agent"]||""));

  const now = new Date().toISOString();
  const day = tzPeriodKey(now, "day");
  const mon = tzPeriodKey(now, "month");
  const yr  = tzPeriodKey(now, "year");

  await Promise.all([
    hllAdd(`installs:day:${day}`, dev),
    hllAdd(`installs:month:${mon}`, dev),
    hllAdd(`installs:year:${yr}`, dev),
  ]).catch(()=>{});

  return res.status(200).json({ ok:true, device: dev });
}
