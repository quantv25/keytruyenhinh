// GitHub file read/write (contents API)
export async function ghGetFile() {
  const { GITHUB_REPO, GITHUB_TOKEN, GITHUB_BRANCH="main", CODES_PATH } = process.env;
  const u = `https://api.github.com/repos/${GITHUB_REPO}/contents/${CODES_PATH}?ref=${GITHUB_BRANCH}`;
  const r = await fetch(u, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "User-Agent": "pachiatv-key-svc" } });
  if (!r.ok) throw new Error(`gh get ${r.status}`);
  const j = await r.json();
  const text = Buffer.from(j.content||"", j.encoding||"base64").toString("utf8");
  return { sha: j.sha, text };
}

export async function ghPutFile(newText, sha) {
  const { GITHUB_REPO, GITHUB_TOKEN, GITHUB_BRANCH="main", CODES_PATH } = process.env;
  const u = `https://api.github.com/repos/${GITHUB_REPO}/contents/${CODES_PATH}`;
  const body = {
    message: `key-svc: update ${CODES_PATH}`,
    content: Buffer.from(newText, "utf8").toString("base64"),
    branch: GITHUB_BRANCH,
    sha
  };
  const r = await fetch(u, {
    method: "PUT",
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "User-Agent": "pachiatv-key-svc", "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`gh put ${r.status}`);
  return r.json();
}

// JSON shape supported:
// ["a123456", ...]  OR  [{code, used, used_by, used_at, exported, exported_at}, ...]
export function parseCodes(text) {
  let arr; try { arr = JSON.parse(text); } catch { arr = []; }
  if (!Array.isArray(arr)) arr = [];
  const map = new Map();
  for (const it of arr) {
    if (typeof it === "string") {
      map.set(it.toLowerCase(), { code: it, used: false });
    } else if (it && typeof it === "object" && it.code) {
      const o = { code: String(it.code), used: !!it.used };
      if (it.used_by) o.used_by = String(it.used_by);
      if (it.used_at) o.used_at = String(it.used_at);
      if (it.exported) o.exported = true;
      if (it.exported_at) o.exported_at = String(it.exported_at);
      map.set(o.code.toLowerCase(), o);
    }
  }
  return map;
}

export function serializeCodes(map) {
  return JSON.stringify(Array.from(map.values()), null, 2);
}
