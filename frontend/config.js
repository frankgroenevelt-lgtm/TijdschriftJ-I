// =============================================================
//  CONFIGURATIE  — vul deze twee waarden in na het opzetten van Supabase
// =============================================================
// Te vinden in je Supabase project: Settings → API
window.APP_CONFIG = {
  // Bijv. "https://abcdefgh.supabase.co"
  SUPABASE_URL: "https://toiabwxcznmwwwefzojn.supabase.co",

  // De publieke "anon" key (mag in de frontend staan, is read-only beperkt)
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaWFid3hjem5td3d3ZWZ6b2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NDA4MDYsImV4cCI6MjA5ODIxNjgwNn0.Pzs6QnAvZVzZQY6sECS0mbmpFmS3FngzlN3DrN64qf4",

  // Deadline voor inzendingen. LEEG = geen einddatum, formulier blijft altijd open.
  // Wil je later toch een deadline? Vul dan een datum in, bijv.
  // "2026-07-16T23:59:59" (formaat YYYY-MM-DDTHH:mm:ss, lokale tijd).
  DEADLINE: "",
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
  "Overig (zelf gemaakte rubriek)",
];

// Label van de "Overig"-optie — bij aanvinken verschijnt een tekstveld
// waarin de gast zijn eigen rubrieknaam kan invullen.
window.OVERIG_LABEL = "Overig (zelf gemaakte rubriek)";
