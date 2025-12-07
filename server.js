const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============== CONFIG ===============
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const GH_TOKEN = process.env.GH_TOKEN;                 // PAT GitHub
const GH_REPO_OWNER = process.env.GH_REPO_OWNER;
const GH_REPO_NAME  = process.env.GH_REPO_NAME;
const GH_FILE_PATH  = process.env.GH_FILE_PATH;
const GH_BRANCH     = process.env.GH_BRANCH;

if (!ADMIN_TOKEN) throw new Error("ADMIN_TOKEN NOT SET");
if (!GH_TOKEN) throw new Error("GH_TOKEN NOT SET");

const GITHUB_API_BASE = "https://api.github.com";

// cache sederhana biar gak spam GitHub
let cache = {
  data: null,    // object licenses
  sha: null,     // file sha git
  loadedAt: 0
};

// =============== GITHUB HELPER ===============
async function githubGetFile() {
  const url = `${GITHUB_API_BASE}/repos/${GH_REPO_OWNER}/${GH_REPO_NAME}/contents/${GH_FILE_PATH}?ref=${GH_BRANCH}`;

  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${GH_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "ce-license-api"
    }
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error("GitHub get error: " + resp.status + " " + txt);
  }

  const json = await resp.json();
  const content = Buffer.from(json.content, "base64").toString("utf8");
  cache = {
    data: content.trim() ? JSON.parse(content) : {},
    sha: json.sha,
    loadedAt: Date.now()
  };
}

async function githubSaveFile(data) {
  const url = `${GITHUB_API_BASE}/repos/${GH_REPO_OWNER}/${GH_REPO_NAME}/contents/${GH_FILE_PATH}`;

  const content = Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64");

  const body = {
    message: "Update licenses via admin panel",
    content,
    sha: cache.sha,
    branch: GH_BRANCH
  };

  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${GH_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "ce-license-api"
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error("GitHub save error: " + resp.status + " " + txt);
  }

  const json = await resp.json();
  cache.sha = json.content.sha;
  cache.data = data;
  cache.loadedAt = Date.now();
}

async function getLicenses() {
  // reload tiap 30 detik
  if (!cache.data || Date.now() - cache.loadedAt > 30000) {
    await githubGetFile();
  }
  return cache.data;
}

// =============== ADMIN AUTH ===============
function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }
  next();
}

// =============== LICENSE CHECK (dipanggil CE) ===============
app.get("/check", async (req, res) => {
  try {
    const { key, hwid } = req.query;
    if (!key || !hwid) return res.send("ERROR|PARAM|");

    const licenses = await getLicenses();
    const lic = licenses[key];

    if (!lic)        return res.send("ERROR|NO_KEY|");
    if (lic.banned)  return res.send("ERROR|BANNED|");

    const today = new Date().toISOString().slice(0, 10);
    if (today > lic.expire) {
      return res.send("ERROR|EXPIRED|" + lic.expire);
    }

    // bind HWID
    if (!lic.hwid) {
      lic.hwid = hwid;
      await githubSaveFile(licenses);
    } else if (lic.hwid !== hwid) {
      return res.send("ERROR|HWID_MISMATCH|");
    }

    return res.send("VALID|OK|" + lic.expire);
  } catch (e) {
    console.error(e);
    return res.status(500).send("ERROR|SERVER|");
  }
});

// =============== ADMIN API ===============
app.post("/admin/add", adminAuth, async (req, res) => {
  try {
    const { key, days } = req.body;
    if (!key || !days) return res.json({ ok: false, error: "PARAM" });

    const licenses = await getLicenses();
    const d = new Date();
    d.setDate(d.getDate() + Number(days));

    licenses[key] = {
      expire: d.toISOString().slice(0, 10),
      hwid: null,
      banned: false
    };

    await githubSaveFile(licenses);
    res.json({ ok: true, action: "add", key, expire: licenses[key].expire });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "SERVER" });
  }
});

app.post("/admin/ban", adminAuth, async (req, res) => {
  try {
    const { key } = req.body;
    const licenses = await getLicenses();
    if (!licenses[key]) return res.json({ ok: false, error: "NO_KEY" });

    licenses[key].banned = true;
    await githubSaveFile(licenses);
    res.json({ ok: true, action: "ban", key });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "SERVER" });
  }
});

app.post("/admin/delete", adminAuth, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ ok: false, error: "NO_KEY" });

  try {
    const data = await getLicenses();   // ← ambil licenses.json
    if (!data[key]) {
      return res.json({
        ok: false,
        message: "License tidak ditemukan"
      });
    }

    delete data[key];                  // ← hapus key

    await saveLicenses(data);           // ← push ke GitHub

    res.json({
      ok: true,
      message: "License berhasil dihapus",
      key
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: "DELETE_FAILED"
    });
  }
});

app.post("/admin/unban", adminAuth, async (req, res) => {
  try {
    const { key } = req.body;
    const licenses = await getLicenses();
    if (!licenses[key]) return res.json({ ok: false, error: "NO_KEY" });

    licenses[key].banned = false;
    await githubSaveFile(licenses);
    res.json({ ok: true, action: "unban", key });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "SERVER" });
  }
});

app.post("/admin/reset-hwid", adminAuth, async (req, res) => {
  try {
    const { key } = req.body;
    const licenses = await getLicenses();
    if (!licenses[key]) return res.json({ ok: false, error: "NO_KEY" });

    licenses[key].hwid = null;
    await githubSaveFile(licenses);
    res.json({ ok: true, action: "reset_hwid", key });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "SERVER" });
  }
});

app.post("/admin/delete", adminAuth, async (req, res) => {
  try {
    const { key } = req.body;
    const licenses = await getLicenses();
    if (!licenses[key]) return res.json({ ok: false, error: "NO_KEY" });

    delete licenses[key];
    await githubSaveFile(licenses);
    res.json({ ok: true, action: "delete", key });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "SERVER" });
  }
});

app.get("/admin/list", adminAuth, async (req, res) => {
  try {
    const licenses = await getLicenses();
    res.json(licenses);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "SERVER" });
  }
});

// download JSON sebagai backup (opsional)
app.get("/admin/download-db", adminAuth, async (req, res) => {
  try {
    const licenses = await getLicenses();
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="licenses.json"'
    );
    res.send(JSON.stringify(licenses, null, 2));
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "SERVER" });
  }
});

// =============== STATIC FILES ===============
app.use("/script", express.static("public/script"));
app.use(express.static("public"));

app.get("/admin", (_, res) =>
  res.sendFile(path.join(__dirname, "public/admin/index.html"))
);

// =============== RUN ===============
const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log("License API running on port", PORT)
);
