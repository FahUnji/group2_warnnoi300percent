const ctaBtn = document.getElementById("cta-btn");

ctaBtn.addEventListener("click", (e) => {
  e.preventDefault();
  globalThis.location.href = "no-project.html";
});
