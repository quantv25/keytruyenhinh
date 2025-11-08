// V2 MỚI: GỘP 3 file admin (generate-codes, generate-csv, report) vào 1 file
import { withCors, requireAdmin, readJson, nowIso } from "../_lib/util.js";
import { readCodes, writeCodes } from "../_lib/gh.js";
import { buildSeries } from "../_lib/report.js";

// --- Logic từ generate-codes.js ---
function gen(existing) {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  while (true) {
    const head = letters[Math.floor(Math.random()*letters.length)];
    const tail = String(Math.floor(Math.random()*1_000_000)).padStart(6,"0");
    const code = `${head}${tail}`;
    if (!existing.has(code.toLowerCase())) return code;
  }
}

async function handleGenerate(n, isCsv = false) {
  const { sha, list } = await readCodes();
  const existing = new Set(list.map(x => x.code.toLowerCase()));
  const now = nowIso();
  const newCodes = [];

  for (let i=0; i<n; i++) {
    const code = gen(existing);
    existing.add(code.toLowerCase());
    list.push({ code, used: false, exported: true, exportedAt: now });
    newCodes.push(code);
  }

  await writeCodes(list, sha, `[V2-Gộp] Generate ${n} codes (csv: ${isCsv})`);

  if (isCsv) {
    const csvString = "code\n" + newCodes.join("\n");
    return { csv: csvString };
  } else {
    return { json: { ok:true, codes: newCodes } };
  }
}

// --- Logic từ admin/report.js ---
async function handleReport(gran, n) {
  const { list } = await readCodes();
  const series = buildSeries(list, gran, n);
  return { ok:true, data:{ series } };
}

// --- Main Handler ---
export default withCors(async function handler(req, res) {
  if (!requireAdmin(req,res)) return;

  // 1. BÁO CÁO (GET)
  if (req.method === "GET") {
    const gran = (req.query.granularity || "day").toString();
    const n = Math.min(365, Math.max(1, parseInt(req.query.n || "30", 10) || 30));
    const reportData = await handleReport(gran, n);
    return res.json(reportData);
  }

  // 2. SINH MÃ (POST)
  if (req.method === "POST") {
    const body = await readJson(req);
    const n = Math.min(10000, Math.max(1, parseInt(body.n || "0", 10) || 0));
    if (n === 0) return res.status(400).json({ ok:false, error:"invalid_n" });

    // 2a. Xuất CSV
    if (req.query.action === "csv") {
      const { csv } = await handleGenerate(n, true);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="vip_codes_${n}.csv"`);
      return res.status(200).send(csv);
    }
    // 2b. Xuất JSON (Copy)
    else {
      const { json } = await handleGenerate(n, false);
      return res.json(json);
    }
  }

  // Method không hợp lệ
  return res.status(405).json({ ok:false, error:"method_not_allowed" });
});
