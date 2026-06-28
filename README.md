# Huwelijkstijdschrift Jonathan & Iris — Inzendwebsite

Een statische website (GitHub Pages) waar gasten een bijdrage (Word-bestand) kunnen
inleveren voor het huwelijkstijdschrift van Jonathan & Iris. Een Supabase Edge Function
verwerkt elke inzending: metadata in de database, het bestand naar Google Drive en een
bevestigingsmail via Resend.

De ceremoniemeesters hebben geen aparte adminpagina nodig: alle ingestuurde bestanden komen
netjes in de gedeelde **Google Drive-map** te staan (bestandsnaam `Naam_Categorie_datum.docx`),
en bij elke inzending komt er een mail binnen op `frankgroenevelt@gmail.com`.

```
huwelijkstijdschrift/
├── frontend/                 # Statische site (GitHub Pages)
│   ├── index.html            # Inzendformulier
│   ├── style.css
│   ├── app.js
│   └── config.js             # Supabase URL + anon key + deadline
├── supabase/
│   ├── migrations/
│   │   └── 0001_create_submissions.sql
│   └── functions/
│       ├── _shared/          # CORS + Google Drive helper
│       └── submit-entry/     # Verwerkt inzendingen
├── .github/workflows/deploy.yml   # Auto-deploy frontend naar Pages
├── .env.example
└── README.md
```

> ⚠️ **Let op de deadline.** De code blokkeert inzendingen na de ingestelde datum (zowel in de
> frontend als in de Edge Function). Standaard staat dit op **16 juli 2026**. Wil je een ander
> jaar/datum, pas dan **beide** plekken aan:
> - `frontend/config.js` → `DEADLINE`
> - `supabase/functions/submit-entry/index.ts` → `const DEADLINE`

---

## Inhoud

1. [Google Cloud project aanmaken](#1-google-cloud-project-aanmaken)
2. [Service Account aanmaken + credentials downloaden](#2-service-account-aanmaken--credentials-downloaden)
3. [Service Account toegang geven tot de Drive-map](#3-service-account-toegang-geven-tot-de-drive-map)
4. [Environment variables](#4-environment-variables)
5. [Supabase opzetten (database + Edge Function)](#5-supabase-opzetten-database--edge-function)
6. [Frontend deployen naar GitHub Pages](#6-frontend-deployen-naar-github-pages)
7. [De volledige flow lokaal testen](#7-de-volledige-flow-lokaal-testen)
8. [Resend e-mail instellen](#8-resend-e-mail-instellen)
9. [Belangrijke aandachtspunten](#9-belangrijke-aandachtspunten)

---

## 1. Google Cloud project aanmaken

1. Ga naar de [Google Cloud Console](https://console.cloud.google.com/).
2. Klik bovenin op de projectkiezer → **Nieuw project**.
3. Geef het een naam, bijv. `huwelijkstijdschrift`, en klik **Maken**.
4. Selecteer het nieuwe project.
5. Ga naar **APIs en services → Bibliotheek**, zoek op **Google Drive API** en klik
   **Inschakelen**.

## 2. OAuth-client aanmaken + refresh token ophalen

> Waarom OAuth en geen service account? Een service account heeft zelf **geen
> opslagquota** en kan dus geen bestanden bewaren in een persoonlijke ("Mijn Drive") map
> (fout: *"Service Accounts do not have storage quota"*). Door OAuth met je **eigen**
> Google-account te gebruiken, zijn de geüploade bestanden eigendom van jou en is dat
> probleem opgelost. De scope `drive.file` is niet-gevoelig, dus dit kan zonder Google-
> verificatie.

**2a. OAuth consent screen (Google Auth Platform):**
1. Google Cloud Console → **Google Auth Platform → Branding**: vul App name +
   support-/developer-e-mail in. Kies bij User Type **External**.
2. **Audience → Publish app → Confirm** zodat de status **In production** wordt.
   Dit voorkomt dat de refresh token na 7 dagen verloopt.

**2b. OAuth-client:**
1. **Clients → Create client → Application type: Web application**.
2. Voeg bij **Authorized redirect URIs** exact toe:
   `https://developers.google.com/oauthplayground`
3. **Create** → noteer de **Client ID** en **Client secret**.

**2c. Refresh token ophalen via de [OAuth Playground](https://developers.google.com/oauthplayground):**
1. Tandwiel ⚙️ → **Use your own OAuth credentials** → plak Client ID + Client secret.
2. Bij "Input your own scopes": `https://www.googleapis.com/auth/drive.file` →
   **Authorize APIs** → log in met het account dat eigenaar is van de Drive-map.
3. **Exchange authorization code for tokens** → kopieer de **Refresh token** (`1//…`).

Deze drie waarden (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REFRESH_TOKEN`) zet je als secrets — zie sectie 4.

## 3. De Drive-map

De doelmap is:
`https://drive.google.com/drive/folders/1jY4mEndb-xKQaBATZu1KthhElwdJaudZ`
(folder-id: `1jY4mEndb-xKQaBATZu1KthhElwdJaudZ`)

Zorg dat deze map in de **Drive van hetzelfde account** staat waarmee je in stap 2c hebt
ingelogd. Er hoeft niets gedeeld te worden — de uploads zijn immers eigendom van dat
account. De ceremoniemeesters kunnen rechtstreeks in deze map kijken.

## 4. Environment variables

Zie [`.env.example`](.env.example). Alle waarden horen als **Supabase Secrets** te staan
(productie) en/of in een lokaal `.env`-bestand (testen). **Nooit hardcoden of committen.**

| Variabele | Waar te vinden / wat |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API (publiek, mag in frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**geheim**, alleen server) |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth-client uit sectie 2b |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth-client secret uit sectie 2b (**geheim**) |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Refresh token uit sectie 2c (**geheim**) |
| `GOOGLE_DRIVE_FOLDER_ID` | `1jY4mEndb-xKQaBATZu1KthhElwdJaudZ` |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM` | Afzender, bijv. `onboarding@resend.dev` of eigen domein |
| `NOTIFICATION_EMAIL` | `frankgroenevelt@gmail.com` |

**Frontend-config los:** `SUPABASE_URL` en `SUPABASE_ANON_KEY` moeten óók in
`frontend/config.js` staan (die draait in de browser). De `service-role`-key en alle andere
secrets blijven uitsluitend server-side.

### Secrets in Supabase zetten

```bash
# Eenmalig: zet alle secrets vanuit een .env-bestand
supabase secrets set --env-file ./.env

# Of per stuk:
supabase secrets set RESEND_API_KEY="re_..."
supabase secrets set GOOGLE_DRIVE_FOLDER_ID="1jY4mEndb-xKQaBATZu1KthhElwdJaudZ"
supabase secrets set NOTIFICATION_EMAIL="frankgroenevelt@gmail.com"
supabase secrets set GOOGLE_OAUTH_CLIENT_ID="...apps.googleusercontent.com"
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="GOCSPX-..."
supabase secrets set GOOGLE_OAUTH_REFRESH_TOKEN="1//..."
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY` en `SUPABASE_SERVICE_ROLE_KEY` worden door Supabase
> automatisch in de Edge Function-omgeving geïnjecteerd; die hoef je meestal niet apart te
> zetten.

## 5. Supabase opzetten (database + Edge Function)

### 5a. Project + CLI

1. Maak een gratis project op [supabase.com](https://supabase.com).
2. Installeer de CLI: `brew install supabase/tap/supabase` (of zie de
   [docs](https://supabase.com/docs/guides/cli)).
3. Login en koppel:
   ```bash
   supabase login
   cd huwelijkstijdschrift
   supabase link --project-ref <jouw-project-ref>
   ```

### 5b. Database-tabel aanmaken

Optie A — via de CLI (gebruikt de migratie in `supabase/migrations/`):
```bash
supabase db push
```
Optie B — via de Supabase **SQL Editor**: plak de inhoud van
[`supabase/migrations/0001_create_submissions.sql`](supabase/migrations/0001_create_submissions.sql)
en voer uit.

### 5c. Edge Function deployen

```bash
# Zet eerst de secrets (zie sectie 4), daarna:
supabase functions deploy submit-entry --no-verify-jwt
```

> `--no-verify-jwt` is nodig omdat gasten geen Supabase-account hebben. De functie beschermt
> zichzelf: ze valideert de invoer, controleert de deadline en de bestandsgrootte (max 20 MB).

Het endpoint is daarna:
`POST https://<project>.supabase.co/functions/v1/submit-entry`

## 6. Frontend deployen naar GitHub Pages

> De repository wordt aangemaakt onder het account **`frankgroenevelt-lgtm`**. De map
> `frontend/` wordt automatisch gepubliceerd door de meegeleverde workflow
> [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. Vul in [`frontend/config.js`](frontend/config.js) je `SUPABASE_URL` en
   `SUPABASE_ANON_KEY` in (en eventueel de `DEADLINE`).
2. Maak op GitHub (account `frankgroenevelt-lgtm`) een **lege** nieuwe repository aan, bijv.
   `huwelijkstijdschrift` (zonder README/licentie, anders botst het met de eerste push).
3. Koppel en push het lokale project (zie de losse stap-voor-stap instructies die je hebt
   gekregen, of):
   ```bash
   cd huwelijkstijdschrift
   git remote add origin https://github.com/frankgroenevelt-lgtm/huwelijkstijdschrift.git
   git branch -M main
   git push -u origin main
   ```
4. Ga in GitHub naar **Settings → Pages** en zet **Source** op **GitHub Actions**.
5. Na de eerste workflow-run staat het formulier op
   `https://frankgroenevelt-lgtm.github.io/huwelijkstijdschrift/`.

> Geen Actions willen gebruiken? Verplaats dan de inhoud van `frontend/` naar de root (of
> naar een `docs/`-map) en kies die als Pages-bron. De Actions-route is het eenvoudigst
> omdat de bronbestanden netjes in `frontend/` blijven staan.

## 7. De volledige flow lokaal testen

### Backend lokaal
```bash
# Start de lokale Supabase-stack (Docker vereist)
supabase start

# Serveer de functie met je lokale secrets
supabase functions serve --env-file ./.env --no-verify-jwt
```
De functie draait dan op `http://localhost:54321/functions/v1/submit-entry`.

### Frontend lokaal
1. Zet in `frontend/config.js` tijdelijk:
   ```js
   SUPABASE_URL: "http://localhost:54321",
   SUPABASE_ANON_KEY: "<lokale anon key uit `supabase start`>",
   ```
2. Serveer de map (vanwege CORS/fetch geen `file://` gebruiken):
   ```bash
   cd frontend
   python3 -m http.server 5173
   ```
3. Open `http://localhost:5173` → vul het formulier in met een test-.docx.

### Wat je zou moeten zien
- ✅ Rij in de tabel `submissions` (Supabase Studio → Table editor).
- ✅ Bestand in de Google Drive-map met naam `Naam_Categorie_YYYYMMDD_HHMMSS.docx`.
- ✅ Mail bij `frankgroenevelt@gmail.com` (zie sectie 8 over Resend-test).

Snel testen zonder browser:
```bash
curl -X POST http://localhost:54321/functions/v1/submit-entry \
  -H "Authorization: Bearer <anon-key>" \
  -F "name=Anna de Vries" \
  -F "email=anna@example.com" \
  -F "category=Moppentrommel" \
  -F "file=@/pad/naar/test.docx"
```

## 8. Resend e-mail instellen

1. Maak een gratis account op [resend.com](https://resend.com) (3.000 mails/maand gratis).
2. **API Keys → Create API Key** → zet de waarde in `RESEND_API_KEY`.
3. **Testen:** met afzender `onboarding@resend.dev` kun je direct mailen, maar Resend levert
   in testmodus alleen af op het e-mailadres waarmee je je account aanmaakte. Zorg dus dat
   `NOTIFICATION_EMAIL` overeenkomt, of:
4. **Productie:** verifieer een eigen domein (Resend → Domains) en zet `RESEND_FROM` op een
   adres binnen dat domein, bijv. `Tijdschrift J&I <tijdschrift@jouwdomein.nl>`.

## 9. Belangrijke aandachtspunten

- **Secrets nooit in git.** `.gitignore` sluit `.env` (en oude `credentials.json`) al uit.
- **Service-role key** en de **OAuth client secret / refresh token** staan uitsluitend in
  Supabase Secrets, nooit in de frontend of in git.
- **Deadline** staat op twee plekken (frontend + Edge Function) — houd ze gelijk.
- **OAuth-app gepubliceerd** ("In production") houden, anders verloopt de refresh token na
  7 dagen. Raakt de token toch ongeldig, haal dan een nieuwe op via de OAuth Playground en
  werk `GOOGLE_OAUTH_REFRESH_TOKEN` bij.
- **Ceremoniemeesters** bekijken de inzendingen rechtstreeks in de Google Drive-map.
- **Max bestandsgrootte** is 20 MB (frontend + backend).

---

Gemaakt met 💚 voor Jonathan & Iris.
