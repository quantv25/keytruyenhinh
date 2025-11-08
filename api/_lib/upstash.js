const base = () => process.env.UPSTASH_REST_URL;
const hdrs = () => ({ Authorization: `Bearer ${process.env.UPSTASH_REST_TOKEN}` });

export async function hllAdd(key, value) {
  const u = `${base()}/pfadd/${encodeURIComponent(key)}/${encodeURIComponent(value)}`;
  await fetch(u, { method:"POST", headers: hdrs() }).catch(()=>{});
}

export async function hllCount(key) {
  try {
    const u = `${base()}/pfcount/${encodeURIComponent(key)}`;
    const r = await fetch(u, { headers: hdrs() });
    const t = await r.text();
    const num = Number(t);
    return Number.isFinite(num) ? num : 0;
  } catch { return 0; }
}
