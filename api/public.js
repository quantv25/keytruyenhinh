// V2 MỚI: GỘP 3 file (ping, check, verify-code) vào 1 file
import { withCors, readJson, periodKey, nowIso } from "../_lib/util.js";
import { hllAdd, sAdd, sIsMember } from "../_lib/upstash.js";
import { readCodes, writeCodes } from "../_lib/gh.js";

// --- Logic từ ping.js ---
async function handlePing(b) {
  const device = (b.device || b.deviceId || b.android_id || "").toString().trim();
  const app = (b.app || "mh.q.truyenhinh").toString().trim();
  if (!device) return { status: 400, json: { ok:false, error:"device_required" } };

  const now = new Date();
  const day = periodKey(now, "day");
  const mon = periodKey(now, "month");
  const yr  = periodKey(now, "year");

  await Promise.all([
    hllAdd(`installs:day:${day}`, device),
    hllAdd(`installs:month:${mon}`, device),
    hllAdd(`installs:year:${yr}`, device),
    sAdd(`installs:devices:${app}`, device)
  ]).catch(()=>{});

  return { status: 200, json: { ok:true, device, app, day, month:mon, year:yr } };
}

// --- Logic từ check.js ---
async function handleCheck(query) {
  const device = (query.device || "").toString().trim();
  if (!device) return { status: 400, json: { ok:false, error:"device_required" } };
  const yes = await sIsMember("adfree:devices", device);
  return { status: 200, json: { ok:true, adfree: !!yes } };
}

// --- Logic từ verify-code.js ---
async function handleVerify(b) {
  const code = (b.code || "").toString().trim();
  const deviceId = (b.deviceId || b.device || "").toString().trim();
  if (!code) return { status: 400, json: { ok:false, error:"code_required" } };
  if (!deviceId) return { status: 400, json: { ok:false, error:"device_required" } };

  if (await sIsMember("adfree:devices", deviceId)) {
    return { status: 200, json: { ok:true, adfree:true, note:"device_whitelisted" } };
  }

  const { sha, list } = await readCodes();
  const idx = list.findIndex(x => x.code?.toLowerCase() === code.toLowerCase());
  if (idx < 0) return { status: 400, json: { ok:false, error:"invalid_code" } };

  const it = list[idx];
  if (!it.usedAt) {
    it.usedAt = nowIso();
    it.usedBy = deviceId;
    it.used = true;
    list[idx] = it;
    await writeCodes(list, sha, `[V2-Gộp] verify ${it.code} by ${deviceId}`);
    await sAdd("adfree:devices", deviceId);
    return { status: 200, json: { ok:true, adfree:true, linked:true } };
  } else {
    if ((it.usedBy || "").toString() === deviceId) {
      await sAdd("adfree:devices", deviceId);
      return { status: 200, json: { ok:true, adfree:true, note:"already_linked" } };
    } else {
      return { status: 400, json: { ok:false, error:"invalid_device", usedBy: it.usedBy } };
    }
  }
}

// --- Main Handler ---
export default withCors(async function handler(req, res) {
  const action = (req.query.action || "").toString();

  try {
    // 1. PING (POST)
    if (req.method === "POST" && action === "ping") {
      const b = await readJson(req);
      const { status, json } = await handlePing(b);
      return res.status(status).json(json);
    }

    // 2. CHECK (GET)
    if (req.method === "GET" && action === "check") {
      const { status, json } = await handleCheck(req.query);
      return res.status(status).json(json);
    }

    // 3. VERIFY (POST)
    if (req.method === "POST" && action === "verify") {
      const b = await readJson(req);
      const { status, json } = await handleVerify(b);
      return res.status(status).json(json);
    }

    return res.status(404).json({ ok: false, error: "not_found" });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});
