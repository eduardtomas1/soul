const FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const TIMEOUT_MS = 120_000;

export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly modifiedTime: string | null;
}

function authHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

async function readError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { error?: { message?: string } };
    return json.error?.message ?? `Google Drive returned ${response.status}.`;
  } catch {
    return `Google Drive returned ${response.status}.`;
  }
}

export async function findFileByName(accessToken: string, name: string): Promise<DriveFile | null> {
  const url = new URL(FILES_ENDPOINT);
  url.searchParams.set("q", `name = '${name.replace(/'/gu, "\\'")}' and trashed = false`);
  url.searchParams.set("fields", "files(id,name,modifiedTime)");
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("pageSize", "5");
  const response = await fetch(url, { headers: authHeaders(accessToken), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(await readError(response));
  const json = (await response.json()) as { files?: Array<{ id: string; name: string; modifiedTime?: string }> };
  const file = json.files?.[0];
  return file ? { id: file.id, name: file.name, modifiedTime: file.modifiedTime ?? null } : null;
}

export async function getFile(accessToken: string, id: string): Promise<DriveFile | null> {
  const url = new URL(`${FILES_ENDPOINT}/${encodeURIComponent(id)}`);
  url.searchParams.set("fields", "id,name,modifiedTime,trashed");
  const response = await fetch(url, { headers: authHeaders(accessToken), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await readError(response));
  const json = (await response.json()) as { id: string; name: string; modifiedTime?: string; trashed?: boolean };
  if (json.trashed) return null;
  return { id: json.id, name: json.name, modifiedTime: json.modifiedTime ?? null };
}

export async function createFile(accessToken: string, name: string, content: Buffer): Promise<DriveFile> {
  const boundary = `soul-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({ name, mimeType: "application/octet-stream" });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\ncontent-type: application/octet-stream\r\n\r\n`, "utf8"),
    content,
    Buffer.from(`\r\n--${boundary}--`, "utf8"),
  ]);
  const url = new URL(UPLOAD_ENDPOINT);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id,name,modifiedTime");
  const response = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(accessToken), "content-type": `multipart/related; boundary=${boundary}` },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await readError(response));
  const json = (await response.json()) as { id: string; name: string; modifiedTime?: string };
  return { id: json.id, name: json.name, modifiedTime: json.modifiedTime ?? null };
}

export async function overwriteFile(accessToken: string, id: string, content: Buffer): Promise<DriveFile> {
  const url = new URL(`${UPLOAD_ENDPOINT}/${encodeURIComponent(id)}`);
  url.searchParams.set("uploadType", "media");
  url.searchParams.set("fields", "id,name,modifiedTime");
  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...authHeaders(accessToken), "content-type": "application/octet-stream" },
    body: new Uint8Array(content),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(await readError(response));
  const json = (await response.json()) as { id: string; name: string; modifiedTime?: string };
  return { id: json.id, name: json.name, modifiedTime: json.modifiedTime ?? null };
}

export async function downloadFile(accessToken: string, id: string): Promise<Buffer> {
  const url = new URL(`${FILES_ENDPOINT}/${encodeURIComponent(id)}`);
  url.searchParams.set("alt", "media");
  const response = await fetch(url, { headers: authHeaders(accessToken), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(await readError(response));
  return Buffer.from(await response.arrayBuffer());
}
