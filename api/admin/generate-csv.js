// V2 MỚI: Sinh mã và trả về CSV
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
    list.push({
      code,
      used: false,
      exported: true,
      exportedAt: now
    });
    newCodes.push(code);
  }

  await writeCodes(list, sha, `[V2] Generate ${n} codes for CSV`);

  // Tạo chuỗi CSV
  const csvString = "code\n" + newCodes.join("\n");

  // Trả về file CSV
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="vip_codes_${n}.csv"`);
  res.status(200).send(csvString);
});
