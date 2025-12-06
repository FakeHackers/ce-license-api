const express = require("express");
const fetch = (...a) => import("node-fetch").then(({default:f})=>f(...a));
const crypto = require("crypto");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========= CONFIG =========
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const GH_TOKEN = process.env.GITHUB_TOKEN;
const GH_REPO = process.env.GITHUB_REPO;
const GH_FILE = process.env.GITHUB_FILE;

if (!ADMIN_TOKEN || !GH_TOKEN || !GH_REPO || !GH_FILE)
  throw new Error("ENV NOT SET");

// ========= UTIL =========
const hashHWID = h =>
  crypto.createHash("sha256").update(h).digest("hex");

const GH_API = `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;

async function loadDB() {
  const r = await fetch(GH_API, {
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json"
    }
  });

  if (r.status === 404) {
    return { data: {}, sha: null };
  }

  const j = await r.json();
  const data = JSON.parse(
    Buffer.from(j.content, "base64").toString()
  );
  return { data, sha: j.sha };
}

async function saveDB(data, sha) {
  await fetch(GH_API, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "update licenses",
      content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64"),
      sha
    })
  });
}

function adminAuth(req, res, next) {
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN)
    return res.status(401).json({ error: "UNAUTHORIZED" });
  next();
}

// ========= CHECK =========
app.get("/check", async (req, res) => {
  const { key, hwid } = req.query;
  if (!key || !hwid) return res.send("ERROR|PARAM|");

  const { data, sha } = await loadDB();
  const lic = data[key];
  const now = new Date().toISOString();

  if (!lic) return res.send("ERROR|NO_KEY|");
  if (lic.banned) return res.send("ERROR|BANNED|");
  if (now.slice(0,10) > lic.expire)
    return res.send("ERROR|EXPIRED|" + lic.expire);

  const hw = hashHWID(hwid);

  if (!lic.hwid_hash) lic.hwid_hash = hw;
  else if (lic.hwid_hash !== hw)
    return res.send("ERROR|HWID_MISMATCH|");

  lic.use_count++;
  lic.last_seen = now;

  await saveDB(data, sha);
  return res.send("VALID|OK|" + lic.expire);
});

// ========= ADMIN =========
app.post("/admin/add", adminAuth, async (req, res) => {
  const { key, days } = req.body;
  const { data, sha } = await loadDB();

  const d = new Date();
  d.setDate(d.getDate() + Number(days));

  data[key] = {
    expire: d.toISOString().slice(0,10),
    hwid_hash: null,
    banned: false,
    use_count: 0,
    last_seen: null
  };

  await saveDB(data, sha);
  res.json({ ok: true });
});

app.post("/admin/ban", adminAuth, async (req, res) => {
  const { data, sha } = await loadDB();
  if (data[req.body.key]) data[req.body.key].banned = true;
  await saveDB(data, sha);
  res.json({ ok: true });
});

app.post("/admin/unban", adminAuth, async (req, res) => {
  const { data, sha } = await loadDB();
  if (data[req.body.key]) data[req.body.key].banned = false;
  await saveDB(data, sha);
  res.json({ ok: true });
});

app.post("/admin/reset-hwid", adminAuth, async (req, res) => {
  const { data, sha } = await loadDB();
  if (data[req.body.key]) data[req.body.key].hwid_hash = null;
  await saveDB(data, sha);
  res.json({ ok: true });
});

app.get("/admin/list", adminAuth, async (_, res) => {
  const { data } = await loadDB();
  res.json(data);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("API running on", PORT));
