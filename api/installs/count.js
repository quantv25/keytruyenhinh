// V2 MỚI: Bổ sung file bị thiếu
import { withCors } from "../../_lib/util.js";
import { sIsMember, sCard } from "../../_lib/upstash.js"; // sCard (SCOUNT)

export default withCors(async function handler(req, res) {
  const app = (req.query.app || "mh.q.truyenhinh").toString().trim();
  const count = await sCard(`installs:devices:${app}`);
  res.json({ ok:true, count: Number(count) || 0 });
});
