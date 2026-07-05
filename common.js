/* ==========================================================================
   F.R.I.D.A.Y. COMMON UTILITIES & SHARED STATE (common.js)
   Shared configurations, theme definitions, local storage triggers,
   and toast alerts for the Hand-Drawn MPA.
   ========================================================================== */

// 1. BASE CONFIGURATION TEMPLATE
const DEFAULT_CONFIG = {
  userName: "Tony Stark",
  assistantName: "Paper",
  sliderWit: 60,
  sliderSarcasm: 40,
  sliderDetail: 75,
  sliderCreativity: 65,
  userBio: "I am an engineer and inventor, working on highly modular and scalable projects. I value elegance, optimization, and neat technical solutions.",
  speakingRules: "Speak with confidence and subtle sarcasm. Keep it structured. Be helpful, but occasionally poke fun if I ask simple questions. Use technical metaphors when explaining things.",
  writingSample: "const initiateSystem = async () => {\n  console.log('Initiating FRIDAY protocol...');\n  await loadNeuralEngines();\n  return true;\n};",
  apiKey: "",
  mistralApiKey: "",
  themeSeed: "#6750A4", // Purple seed (default)
  ttsVoiceURI: "",
  ttsRate: 1.0,
  autoSpeak: false,
  userMood: "Neutral",
  backendModel: "google/gemini-2.5-flash"
};

// 2. PALETTE THEME MAP (HAND-DRAWN STYLINGS ACCENTS)
const THEME_SEEDS = {
  "#6750A4": { // Purple Core (Imperial Velvet Ink)
    "pencil": "#24252d",       // Deep Charcoal Pencil
    "marker": "#d91b5c",       // Rich Fuchsia Corrector
    "pen": "#5f3dc4",          // Deep Royal Violet Pen
    "paper": "#faf8f5",        // Ivory Cotton Linen Paper
    "erased": "#e2e1e9",       // Smudged Eraser Gray
    "postit-yellow": "#fffbeb", // Soft Butter Cream
    "postit-blue": "#ecfeff",   // Minty Sky Tint
    "postit-pink": "#fdf2f8"    // Pale Peach Blossom
  },
  "#006A6A": { // Teal Core (Peacock Fountain Ink)
    "pencil": "#1a2424",       // Dark Ivy Graphite
    "marker": "#e65c00",       // Bright Amber Highlighter
    "pen": "#087f5b",          // Deep Emerald Pen
    "paper": "#f5fbf9",        // Soft Seafoam Linen
    "erased": "#dbe3df",       // Muted Mint Eraser
    "postit-yellow": "#fffbeb",
    "postit-blue": "#f0fdf4",   // Soft Sage postit
    "postit-pink": "#fff1f2"    // Pale Rose
  },
  "#8B5000": { // Amber Core (Sienna Ochre Crayon)
    "pencil": "#2c251e",       // Roasted Chestnut Graphite
    "marker": "#c2410c",       // Deep Burnt Orange
    "pen": "#9a3412",          // Terracotta Calligraphy Pen
    "paper": "#fcfaf6",        // Warm Cream Parchment
    "erased": "#ebdccb",       // Vintage Sand Eraser
    "postit-yellow": "#fef9c3",
    "postit-blue": "#f0fdf4",
    "postit-pink": "#faf5ff"
  },
  "#BA1A1A": { // Rose Core (Crimson Blood Ink)
    "pencil": "#2d1a1a",       // Dark Garnet Graphite
    "marker": "#c53030",       // Crimson Highlighter
    "pen": "#9b1c1c",          // Rich Carmine Pen
    "paper": "#fdf8f8",        // Soft Pinkish Cotton
    "erased": "#ebdcdd",       // Rosewater Gray
    "postit-yellow": "#fffbeb",
    "postit-blue": "#ecfeff",
    "postit-pink": "#ffe4e6"
  },
  "#005FAF": { // Blue Core (Prussian Engineering Ink)
    "pencil": "#1a2333",       // Prussian Blue Graphite
    "marker": "#e11d48",       // Bright Red Corrector
    "pen": "#1d4ed8",          // Deep Cobalt Blue Pen
    "paper": "#f4f7fb",        // Architectural Draft Paper
    "erased": "#ced7e5",       // Blueprint Eraser Gray
    "postit-yellow": "#fffbeb",
    "postit-blue": "#e0f2fe",   // Blueprint blue postit
    "postit-pink": "#f5f3ff"
  },
  "#d97706": { // Orange Core (Vibrant Ochre Crayon)
    "pencil": "#29231d",       // Roasted Amber Graphite
    "marker": "#f97316",       // Orange Highlighter
    "pen": "#c2410c",          // Rust Red Pen
    "paper": "#fdfaf7",        // Warm Cream Paper
    "erased": "#ebdccb",       // Sand Eraser
    "postit-yellow": "#fffbeb",
    "postit-blue": "#f0fdf4",
    "postit-pink": "#faf5ff"
  },
  "#ca8a04": { // Yellow Core (Golden Sunrise Highlighter)
    "pencil": "#27241d",       // Charcoal Mustard
    "marker": "#eab308",       // Yellow Highlighter
    "pen": "#854d0e",          // Golden Ink Pen
    "paper": "#fdfcf7",        // Butter Cream Paper
    "erased": "#eae3cc",       // Khaki Eraser
    "postit-yellow": "#fef9c3",
    "postit-blue": "#f0fdf4",
    "postit-pink": "#faf5ff"
  },
  "#15803d": { // Green Core (Forest Evergreen Pen)
    "pencil": "#1c241e",       // Dark Pine Graphite
    "marker": "#22c55e",       // Bright Green Highlighter
    "pen": "#15803d",          // Fountain Green Pen
    "paper": "#f6faf7",        // Mint Cream Paper
    "erased": "#d1e0d4",       // Sage Eraser
    "postit-yellow": "#fffbeb",
    "postit-blue": "#f0fdf4",
    "postit-pink": "#fff1f2"
  }
};

/**
 * Loads current configuration state from localStorage.
 * Merges with defaults if properties are missing.
 * @returns {object}
 */
window.loadConfig = function() {
  const stored = localStorage.getItem("friday_companion_config");
  let state = { ...DEFAULT_CONFIG };
  if (stored) {
    try {
      state = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch (e) {
      console.error("Failed to parse config from local storage", e);
    }
  }

  // Pre-populate system key from config.js as a fallback ONLY if not already saved in local storage
  if (!state.apiKey && window.FRIDAY_API_KEY) {
    state.apiKey = window.FRIDAY_API_KEY;
  }
  if (!state.dbKey && window.FRIDAY_DB_KEY) {
    state.dbKey = window.FRIDAY_DB_KEY;
  }
  if (!state.nvidiaApiKey && window.FRIDAY_NVIDIA_API_KEY) {
    state.nvidiaApiKey = window.FRIDAY_NVIDIA_API_KEY;
  }
  if (!state.mistralApiKey && window.FRIDAY_MISTRAL_API_KEY) {
    state.mistralApiKey = window.FRIDAY_MISTRAL_API_KEY;
  }
  return state;
};

/**
 * Saves configuration state to localStorage.
 * @param {object} state 
 */
window.saveConfig = function(state) {
  // Save exactly what is passed (respecting manual input in Settings form)
  localStorage.setItem("friday_companion_config", JSON.stringify(state));
};

/**
 * Applies the wobbly design theme variable markers to the document element.
 * @param {string} seedHex 
 */
window.applyTheme = function(seedHex) {
  const theme = THEME_SEEDS[seedHex] || THEME_SEEDS["#6750A4"];
  const root = document.documentElement;
  
  for (const [key, value] of Object.entries(theme)) {
    root.style.setProperty(`--color-${key}`, value);
  }
};

/**
 * Triggers a wobbly notification slide alert.
 * @param {string} text 
 * @param {'success' | 'error' | 'info'} type 
 */
window.showToast = function(text, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  
  let icon = "📝";
  if (type === "success") icon = "✏️";
  if (type === "error") icon = "❌";
  if (type === "info") icon = "📌";

  toast.innerHTML = `
    <span class="toast-icon ${type}">${icon}</span>
    <span>${text}</span>
  `;
  
  container.appendChild(toast);
  
  // Remove toast when slide-out finishes
  setTimeout(() => {
    toast.remove();
  }, 4000);
};

// 3. COMMON PAGE INITIALIZATIONS
window.addEventListener("DOMContentLoaded", () => {
  const state = window.loadConfig();
  
  // 1. Apply active theme seed
  window.applyTheme(state.themeSeed);

  // 2. Setup theme seed selector dropdown logic if present on the page
  const seedDropdown = document.getElementById("themeSeed");
  if (seedDropdown) {
    seedDropdown.value = state.themeSeed;
    seedDropdown.addEventListener("change", (e) => {
      const newSeed = e.target.value;
      
      // Update local storage configuration
      const currentState = window.loadConfig();
      currentState.themeSeed = newSeed;
      window.saveConfig(currentState);
      
      // Live reload theme elements on page
      window.applyTheme(newSeed);
      window.showToast("Re-drawing sketchbook colors.", "info");
      
      // Notify other script parts if they exist
      if (typeof window.onThemeChanged === "function") {
        window.onThemeChanged(newSeed);
      }
    });
  }

  // 3. Sync Neural Chip status indicator (header) if present on the page
  const syncChip = document.getElementById("syncStatusChip");
  const syncLabel = document.getElementById("syncStatusLabel");
  if (syncChip && syncLabel) {
    const hasKey = !!state.apiKey;
    syncChip.className = `status-chip ${hasKey ? 'online' : 'free-mode'}`;
    syncLabel.textContent = hasKey ? "Sync: Gemini API" : "Sync: Free AI";
  }

  // 4. Dynamically generate 3D wire loops in margins
  generateSpiralLoops();
});

/**
 * Dynamically generates 3D wire loops and punched holes inside
 * any spiral-binding containers on the page.
 */
function generateSpiralLoops() {
  const bindings = document.querySelectorAll(".spiral-binding");
  bindings.forEach(binding => {
    binding.innerHTML = ""; // Clear CSS placeholders
    
    const loopCount = 18;
    for (let i = 0; i < loopCount; i++) {
      const topPct = (i / (loopCount - 1)) * 100;
      
      // Punched hole on paper
      const hole = document.createElement("div");
      hole.className = "spiral-hole";
      hole.style.top = `calc(${topPct}% - 4px)`;
      
      // 3D wire loop ring
      const loop = document.createElement("div");
      loop.className = "spiral-ring";
      loop.style.top = `calc(${topPct}% - 6px)`;
      
      if (binding.classList.contains("left")) {
        loop.style.left = "-12px";
      } else {
        loop.style.right = "-12px";
      }
      
      // Random slight wobbly rotation
      const randomRot = (Math.random() * 6 - 3).toFixed(1);
      loop.style.transform = `rotate(${randomRot}deg)`;
      
      binding.appendChild(hole);
      binding.appendChild(loop);
    }
  });
}

// --------------------------------------------------------------------------
// 5. BOTANICAL / ORGANIC STYLE THEME TOGGLE WITH DUST DISINTEGRATION & PALETTES
// --------------------------------------------------------------------------
// Curated Botanical Color Palettes
const BOTANICAL_PALETTES = [
  { name: "Forest Sage", pencil: "#1f2a22", marker: "#c05638", pen: "#40604b", paper: "#fafaf6", erased: "#d3ded6", border: "#c2d1c6" },
  { name: "Desert Ochre", pencil: "#27241d", marker: "#d4813b", pen: "#8f6735", paper: "#fdfaf2", erased: "#ebdcc5", border: "#dfcfb9" },
  { name: "Midnight Iris", pencil: "#221d2b", marker: "#be5e80", pen: "#5a4575", paper: "#faf7fe", erased: "#e5daee", border: "#d5c9e2" },
  { name: "Ocean Kelp", pencil: "#14222b", marker: "#dd6b55", pen: "#2c6b63", paper: "#f3fbf9", erased: "#d1e4e0", border: "#bed6d1" },
  { name: "Autumn Chestnut", pencil: "#301e14", marker: "#c84e1b", pen: "#a0522d", paper: "#fdf8f4", erased: "#eccfa8", border: "#debe8d" }
];

window.applyBotanicalPalette = function(index) {
  const palette = BOTANICAL_PALETTES[index] || BOTANICAL_PALETTES[0];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(palette)) {
    if (key === "name") continue;
    root.style.setProperty(`--color-${key}`, value);
  }
  localStorage.setItem("friday_botanical_palette_index", index);
};

// Setup active style theme and inject paper grain on load
window.addEventListener("DOMContentLoaded", () => {
  let savedStyleTheme = localStorage.getItem("friday_style_theme") || "sketchbook";
  if (savedStyleTheme === "chatgpt") {
    savedStyleTheme = "sketchbook";
    localStorage.setItem("friday_style_theme", "sketchbook");
  }

  // Inject fullscreen paper grain element
  if (!document.getElementById("paper-grain")) {
    const grain = document.createElement("div");
    grain.id = "paper-grain";
    grain.className = "paper-grain";
    grain.setAttribute("aria-hidden", "true");
    document.body.appendChild(grain);
  }

  // Load style theme
  document.body.classList.add(`theme-${savedStyleTheme}`);
  
  if (savedStyleTheme === "botanical") {
    const savedBotanicalIdx = localStorage.getItem("friday_botanical_palette_index") || "0";
    window.applyBotanicalPalette(savedBotanicalIdx);
  }
  
  // Initial toggle button icon sync
  setTimeout(updateToggleIcons, 100);
});

// Global function to toggle style themes with Thanos-snap dust disintegration
window.toggleStyleTheme = function() {
  if (window.isDisintegrating) return;
  window.isDisintegrating = true;

  const appLayout = document.querySelector(".app-layout");
  if (!appLayout) {
    // Fallback if app-layout is not present
    toggleThemeClass();
    window.isDisintegrating = false;
    return;
  }

  // 1. Create dust particle canvas overlay
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.zIndex = "99999";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  // 2. Query visible elements to spawn dust particles around them
  const elements = document.querySelectorAll(
    ".card, .app-bar, .btn-filled, .btn-outlined, textarea, input, h1, h2, table, .brand-text, .status-chip, .visualizer-container, .brand-icon"
  );
  
  const particles = [];
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Colors representation based on current theme
  const isCurrentlyBotanical = document.body.classList.contains("theme-botanical");
  const particleColors = isCurrentlyBotanical 
    ? [ { r: 45, g: 58, b: 49 }, { r: 140, g: 154, b: 132 }, { r: 194, g: 123, b: 102 } ] // forest, sage, terracotta
    : [ { r: 45, g: 45, b: 45 }, { r: 255, g: 77, b: 77 }, { r: 45, g: 93, b: 161 } ];    // pencil black, marker red, pen blue

  elements.forEach(el => {
    const rect = el.getBoundingClientRect();
    
    // Check if element is inside viewport
    if (
      rect.bottom >= 0 &&
      rect.top <= viewportHeight &&
      rect.right >= 0 &&
      rect.left <= viewportWidth
    ) {
      // Spawn particles per element based on size
      const area = rect.width * rect.height;
      const count = Math.min(45, Math.max(8, Math.floor(area / 4000)));
      for (let k = 0; k < count; k++) {
        const pColor = particleColors[Math.floor(Math.random() * particleColors.length)];
        particles.push({
          x: rect.left + Math.random() * rect.width,
          y: rect.top + Math.random() * rect.height,
          vx: Math.random() * 2.5 - 0.5 + 2.0, // Wind blowing right
          vy: Math.random() * 2.5 - 3.5,        // Floating upwards
          size: Math.random() * 2.2 + 0.8,
          alpha: 1.0,
          fadeRate: Math.random() * 0.015 + 0.008,
          color: pColor
        });
      }
    }
  });

  // 3. Fade out the DOM layout using blur and opacity transitions
  appLayout.classList.add("disintegrate");

  // 4. Run particle animation loop
  let startTime = null;
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    // Clear canvas
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Update and draw particles
    let activeParticlesCount = 0;
    particles.forEach(p => {
      if (p.alpha > 0) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.fadeRate;
        
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        activeParticlesCount++;
      }
    });

    if (activeParticlesCount > 0 && elapsed < 2000) {
      requestAnimationFrame(animate);
    } else {
      // Cleanup canvas when animation completes
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }
  requestAnimationFrame(animate);

  // 5. Swap the style theme mid-disintegration (600ms)
  setTimeout(() => {
    toggleThemeClass();
  }, 600);

  // 6. Integrate back in with new styles (1200ms)
  setTimeout(() => {
    appLayout.classList.remove("disintegrate");
    window.isDisintegrating = false;
  }, 1200);
};

function toggleThemeClass() {
  const isBotanical = document.body.classList.contains("theme-botanical");
  
  if (isBotanical) {
    document.body.classList.remove("theme-botanical");
    document.body.classList.add("theme-sketchbook");
    localStorage.setItem("friday_style_theme", "sketchbook");
    
    const state = window.loadConfig();
    window.applyTheme(state.themeSeed);
  } else {
    document.body.classList.remove("theme-sketchbook");
    document.body.classList.add("theme-botanical");
    localStorage.setItem("friday_style_theme", "botanical");
    
    const savedBotanicalIdx = localStorage.getItem("friday_botanical_palette_index") || "0";
    window.applyBotanicalPalette(savedBotanicalIdx);
  }
  
  updateToggleIcons();
}

function updateToggleIcons() {
  const isBotanical = document.body.classList.contains("theme-botanical");
  
  const buttons = document.querySelectorAll(".theme-toggle-btn span");
  buttons.forEach(span => {
    span.textContent = isBotanical ? "draw" : "eco";
  });
}

// Global function to randomize active theme colors (Bolt Trigger)
window.randomizePalette = function() {
  const isBotanical = document.body.classList.contains("theme-botanical");
  
  // Rotate the bolt icon wobbily
  const boltIcon = document.querySelector(".thunder-btn span");
  if (boltIcon) {
    boltIcon.style.transition = "transform 0.5s ease-out";
    boltIcon.style.transform = "scale(1.3) rotate(360deg)";
    setTimeout(() => { boltIcon.style.transform = ""; }, 500);
  }

  if (isBotanical) {
    // Select a random botanical palette
    const currentIndex = parseInt(localStorage.getItem("friday_botanical_palette_index") || "0");
    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * BOTANICAL_PALETTES.length);
    }
    window.applyBotanicalPalette(nextIndex);
    window.showToast(`⚡ Forest Mood: ${BOTANICAL_PALETTES[nextIndex].name}`, "info");
  } else {
    // Select a random sketchbook theme seed
    const seeds = Object.keys(THEME_SEEDS);
    const state = window.loadConfig();
    const currentSeed = state.themeSeed;
    let nextSeed = currentSeed;
    while (nextSeed === currentSeed) {
      nextSeed = seeds[Math.floor(Math.random() * seeds.length)];
    }
    
    // Save and apply the new theme seed
    state.themeSeed = nextSeed;
    window.saveConfig(state);
    window.applyTheme(nextSeed);
    
    // Sync settings dropdown if it exists on page
    const seedDropdown = document.getElementById("themeSeed");
    if (seedDropdown) {
      seedDropdown.value = nextSeed;
    }
    
    // Get seed label for toast
    const seedNames = {
      "#6750A4": "Purple Core",
      "#006A6A": "Teal Core",
      "#8B5000": "Amber Core",
      "#BA1A1A": "Rose Core",
      "#005FAF": "Blue Core"
    };
    window.showToast(`⚡ Ink Shift: ${seedNames[nextSeed] || 'New Ink'}`, "info");
  }
};
