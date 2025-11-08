// V2 MỚI: Sinh mã và trả về JSON
import { withCors, requireAdmin, readJson, nowIso } from "../../_lib/util.js";
import { readCodes, writeCodes } from "../../_lib/gh.js";

// Lấy từ file add-codes.txt cũ
function gen(existing) {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  while (true) {
    const head = letters[Math.floor(Math.random()*letters.length)];
    const tail = String(Math.floor(Math.random()*1_000_000)).padStart(6,"0");
    const code = `${head}${tail}`;
    if (!existing.has(code.toLowerCase())) return code;
  }
}

export default withCors(async function handler(req, res) {
  if (!requireAdmin(req,res)) return;
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method_not_allowed" });

  const body = await readJson(req);
  const n = Math.min(10000, Math.max(1, parseInt(body.n || "0", 10) || 0));
  if (n === 0) return res.status(400).json({ ok:false, error:"invalid_n" });

  const { sha, list } = await readCodes();
  const existing = new Set(list.map(x => x.code.toLowerCase()));
  const now = nowIso();
  const newCodes = [];

  for (let i=0; i<n; i++) {
    const code = gen(existing);
    existing.add(code.toLowerCase());
    // Thêm vào danh sách chính
    list.push({
      code,
      used: false,
      exported: true, // V2: Đánh dấu đã xuất ngay
      exportedAt: now // V2: Ghi lại thời gian xuất
    });
    // Thêm vào danh sách trả về
    newCodes.push(code);
  }

  // Ghi lại file codes.json
  await writeCodes(list, sha, `[V2] Generate ${n} codes`);

  // Trả về JSON cho app
  res.json({ ok:true, codes: newCodes });
});
