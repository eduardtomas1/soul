import { createHash, randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import { shell } from "electron";

export interface DriveClient {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface DriveTokens {
  readonly refreshToken: string;
  readonly accessToken: string;
  readonly expiresAt: number;
}

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const SCOPES = ["https://www.googleapis.com/auth/drive.file", "openid", "email"];
const LOGIN_TIMEOUT_MS = 5 * 60_000;

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

const SUCCESS_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Soul</title>
<style>body{font-family:system-ui;background:#f7f6f3;color:#222;display:grid;place-items:center;height:100vh;margin:0}
main{text-align:center;max-width:28rem;padding:2rem}h1{font-weight:600;font-size:1.4rem}p{color:#666}</style></head>
<body><main><h1>Soul is connected to Google Drive</h1><p>You can close this tab and return to Soul.</p></main></body></html>`;

const FAILURE_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Soul</title>
<style>body{font-family:system-ui;background:#f7f6f3;color:#222;display:grid;place-items:center;height:100vh;margin:0}
main{text-align:center;max-width:28rem;padding:2rem}h1{font-weight:600;font-size:1.4rem}p{color:#666}</style></head>
<body><main><h1>Soul could not connect</h1><p>Return to Soul and try again.</p></main></body></html>`;

export async function authorizeWithLoopback(client: DriveClient, signal?: AbortSignal): Promise<{ tokens: DriveTokens; email: string | null }> {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const state = base64Url(randomBytes(16));

  const { server, port } = await listen();
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  try {
    const code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Google sign-in timed out.")), LOGIN_TIMEOUT_MS);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Google sign-in was cancelled."));
      });
      server.on("request", (request, response) => {
        const url = new URL(request.url ?? "/", redirectUri);
        if (url.pathname !== "/callback") {
          response.writeHead(404).end();
          return;
        }
        const returnedState = url.searchParams.get("state");
        const returnedCode = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        if (error || returnedState !== state || !returnedCode) {
          response.writeHead(400, { "content-type": "text/html; charset=utf-8" }).end(FAILURE_PAGE);
          clearTimeout(timer);
          reject(new Error(error === "access_denied" ? "Access was denied in Google." : "Google returned an invalid sign-in response."));
          return;
        }
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(SUCCESS_PAGE);
        clearTimeout(timer);
        resolve(returnedCode);
      });
      const authUrl = new URL(AUTH_ENDPOINT);
      authUrl.searchParams.set("client_id", client.clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      void shell.openExternal(authUrl.toString());
    });
    const tokens = await exchangeCode(client, code, verifier, redirectUri);
    const email = await fetchEmail(tokens.accessToken);
    return { tokens, email };
  } finally {
    server.close();
  }
}

function listen(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not open a local port for Google sign-in."));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

async function exchangeCode(client: DriveClient, code: string, verifier: string, redirectUri: string): Promise<DriveTokens> {
  const body = new URLSearchParams({
    code,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const response = await fetch(TOKEN_ENDPOINT, { method: "POST", body, signal: AbortSignal.timeout(30_000) });
  const json = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!response.ok || !json.access_token || !json.refresh_token) {
    throw new Error(json.error_description ?? json.error ?? "Google did not return tokens.");
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + (json.expires_in ?? 3_600) * 1_000 - 60_000 };
}

export async function refreshAccessToken(client: DriveClient, refreshToken: string): Promise<DriveTokens> {
  const body = new URLSearchParams({
    client_id: client.clientId,
    client_secret: client.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_ENDPOINT, { method: "POST", body, signal: AbortSignal.timeout(30_000) });
  const json = (await response.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !json.access_token) {
    if (json.error === "invalid_grant") throw new Error("Google Drive access expired. Connect again.");
    throw new Error(json.error_description ?? json.error ?? "Could not refresh Google access.");
  }
  return { accessToken: json.access_token, refreshToken, expiresAt: Date.now() + (json.expires_in ?? 3_600) * 1_000 - 60_000 };
}

async function fetchEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const json = (await response.json()) as { email?: string };
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}
