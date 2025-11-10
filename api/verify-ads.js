export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  const { code, device, app } = req.body || {};
  if (!code || !device) return res.status(400).json({ ok:false, error:"Missing code/device" });

  const GH_REPO   = process.env.GH_REPO   || "quantv25/keytruyenhinh";
  const GH_BRANCH = process.env.GH_BRANCH || "main";
  const GH_TOKEN  = process.env.GH_TOKEN;
  const GH_PATH   = "pachiatv/codes.json";

  try {
    const meta = await fetch(
      `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}?ref=${GH_BRANCH}`,
      { headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "verify-ads" } }
    ).then(r => { if(!r.ok) throw new Error("GH_GET "+r.status); return r.json(); });

    const raw = Buffer.from(meta.content, "base64").toString("utf8");
    let list = [];
    try { list = JSON.parse(raw); } catch { return res.status(500).json({ ok:false, error:"Invalid JSON file" }); }
    if (!Array.isArray(list)) return res.status(500).json({ ok:false, error:"codes.json must be an array" });

    const i = list.findIndex(x => String(x.code).toLowerCase() === String(code).toLowerCase());
    if (i < 0) return res.status(404).json({ ok:false, error:"Code not found" });

    const devShort = String(device).slice(0,16);
    const row = list[i];

    if (row.used === true && row.usedBy && row.usedBy === devShort) {
      return res.status(200).json({ ok:true, plan:"adfree", adfree:true, used:true, usedBy:row.usedBy, usedAt:row.usedAt, app });
    }
    if (row.used === true && row.usedBy && row.usedBy !== devShort) {
      return res.status(409).json({ ok:false, error:"Code already used" });
    }

    row.used   = true;
    row.usedBy = devShort;
    row.usedAt = new Date().toISOString();

    const newStr = JSON.stringify(list, null, 2);
    const b64 = Buffer.from(newStr, "utf8").toString("base64");

    await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${GH_TOKEN}`, "User-Agent": "verify-ads", "Content-Type": "application/json" },
      body: JSON.stringify({ message:`verify-ads ${code} by ${devShort}`, content:b64, branch:GH_BRANCH, sha:meta.sha })
    }).then(r => { if(!r.ok) return r.text().then(t=>{throw new Error("GH_PUT "+r.status+" "+t)}); });

    return res.status(200).json({ ok:true, plan:"adfree", adfree:true, used:true, usedBy:row.usedBy, usedAt:row.usedAt, app });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e.message || "Internal error" });
  }
}
