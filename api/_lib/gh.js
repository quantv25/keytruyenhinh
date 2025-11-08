// Lấy từ file gh.txt
// Đọc/ghi file JSON mã trên GitHub (Contents API)
async function ghGetFileRaw() {
  const { GITHUB_REPO, GITHUB_TOKEN, GITHUB_BRANCH="main", CODES_PATH } = process.env;
  if (!GITHUB_REPO || !GITHUB_TOKEN || !CODES_PATH) {
    console.error("Missing GITHUB_REPO, GITHUB_TOKEN, or CODES_PATH");
    // Sửa lỗi: Trả về đối tượng lỗi, không throw
    return { ok: false, status: 500, error: "Missing env vars" };
  }
  const u = `https://api.github.com/repos/${GITHUB_REPO}/contents/${CODES_PATH}?ref=${GITHUB_BRANCH}`;
  const r = await fetch(u, { headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, "User-Agent":"pachiatv-key-svc" } });
  
  // SỬA LỖI: Trả về status, không throw
  if (!r.ok) {
    return { ok: false, status: r.status };
  }
  const j = await r.json();
  const text = Buffer.from(j.content||"", j.encoding||"base64").toString("utf8");
  return { ok: true, sha:j.sha, text };
}

async function ghPutFileRaw(newText, sha, message) {
  const { GITHUB_REPO, GITHUB_TOKEN, GITHUB_BRANCH="main", CODES_PATH } = process.env;
  const u = `https://api.github.com/repos/${GITHUB_REPO}/contents/${CODES_PATH}`;
  const body = {
    message: message || `update ${CODES_PATH}`,
    content: Buffer.from(newText, "utf8").toString("base64"),
    branch: GITHUB_BRANCH,
  };

  // SỬA LỖI: Chỉ thêm SHA nếu nó tồn tại (để update file)
  // Nếu SHA là null (file mới), nó sẽ tạo file mới
  if (sha) {
    body.sha = sha;
  }

  const r = await fetch(u, {
    method: "PUT",
    headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, "User-Agent":"pachiatv-key-svc", "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const errorBody = await r.text();
    console.error("ghPutFileRaw failed:", errorBody);
    throw new Error(`gh put ${r.status}: ${errorBody}`);
  }
  return r.json();
}

// Chuẩn hoá record
function norm(rec) {
  if (typeof rec === "string") return { code: rec, used: false };
  const o = { code: String(rec.code) };
  const u = !!(rec.used ?? rec.used_flag);
  o.used = u || !!rec.usedAt || !!rec.used_at;
  if (rec.usedBy   || rec.used_by)   o.usedBy   = String(rec.usedBy || rec.used_by);
  if (rec.usedAt   || rec.used_at)   o.usedAt   = String(rec.usedAt || rec.used_at);
  if (rec.exported || rec.exported_flag) o.exported = true;
  if (rec.exportedAt || rec.exported_at) o.exportedAt = String(rec.exportedAt || rec.exported_at);
  return o;
}

export async function readCodes() {
  let sha = null;
  let text = "[]";
  let list = [];

  try {
    const file = await ghGetFileRaw();
    if (file.ok) {
      // File tồn tại, đọc bình thường
      sha = file.sha;
      text = file.text;
    } else {
      // Lỗi (404, 401, v.v.),
      // Nếu là 404 (file not found), coi như file rỗng và sẽ được tạo mới lúc writeCodes
      console.warn(`ghGetFileRaw failed with status ${file.status}. Assuming new file.`);
      text = "[]"; // Mặc định là mảng rỗng
      sha = null; // Sẽ tạo file mới khi write
    }
  } catch (e) {
    console.error("Error in readCodes -> ghGetFileRaw:", e);
    text = "[]"; // Mặc định mảng rỗng nếu có lỗi
    sha = null;
  }

  try {
    // Đảm bảo text không rỗng trước khi parse
    const arr = JSON.parse(text || "[]");
    if (Array.isArray(arr)) {
      list = arr.map(norm).filter(x => x && x.code);
    }
  } catch (e) {
    console.error("Error parsing codes.json content:", text, e);
    // Giữ list = []
  }
  
  return { sha, list };
}

export async function writeCodes(list, sha, message) {
  const text = JSON.stringify(list, null, 2);
  return ghPutFileRaw(text, sha, message);
}
