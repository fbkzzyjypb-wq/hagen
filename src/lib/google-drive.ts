/**
 * De få kallene mot Google Disk appen trenger: finne og lage mappen og filene sine, laste opp og ned, og rydde. Med
 * scopet `drive.file` ser appen bare filer den selv har laget, så søkene går på egne merkelapper (`appProperties`).
 */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveFile = { id: string; name?: string; modifiedTime?: string; size?: string; trashed?: boolean; appProperties?: Record<string, string> };

export class DriveError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      // uten detaljer
    }
    throw new DriveError(detail ? `Google Disk: ${detail}` : `Google Disk svarte ${res.status}.`, res.status);
  }
  return res;
}

/** Hvem som er logget inn. */
export async function driveUser(token: string): Promise<{ email?: string; name?: string }> {
  const data = (await (await call(token, `${API}/about?fields=user(emailAddress,displayName)`)).json()) as { user?: { emailAddress?: string; displayName?: string } };
  return { email: data.user?.emailAddress, name: data.user?.displayName };
}

/** Filene appen har merket med `hagen=<value>`, uten de i papirkurven. */
export async function findByTag(token: string, value: string, parent?: string): Promise<DriveFile[]> {
  const q = [`appProperties has { key='hagen' and value='${value}' }`, "trashed = false", parent ? `'${parent}' in parents` : ""].filter(Boolean).join(" and ");
  const url = `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,name,modifiedTime,size,appProperties)")}&pageSize=100&spaces=drive`;
  return ((await (await call(token, url)).json()) as { files?: DriveFile[] }).files ?? [];
}

export async function createFolder(token: string, name: string): Promise<string> {
  const body = JSON.stringify({ name, mimeType: FOLDER_MIME, appProperties: { hagen: "root" } });
  const data = (await (await call(token, `${API}/files?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" }, body })).json()) as { id: string };
  return data.id;
}

/** Metadata for en fil, eller null når den er borte (slettet av brukeren). */
export async function getFile(token: string, id: string): Promise<DriveFile | null> {
  try {
    return (await (await call(token, `${API}/files/${id}?fields=${encodeURIComponent("id,name,modifiedTime,size,trashed")}`)).json()) as DriveFile;
  } catch (err) {
    if (err instanceof DriveError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Laster opp en fil. Med `fileId` byttes innholdet i en fil som finnes (metadataene beholdes); ellers lages en ny i
 * mappen, merket så den kan finnes igjen.
 */
export async function uploadFile(
  token: string,
  file: { name: string; parent: string; tag: string; key?: string; blob: Blob; fileId?: string }
): Promise<{ id: string; modifiedTime?: string }> {
  const fields = "fields=id,modifiedTime";
  if (file.fileId) {
    const res = await call(token, `${UPLOAD}/files/${file.fileId}?uploadType=media&${fields}`, {
      method: "PATCH",
      headers: { "Content-Type": file.blob.type || "application/octet-stream" },
      body: file.blob,
    });
    return (await res.json()) as { id: string; modifiedTime?: string };
  }
  const boundary = `hagen${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: file.name, parents: [file.parent], appProperties: file.key ? { hagen: file.tag, key: file.key } : { hagen: file.tag } });
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.blob.type || "application/octet-stream"}\r\n\r\n`,
      file.blob,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );
  const res = await call(token, `${UPLOAD}/files?uploadType=multipart&${fields}`, { method: "POST", headers: { "Content-Type": body.type }, body });
  return (await res.json()) as { id: string; modifiedTime?: string };
}

export async function downloadFile(token: string, id: string): Promise<Blob> {
  return (await call(token, `${API}/files/${id}?alt=media`)).blob();
}

export async function deleteFile(token: string, id: string): Promise<void> {
  try {
    await call(token, `${API}/files/${id}`, { method: "DELETE" });
  } catch (err) {
    if (!(err instanceof DriveError && err.status === 404)) throw err;
  }
}

/** Alle filene appen har i mappen, så det som ikke brukes lenger kan ryddes bort. */
export async function listFolder(token: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const q = `'${folderId}' in parents and trashed = false`;
    const url = `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("nextPageToken,files(id,name,appProperties)")}&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const data = (await (await call(token, url)).json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}
