import { withCors, requireAdmin, nowIso, readJson } from "../_lib/util.js";
import { ghGetFile, ghPutFile, parseCodes, serializeCodes } from "../_lib/gh.js";

function randCode(existing) {
  // Mã: 1 chữ + 6 số, loại bỏ ký tự dễ nhầm
  const letters = "abcdefghjkmnpqrstuvwxyz"; // bỏ i, l, o
  const head = letters[Math.floor(Math.random()*letters.length)];
  const tail = String(Math.floor(Math.random()*1_000_000)).padStart(6, "0");
  const c = `${head}${tail}`;
  return existing.has(c.toLowerCase()) ? randCode(existing) : c;
}

export default async function handler(req, res) {
  if (!withCors(req,res)) return;
  if (!requireAdmin(req,res)) return;
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const n = Math.min(5000, Math.max(1, parseInt(req.query.limit || "0", 10) || 0));
  if (!process.env.GITHUB_REPO) return res.status(500).json({ ok:false, error:"codes_source_not_configured" });

  let sha, text;
  try { ({ sha, text } = await ghGetFile()); }
  catch { return res.status(500).json({ ok:false, error:"codes_read_failed" }); }

  const map = parseCodes(text);
  const out = [];
  const now = nowIso();

  for (let i=0;i<n;i++) {
    const code = randCode(map);
    map.set(code.toLowerCase(), { code, used:false, exported:true, exported_at: now });
    out.push({ code });
  }

  try { await ghPutFile(serializeCodes(map), sha); }
  catch { return res.status(500).json({ ok:false, error:"codes_write_failed" }); }

  // Giữ nguyên **shape cũ** cho app: { codes: [{code}] }
  return res.status(200).json({ ok:true, codes: out });
}
