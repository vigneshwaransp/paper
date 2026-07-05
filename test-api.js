import { API_KEY } from "./config.js";

const DEFAULT_CONFIG = {
  userName: "Tony Stark",
  assistantName: "F.R.I.D.A.Y.",
  sliderWit: 60,
  sliderSarcasm: 40,
  sliderDetail: 75,
  sliderCreativity: 65,
  userBio: "I am an engineer...",
  speakingRules: "Speak with confidence...",
  writingSample: "const initiateSystem = ...",
  apiKey: API_KEY,
  themeSeed: "#6750A4"
};

const appState = DEFAULT_CONFIG;

function generateSystemInstruction() {
  const witDesc = appState.sliderWit > 75 ? "extremely witty and humorous" : (appState.sliderWit < 30 ? "highly serious and dry" : "moderately witty");
  const sarcasmDesc = appState.sliderSarcasm > 70 ? "heavily sarcastic and teasing, frequently utilizing playful banter" : (appState.sliderSarcasm < 25 ? "polite and straight-forward, strictly avoiding sarcasm" : "occasionally sarcastic");
  const detailDesc = appState.sliderDetail > 75 ? "thorough, detailed, and highly technical" : (appState.sliderDetail < 30 ? "exceptionally brief, quick, and conversational" : "balanced in detail");
  
  return `You are an advanced AI companion named ${appState.assistantName}. You are a customized virtual mirror, assistant, and clone of the user, who is named ${appState.userName}.
You must talk like ${appState.userName}, think like ${appState.userName}, and create like ${appState.userName}.

Here is the personal profile/biography of the user:
"${appState.userBio}"

Use the following strict speech guidelines to shape your voice:
- Sarcasm & Banter: You are ${sarcasmDesc}.
- Wit & Humor: You are ${witDesc}.
- Length & Technical Detail: You are ${detailDesc}.
- Custom rules: ${appState.speakingRules}

Study the writing sample below.`;
}

async function run() {
  const requestBody = {
    contents: [{ role: "user", parts: [{ text: "hello" }] }],
    systemInstruction: {
      parts: [{ text: generateSystemInstruction() }]
    },
    generationConfig: {
      temperature: Math.max(0.2, appState.sliderCreativity / 100),
      maxOutputTokens: 2048
    }
  };

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${appState.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
