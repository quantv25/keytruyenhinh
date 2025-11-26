// api/delete-code.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  // Parse body
  let body = req.body;
  if (!body || typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { body = {}; }
  }

  const code = String(body.code || "").trim();
  const adminKey = String(body.adminKey || "").trim();

  if (!code) {
    return res.status(400).json({ ok: false, error: "MISSING_CODE" });
  }

  // Kiểm tra admin key
  const expectedAdminKey = process.env.ADMIN_KEY;
  if (!expectedAdminKey || adminKey !== expectedAdminKey) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  const GITHUB_REPO = process.env.GITHUB_REPO || "quantv25/keytruyenhinh";
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_PATH = "vip_data/codes.json"; // File chứa VIP codes

  const metaUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}?ref=${GITHUB_BRANCH}`;
  const putUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

  try {
    // Đọc file từ GitHub
    const meta = await fetch(metaUrl, {
      headers: { 
        Authorization: `Bearer ${GITHUB_TOKEN}`, 
        "User-Agent": "delete-code" 
      }
    }).then(r => {
      if (!r.ok) throw new Error("GITHUB_GET " + r.status);
      return r.json();
    });

    const raw = Buffer.from(meta.content, "base64").toString("utf8");
    let list;
    try { 
      list = JSON.parse(raw); 
    } catch { 
      return res.status(500).json({ ok: false, error: "INVALID_JSON_FILE" }); 
    }
    
    if (!Array.isArray(list)) {
      return res.status(500).json({ ok: false, error: "CODES_JSON_MUST_BE_ARRAY" });
    }

    // Tìm code cần xóa
    const index = list.findIndex(x => String(x.code || "").toLowerCase() === code.toLowerCase());
    if (index < 0) {
      return res.status(404).json({ ok: false, error: "CODE_NOT_FOUND" });
    }

    const deletedCode = list[index];
    
    // Xóa code khỏi danh sách
    list.splice(index, 1);

    // Ghi lại file lên GitHub
    const b64 = Buffer.from(JSON.stringify(list, null, 2), "utf8").toString("base64");
    
    const putResponse = await fetch(putUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "User-Agent": "delete-code",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `DELETE code ${code} (was used by: ${deletedCode.usedBy || "unused"})`,
        content: b64,
        branch: GITHUB_BRANCH,
        sha: meta.sha
      })
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      throw new Error("GITHUB_PUT " + putResponse.status + " " + errorText);
    }

    return res.status(200).json({
      ok: true,
      message: `Đã xóa code ${code}`,
      deleted: {
        code: deletedCode.code,
        wasUsed: deletedCode.used || false,
        usedBy: deletedCode.usedBy || null,
        usedAt: deletedCode.usedAt || null
      }
    });

  } catch (error) {
    console.error("Delete code error:", error);
    return res.status(500).json({ 
      ok: false, 
      error: "INTERNAL_SERVER_ERROR",
      message: error.message 
    });
  }
}
