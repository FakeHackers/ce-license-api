function getToken() {
  const t = document.getElementById("token").value.trim();
  if (!t) {
    alert("Admin Token required");
    throw "NO_TOKEN";
  }
  return t;
}

function post(url, data) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getToken()
    },
    body: JSON.stringify(data || {})
  })
  .then(async r => {
    const txt = await r.text();
    let json;
    try { json = JSON.parse(txt); }
    catch { json = { raw: txt }; }

    if (!r.ok) {
      throw json || { error: "HTTP_" + r.status };
    }
    return json;
  });
}

function show(res) {
  document.getElementById("out").textContent =
    JSON.stringify(res, null, 2);
}

// ==== ACTIONS ====
function addLic() {
  post("/admin/add", {
    key: document.getElementById("key").value.trim(),
    days: Number(document.getElementById("days").value || 0)
  }).then(show).catch(show);
}

function ban() {
  post("/admin/ban", {
    key: document.getElementById("key").value.trim()
  }).then(show).catch(show);
}

function delLicense() {
  if (!confirm("Delete this license?")) return;
  post("/admin/delete", {
    key: key.value
  }).then(show);
}


function unban() {
  post("/admin/unban", {
    key: document.getElementById("key").value.trim()
  }).then(show).catch(show);
}

function resetHwid() {
  post("/admin/reset-hwid", {
    key: document.getElementById("key").value.trim()
  }).then(show).catch(show);
}

// download JSON (GET + header)
function backup() {
  const token = getToken();
  fetch("/admin/download-db", {
    headers: { "x-admin-token": token }
  })
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "licenses.json";
      a.click();
    });
}
