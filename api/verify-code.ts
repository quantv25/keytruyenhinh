// Node.js runtime on Vercel
export const config = { runtime: "nodejs" };

import type { VercelRequest, VercelResponse } from "@vercel/node";

const GH_REPO   = process.env.GH_REPO   || "quantv25/keytruyenhinh";      // đổi nếu dùng repo khác
const GH_PATH   = process.env.GH_PATH   || "pages/codes.json";
const GH_BRANCH = process.env.GH_BRANCH || "main";
const GH_TOKEN  = process.env.GH_TOKEN; // Personal Access Token có quyền repo (contents:write)

async function ghGetFile() {
  const url = `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}?ref=${GH_BRANCH}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "verify-code" } });
  if (!r.ok) throw new Error(`GH_GET ${r.status}`);
  return r.json(); // { content (base64), sha, ... }
}

async function ghPutFile(newContentBase64: string, sha: string) {
  const url = `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`;
  const body = {
    message: `verify-code update ${new Date().toISOString()}`,
    content: newContentBase64,
    branch: GH_BRANCH,
    sha
  };
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      "User-Agent": "verify-code",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`GH_PUT ${r.status} ${await r.text()}`);
  return r.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    const { code, device, app } = req.body || {};
    if (!code || !device) return res.status(400).json({ ok: false, error: "Missing code/device" });

    if (!GH_TOKEN) return res.status(500).json({ ok: false, error: "Server missing GH_TOKEN" });

    // Tải codes.json từ GitHub
    const meta = await ghGetFile();
    const jsonStr = Buffer.from(meta.content, "base64").toString("utf8");
    const data = JSON.parse(jsonStr); // { codes: { "z875380": {plan:"vip", usedBy:"", usedAt:""} } }

    const entry = data?.codes?.[code];
    if (!entry) return res.status(404).json({ ok: false, error: "Code not found" });

    // Nếu đã dùng bởi chính device này → vẫn OK (idempotent)
    if (entry.usedBy && entry.usedBy === device) {
      return res.status(200).json({ ok: true, adfree: true, usedBy: entry.usedBy, usedAt: entry.usedAt, app });
    }
    // Nếu đã dùng bởi device khác → từ chối
    if (entry.usedBy && entry.usedBy !== device) {
      return res.status(409).json({ ok: false, error: "Code already used" });
    }

    // Đánh dấu đã dùng
    entry.usedBy = device;
    entry.usedAt = new Date().toISOString();

    const newStr = JSON.stringify(data, null, 2);
    const b64 = Buffer.from(newStr, "utf8").toString("base64");
    await ghPutFile(b64, meta.sha);

    return res.status(200).json({ ok: true, adfree: true, usedBy: entry.usedBy, usedAt: entry.usedAt, app });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message || "Internal error" });
  }
}
