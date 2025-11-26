import { withCors, requireAdmin, readJson, nowIso, periodKey } from './_lib/util.js';
import { readCodes, writeCodes } from './_lib/gh.js';
import { buildSeries } from './_lib/report.js';

// --- Hàm Gen Code (Lấy từ file V1 cũ) ---
function gen(existing) {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  while (true) {
    const head = letters[Math.floor(Math.random()*letters.length)];
    const tail = String(Math.floor(Math.random()*1_000_000)).padStart(6,"0");
    const code = `${head}${tail}`;
    if (!existing.has(code.toLowerCase())) return code;
  }
}

// --- Xử lý các action ---

// POST /api/admin?action=generate-codes
async function handleGenerateCodes(req, res) {
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

  await writeCodes(list, sha, `[V2] Generate ${n} codes`);
  res.json({ ok:true, codes: newCodes });
}

// POST /api/admin?action=generate-csv
async function handleGenerateCsv(req, res) {
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

  const csvString = "code\n" + newCodes.join("\n");
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="vip_codes_${n}.csv"`);
  res.status(200).send(csvString);
}

// GET /api/admin?action=report&granularity=...&n=...
async function handleReport(req, res) {
  const gran = (req.query.granularity || "day").toString();
  const n = Math.min(365, Math.max(1, parseInt(req.query.n || "30", 10) || 30));

  const { list } = await readCodes();
  const series = buildSeries(list, gran, n);
  res.json({ ok:true, data:{ series } });
}

// GET /api/admin?action=list-all-codes
async function handleListAllCodes(req, res) {
  const { list } = await readCodes();
  
  // Sắp xếp lại: chưa dùng (used=false) lên đầu
  list.sort((a, b) => {
    if (a.used && !b.used) return 1;
    if (!a.used && b.used) return -1;
    return 0;
  });

  res.json({ ok: true, data: { codes: list } });
}

// POST /api/admin?action=delete-code (CHỨC NĂNG MỚI)
async function handleDeleteCode(req, res) {
  const body = await readJson(req);
  const code = String(body.code || "").trim();

  if (!code) {
    return res.status(400).json({ ok: false, error: "MISSING_CODE" });
  }

  const { sha, list } = await readCodes();
  
  // Tìm code cần xóa
  const index = list.findIndex(x => x.code?.toLowerCase() === code.toLowerCase());
  if (index < 0) {
    return res.status(404).json({ ok: false, error: "CODE_NOT_FOUND" });
  }

  const deletedCode = list[index];
  
  // Xóa code khỏi danh sách
  list.splice(index, 1);

  await writeCodes(list, sha, `[V2] Delete code ${code} (was used by: ${deletedCode.usedBy || "unused"})`);

  res.json({
    ok: true,
    message: `Đã xóa code ${code}`,
    deleted: {
      code: deletedCode.code,
      wasUsed: deletedCode.used || false,
      usedBy: deletedCode.usedBy || null,
      usedAt: deletedCode.usedAt || null
    }
  });
}

// --- Bộ định tuyến (Router) ---
export default withCors(async function handler(req, res) {
  if (!requireAdmin(req,res)) return; // Kiểm tra Admin Key trước

  const action = (req.query.action || "default").toString();

  try {
    if (req.method === 'POST') {
      switch (action) {
        case 'generate-codes':
          await handleGenerateCodes(req, res);
          break;
        case 'generate-csv':
          await handleGenerateCsv(req, res);
          break;
        case 'delete-code': // THÊM MỚI
          await handleDeleteCode(req, res);
          break;
        default:
          res.status(400).json({ ok: false, error: "invalid_action_for_post" });
      }
    } else if (req.method === 'GET') {
      switch (action) {
        case 'report':
          await handleReport(req, res);
          break;
        case 'list-all-codes':
          await handleListAllCodes(req, res);
          break;
        default:
          // Mặc định cho GET (để test key)
          res.json({ ok: true, message: "Admin key is valid." });
      }
    } else {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
    }
  } catch (e) {
    console.error(`Error in /api/admin (action=${action}):`, e);
    res.status(500).json({ ok: false, error: "internal_server_error", message: e.message });
  }
});
