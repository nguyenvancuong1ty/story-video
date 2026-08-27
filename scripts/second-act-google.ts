import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

export type GoogleToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  expires_at?: number;
};

const tokenPath = () => resolve(process.env.SECOND_ACT_GOOGLE_TOKEN_PATH ?? ".second-act/google-token.json");

const clientConfig = () => ({
  clientId: process.env.SECOND_ACT_GOOGLE_CLIENT_ID?.trim() ?? "",
  clientSecret: process.env.SECOND_ACT_GOOGLE_CLIENT_SECRET?.trim() ?? ""
});

export const saveToken = async (token: GoogleToken): Promise<void> => {
  const path = tokenPath();
  await mkdir(dirname(path), { recursive: true });
  const normalized = { ...token, expires_at: Date.now() + Math.max(0, (token.expires_in ?? 3600) - 60) * 1000 };
  await writeFile(path, `${JSON.stringify(normalized, null, 2)}\n`);
};

export const loadToken = async (): Promise<GoogleToken> =>
  JSON.parse(await readFile(tokenPath(), "utf8")) as GoogleToken;
const postForm = async (url: string, values: Record<string, string>): Promise<any> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Google OAuth failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
};

export const refreshAccessToken = async (token: GoogleToken): Promise<GoogleToken> => {
  if (token.expires_at && token.expires_at > Date.now() && token.access_token) return token;
  if (!token.refresh_token) throw new Error("Google token expired and has no refresh_token; run second-act:auth again");
  const { clientId, clientSecret } = clientConfig();
  if (!clientId || !clientSecret) throw new Error("Missing SECOND_ACT_GOOGLE_CLIENT_ID / SECOND_ACT_GOOGLE_CLIENT_SECRET");
  const refreshed = await postForm("https://oauth2.googleapis.com/token", {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: token.refresh_token,
    grant_type: "refresh_token"
  });
  const merged = { ...token, ...refreshed, refresh_token: token.refresh_token } as GoogleToken;
  await saveToken(merged);
  return loadToken();
};

export const googleFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const token = await refreshAccessToken(await loadToken());
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token.access_token}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) throw new Error(`Google API failed (${response.status}): ${await response.text()}`);
  return response;
};
