// Lấy từ file gh.txt
// Đọc/ghi file JSON mã trên GitHub (Contents API)
async function ghGetFileRaw() {
  const { GITHUB_REPO, GITHUB_TOKEN, GITHUB_BRANCH="main", CODES_PATH } = process.env;
  const u = `https://api.github.com/repos/${GITHUB_REPO}/contents/${CODES_PATH}?ref=${GITHUB_BRANCH}`;
  const r = await fetch(u, { headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, "User-Agent":"pachiatv-key-svc" } });
  if (!r.ok) throw new Error(`gh get ${r.status}`);
  const j = await r.json();
  const text = Buffer.from(j.content||"", j.encoding||"base64").toString("utf8");
  return { sha:j.sha, text };
}

async function ghPutFileRaw(newText, sha, message) {
  const { GITHUB_REPO, GITHUB_TOKEN, GITHUB_BRANCH="main", CODES_PATH } = process.env;
  const u = `https://api.github.com/repos/${GITHUB_REPO}/contents/${CODES_PATH}`;
  const body = {
    message: message || `update ${CODES_PATH}`,
    content: Buffer.from(newText, "utf8").toString("base64"),
    branch: GITHUB_BRANCH,
    sha
  };
  const r = await fetch(u, {
    method: "PUT",
    headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, "User-Agent":"pachiatv-key-svc", "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`gh put ${r.status}`);
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
  const { sha, text } = await ghGetFileRaw();
  let arr; try { arr = JSON.parse(text); } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  const list = arr.map(norm).filter(x => x && x.code);
  return { sha, list };
}

export async function writeCodes(list, sha, message) {
  const text = JSON.stringify(list, null, 2);
  return ghPutFileRaw(text, sha, message);
}
