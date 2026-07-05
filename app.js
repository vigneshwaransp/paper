/* ==========================================================================
   F.R.I.D.A.Y. DASHBOARD CONTROLLER (app.js)
   Controls the home page HUD visualizer, loads diagnostics summary,
   and manages active sketched brain animation states.
   ========================================================================== */

const THEME_NAMES = {
  "#6750A4": "Purple Core (Default)",
  "#006A6A": "Teal Core (Analytical)",
  "#8B5000": "Amber Core (Energetic)",
  "#BA1A1A": "Rose Core (Expressive)",
  "#005FAF": "Blue Core (Sleek)",
  "#d97706": "Orange Core (Artistic)",
  "#ca8a04": "Yellow Core (Wise)",
  "#15803d": "Green Core (Polyglot)"
};

// DOM elements specific to index.html
const pageDom = {
  blobWrapper: document.getElementById("blobWrapper"),
  readoutState: document.getElementById("readoutState"),
  personaPreview: document.getElementById("personaPreview"),
  profileSummary: document.getElementById("profileSummary"),
  diagSync: document.getElementById("diagSync"),
  diagTheme: document.getElementById("diagTheme"),
  diagMood: document.getElementById("diagMood")
};

/**
 * Renders state parameters into the UI elements of the dashboard.
 * @param {object} state 
 */
function updateDashboardUI(state) {
  const hasKey = !!state.apiKey;
  
  // Set sync status text
  if (pageDom.diagSync) {
    pageDom.diagSync.textContent = hasKey ? "Active (System Key)" : "Offline (Mock)";
  }

  // Set theme name text
  if (pageDom.diagTheme) {
    pageDom.diagTheme.textContent = THEME_NAMES[state.themeSeed] || "Custom Core";
  }

  // Set mood status text
  if (pageDom.diagMood) {
    pageDom.diagMood.textContent = state.userMood || "Neutral";
  }

  // Core status indicators
  if (pageDom.readoutState) {
    pageDom.readoutState.textContent = hasKey ? "Core Status: Synced" : "Core Status: Offline";
  }

  if (pageDom.blobWrapper) {
    pageDom.blobWrapper.className = `brain-sketch-wrapper ${hasKey ? 'syncing' : ''}`;
  }

  // Setup preview tagline
  if (pageDom.personaPreview) {
    pageDom.personaPreview.textContent = `${state.userName}'s Mirror // Sarcasm: ${state.sliderSarcasm}%`;
  }

  // Set custom summary post-it details
  if (pageDom.profileSummary) {
    pageDom.profileSummary.innerHTML = `
      <strong>Brain Clone Name</strong>: ✏️ ${state.assistantName}<br>
      <strong>User Persona</strong>: ${state.userName}<br>
      <strong>Linguistic Alignments</strong>:<br>
      - Wit / Humor: <em>${state.sliderWit}%</em><br>
      - Sarcasm Level: <em>${state.sliderSarcasm}%</em><br>
      - Rigor / Depth: <em>${state.sliderDetail}%</em><br>
      - Creative Index: <em>${state.sliderCreativity}%</em>
    `;
  }
}

// Register callback for when seed dropdown updates on home page
window.onThemeChanged = function(newSeed) {
  if (pageDom.diagTheme) {
    pageDom.diagTheme.textContent = THEME_NAMES[newSeed] || "Custom Core";
  }
};

function initAgentSelectorDeck() {
  const deck = document.getElementById("agentDeck");
  if (!deck) return;

  const buttons = deck.querySelectorAll(".agent-deck-btn");
  const savedAgent = localStorage.getItem("friday_active_agent") || "core";

  buttons.forEach(btn => {
    const agent = btn.getAttribute("data-agent");
    if (agent === savedAgent) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }

    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      localStorage.setItem("friday_active_agent", agent);

      let seedHex = "#6750A4";
      if (agent === "maths") seedHex = "#006A6A";
      if (agent === "physics") seedHex = "#8B5000";
      if (agent === "english") seedHex = "#BA1A1A";
      if (agent === "cs") seedHex = "#005FAF";
      if (agent === "image") seedHex = "#d97706";
      if (agent === "quote") seedHex = "#ca8a04";
      if (agent === "translate") seedHex = "#15803d";

      const state = window.loadConfig();
      state.themeSeed = seedHex;
      window.saveConfig(state);
      window.applyTheme(seedHex);

      // Switch workspace classes on layout wrapper
      const appLayoutWrapper = document.getElementById("appLayoutWrapper");
      if (appLayoutWrapper) {
        appLayoutWrapper.classList.add("page-fold-transitioning");
        setTimeout(() => {
          const classes = Array.from(appLayoutWrapper.classList);
          classes.forEach(c => {
            if (c.startsWith("workspace-")) appLayoutWrapper.classList.remove(c);
          });
          appLayoutWrapper.classList.add("workspace-" + agent);
        }, 150);
        setTimeout(() => {
          appLayoutWrapper.classList.remove("page-fold-transitioning");
        }, 300);
      }

      if (pageDom.diagTheme) {
        pageDom.diagTheme.textContent = THEME_NAMES[seedHex] || "Custom Core";
      }

      window.showToast(`Cognitive Specialist Synced: ${agent.toUpperCase()}`, "success");
    });
  });
}

// Initializer
function initDashboard() {
  const state = window.loadConfig();
  updateDashboardUI(state);
  initAgentSelectorDeck();

  const activeAgent = localStorage.getItem("friday_active_agent") || "core";
  const appLayoutWrapper = document.getElementById("appLayoutWrapper");
  if (appLayoutWrapper) {
    appLayoutWrapper.classList.add("workspace-" + activeAgent);
  }
}

window.addEventListener("DOMContentLoaded", initDashboard);
