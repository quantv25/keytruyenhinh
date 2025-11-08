import { withCors, requireAdmin, readJson } from "../_lib/util.js";
export default async function handler(req, res) {
  if (!withCors(req,res)) return;
  if (!requireAdmin(req,res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  await readJson(req); // bỏ qua payload
  // Vì đã đánh dấu exported khi sinh mã -> noop
  return res.status(200).json({ ok:true, note:"already_marked_when_generated" });
}
