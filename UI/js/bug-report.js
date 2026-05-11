function showDonutTip(event, label, pct, color, tipId) {
  const tip = document.getElementById(tipId || "donutTip");
  tip.textContent = label + " · " + pct;
  tip.style.borderLeft = "3px solid " + color;
  tip.style.paddingLeft = "8px";
  tip.classList.add("visible");
  moveTip(event, tip);
  event.target.addEventListener("mousemove", function(e) { moveTip(e, tip); });
}

function hideDonutTip(tipId) {
  const tip = document.getElementById(tipId || "donutTip");
  tip.classList.remove("visible");
}

function moveTip(event, tip) {
  const el = tip || document.getElementById("donutTip");
  el.style.left = (event.clientX + 14) + "px";
  el.style.top  = (event.clientY - 10) + "px";
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
});
