function token() {
  const t = document.getElementById("token").value;
  if (!t) {
    alert("Admin token required");
    throw "NO_TOKEN";
  }
  return t;
}

function post(url, data) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": token()
    },
    body: JSON.stringify(data)
  }).then(r => r.json());
}

function show(res) {
  document.getElementById("out").textContent =
    JSON.stringify(res, null, 2);
}

function add() {
  post("/admin/add", { key:key.value, days:days.value }).then(show);
}
function extend() {
  post("/admin/extend", { key:key.value, days:days.value }).then(show);
}
function ban(state) {
  post("/admin/ban", { key:key.value, state }).then(show);
}
function del() {
  post("/admin/delete", { key:key.value }).then(show);
}
