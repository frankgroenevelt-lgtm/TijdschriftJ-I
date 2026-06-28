// =============================================================
//  Google Drive upload via een Service Account (zonder externe libs).
//  We maken zelf een JWT, wisselen die in voor een access token en
//  uploaden het bestand met de Drive API v3 (multipart upload).
// =============================================================

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function base64url(input: ArrayBuffer | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("Google auth mislukt: " + JSON.stringify(data));
  }
  return data.access_token as string;
}

/**
 * Upload een bestand naar Google Drive in de opgegeven map.
 * Retourneert het Drive file-id.
 */
export async function uploadToDrive(opts: {
  serviceAccountJson: string;
  folderId: string;
  filename: string;
  mimeType: string;
  data: Uint8Array;
}): Promise<string> {
  const sa = JSON.parse(opts.serviceAccountJson) as ServiceAccount;
  // private_key kan met letterlijke \n in de env-variabele staan
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");

  const token = await getAccessToken(sa);

  const boundary = "boundary_ji_" + crypto.randomUUID();
  const metadata = { name: opts.filename, parents: [opts.folderId] };

  const pre = new TextEncoder().encode(
    `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: ${opts.mimeType}\r\n\r\n`,
  );
  const post = new TextEncoder().encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(pre.length + opts.data.length + post.length);
  body.set(pre, 0);
  body.set(opts.data, pre.length);
  body.set(post, pre.length + opts.data.length);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const result = await res.json();
  if (!res.ok || !result.id) {
    throw new Error("Drive upload mislukt: " + JSON.stringify(result));
  }
  return result.id as string;
}
