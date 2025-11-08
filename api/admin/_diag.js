// _diag.js — TẠM THỜI dùng để debug 401
export default async function handler(req, res) {
  const adminEnv = (process.env.ADMIN_KEY || "").toString();
  const headerKey = (req.headers["x-admin-key"] || "").toString().trim();
  const queryKey  = (req.query?.key || "").toString().trim();

  // Ẩn nội dung key, chỉ show độ dài + sha256 để so sánh
  const sha256 = s => await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
    .then(b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join(""));

  const [envHash, headerHash, queryHash] = await Promise.all([
    sha256(adminEnv), sha256(headerKey), sha256(queryKey)
  ]);

  res.status(200).json({
    ok: true,
    env: { set: !!adminEnv, len: adminEnv.length, sha256: envHash },
    got: {
      header: { present: !!headerKey, len: headerKey.length, sha256: headerHash },
      query:  { present: !!queryKey,  len: queryKey.length,  sha256: queryHash }
    },
    match_header: adminEnv && headerKey && adminEnv === headerKey,
    match_query:  adminEnv && queryKey  && adminEnv === queryKey
  });
}

export const config = { runtime: "nodejs18.x" };
