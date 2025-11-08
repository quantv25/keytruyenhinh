// Lấy từ file admin.report.txt (Báo cáo mã VIP)
import { withCors, requireAdmin } from "../../_lib/util.js";
import { readCodes } from "../../_lib/gh.js";
import { buildSeries } from "../../_lib/report.js";

export default withCors(async function handler(req, res) {
  if (!requireAdmin(req,res)) return;
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const gran = (req.query.granularity || "day").toString();
  const n = Math.min(365, Math.max(1, parseInt(req.query.n || "30", 10) || 30));

  const { list } = await readCodes();
  const series = buildSeries(list, gran, n);
  res.json({ ok:true, data:{ series } });
});
