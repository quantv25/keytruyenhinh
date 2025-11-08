import { withCors, requireAdmin, readJson, nowIso } from './_lib/util.js';
import { readCodes, writeCodes } from './_lib/gh.js';
import { buildSeries } from './_lib/report.js';

// --- Logic sinh mã (từ add-codes.txt) ---
function genCode(existing) {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  while (true) {
    const head = letters[Math.floor(Math.random()*letters.length)];
    const tail = String(Math.floor(Math.random()*1_000_000)).padStart(6,"0");
    const code = `${head}${tail}`;
    if (!existing.has(code.toLowerCase())) return code;
  }
}
// --- Hết logic sinh mã ---

// --- Xử lý các action ---

// GET /api/admin?report=...
async function handleGetReport(req, res) {
  const gran = (req.query.granularity || "day").toString();
  const n = Math.min(365, Math.max(1, parseInt(req.query.n || "30", 10) || 30));
  const { list } = await readCodes();
  const series = buildSeries(list, gran, n);
  res.json({ ok:true, data:{ series } });
}

// POST /api/admin (action=csv | action=codes)
async function handleGenerateCodes(req, res) {
  const body = await readJson(req);
  const n = Math.min(10000, Math.max(1, parseInt(body.n || "1", 10) || 1));
  const action = (req.query.action || "codes").toString(); // 'codes' (JSON) or 'csv'

  const { sha, list } = await readCodes();
  const existing = new Set(list.map(x => x.code.toLowerCase()));
  
  const newCodes = [];
  const now = nowIso();

  for (let i=0; i < n; i++) {
    const code = genCode(existing);
    existing.add(code.toLowerCase());
    newCodes.push(code);
    
    // Thêm vào danh sách chính (đã đánh dấu exported)
    list.push({
      code: code,
      used: false,
      exported: true,
      exportedAt: now
    });
  }

  // Ghi lại file codes.json trên GitHub
  await writeCodes(list, sha, `generate and export ${n} codes`);

  // Trả về cho app
  if (action === 'csv') {
    const csvHeader = "code\n";
    const csvBody = newCodes.join("\n");
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="vip_codes_${n}.csv"`);
    res.status(200).send(csvHeader + csvBody);
  } else {
    // Mặc định trả JSON
    res.json({ ok: true, codes: newCodes });
  }
}

// --- Bộ định tuyến (Router) ---
export default withCors(async function handler(req, res) {
  if (!requireAdmin(req, res)) return; // Check Admin Key

  try {
    if (req.method === 'GET') {
      // Mặc định là báo cáo (giống V1)
      await handleGetReport(req, res);
    } else if (req.method === 'POST') {
      // Sinh mã (V2)
      await handleGenerateCodes(req, res);
    } else {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
  } catch (e) {
    console.error("Error in /api/admin handler:", e);
    res.status(500).json({ ok: false, error: "internal_server_error", message: e.message });
  }
});
