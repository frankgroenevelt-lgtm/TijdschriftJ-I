/* =============================================================
   Huwelijkstijdschrift Jonathan & Iris — formulierlogica
   ============================================================= */
(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const categories = window.CATEGORIES || [];
  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

  const els = {
    formCard: document.getElementById("formCard"),
    closedCard: document.getElementById("closedCard"),
    deadlineText: document.getElementById("deadlineText"),
    form: document.getElementById("entryForm"),
    name: document.getElementById("name"),
    categoryGrid: document.getElementById("categoryGrid"),
    file: document.getElementById("file"),
    fileDrop: document.getElementById("fileDrop"),
    fileDropText: document.getElementById("fileDropText"),
    submitBtn: document.getElementById("submitBtn"),
    status: document.getElementById("formStatus"),
    overlay: document.getElementById("uploadOverlay"),
  };

  const selectedCategories = new Set();

  /* ---------- Deadline ---------- */
  function deadlineLabel() {
    const d = new Date(cfg.DEADLINE);
    if (isNaN(d)) return "16 juli";
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
  }

  function isClosed() {
    const d = new Date(cfg.DEADLINE);
    if (isNaN(d)) return false;
    return new Date() > d;
  }

  /* ---------- Categorie-kaarten opbouwen ---------- */
  function buildCategories() {
    categories.forEach((label, i) => {
      const card = document.createElement("div");
      card.className = "category-card";
      card.setAttribute("role", "checkbox");
      card.setAttribute("aria-checked", "false");
      card.tabIndex = 0;
      card.innerHTML =
        '<span class="category-card__num">' + (i + 1) + "</span>" +
        '<span class="category-card__dot"></span>' +
        "<span>" + escapeHtml(label) + "</span>";

      function toggle() {
        if (selectedCategories.has(label)) {
          selectedCategories.delete(label);
          card.classList.remove("selected");
          card.setAttribute("aria-checked", "false");
        } else {
          selectedCategories.add(label);
          card.classList.add("selected");
          card.setAttribute("aria-checked", "true");
        }
        clearError("category");
      }
      card.addEventListener("click", toggle);
      card.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
      });
      els.categoryGrid.appendChild(card);
    });
  }

  /* ---------- Bestand-keuze ---------- */
  function wireFileInput() {
    els.file.addEventListener("change", () => updateFileLabel(els.file.files[0]));

    ["dragenter", "dragover"].forEach((evt) =>
      els.fileDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        els.fileDrop.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      els.fileDrop.addEventListener(evt, (e) => {
        e.preventDefault();
        els.fileDrop.classList.remove("dragover");
      })
    );
    els.fileDrop.addEventListener("drop", (e) => {
      const f = e.dataTransfer.files[0];
      if (f) {
        els.file.files = e.dataTransfer.files;
        updateFileLabel(f);
      }
    });
  }

  function updateFileLabel(file) {
    if (!file) {
      els.fileDropText.textContent = "Klik om een bestand te kiezen of sleep het hierheen";
      els.fileDrop.classList.remove("has-file");
      return;
    }
    els.fileDropText.textContent = file.name + "  (" + formatBytes(file.size) + ")";
    els.fileDrop.classList.add("has-file");
    clearError("file");
  }

  /* ---------- Validatie ---------- */
  function validate() {
    let ok = true;
    clearAllErrors();

    if (!els.name.value.trim()) { setError("name", "Vul je naam in."); ok = false; }

    if (selectedCategories.size === 0) {
      setError("category", "Kies minstens één rubriek."); ok = false;
    }

    const file = els.file.files[0];
    if (!file) { setError("file", "Kies een Word-bestand om te uploaden."); ok = false; }
    else {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".doc") && !name.endsWith(".docx")) {
        setError("file", "Alleen .doc of .docx bestanden zijn toegestaan."); ok = false;
      } else if (file.size > MAX_BYTES) {
        setError("file", "Het bestand is groter dan 20 MB."); ok = false;
      }
    }
    return ok;
  }

  /* ---------- Verzenden ---------- */
  async function handleSubmit(e) {
    e.preventDefault();
    hideStatus();
    if (!validate()) return;

    if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("JOUW-PROJECT")) {
      showStatus("error", "De website is nog niet volledig geconfigureerd (Supabase). " +
        "Neem contact op met de ceremoniemeesters.");
      return;
    }

    const fd = new FormData();
    fd.append("name", els.name.value.trim());
    selectedCategories.forEach((cat) => fd.append("category", cat));
    fd.append("file", els.file.files[0]);

    setLoading(true);
    try {
      const res = await fetch(cfg.SUPABASE_URL + "/functions/v1/submit-entry", {
        method: "POST",
        headers: { Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Er ging iets mis bij het versturen (" + res.status + ").");
      }

      els.form.reset();
      selectedCategories.clear();
      document.querySelectorAll(".category-card").forEach((c) => {
        c.classList.remove("selected");
        c.setAttribute("aria-checked", "false");
      });
      updateFileLabel(null);
      showStatus("success", "Gelukt! 🎉 Je bijdrage is ontvangen. Dankjewel! " +
        "Wil je nog een stukje insturen? Vul het formulier gerust nog een keer in.");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (err) {
      showStatus("error", (err && err.message) ||
        "Er ging iets mis. Probeer het later opnieuw of mail de ceremoniemeesters.");
    } finally {
      setLoading(false);
    }
  }

  /* ---------- UI helpers ---------- */
  function setLoading(on) {
    els.submitBtn.disabled = on;
    els.submitBtn.classList.toggle("loading", on);
    els.submitBtn.querySelector(".submit-btn__label").textContent =
      on ? "Bezig met uploaden…" : "Verstuur mijn bijdrage";
    els.overlay.hidden = !on;
  }
  function setError(field, msg) {
    const p = document.querySelector('[data-error-for="' + field + '"]');
    if (p) p.textContent = msg;
    if (p && p.closest(".field")) p.closest(".field").classList.add("invalid");
  }
  function clearError(field) {
    const p = document.querySelector('[data-error-for="' + field + '"]');
    if (p) { p.textContent = ""; if (p.closest(".field")) p.closest(".field").classList.remove("invalid"); }
  }
  function clearAllErrors() {
    document.querySelectorAll(".field__error").forEach((p) => (p.textContent = ""));
    document.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  }
  function showStatus(type, msg) {
    els.status.textContent = msg;
    els.status.className = "form-status show " + type;
  }
  function hideStatus() { els.status.className = "form-status"; els.status.textContent = ""; }

  function formatBytes(b) {
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
    return (b / 1024 / 1024).toFixed(1) + " MB";
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- Init ---------- */
  function init() {
    els.deadlineText.textContent = "Lever je bijdrage in vóór " + deadlineLabel();

    if (isClosed()) {
      els.formCard.hidden = true;
      els.closedCard.hidden = false;
      return;
    }
    buildCategories();
    wireFileInput();
    els.form.addEventListener("submit", handleSubmit);
    els.name.addEventListener("input", () => clearError("name"));
  }

  init();
})();
