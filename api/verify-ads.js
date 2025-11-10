export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  const { code, device, app } = req.body || {};
  if (!code || !device) return res.status(400).json({ ok:false, error:"Missing code/device" });

  const GH_REPO   = process.env.GH_REPO   || "quantv25/keytruyenhinh";
  const GH_BRANCH = process.env.GH_BRANCH || "main";
  const GH_TOKEN  = process.env.GH_TOKEN;
  const GH_PATH   = "pachiatv/codes.json"; // <— Ads ghi ở đây

  try {
    const meta = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}?ref=${GH_BRANCH}`, {
      headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "verify-ads" }
    }).then(r => r.json());

    const obj = JSON.parse(Buffer.from(meta.content, "base64").toString("utf8"));
    const entry = obj?.codes?.[code];
    if (!entry) return res.status(404).json({ ok:false, error:"Code not found" });

    if (entry.usedBy && entry.usedBy !== device) {
      return res.status(409).json({ ok:false, error:"Code already used" });
    }

    entry.usedBy = device;
    entry.usedAt = new Date().toISOString();

    const newStr = JSON.stringify(obj, null, 2);
    const b64 = Buffer.from(newStr, "utf8").toString("base64");

    await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GH_TOKEN}`,
        "User-Agent": "verify-ads",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `verify-ads ${code} by ${device}`,
        content: b64,
        branch: GH_BRANCH,
        sha: meta.sha
      })
    }).then(r => r.json());

    return res.status(200).json({ ok:true, plan:"adfree", adfree:true, usedBy: entry.usedBy, usedAt: entry.usedAt, app });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message || "Internal error" });
  }
}
