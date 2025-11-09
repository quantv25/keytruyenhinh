const BASE = () => (process.env.UPSTASH_REST_URL || "").replace(/\/+$/,"");
const HDRS = () => ({ Authorization:`Bearer ${process.env.UPSTASH_REST_TOKEN}` });
const enc = s => encodeURIComponent(s);

async function call(path, method="GET") {
  const r = await fetch(`${BASE()}/${path}`, { method, headers: HDRS() });
  if (!r.ok) return null;
  const t = await r.text();
  try { return JSON.parse(t).result ?? JSON.parse(t); } catch { return t; }
}

// CÁC HÀM GỐC CỦA ANH (ĐÃ GIỮ LẠI)
export const hllAdd   = (key, member) => call(`pfadd/${enc(key)}/${enc(member)}`, "POST");
export const hllCount = (key)         => call(`pfcount/${enc(key)}`);
export const sAdd      = (key, member) => call(`sadd/${enc(key)}/${enc(member)}`, "POST");
export const sIsMember = (key, member) => call(`sismember/${enc(key)}/${enc(member)}`);

// HÀM MỚI EM THÊM VÀO (ĐỂ ĐẾM SỐ NGƯỜI BỎ QC)
export const sCard     = (key)         => call(`scard/${enc(key)}`);
