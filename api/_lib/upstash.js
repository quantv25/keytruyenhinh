const U = () => ({
  url: process.env.UPSTASH_REST_URL,
  token: process.env.UPSTASH_REST_TOKEN
});
async function upstash(cmd, ...args) {
  const { url, token } = U();
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type":"application/json" },
    body: JSON.stringify({ cmd, args })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`upstash:${r.status} ${JSON.stringify(j)}`);
  return j.result;
}
export const hllAdd = (key, member) => upstash("PFADD", key, member);
export const hllCount = (key) => upstash("PFCOUNT", key);
export const sAdd = (key, member) => upstash("SADD", key, member);
export const sIsMember = (key, member) => upstash("SISMEMBER", key, member);
