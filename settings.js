/* ==========================================================================
   F.R.I.D.A.Y. CONFIGURATOR CONTROLLER (settings.js)
   Handles form caches, dynamically binds sliders, validates inputs,
   and writes parameters to localStorage.
   ========================================================================== */

const settingsDom = {
  userName: document.getElementById("userName"),
  assistantName: document.getElementById("assistantName"),
  sliderWit: document.getElementById("sliderWit"),
  sliderSarcasm: document.getElementById("sliderSarcasm"),
  sliderDetail: document.getElementById("sliderDetail"),
  sliderCreativity: document.getElementById("sliderCreativity"),
  valWit: document.getElementById("valWit"),
  valSarcasm: document.getElementById("valSarcasm"),
  valDetail: document.getElementById("valDetail"),
  valCreativity: document.getElementById("valCreativity"),
  userBio: document.getElementById("userBio"),
  speakingRules: document.getElementById("speakingRules"),
  writingSample: document.getElementById("writingSample"),
  apiKey: document.getElementById("apiKey"),
  backendModel: document.getElementById("backendModel"),
  btnSave: document.getElementById("btnSave"),
  btnReset: document.getElementById("btnReset"),
  syncStatusChip: document.getElementById("syncStatusChip"),
  syncStatusLabel: document.getElementById("syncStatusLabel"),
  
  // Voice Synthesis Elements
  ttsVoice: document.getElementById("ttsVoice"),
  ttsRate: document.getElementById("ttsRate"),
  valTtsRate: document.getElementById("valTtsRate"),
  autoSpeak: document.getElementById("autoSpeak"),

  // Cloud Sync Elements
  btnCloudBackup: document.getElementById("btnCloudBackup"),
  btnCloudRestore: document.getElementById("btnCloudRestore"),
  cloudSyncStatus: document.getElementById("cloudSyncStatus"),
  cloudSyncStatusText: document.getElementById("cloudSyncStatusText")
};

/**
 * Fills settings form fields from active configuration state.
 */
function populateForm() {
  const state = window.loadConfig();
  
  settingsDom.userName.value = state.userName;
  settingsDom.assistantName.value = state.assistantName;
  settingsDom.sliderWit.value = state.sliderWit;
  settingsDom.sliderSarcasm.value = state.sliderSarcasm;
  settingsDom.sliderDetail.value = state.sliderDetail;
  settingsDom.sliderCreativity.value = state.sliderCreativity;
  settingsDom.userBio.value = state.userBio;
  settingsDom.speakingRules.value = state.speakingRules;
  settingsDom.writingSample.value = state.writingSample;
  settingsDom.apiKey.value = state.apiKey || "";
  if (settingsDom.backendModel) {
    settingsDom.backendModel.value = state.backendModel || "google/gemini-2.5-flash";
  }
  
  // Voice controls
  settingsDom.ttsRate.value = state.ttsRate || 1.0;
  settingsDom.autoSpeak.checked = !!state.autoSpeak;
  loadVoices(state.ttsVoiceURI);
  
  updateSlidersText();
}

/**
 * Loads available system voices into the vocal select dropdown.
 * @param {string} selectedURI 
 */
function loadVoices(selectedURI) {
  settingsDom.ttsVoice.innerHTML = '';

  if (typeof speechSynthesis === 'undefined') {
    const opt = document.createElement("option");
    opt.textContent = "No voices available (browser unsupported)";
    opt.value = "";
    settingsDom.ttsVoice.appendChild(opt);
    return;
  }

  const voices = speechSynthesis.getVoices();
  if (!voices.length) {
    // Voices may load async; retry once
    speechSynthesis.addEventListener("voiceschanged", () => loadVoices(selectedURI), { once: true });
    return;
  }

  // Comprehensive female voice detection keywords
  const femaleNames = [
    "zira", "samantha", "hazel", "susan", "victoria", "karen", "moira", "tessa",
    "fiona", "kate", "serena", "veena", "rishi", "allison", "ava", "joana",
    "nora", "sara", "jenny", "aria", "sonia", "heera", "priya", "aditi",
    "ivy", "kendra", "kimberly", "salli", "joanna", "amy", "emma", "nicole",
    "olivia", "natasha", "chloe", "amelie", "ines", "monica", "lucia", "mia",
    "margaux", "elsa", "alice", "anna", "female", "woman"
  ];

  // Separate female and other voices
  const femaleVoices = [];
  const otherVoices = [];

  voices.forEach(voice => {
    const nameLower = voice.name.toLowerCase();
    const isFemale = femaleNames.some(kw => nameLower.includes(kw));
    // Also check if the voice name explicitly contains "Female"
    const hasGenderTag = nameLower.includes("female") || nameLower.includes("woman");
    
    if (isFemale || hasGenderTag) {
      femaleVoices.push(voice);
    } else {
      otherVoices.push(voice);
    }
  });

  // Sort: English female voices first, then other female, then all others
  femaleVoices.sort((a, b) => {
    const aEn = a.lang.startsWith("en") ? 1 : 0;
    const bEn = b.lang.startsWith("en") ? 1 : 0;
    return bEn - aEn || a.name.localeCompare(b.name);
  });

  // Add Female Voices group
  if (femaleVoices.length) {
    const femaleGroup = document.createElement("optgroup");
    femaleGroup.label = "👩 Female Voices (Recommended)";
    
    femaleVoices.forEach(voice => {
      const opt = document.createElement("option");
      opt.textContent = `✨ ${voice.name} (${voice.lang})`;
      opt.value = voice.voiceURI;
      if (voice.voiceURI === selectedURI) opt.selected = true;
      femaleGroup.appendChild(opt);
    });

    settingsDom.ttsVoice.appendChild(femaleGroup);
  }

  // Add Other Voices group
  if (otherVoices.length) {
    const otherGroup = document.createElement("optgroup");
    otherGroup.label = "👤 Other System Voices";
    
    otherVoices.forEach(voice => {
      const opt = document.createElement("option");
      opt.textContent = `${voice.name} (${voice.lang})`;
      opt.value = voice.voiceURI;
      if (voice.voiceURI === selectedURI) opt.selected = true;
      otherGroup.appendChild(opt);
    });

    settingsDom.ttsVoice.appendChild(otherGroup);
  }

  // Auto-select first female voice if no voice was previously selected
  if (!selectedURI && femaleVoices.length) {
    settingsDom.ttsVoice.value = femaleVoices[0].voiceURI;
  }
}

/**
 * Updates text readouts representing sliders percentages.
 */
function updateSlidersText() {
  settingsDom.valWit.textContent = `${settingsDom.sliderWit.value}%`;
  settingsDom.valSarcasm.textContent = `${settingsDom.sliderSarcasm.value}%`;
  settingsDom.valDetail.textContent = `${settingsDom.sliderDetail.value}%`;
  settingsDom.valCreativity.textContent = `${settingsDom.sliderCreativity.value}%`;
  
  if (settingsDom.valTtsRate) {
    settingsDom.valTtsRate.textContent = `${parseFloat(settingsDom.ttsRate.value).toFixed(1)}x`;
  }
}

/**
 * Saves inputs back to local storage and alerts user.
 */
function saveAlignmentConfig() {
  const currentConfig = window.loadConfig();
  
  const updatedState = {
    userName: settingsDom.userName.value.trim() || "Tony Stark",
    assistantName: settingsDom.assistantName.value.trim() || "Paper",
    sliderWit: parseInt(settingsDom.sliderWit.value),
    sliderSarcasm: parseInt(settingsDom.sliderSarcasm.value),
    sliderDetail: parseInt(settingsDom.sliderDetail.value),
    sliderCreativity: parseInt(settingsDom.sliderCreativity.value),
    userBio: settingsDom.userBio.value.trim(),
    speakingRules: settingsDom.speakingRules.value.trim(),
    writingSample: settingsDom.writingSample.value.trim(),
    apiKey: window.FRIDAY_API_KEY || settingsDom.apiKey.value.trim(),
    themeSeed: currentConfig.themeSeed, // preserve theme seed
    
    // Voice values
    ttsVoiceURI: settingsDom.ttsVoice.value,
    ttsRate: parseFloat(settingsDom.ttsRate.value),
    autoSpeak: settingsDom.autoSpeak.checked,
    userMood: currentConfig.userMood, // preserve mood
    backendModel: settingsDom.backendModel.value
  };

  window.saveConfig(updatedState);
  window.showToast("Cerebral sync saved successfully.", "success");
  
  // Sync status chip in header
  const hasKey = !!updatedState.apiKey;
  if (settingsDom.syncStatusChip && settingsDom.syncStatusLabel) {
    settingsDom.syncStatusChip.className = `status-chip ${hasKey ? 'online' : 'free-mode'}`;
    settingsDom.syncStatusLabel.textContent = hasKey ? "Sync: Gemini API" : "Sync: Free AI";
  }
}

/**
 * Clears overrides and resets back to factory DEFAULT_CONFIG.
 */
function resetAlignmentConfig() {
  if (confirm("Reset Paper configuration to factory defaults? This clears current settings.")) {
    localStorage.removeItem("friday_companion_config");
    populateForm();
    window.showToast("Factory settings restored.", "info");

    // Sync header status chip
    const hasKey = !!window.FRIDAY_API_KEY;
    if (settingsDom.syncStatusChip && settingsDom.syncStatusLabel) {
      settingsDom.syncStatusChip.className = `status-chip ${hasKey ? 'online' : 'free-mode'}`;
      settingsDom.syncStatusLabel.textContent = hasKey ? "Sync: Gemini API" : "Sync: Free AI";
    }
  }
}

// Binds event listeners
function setupSettingsEvents() {
  // Bind inputs updates for sliders
  [settingsDom.sliderWit, settingsDom.sliderSarcasm, settingsDom.sliderDetail, settingsDom.sliderCreativity, settingsDom.ttsRate].forEach(slider => {
    slider.addEventListener("input", updateSlidersText);
  });

  // Action buttons
  settingsDom.btnSave.addEventListener("click", saveAlignmentConfig);
  settingsDom.btnReset.addEventListener("click", resetAlignmentConfig);

  // Cloud Sync buttons
  if (settingsDom.btnCloudBackup) {
    settingsDom.btnCloudBackup.addEventListener("click", cloudBackupToVault);
  }
  if (settingsDom.btnCloudRestore) {
    settingsDom.btnCloudRestore.addEventListener("click", cloudRestoreFromVault);
  }

  // Voice Preview button
  const btnPreview = document.getElementById("btnPreviewVoice");
  if (btnPreview) {
    btnPreview.addEventListener("click", () => {
      if (typeof speechSynthesis === 'undefined') {
        window.showToast("Speech synthesis not supported in this browser.", "error");
        return;
      }
      speechSynthesis.cancel();
      
      const sampleText = "Hello, I am Paper, your personal cognitive companion. How can I assist you today?";
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.rate = parseFloat(settingsDom.ttsRate.value) || 1.0;
      
      const voices = speechSynthesis.getVoices();
      const selectedURI = settingsDom.ttsVoice.value;
      const matchedVoice = voices.find(v => v.voiceURI === selectedURI);
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      
      speechSynthesis.speak(utterance);
      window.showToast("Playing voice preview...", "info");
    });
  }
}

// Init
window.addEventListener("DOMContentLoaded", () => {
  populateForm();
  setupSettingsEvents();
  
  const activeAgent = localStorage.getItem("friday_active_agent") || "core";
  const appLayoutWrapper = document.getElementById("appLayoutWrapper");
  if (appLayoutWrapper) {
    appLayoutWrapper.classList.add("workspace-" + activeAgent);
  }
  
  // Browser Speech synthesis callback for asynchronous voice loading
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      const state = window.loadConfig();
      loadVoices(state.ttsVoiceURI);
    };
  }
});

// --------------------------------------------------------------------------
// SECURE SUPABASE PORTGRESQL DATABASE SYNC
// --------------------------------------------------------------------------
async function cloudBackupToVault() {
  settingsDom.cloudSyncStatus.style.display = "flex";
  settingsDom.cloudSyncStatusText.textContent = "Connecting to Supabase Database...";

  try {
    const state = window.loadConfig();

    // Step 1: Backup Config
    settingsDom.cloudSyncStatusText.textContent = "Writing parameters to Supabase...";
    const configData = localStorage.getItem("friday_companion_config") || JSON.stringify(state);
    
    const configRes = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'config', data: JSON.parse(configData) })
    });
    if (!configRes.ok) {
      const errJson = await configRes.json();
      throw new Error(errJson.message || "Failed to save parameters.");
    }

    // Step 2: Backup Chat History
    settingsDom.cloudSyncStatusText.textContent = "Backing up neural chat history...";
    const chatHistory = localStorage.getItem("friday_companion_chat_history") || "[]";
    
    const historyRes = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'history', data: JSON.parse(chatHistory) })
    });
    if (!historyRes.ok) {
      const errJson = await historyRes.json();
      throw new Error(errJson.message || "Failed to save chat history.");
    }

    settingsDom.cloudSyncStatusText.textContent = "Supabase Database Synced!";
    window.showToast("Database backup successfully synced to Supabase!", "success");
    
    setTimeout(() => {
      settingsDom.cloudSyncStatus.style.display = "none";
    }, 2000);

  } catch (err) {
    console.error("Supabase Backup failed:", err);
    settingsDom.cloudSyncStatusText.textContent = "Sync Error!";
    window.showToast(`Sync failed: ${err.message}`, "error");
    
    setTimeout(() => {
      settingsDom.cloudSyncStatus.style.display = "none";
    }, 3000);
  }
}

async function cloudRestoreFromVault() {
  if (!confirm("Restore parameters from Supabase? This will overwrite your current configuration and chat logs.")) {
    return;
  }

  settingsDom.cloudSyncStatus.style.display = "flex";
  settingsDom.cloudSyncStatusText.textContent = "Accessing Supabase Database...";

  try {
    // Step 1: Restore Config
    settingsDom.cloudSyncStatusText.textContent = "Reading parameters from Supabase...";
    const configRes = await fetch('/api/restore?key=config');
    if (!configRes.ok) {
      const errJson = await configRes.json();
      throw new Error(errJson.message || "No backup found in this Supabase database.");
    }
    const configData = await configRes.json();
    localStorage.setItem("friday_companion_config", JSON.stringify(configData.data));

    // Step 2: Restore History
    settingsDom.cloudSyncStatusText.textContent = "Downloading chat logs...";
    const historyRes = await fetch('/api/restore?key=history');
    if (historyRes.ok) {
      const historyData = await historyRes.json();
      localStorage.setItem("friday_companion_chat_history", JSON.stringify(historyData.data));
    }

    settingsDom.cloudSyncStatusText.textContent = "Supabase Parameters Restored!";
    window.showToast("Database restore successfully applied!", "success");
    
    setTimeout(() => {
      settingsDom.cloudSyncStatus.style.display = "none";
      populateForm();
      const newState = window.loadConfig();
      window.applyTheme(newState.themeSeed);
    }, 1500);

  } catch (err) {
    console.error("Supabase Restore failed:", err);
    settingsDom.cloudSyncStatusText.textContent = "Sync Error!";
    window.showToast(`Restore failed: ${err.message}`, "error");
    
    setTimeout(() => {
      settingsDom.cloudSyncStatus.style.display = "none";
    }, 3000);
  }
}
