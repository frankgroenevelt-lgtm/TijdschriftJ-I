// =============================================================
//  Edge Function: submit-entry
//  Ontvangt het formulier + bestand, slaat metadata op in Supabase,
//  uploadt het bestand naar Google Drive en stuurt een mail via Resend.
// =============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { uploadToDrive } from "../_shared/googleDrive.ts";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// Deadline: na deze datum worden inzendingen geweigerd.
// null = geen einddatum, het formulier blijft altijd open.
// Wil je later toch een deadline? Zet bijv. new Date("2026-07-16T23:59:59+02:00")
// en houd dit gelijk aan frontend/config.js.
const DEADLINE: Date | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Methode niet toegestaan." }, 405);

  try {
    // ---- Deadline-check (server-side) ----
    if (DEADLINE && new Date() > DEADLINE) {
      return json({ error: "De inzendtermijn is gesloten." }, 403);
    }

    // ---- Formulier uitlezen ----
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();
    const categories = form.getAll("category")
      .map((c) => String(c).trim())
      .filter((c) => c.length > 0);
    const category = categories.join(", ");
    const file = form.get("file");

    if (!name || categories.length === 0) {
      return json({ error: "Naam en minstens één rubriek zijn verplicht." }, 400);
    }
    if (!(file instanceof File)) {
      return json({ error: "Er is geen bestand meegestuurd." }, 400);
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".doc") && !lower.endsWith(".docx")) {
      return json({ error: "Alleen .doc of .docx bestanden zijn toegestaan." }, 400);
    }
    if (file.size > MAX_BYTES) {
      return json({ error: "Het bestand is groter dan 20 MB." }, 400);
    }

    // ---- Bestandsnaam opbouwen: [Naam]_[Rubriek(en)]_[timestamp].ext ----
    const ext = lower.endsWith(".docx") ? "docx" : "doc";
    const stamp = timestamp();
    const catForFile = categories.map((c) => slug(c)).join("-").slice(0, 80);
    const filename = `${slug(name)}_${catForFile}_${stamp}.${ext}`;
    const mimeType = file.type ||
      (ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/msword");

    // ---- 1. Upload naar Google Drive ----
    const bytes = new Uint8Array(await file.arrayBuffer());
    const driveFileId = await uploadToDrive({
      clientId: requireEnv("GOOGLE_OAUTH_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      refreshToken: requireEnv("GOOGLE_OAUTH_REFRESH_TOKEN"),
      folderId: requireEnv("GOOGLE_DRIVE_FOLDER_ID"),
      filename,
      mimeType,
      data: bytes,
    });

    // ---- 2. Metadata opslaan in Supabase ----
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data: row, error: dbError } = await supabase
      .from("submissions")
      .insert({ name, category, filename, drive_file_id: driveFileId })
      .select()
      .single();

    if (dbError) {
      console.error("DB-fout:", dbError);
      return json({ error: "Kon de inzending niet opslaan." }, 500);
    }

    // ---- 3. Bevestigingsmail via Resend ----
    try {
      await sendEmail({ name, category, filename, createdAt: row.created_at });
    } catch (mailErr) {
      // Mail-fout mag de inzending niet laten mislukken; gewoon loggen.
      console.error("Mail-fout (inzending wel opgeslagen):", mailErr);
    }

    return json({ ok: true, id: row.id, filename });
  } catch (err) {
    console.error("Onverwachte fout:", err);
    return json({ error: "Er ging iets mis op de server. Probeer het later opnieuw." }, 500);
  }
});

// ---------- Helpers ----------
function requireEnv(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Ontbrekende environment variable: ${key}`);
  return v;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

// Maak een veilige bestandsnaam-component: diacriten weg, spaties -> _
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "onbekend";
}

async function sendEmail(p: {
  name: string;
  category: string;
  filename: string;
  createdAt: string;
}) {
  const apiKey = requireEnv("RESEND_API_KEY");
  const to = requireEnv("NOTIFICATION_EMAIL");
  const from = Deno.env.get("RESEND_FROM") || "Tijdschrift J&I <onboarding@resend.dev>";

  const tijdstip = new Date(p.createdAt).toLocaleString("nl-NL", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  });

  const subject = `Nieuwe inzending tijdschrift Jonathan & Iris – ${p.name} – ${p.category}`;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#243b20;max-width:560px;">
      <h2 style="color:#21401c;">Nieuwe inzending 🎉</h2>
      <p>Er is een nieuwe bijdrage binnengekomen voor het huwelijkstijdschrift van
         Jonathan &amp; Iris.</p>
      <table style="border-collapse:collapse;width:100%;">
        ${rowHtml("Naam indiener", p.name)}
        ${rowHtml("Rubriek(en)", p.category)}
        ${rowHtml("Tijdstip", tijdstip)}
        ${rowHtml("Bestandsnaam", p.filename)}
      </table>
      <p style="color:#6f7d68;font-size:13px;margin-top:18px;">
        Het bestand is opgeslagen in de Google Drive-map.</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    throw new Error("Resend-fout: " + (await res.text()));
  }
}

function rowHtml(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 10px;border:1px solid #dde7d6;background:#eef3ea;font-weight:bold;">${label}</td>
    <td style="padding:8px 10px;border:1px solid #dde7d6;">${escapeHtml(value)}</td>
  </tr>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
