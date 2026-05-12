import "dotenv/config";
import express from "express";
import cors from "cors";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const {
  ATLASSIAN_CLIENT_ID,
  ATLASSIAN_CLIENT_SECRET,
  REDIRECT_URI = "http://localhost:3000/auth/callback",
  APP_URL = "http://localhost:3000/UI/login.html",
} = process.env;

// In-memory state store (keyed by random state param)
const stateStore = new Map();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use("/UI", express.static(join(__dirname, "UI")));

// ── POST /auth/start ──────────────────────────────────────────────────────────
// Called by login.js when the user clicks "Continue with Atlassian".
// Returns the Atlassian OAuth authorization URL to open in the browser.
app.post("/auth/start", (req, res) => {
  if (!ATLASSIAN_CLIENT_ID) {
    return res.status(500).json({
      error: "ATLASSIAN_CLIENT_ID is not set. Copy .env.example to .env and fill in your credentials.",
    });
  }

  const state = randomBytes(16).toString("hex");
  stateStore.set(state, { createdAt: Date.now() });

  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: ATLASSIAN_CLIENT_ID,
    scope: "read:jira-work read:jira-user offline_access",
    redirect_uri: REDIRECT_URI,
    state,
    response_type: "code",
    prompt: "consent",
  });

  const authUrl = `https://auth.atlassian.com/authorize?${params}`;
  res.json({ authUrl });
});

// ── GET /auth/callback ────────────────────────────────────────────────────────
// Atlassian redirects here after the user authorises the app.
app.get("/auth/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${APP_URL}?error=${encodeURIComponent(error)}`);
  }

  if (!state || !stateStore.has(state)) {
    return res.status(400).send("Invalid or expired state parameter.");
  }

  stateStore.delete(state);

  try {
    const tokenRes = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: ATLASSIAN_CLIENT_ID,
        client_secret: ATLASSIAN_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const token = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Token exchange failed:", token);
      return res.redirect(`${APP_URL}?error=${encodeURIComponent(token.error_description || "token_error")}`);
    }

    // Fetch accessible Jira resources with the token
    const resourcesRes = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: "application/json" },
    });
    const resources = await resourcesRes.json();
    const site = resources[0];

    console.log(`✅ Connected: ${site?.name} (${site?.url})`);
    console.log(`   Access token: ${token.access_token.slice(0, 20)}…`);

    // Redirect to the dashboard (pass site info as query params for now)
    res.redirect(
      `${APP_URL}?connected=1&site=${encodeURIComponent(site?.name || "")}&url=${encodeURIComponent(site?.url || "")}`
    );
  } catch (err) {
    console.error("Auth callback error:", err);
    res.redirect(`${APP_URL}?error=server_error`);
  }
});

// ── Serve login page at root ──────────────────────────────────────────────────
app.get("/", (_, res) => res.redirect("/UI/login.html"));

app.listen(PORT, () => {
  console.log(`\n🚀 Jira MCP server running at http://localhost:${PORT}`);
  console.log(`   Login page: http://localhost:${PORT}/UI/login.html`);
  console.log(
    ATLASSIAN_CLIENT_ID
      ? `   Atlassian app: ${ATLASSIAN_CLIENT_ID}`
      : `\n⚠️  No ATLASSIAN_CLIENT_ID found — copy .env.example to .env`
  );
});
