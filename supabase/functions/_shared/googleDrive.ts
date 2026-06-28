// =============================================================
//  Google Drive upload via OAuth (refresh token van een gewoon
//  Google-account). De bestanden zijn eigendom van dat account, dus
//  geen "service account storage quota"-probleem. Geen externe libs.
// =============================================================

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error("Google OAuth (refresh) mislukt: " + JSON.stringify(data));
  }
  return data.access_token as string;
}

/**
 * Upload een bestand naar Google Drive in de opgegeven map.
 * Retourneert het Drive file-id.
 */
export async function uploadToDrive(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
  filename: string;
  mimeType: string;
  data: Uint8Array;
}): Promise<string> {
  const token = await getAccessToken(
    opts.clientId,
    opts.clientSecret,
    opts.refreshToken,
  );

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
