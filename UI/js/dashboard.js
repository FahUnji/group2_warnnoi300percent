const MCP_CONNECT = "http://localhost:3000/connect-project";

const connectBtn = document.getElementById("dashboard-connect-btn");
const urlInput   = document.getElementById("jiraLink");
const statusEl   = document.getElementById("dashboard-connect-status");

connectBtn.addEventListener("click", async () => {
  const projectUrl = urlInput.value.trim();
  if (!projectUrl) {
    setStatus("error", "Please enter a Jira project URL or key.");
    return;
  }

  setStatus("loading", "Connecting to Jira project…");
  connectBtn.disabled = true;

  try {
    const res = await fetch(MCP_CONNECT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectUrl }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setStatus("success", data.message || "Project connected! Loading dashboard…");
      setTimeout(() => { globalThis.location.href = data.redirectUrl || "sprint.html"; }, 1500);
    } else {
      setStatus("error", data.error || `Failed to connect (${res.status}). Check the URL and try again.`);
      connectBtn.disabled = false;
    }
  } catch {
    setStatus("error", `Could not reach MCP server at ${MCP_CONNECT}. Is it running?`);
    connectBtn.disabled = false;
  }
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") connectBtn.click();
});

function setStatus(type, message) {
  statusEl.textContent = message;
  statusEl.className = `connect-status ${type}`;
  statusEl.hidden = false;
}
