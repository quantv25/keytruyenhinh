import { withCors } from "../../_lib/util.js";
import { makePeriods } from "../../_lib/util.js";
import { hllCount } from "../../_lib/upstash.js";

export default async function handler(req, res) {
  if (!withCors(req,res)) return;
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const gran = (req.query.granularity || "day").toString();
  const n = Math.min(365, Math.max(1, parseInt(req.query.n || "30", 10) || 30));
  const periods = makePeriods(gran, n);

  const keys = periods.map(p => `installs:${gran}:${p}`);
  const counts = await Promise.all(keys.map(k => hllCount(k)));

  const series = periods.map((p, i) => ({ period: p, installs: counts[i] || 0 }));
  return res.status(200).json({ ok:true, data:{ series } });
}
