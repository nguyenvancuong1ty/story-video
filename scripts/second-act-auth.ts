import { createServer } from "node:http";
import { URL } from "node:url";

import { saveToken } from "./second-act-google.js";

if (await import("node:fs/promises").then(({ access }) => access(".env").then(() => true).catch(() => false))) {
  process.loadEnvFile(".env");
}

const clientId = process.env.SECOND_ACT_GOOGLE_CLIENT_ID?.trim();
const clientSecret = process.env.SECOND_ACT_GOOGLE_CLIENT_SECRET?.trim();
if (!clientId || !clientSecret) throw new Error("Set SECOND_ACT_GOOGLE_CLIENT_ID and SECOND_ACT_GOOGLE_CLIENT_SECRET first");

const redirectUri = "http://127.0.0.1:53682/oauth2callback";
const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file"
].join(" ");

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", scopes);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("Open this URL in your browser and approve access:\n");
console.log(authUrl.toString());
const code = await new Promise<string>((resolveCode, reject) => {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", redirectUri);
    if (requestUrl.pathname !== "/oauth2callback") {
      response.writeHead(404).end("Not found");
      return;
    }
    const error = requestUrl.searchParams.get("error");
    const value = requestUrl.searchParams.get("code");
    if (error || !value) {
      response.writeHead(400, { "content-type": "text/plain" }).end(`OAuth failed: ${error ?? "missing code"}`);
      reject(new Error(error ?? "Missing authorization code"));
      server.close();
      return;
    }
    response.writeHead(200, { "content-type": "text/plain" }).end("Second Act Stories authorization complete. You can close this tab.");
    resolveCode(value);
    server.close();
  });
  server.listen(53682, "127.0.0.1");
  server.on("error", reject);
});

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  })
});
const token = await tokenResponse.json();
if (!tokenResponse.ok) throw new Error(`Token exchange failed: ${JSON.stringify(token)}`);
await saveToken(token);
console.log("Google OAuth token saved successfully.");
