function toggleSprint(rowEl) {
  const card = rowEl.closest(".sprint-card");
  card.classList.toggle("expanded");
}

function toggleExportMenu(event) {
  event.stopPropagation();
  document.getElementById("exportMenu").classList.toggle("open");
}

function closeExportMenu() {
  document.getElementById("exportMenu").classList.remove("open");
}

document.addEventListener("click", function () {
  closeExportMenu();
  closeUserMenu();
});

function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById("userMenu").classList.toggle("open");
}

function closeUserMenu() {
  const menu = document.getElementById("userMenu");
  if (menu) menu.classList.remove("open");
}

function handleLogout() {
  globalThis.location.href = "login.html";
}
