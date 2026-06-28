// =============================================================
//  CONFIGURATIE  — vul deze twee waarden in na het opzetten van Supabase
// =============================================================
// Te vinden in je Supabase project: Settings → API
window.APP_CONFIG = {
  // Bijv. "https://abcdefgh.supabase.co"
  SUPABASE_URL: "https://JOUW-PROJECT.supabase.co",

  // De publieke "anon" key (mag in de frontend staan, is read-only beperkt)
  SUPABASE_ANON_KEY: "JOUW_SUPABASE_ANON_KEY",

  // Deadline voor inzendingen.  LET OP: het verzoek noemde "16 juli".
  // Standaard staat hier 16 juli 2026 zodat de site nu werkt; het
  // oorspronkelijke verzoek schreef 2025. Pas het jaar aan indien nodig.
  // Formaat: YYYY-MM-DDTHH:mm:ss  (lokale tijd, einde van de dag)
  DEADLINE: "2026-07-16T23:59:59",
};

// =============================================================
//  Categorieën voor het huwelijkstijdschrift (exact volgens verzoek)
// =============================================================
window.CATEGORIES = [
  "Het liefdesverhaal (hoe het begon)",
  "Toen en nu reportage (van de eerste ontmoeting tot nu)",
  "Jouw eerste herinneringen aan Jonathan",
  "Jouw eerste herinneringen aan Iris",
  "Een memorabele gebeurtenis",
  "Het liefdesverhaal in een kinderversie",
  "Vanuit het perspectief van de kat (de kat vertelt)",
  "Fotoreportage met toelichting bij de foto's",
  "Slechte fotoreportage (bewust ongemakkelijk/grappig)",
  "Kaart/route – de liefdesreis in kaart gebracht",
  "Quiz (grappige en herkenbare situaties)",
  "Rebus of kruiswoordpuzzel",
  "Relatievragen (voor het bruidspaar aan elkaar)",
  "Date-ideeën",
  "Moppentrommel",
  "ABC van hun relatie",
  'Breaking news artikel ("HET KOPPEL GAAT TROUWEN")',
  "Mythes versus feiten",
];
