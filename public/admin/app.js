function addKey() {
  const key = document.getElementById("key").value;
  const days = document.getElementById("days").value;

  fetch("/admin/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": "HUTAO_ISTRI_HIRO"
    },
    body: JSON.stringify({ key, days })
  })
  .then(r => r.json())
  .then(d => {
    document.getElementById("out").textContent =
      JSON.stringify(d, null, 2);
  })
  .catch(e => alert(e));
}
