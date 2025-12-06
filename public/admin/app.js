function getToken() {
  const t = document.getElementById("token").value;
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
  }).then(r => r.json());
}

// ===== ACTIONS =====
function add() {
  post("/admin/add", {
    key: key.value,
    days: days.value
  }).then(show);
}

function ban() {
  post("/admin/ban", {
    key: key.value
  }).then(show);
}

// DOWNLOAD DB (GET + HEADER)
function backup() {
  fetch("/admin/download-db", {
    headers: {
      "x-admin-token": getToken()
    }
  })
  .then(resp => resp.blob())
  .then(blob => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "license-backup.db";
    a.click();
  });
}

// OUTPUT
function show(res) {
  document.getElementById("out").textContent =
    JSON.stringify(res, null, 2);
}
