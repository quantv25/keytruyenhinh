// api/verify-vip.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"METHOD_NOT_ALLOWED" });

  // Parse body linh hoạt
  let body = req.body;
  if (!body || typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { body = {}; }
  }

  const code     = String(body.code || "").trim();
  const device   = String(body.device || "").trim().toLowerCase();   // 64-hex từ app
  const deviceId = String(body.deviceId || "").trim();
  const app      = String(body.app || "").trim();

  if (!code || !device) return res.status(400).json({ ok:false, error:"MISSING_FIELDS", need:["code","device"] });

  const GITHUB_REPO   = process.env.GITHUB_REPO   || "quantv25/keytruyenhinh";
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
  const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
  const GITHUB_PATH   = "vip_data/codes.json";

  const metaUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`;
  const putUrl  = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

  try {
    // Đọc file từ GitHub Contents API (cần token để ổn định)
    const meta = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "User-Agent": "verify-vip" }
    }).then(r => { if(!r.ok) throw new Error("GITHUB_GET "+r.status); return r.json(); });

    const raw = Buffer.from(meta.content, "base64").toString("utf8");
    let list;
    try { list = JSON.parse(raw); } catch { return res.status(500).json({ ok:false, error:"INVALID_JSON_FILE" }); }
    if (!Array.isArray(list)) return res.status(500).json({ ok:false, error:"CODES_JSON_MUST_BE_ARRAY" });

    const i = list.findIndex(x => String(x.code || "").toLowerCase() === code.toLowerCase());
    if (i < 0) return res.status(404).json({ ok:false, error:"CODE_NOT_FOUND" });

    const row = { ...list[i] };
    const nowUTC   = new Date().toISOString();
    const nowLocal = new Date().toLocaleString("sv-SE", {
      timeZone: "Asia/Bangkok", year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
    }).replace(' ', 'T') + "+07:00";

    // Idempotent: cùng device gọi lại => OK
    if (row.used === true && row.usedBy && row.usedBy === device) {
      return res.status(200).json({
        ok:true, plan: (row.tier || "vip"), adfree:true,
        used:true, usedBy: row.usedBy, usedAt: row.usedAt,
        usedAtLocal: row.usedAtLocal || nowLocal, tz:"Asia/Bangkok", app, deviceId
      });
    }
    // Đã dùng bởi device khác => 409
    if (row.used === true && row.usedBy && row.usedBy !== device) {
      return res.status(409).json({ ok:false, error:"CODE_ALREADY_USED", by: row.usedBy, when: row.usedAt || null });
    }

    // Cập nhật
    row.used        = true;
    row.usedBy      = device;                  // LƯU FULL 64 HEX
    row.usedByShort = device.slice(0,16);      // Lưu thêm bản rút gọn để đọc nhanh
    row.usedAt      = nowUTC;
    row.usedAtLocal = nowLocal;
    row.tz          = "Asia/Bangkok";
    row.app         = app || "mh.q.truyenhinh";
    row.deviceId    = deviceId;

    const next = list.slice();
    next[i]    = row;

    const b64 = Buffer.from(JSON.stringify(next, null, 2), "utf8").toString("base64");
    const put = await fetch(putUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "User-Agent": "verify-vip",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `verify-vip ${code} by ${row.usedByShort}`,
        content: b64,
        branch:  GITHUB_BRANCH,
        sha:     meta.sha
      })
    });
    if (!put.ok) {
      const t = await put.text();
      throw new Error("GITHUB_PUT "+put.status+" "+t);
    }

    return res.status(200).json({
      ok:true, plan:(row.tier || "vip"), adfree:true,
      used:true, usedBy: row.usedBy, usedAt: row.usedAt,
      usedAtLocal: row.usedAtLocal, tz: row.tz, app, deviceId
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e && e.message || e) });
  }
}
