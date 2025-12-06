function token() {
  const t = document.getElementById("token").value;
  if (!t) {
    alert("Admin Token required");
    throw "NO_TOKEN";
  }
  return t;
}

function post(url, body) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token()
    },
    body: JSON.stringify(body || {})
  }).then(r => r.json());
}

function get(url) {
  return fetch(url, {
    headers: { "x-admin-token": token() }
  }).then(r => r.json());
}

function show(res) {
  document.getElementById("out").textContent =
    JSON.stringify(res, null, 2);
}

// ===== Actions =====
function add() {
  post("/admin/add", {
    key: key.value,
    days: days.value
  }).then(show);
}

function ban() {
  post("/admin/ban", { key: key.value }).then(show);
}

function unban() {
  post("/admin/unban", { key: key.value }).then(show);
}

function resetHwid() {
  post("/admin/reset-hwid", { key: key.value }).then(show);
}

function list() {
  get("/admin/list").then(show);
}
