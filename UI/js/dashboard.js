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

document.addEventListener("click", function () {
  closeUserMenu();
});
