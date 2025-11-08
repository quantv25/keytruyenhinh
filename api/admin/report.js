import { withCors, requireAdmin } from "../_lib/util.js";
import { ghGetFile, parseCodes } from "../_lib/gh.js";
import { calcSeries } from "../_lib/report.js";

export default async function handler(req, res) {
  if (!withCors(req,res)) return;
  if (!requireAdmin(req,res)) return;
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const gran = (req.query.granularity || "day").toString();
  const n = Math.min(365, Math.max(1, parseInt(req.query.n || "30", 10) || 30));

  let text;
  try { ({ text } = await ghGetFile()); }
  catch { return res.status(500).json({ ok:false, error:"codes_read_failed" }); }

  const map = parseCodes(text);
  const series = calcSeries(map, gran, n);

  return res.status(200).json({ ok:true, data: { series } });
}
