/* ==========================================================================
   F.R.I.D.A.Y. CHAT CLIENT & API SERVICE (chat.js)
   Connects the wobbly UI to the Gemini API, constructs system instructions,
   and handles markdown chat element formatting.
   ========================================================================== */

let activeState = {};
let chatHistory = [];
let activeAttachedImageBase64 = null;
let activeAttachedImageMimeType = null;
let activeAttachedImageOcrText = null;

// DOM element caches for chat.html
// DOM element caches for chat.html
const chatDom = {
  chatTitle: document.getElementById("chatTitle"),
  chatMessages: document.getElementById("chatMessages"),
  chatInput: document.getElementById("chatInput"),
  btnSend: document.getElementById("btnSend"),
  btnStop: document.getElementById("btnStop"),
  btnFullscreen: document.getElementById("btnFullscreen"),
  blobWrapper: document.getElementById("blobWrapper"),
  visualizerText: document.getElementById("visualizerText"),
  
  // OCR, STT and TTS elements
  btnOcr: document.getElementById("btnOcr"),
  btnMic: document.getElementById("btnMic"),
  ocrFileInput: document.getElementById("ocrFileInput"),
  chatAutoSpeak: document.getElementById("chatAutoSpeak"),
  btnWebSearch: document.getElementById("btnWebSearch"),

  // Drawing Canvas Elements
  btnDraw: document.getElementById("btnDraw"),
  sketchBoardBackdrop: document.getElementById("sketchBoardBackdrop"),
  closeSketchBtn: document.getElementById("closeSketchBtn"),
  sketchCanvas: document.getElementById("sketchCanvas"),
  btnScanSketch: document.getElementById("btnScanSketch"),
  btnUndoSketch: document.getElementById("btnUndoSketch"),
  btnClearSketch: document.getElementById("btnClearSketch"),
  agentTabs: document.getElementById("agentTabs")
};

// Specialist Agent State (Default general Core)
let activeAgent = "core";

// Drawing Board state parameters
let sketchContext = null;
let isDrawing = false;
let drawHistory = [];
let activeDrawTool = "pen"; // pen, marker, highlighter, eraser

// Speech recognition controller (STT)
let speechRecognizer = null;
let isRecording = false;

// Current active speech utterance (TTS)
let currentSpeechUtterance = null;

// AbortController for stopping active API requests
let currentAbortController = null;

// Active typewriter streaming interval ID
let activeStreamInterval = null;

/**
 * Encodes plain text to escape HTML tags.
 * @param {string} text 
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Lightweight wobbly markdown parser for ink messages.
 * Matches bolding, inline code, pre code, linebreaks, and hyperlinks.
 * @param {string} md 
 */
function parseSimpleMarkdown(md) {
  let html = escapeHtml(md);
  
  // 1. Code blocks (```lang ... ```)
  html = html.replace(/```([a-zA-Z0-9]+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const isJava = (lang && lang.toLowerCase() === "java") || code.includes("public class ") || code.includes("System.out.print");
    const codeId = "code_block_" + Math.random().toString(36).substr(2, 9);
    
    let buttonHtml = "";
    if (isJava && activeAgent === "cs") {
      buttonHtml = `
        <div style="display: flex; justify-content: flex-end; padding: 0.25rem 0.5rem; background-color: #f1f5f9; border-bottom: 2px solid var(--color-pencil);">
          <button type="button" class="btn-run-java btn-outlined" data-code-id="${codeId}" style="height: 28px; padding: 0 0.75rem; font-family: 'Kalam', cursive; font-size: 0.85rem; display: flex; align-items: center; gap: 0.25rem; border-radius: var(--wobbly-sm);">
            <span class="material-symbols-outlined" style="font-size: 1rem;">play_arrow</span> Run Java
          </button>
        </div>
      `;
    }
    
    return `
      <div class="code-block-wrapper" style="border: 2.5px solid var(--color-pencil); border-radius: var(--wobbly-sm); overflow: hidden; margin: 0.75rem 0; background-color: #f8fafc; position: relative;">
        ${buttonHtml}
        <pre style="margin: 0; padding: 0.75rem; overflow-x: auto;"><code id="${codeId}">${code}</code></pre>
        <div id="console_${codeId}" class="console-output" style="display: none; padding: 0.75rem; background-color: #0f172a; color: #f8fafc; font-family: 'Courier New', monospace; font-size: 0.85rem; border-top: 2.5px solid var(--color-pencil); white-space: pre-wrap; word-break: break-all;"></div>
      </div>
    `;
  });
  
  // 2. Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  
  // 3. Bold text (**bold**)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 3a. Blockquotes (&gt; text)
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote style="border-left: 4px solid var(--color-marker); padding-left: 0.75rem; font-style: italic; margin: 0.5rem 0; opacity: 0.85;">$1</blockquote>');

  // 3b. Images (![alt](url))
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const cleanUrl = url.trim().replace(/\s+/g, "%20");
    return `<div class="chat-image-wrap" style="position: relative; display: inline-block; margin-top: 0.75rem; max-width: 100%;"><img src="${cleanUrl}" alt="${alt}" style="max-width: 100%; border-radius: 8px; border: 2.5px solid var(--color-pencil); display: block;" onload="scrollChat()"><div class="card-paperclip" style="top: -12px; right: 10px; height: 36px; width: 16px;"></div></div>`;
  });

  // 4. Links [text](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, (match, text, url) => {
    if (url.includes("image.pollinations.ai/prompt/")) {
      const cleanUrl = url.trim().replace(/\s+/g, "%20");
      return `<div class="chat-image-wrap" style="position: relative; display: inline-block; margin-top: 0.75rem; max-width: 100%;"><img src="${cleanUrl}" alt="${text}" style="max-width: 100%; border-radius: 8px; border: 2.5px solid var(--color-pencil); display: block;" onload="scrollChat()"><div class="card-paperclip" style="top: -12px; right: 10px; height: 36px; width: 16px;"></div></div>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // 4a. Auto-link raw URLs (http:// or https://) that are not already inside HTML href or src attributes
  html = html.replace(/(?<!href=")(?<!src=")\b(https?:\/\/[^\s\<\>"]+)/gi, (url) => {
    let cleanUrl = url;
    let suffix = '';
    const lastChar = url.slice(-1);
    if (['.', ',', ';', '?', '!', ')'].includes(lastChar)) {
      cleanUrl = url.slice(0, -1);
      suffix = lastChar;
    }
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${suffix}`;
  });

  // 5. Line breaks (\n)
  html = html.replace(/\n/g, "<br>");

  // 6. Raw Pollinations image URL fallback formatter
  html = html.replace(/(src="|href=")?(https:\/\/image\.pollinations\.ai\/prompt\/[^\n\r"'\<\>]+)/gi, (match, prefix, url) => {
    if (prefix) return match;
    const cleanUrl = url.trim().replace(/\s+/g, "%20");
    return `<div class="chat-image-wrap" style="position: relative; display: inline-block; margin-top: 0.75rem; max-width: 100%;"><img src="${cleanUrl}" style="max-width: 100%; border-radius: 8px; border: 2.5px solid var(--color-pencil); display: block;" onload="scrollChat()"><div class="card-paperclip" style="top: -12px; right: 10px; height: 36px; width: 16px;"></div></div>`;
  });
  
  return html;
}

/**
 * Binds Run Java buttons inside rendered code blocks to post code to local compiler and render console output.
 */
function bindCodeRunnerListeners(parentEl) {
  parentEl.querySelectorAll(".btn-run-java").forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "true";
    
    btn.addEventListener("click", async () => {
      const codeId = btn.getAttribute("data-code-id");
      const codeElement = document.getElementById(codeId);
      const consoleContainer = document.getElementById("console_" + codeId);
      
      if (!codeElement || !consoleContainer) return;
      
      const rawCodeText = codeElement.innerHTML
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
      
      // Update UI loading state
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size: 1rem; animation: spinLoader 2s infinite linear; display: inline-block;">sync</span> Compiling...`;
      
      consoleContainer.style.display = "block";
      consoleContainer.textContent = "✏️ Compiling & running Java code using OpenJDK...\n";
      scrollChat();
      
      try {
        const runnerUrl = window.location.hostname === 'localhost' ? '/api/run-java' : 'http://localhost:3000/api/run-java';
        const response = await fetch(runnerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ code: rawCodeText })
        });
        
        const data = await response.json();
        
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1rem;">play_arrow</span> Run Java`;
        
        if (data.status === "success") {
          let outputText = "";
          if (data.output) {
            outputText += data.output;
          }
          if (data.error) {
            outputText += `\n[Stderr Error]:\n${data.error}`;
          }
          if (!data.output && !data.error) {
            outputText += "[Program executed successfully with no console output]";
          }
          consoleContainer.textContent = outputText;
        } else {
          consoleContainer.textContent = `⚠️ Compilation/Execution Error:\n${data.output || data.message}`;
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1rem;">play_arrow</span> Run Java`;
        consoleContainer.textContent = `❌ Network Error connecting to local runner:\n${err.message}`;
      }
      scrollChat();
    });
  });
}

/**
 * Adds a user text bubble to the chat container.
 * @param {string} text 
 */
function addUserMessage(text, image = null) {
  const msgEl = document.createElement("div");
  msgEl.className = "message user";
  
  const randRot = (Math.random() * 2 - 1).toFixed(2);
  msgEl.style.transform = `rotate(${randRot}deg)`;

  let innerHTML = `
    <span class="message-label">${activeState.userName}</span>
    <div class="message-bubble">${escapeHtml(text)}`;
  
  if (image) {
    innerHTML += `<br><img src="data:${image.mimeType};base64,${image.data}" style="max-width: 100%; max-height: 200px; border: 2.5px solid var(--color-pencil); border-radius: var(--wobbly-sm); margin-top: 0.5rem; object-fit: contain; display: block;">`;
  }
  
  innerHTML += `</div>`;
  msgEl.innerHTML = innerHTML;
  chatDom.chatMessages.appendChild(msgEl);
  scrollChat();
}

let mindMapAnimationFrame = null;

/**
 * Appends a wobbly loader bubble showing F.R.I.D.A.Y. is thinking with dynamic mind-map
 */
function showScribbleLoader() {
  const loader = document.createElement("div");
  loader.id = "fridayScribbleLoader";
  loader.className = "scribble-loader message companion";
  loader.innerHTML = `
    <span class="message-label">${activeState.assistantName}</span>
    <div class="mindmap-thinking-container">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;">
        <span>✏️ mapping reasoning paths</span>
        <div class="scribble-dots"><span></span><span></span><span></span></div>
      </div>
      <canvas id="mindMapCanvas" class="mindmap-canvas" width="280" height="150"></canvas>
    </div>
  `;
  chatDom.chatMessages.appendChild(loader);
  scrollChat();

  const canvas = document.getElementById("mindMapCanvas");
  if (canvas) {
    animateMindMap(canvas);
  }
}

/**
 * Removes the wobbly scribble loading bubble and clears animation loop
 */
function hideScribbleLoader() {
  const loader = document.getElementById("fridayScribbleLoader");
  if (loader) loader.remove();
  if (mindMapAnimationFrame) {
    cancelAnimationFrame(mindMapAnimationFrame);
    mindMapAnimationFrame = null;
  }
}

/**
 * Animates hand-drawn nodes and connecting lines on Canvas
 */
function animateMindMap(canvas) {
  const ctx = canvas.getContext("2d");
  const nodes = [
    { x: 50, y: 75, label: "Input Focus", targetX: 50, targetY: 75, size: 0 },
    { x: 140, y: 40, label: "Recalling Memory", targetX: 140, targetY: 40, size: 0 },
    { x: 140, y: 110, label: "Semantic Links", targetX: 140, targetY: 110, size: 0 },
    { x: 230, y: 75, label: "Drafting Ink", targetX: 230, targetY: 75, size: 0 }
  ];

  let frame = 0;
  
  function drawWobblyLine(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const wobbleX = (Math.sin(frame * 0.1) * 2) + (Math.random() - 0.5);
    const wobbleY = (Math.cos(frame * 0.1) * 2) + (Math.random() - 0.5);
    ctx.quadraticCurveTo(midX + wobbleX, midY + wobbleY, x2, y2);
    ctx.stroke();
  }

  function drawNodeCircle(node) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(node.x + (Math.random() - 0.5), node.y + (Math.random() - 0.5), node.size * 0.95, 0, Math.PI * 2);
    ctx.stroke();
  }

  function loop() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let strokeColor = "#1e293b";
    let fontName = "Kalam, cursive";
    
    if (activeAgent === "physics" || activeAgent === "maths") {
      strokeColor = "rgba(255, 255, 255, 0.6)";
    } else if (activeAgent === "cs") {
      strokeColor = "#4ade80";
      fontName = "Courier New, monospace";
    } else if (activeAgent === "english") {
      strokeColor = "#5c4033";
      fontName = "Georgia, serif";
    } else if (activeAgent === "web") {
      strokeColor = "#d8b4fe";
      fontName = "Kalam, cursive";
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.font = `9px ${fontName}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    nodes.forEach((node, idx) => {
      const delay = idx * 20;
      if (frame > delay && node.size < 18) {
        node.size += 0.8;
      }
      node.x = node.targetX + Math.sin(frame * 0.05 + idx) * 1.5;
      node.y = node.targetY + Math.cos(frame * 0.05 + idx) * 1.5;
    });

    if (nodes[0].size > 5) {
      if (nodes[1].size > 5) drawWobblyLine(nodes[0].x, nodes[0].y, nodes[1].x, nodes[1].y);
      if (nodes[2].size > 5) drawWobblyLine(nodes[0].x, nodes[0].y, nodes[2].x, nodes[2].y);
    }
    if (nodes[3].size > 5) {
      if (nodes[1].size > 5) drawWobblyLine(nodes[1].x, nodes[1].y, nodes[3].x, nodes[3].y);
      if (nodes[2].size > 5) drawWobblyLine(nodes[2].x, nodes[2].y, nodes[3].x, nodes[3].y);
    }

    nodes.forEach(node => {
      if (node.size > 2) {
        drawNodeCircle(node);
        ctx.fillText(node.label, node.x, node.y + node.size + 10);
      }
    });

    mindMapAnimationFrame = requestAnimationFrame(loop);
  }

  loop();
}

function replaceCitationNumbers(text, sources) {
  if (!sources || sources.length === 0) return text;
  let formattedText = text;
  sources.forEach((src, idx) => {
    const num = idx + 1;
    const regex = new RegExp(`\\[${num}\\]`, 'g');
    formattedText = formattedText.replace(regex, `[${num}](${src.url})`);
    const regex2 = new RegExp(`\\[Source ${num}\\]`, 'g');
    formattedText = formattedText.replace(regex2, `[Source ${num}](${src.url})`);
  });
  return formattedText;
}

function renderSourcesUsed(bubbleElement, sources) {
  if (!sources || sources.length === 0) return;

  let container = bubbleElement.querySelector(".sources-used-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "sources-used-container";

    // Decode HTML entities safely via a temp element
    const decodeEntities = (str) => {
      const tmp = document.createElement("textarea");
      tmp.innerHTML = str;
      return tmp.value;
    };

    const headerDiv = document.createElement("div");
    headerDiv.className = "sources-header";
    headerDiv.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.1rem;">language</span> SOURCES USED`;

    const gridDiv = document.createElement("div");
    gridDiv.className = "sources-grid";

    sources.forEach(src => {
      let domain = "web";
      try {
        domain = new URL(src.url).hostname;
      } catch (e) {}

      const card = document.createElement("div");
      card.className = "source-card";
      card.addEventListener("click", () => window.open(src.url, "_blank"));

      const titleSpan = document.createElement("span");
      titleSpan.className = "source-card-title";
      titleSpan.textContent = decodeEntities(src.title);

      const domainSpan = document.createElement("span");
      domainSpan.className = "source-card-domain";
      domainSpan.textContent = domain;

      card.appendChild(titleSpan);
      card.appendChild(domainSpan);
      gridDiv.appendChild(card);
    });

    container.appendChild(headerDiv);
    container.appendChild(gridDiv);
    bubbleElement.appendChild(container);
  }
}


/**
 * Renders an assistant message bubble and streams the text word-by-word.
 * @param {string} text 
 * @param {Array} sources 
 */
function addCompanionMessageStream(text, sources = null) {
  const msgEl = document.createElement("div");
  msgEl.className = "message companion";
  
  const randRot = (Math.random() * 2 - 1).toFixed(2);
  msgEl.style.transform = `rotate(${randRot}deg)`;

  const messageId = "msg-" + Date.now();
  
  msgEl.innerHTML = `
    <span class="message-label">${activeState.assistantName}</span>
    <div class="message-bubble" id="${messageId}">
      <div class="message-bubble-header">
        <button type="button" class="btn-speak" title="Read Aloud" data-text="${escapeHtml(text)}">
          <span class="material-symbols-outlined" style="font-size: 1.15rem;">volume_up</span> Speak
        </button>
      </div>
      <div class="bubble-stream-content"></div>
    </div>
  `;
  
  chatDom.chatMessages.appendChild(msgEl);
  scrollChat();

  const bubbleContent = msgEl.querySelector(".bubble-stream-content");
  const playBtn = msgEl.querySelector(".btn-speak");
  
  // Split response into tokens (words and spaces)
  const tokens = text.split(/(\s+)/);
  let currentTokenIdx = 0;
  let accumulatedText = "";
  
  // Set wobbly core to thinking during typing
  if (chatDom.blobWrapper) chatDom.blobWrapper.className = "brain-sketch-wrapper thinking";

  // Trigger TTS voice dynamically as stream starts if Auto-Speak is enabled
  if (activeState.autoSpeak) {
    speakVoiceText(text);
  }

  // Typewriter streaming interval
  activeStreamInterval = setInterval(() => {
    if (currentTokenIdx >= tokens.length) {
      clearInterval(activeStreamInterval);
      activeStreamInterval = null;
      // Final full render to format code blocks and tags correctly
      const citedText = replaceCitationNumbers(text, sources);
      bubbleContent.innerHTML = parseSimpleMarkdown(citedText);
      bindCodeRunnerListeners(bubbleContent);
      renderSourcesUsed(msgEl.querySelector(".message-bubble"), sources);
      scrollChat();
      
      // Reset core animation
      if (chatDom.blobWrapper) {
        chatDom.blobWrapper.className = `brain-sketch-wrapper ${activeState.apiKey ? 'syncing' : ''}`;
      }

      // Hide stop button, show send button
      if (chatDom.btnStop) chatDom.btnStop.style.display = "none";
      if (chatDom.btnSend) chatDom.btnSend.style.display = "";
      return;
    }
    
    accumulatedText += tokens[currentTokenIdx];
    // Render partial markdown safely
    const partialCited = replaceCitationNumbers(accumulatedText, sources);
    bubbleContent.innerHTML = parseSimpleMarkdown(partialCited);
    scrollChat();
    currentTokenIdx++;
  }, 45); // Typing speed rate

  // Bind play trigger for manual speech synthesis
  playBtn.addEventListener("click", () => {
    speakVoiceText(text);
  });
}

function scrollChat() {
  chatDom.chatMessages.scrollTop = chatDom.chatMessages.scrollHeight;
}

// --------------------------------------------------------------------------
// ADVANCED VOCAL SYNTHESIS (TTS AUDIO ENGINE)
// --------------------------------------------------------------------------
/**
 * Speaks text using window.speechSynthesis with chunked playback
 * to handle long responses without cutting off.
 * @param {string} text 
 */
function speakVoiceText(text) {
  if (typeof speechSynthesis === 'undefined') return;

  // Strip markdown code blocks before speaking
  const cleanedText = text.replace(/```[\s\S]*?```/g, "[Code snippet omitted]").replace(/`([^`]+)`/g, "$1");

  // Stop any active speech
  speechSynthesis.cancel();
  if (window.activeWebAudioTts) {
    window.activeWebAudioTts.pause();
    window.activeWebAudioTts = null;
  }

  // Split long text into sentence-level chunks for reliable playback
  // Browser speechSynthesis often fails silently on long strings
  const chunks = splitTextIntoChunks(cleanedText, 180);
  
  // Find the selected voice
  const voices = speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.voiceURI === activeState.ttsVoiceURI);

  let chunkIndex = 0;

  function speakNextChunk() {
    if (chunkIndex >= chunks.length) return;
    
    const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
    utterance.rate = activeState.ttsRate || 1.0;
    
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => {
      chunkIndex++;
      speakNextChunk();
    };

    utterance.onerror = () => {
      chunkIndex++;
      speakNextChunk();
    };

    currentSpeechUtterance = utterance;
    speechSynthesis.speak(utterance);
  }

  speakNextChunk();
}

/**
 * Splits text into chunks at sentence boundaries, respecting a max character limit.
 * @param {string} text 
 * @param {number} maxLen 
 * @returns {string[]}
 */
function splitTextIntoChunks(text, maxLen) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) {
    chunks.push(current.trim());
  }

return chunks;
}

// --------------------------------------------------------------------------
// ADVANCED OCR FILE SCANNER (TESSERACT.JS INTEGRATION)
// --------------------------------------------------------------------------
/**
 * Renders wobbly progress indicator inside chat logs
 * @param {string} statusMsg 
 */
function showOcrScannerStatus(statusMsg) {
  let statusCard = document.getElementById("fridayOcrScannerStatus");
  if (!statusCard) {
    statusCard = document.createElement("div");
    statusCard.id = "fridayOcrScannerStatus";
    statusCard.className = "ocr-status-card message companion";
    chatDom.chatMessages.appendChild(statusCard);
  }
  statusCard.innerHTML = `
    <span class="material-symbols-outlined" style="animation: jiggleLoader 1.5s infinite alternate; font-size: 1.45rem; color: var(--color-marker);">document_scanner</span>
    <span style="font-family: 'Kalam', cursive; font-size: 1.05rem;">F.R.I.D.A.Y. Scanner: ${statusMsg}</span>
  `;
  scrollChat();
}

function removeOcrScannerStatus() {
  const statusCard = document.getElementById("fridayOcrScannerStatus");
  if (statusCard) statusCard.remove();
}

/**
 * Preprocesses sketch board canvas to erase background notebook guidelines,
 * leaving only dark user drawings to maximize OCR scan accuracy.
 */
function preprocessCanvasForOcr(canvas) {
  const scaleFactor = 2.5; // Scale up to increase pixel density for low-res handwriting OCR
  const padding = 50; // White border padding in pixels
  
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  
  tempCanvas.width = canvas.width * scaleFactor + padding * 2;
  tempCanvas.height = canvas.height * scaleFactor + padding * 2;
  
  // Fill white background
  tempCtx.fillStyle = "#ffffff";
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  
  // Draw the original canvas scaled up in the center
  tempCtx.drawImage(
    canvas,
    0, 0, canvas.width, canvas.height,
    padding, padding, canvas.width * scaleFactor, canvas.height * scaleFactor
  );
  
  const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imgData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    
    // Clear pure white background (r > 240) and notebook ruled lines (#e2e8f0)
    const isWhite = r > 240 && g > 240 && b > 240;
    const isGrid = Math.abs(r - 226) < 18 && Math.abs(g - 232) < 18 && Math.abs(b - 240) < 18;
    
    if (isWhite || isGrid) {
      data[i] = 255;
      data[i+1] = 255;
      data[i+2] = 255;
    } else {
      // Amplify user drawings (colored or dark inks) to solid high-contrast black
      data[i] = 0;
      data[i+1] = 0;
      data[i+2] = 0;
    }
  }
  
  tempCtx.putImageData(imgData, 0, 0);
  return tempCanvas.toDataURL("image/png");
}

/**
 * Adaptive binarization + automatic dark mode inversion for uploaded files.
 */
function preprocessImageForOcr(imgEl) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  canvas.width = imgEl.naturalWidth || imgEl.width;
  canvas.height = imgEl.naturalHeight || imgEl.height;
  
  ctx.drawImage(imgEl, 0, 0);
  
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  
  // Calculate average luminance
  let totalLuminance = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalLuminance += 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
  }
  const avgLuminance = totalLuminance / (data.length / 4);
  
  // Auto-invert if dark mode image
  const invert = avgLuminance < 85;
  const thresholdVal = Math.max(60, Math.min(195, avgLuminance));
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i+1];
    let b = data[i+2];
    
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }
    
    const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const threshold = v > thresholdVal ? 255 : 0;
    
    data[i] = threshold;
    data[i+1] = threshold;
    data[i+2] = threshold;
  }
  
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Handles image files loading, saves data to activeAttachedImageBase64/MimeType, runs Tesseract OCR in the background to capture text context, and updates preview.
 * @param {File} file 
 */
function processOcrImage(file) {
  const progressOverlay = document.getElementById("ocrProgressOverlay");
  const progressText = document.getElementById("ocrProgressText");
  const previewOverlay = document.getElementById("ocrPreviewOverlay");
  const previewImg = document.getElementById("ocrPreviewImg");

  if (progressOverlay) {
    progressOverlay.style.display = "flex";
    progressText.textContent = "Attaching image...";
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    activeAttachedImageBase64 = event.target.result.split(',')[1];
    activeAttachedImageMimeType = file.type;

    const img = new Image();
    img.onload = function() {
      if (progressText) {
        progressText.textContent = "Reading image text...";
      }

      // Preprocess image (binarization + inversion check)
      const binarizedDataUrl = preprocessImageForOcr(img);

      if (typeof Tesseract === "undefined") {
        if (progressOverlay) progressOverlay.style.display = "none";
        activeAttachedImageOcrText = null;
        showSidebarPreview();
        return;
      }

      // Run local OCR
      Tesseract.recognize(
        binarizedDataUrl,
        "eng",
        {
          logger: m => {
            // Clean progress message (no raw percentages)
            if (progressText) {
              const status = m.status.replace(/_/g, " ");
              progressText.textContent = `${status}...`;
            }
          }
        }
      ).then(({ data: { text } }) => {
        if (progressOverlay) progressOverlay.style.display = "none";
        activeAttachedImageOcrText = text.trim();
        showSidebarPreview();
        window.showToast("Image loaded and analyzed successfully!", "success");
      }).catch(err => {
        console.error("Tesseract error:", err);
        if (progressOverlay) progressOverlay.style.display = "none";
        activeAttachedImageOcrText = null;
        showSidebarPreview();
        window.showToast("Image loaded (text analysis skipped).", "info");
      });
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);

  function showSidebarPreview() {
    if (previewImg && previewOverlay) {
      previewImg.src = reader.result;
      previewOverlay.style.display = "flex";
      
      const appLayoutWrapper = document.getElementById("appLayoutWrapper");
      if (appLayoutWrapper) {
        appLayoutWrapper.classList.remove("sidebar-right-collapsed");
      }
    }
    chatDom.chatInput.focus();
  }
}

// --------------------------------------------------------------------------
// ADVANCED SPEECH-TO-TEXT DICTATION (STT MICROPHONE ENGINE)
// --------------------------------------------------------------------------
function setupSpeechToText() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    chatDom.btnMic.style.display = "none"; // Hide if unsupported
    return;
  }

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = false;
  speechRecognizer.interimResults = false;
  speechRecognizer.lang = 'en-US';

  speechRecognizer.onstart = () => {
    isRecording = true;
    chatDom.btnMic.classList.add("recording");
    window.showToast("Listening... speak your prompt.", "info");
  };

  speechRecognizer.onresult = (e) => {
    const transcriptText = e.results[0][0].transcript;
    if (transcriptText) {
      chatDom.chatInput.value += (chatDom.chatInput.value ? " " : "") + transcriptText;
    }
  };

  speechRecognizer.onerror = (e) => {
    console.error("STT Dictation Error:", e);
    window.showToast("Mic recording failed.", "error");
    stopRecording();
  };

  speechRecognizer.onend = () => {
    stopRecording();
  };
}

function toggleRecording() {
  if (!speechRecognizer) return;
  if (isRecording) {
    speechRecognizer.stop();
  } else {
    try {
      speechRecognizer.start();
    } catch (e) {
      console.error(e);
    }
  }
}

function stopRecording() {
  isRecording = false;
  chatDom.btnMic.classList.remove("recording");
}

// --------------------------------------------------------------------------
// LOCAL NLP SENTIMENT ANALYSIS UTILITY
// --------------------------------------------------------------------------
/**
 * Evaluates sentiment score of user prompt and saves mood in state.
 * @param {string} text 
 */
function runLocalNlpSentiment(text) {
  const query = text.toLowerCase();
  
  // Keyword scoring
  const posKeywords = ["happy", "great", "good", "awesome", "amazing", "neat", "cool", "optimal", "success", "nice", "wonderful", "genius", "love", "perfect"];
  const negKeywords = ["sad", "bad", "error", "fail", "crash", "terrible", "wobbly", "stress", "angry", "hate", "delay", "broken", "annoy", "slow", "incorrect"];
  
  let score = 0;
  posKeywords.forEach(w => { if (query.includes(w)) score++; });
  negKeywords.forEach(w => { if (query.includes(w)) score--; });

  let computedMood = "Neutral";
  if (score > 0) computedMood = "Optimistic";
  if (score < 0) computedMood = "Stressed";

  // Save back to storage configuration
  activeState.userMood = computedMood;
  window.saveConfig(activeState);

  const telemetryMood = document.getElementById("telemetryMood");
  if (telemetryMood) {
    telemetryMood.textContent = computedMood;
  }
}

// --------------------------------------------------------------------------
// GEMINI API COMMUNICATION
// --------------------------------------------------------------------------
/**
 * Formulates system instruction block using custom bio and sliders values.
 */
function generateSystemInstruction(requestsImage = false) {
  const witDesc = activeState.sliderWit > 75 ? "extremely witty and humorous" : (activeState.sliderWit < 30 ? "highly serious and dry" : "moderately witty");
  const sarcasmDesc = activeState.sliderSarcasm > 70 ? "heavily sarcastic and teasing, frequently utilizing playful banter" : (activeState.sliderSarcasm < 25 ? "polite and straight-forward, strictly avoiding sarcasm" : "occasionally sarcastic");
  const detailDesc = activeState.sliderDetail > 75 ? "thorough, detailed, and highly technical" : (activeState.sliderDetail < 30 ? "exceptionally brief, quick, and conversational" : "balanced in detail");
  
  let basePrompt = `You are an advanced AI companion named ${activeState.assistantName}. You are a customized virtual mirror, assistant, and clone of the user, who is named ${activeState.userName}.
You must talk like ${activeState.userName}, think like ${activeState.userName}, and create like ${activeState.userName}.

Here is the personal profile/biography of the user:
"${activeState.userBio}"

Use the following strict speech guidelines to shape your voice:
- Sarcasm & Banter: You are ${sarcasmDesc}.
- Wit & Humor: You are ${witDesc}.
- Length & Technical Detail: You are ${detailDesc}.
- Custom rules: ${activeState.speakingRules}

Study the writing sample below. Incorporate this specific writing, coding, and thinking pattern into your replies. Adapt formatting, punctuation, casing, or code design from it:
"""
${activeState.writingSample}
"""

Always respond in a natural, conversational manner. If you write code, explain it briefly in the user's style. Keep the F.R.I.D.A.Y. persona present: you are a brilliant, personal AI built to assist them in their endeavors. Do not break character. Refer to the user as ${activeState.userName}.`;

  // Check if non-coding agent is selected to enforce no code leakage (fixes user's poem code block issue)
  if (activeAgent !== "cs" && activeAgent !== "core") {
    basePrompt += `\n\n[CRITICAL DIRECTIVE: NO PROGRAMMING CODE BLOCKS]
You are currently operating in a specialized non-programming mode (${activeAgent}). You must STRICTLY ignore the JavaScript coding style, syntax, and formatting from the user's writing sample. Do NOT output code snippets, script files, HTML templates, or backticks enclosing programming tags unless specifically asked. Speak and write exclusively in standard, natural human language appropriate for your active specialist persona.`;
  }

  // Append specialist agent instructions
  if (activeAgent === "maths") {
    basePrompt += `\n\n[SPECIALIST PERSONA: MATHEMATICIAN]
You are currently operating in Mathematics Specialist Mode.
- You must structure responses with rigorous mathematical logic and clear step-by-step proofs.
- Use inline math \\(...\\) and display math \\[...\\] for formatting formulas (LaTeX syntax).
- Explain concepts using blackboard-style derivations. Be precise, analytical, and highly structured. Speak like a genius mathematics professor.`;
  } else if (activeAgent === "physics") {
    basePrompt += `\n\n[SPECIALIST PERSONA: PHYSICIST]
You are currently operating in Physics Specialist Mode.
- You must explain things using laws of physics, force interactions, energy conservation, and kinematics.
- Include relevant physical constants and step-by-step calculations.
- Use text-based or ASCII sketch layouts to illustrate physical configurations (like vectors or masses on pulleys) if requested. Speak like a brilliant theoretical physicist.`;
  } else if (activeAgent === "english") {
    basePrompt += `\n\n[SPECIALIST PERSONA: CREATIVE WRITER & POET]
You are currently operating in Creative Writing and English Specialist Mode.
- Speak and respond in sweet, elegant, sophisticated English. Use rich metaphors, expansive vocabulary, and immaculate grammar.
- Write beautifully structured explanations, analysis, short stories, or poems.
- If asked for a poem, respond in gorgeous stanzas. Never wrap poetry in preformatted code blocks or programming tags.`;
  } else if (activeAgent === "cs") {
    basePrompt += `\n\n[SPECIALIST PERSONA: SENIOR SYSTEMS ENGINEER]
You are currently operating in Computer Science Specialist Mode.
- Focus on providing clean, optimal, compilable code.
- You MUST NOT write any comments (neither single-line '//' nor multi-line '/* */') inside the code blocks. The code block must contain ONLY pure, raw program statements.
- Keep explanation of the code separate, outside of the code block.
- Analyze time complexity (Big O) and space complexity for all algorithms.`;
  } else if (activeAgent === "image") {
    basePrompt += `\n\n[SPECIALIST PERSONA: ARTISTIC ILLUSTRATOR]
You are currently operating in Image Generation Mode.
- The user will ask you to draw or generate an image of a subject.
- First, write a brief, elegant artistic description (2-3 sentences) describing how you are sketching it in your notebook.
- Then, on a new line, you MUST output exactly this markdown image tag:
  ![Artistic Sketch](https://image.pollinations.ai/prompt/optimized_prompt?width=600&height=450&nologo=true)
  (Replace 'optimized_prompt' with a detailed, descriptive text-to-image prompt of what the user wants, URL-encoded. For example: if they want a cute cat, use 'cute%20cat%20sketch%20style%20in%20watercolor').
- Do not output any markdown code blocks enclosing the image tag.`;
  } else if (activeAgent === "youtube") {
    basePrompt += `\n\n[SPECIALIST PERSONA: YOUTUBE MUSIC COMPANION]
You are currently operating in YouTube Music Companion Mode.
- If the user asks to play a song, music, or video, tell them enthusiastically that you are launching it on YouTube in a new tab.
- Help suggest new songs based on their mood, help outline playlist tracklists, discuss artists, and chat warmly about music!`;
  } else if (activeAgent === "translate") {
    basePrompt += `\n\n[SPECIALIST PERSONA: POLYGLOT TRANSLATOR]
You are currently operating in Translation Specialist Mode.
- Translate any provided text into the requested target language with perfect linguistic accuracy.
- Show the translation clearly, provide a phonetic pronunciation guide, and add a brief grammatical or cultural note to help the user learn. Speak like a helpful language professor.`;
  } else if (activeAgent === "web") {
    basePrompt += `\n\n[SPECIALIST PERSONA: WEB BROWSER EXPLORER]
You are currently operating in Web Browser Specialist Mode.
- Speak and respond as a highly analytical search companion. Focus on providing straight, accurate, and up-to-date facts from the Yahoo! Search browser results provided to you.
- Synthesize information across multiple sources if helpful.
- When you cite a fact or detail from a source, you MUST append the source page title as a markdown link inline (e.g. "...as reported by [Wikipedia](https://en.wikipedia.org/wiki/C._Joseph_Vijay) in 2026"). Never write raw URLs in your text.`;
  }

  if (requestsImage) {
    basePrompt += `\n\n[IMAGE GENERATION DIRECTIVE]
- The user has requested to draw, sketch, paint, or generate an image.
- At the end of your response, on a new line, you MUST output exactly this markdown image tag:
  ![Artistic Sketch](https://image.pollinations.ai/prompt/optimized_prompt?width=600&height=450&nologo=true)
  (Replace 'optimized_prompt' with a detailed, descriptive text-to-image prompt, URL-encoded. Example: 'futuristic%20modular%20graphene%20space%20helmet%20detailed%20sketch').
- Do not output any markdown code blocks enclosing the image tag.`;
  }

  const tunerVal = document.getElementById("responseTuner")?.value || activeState.responseTuner || "large";
  if (tunerVal === "small") {
    basePrompt += `\n\n[RESPONSE SIZE CONSTRAINT]:
- The user requested a SMALL response to save tokens.
- You MUST make your output extremely brief and concise. Keep it under 2 sentences (or a tiny single paragraph) at all costs. Cut out all fluff, descriptions, greeting, introduction, and conclusions. Just return the core answer!`;
  } else if (tunerVal === "medium") {
    basePrompt += `\n\n[RESPONSE SIZE CONSTRAINT]:
- The user requested a MEDIUM response.
- Keep your reply moderately detailed. Limit the total output to 1 or 2 concise paragraphs. Avoid long lists or unnecessary explanations.`;
  }

  return basePrompt;
}

async function processMessage(prompt) {
  // Execute local NLP sentiment analysis
  runLocalNlpSentiment(prompt);

  let finalPrompt = prompt;
  let searchSources = [];

  if (activeAgent === "web") {
    try {
      showOcrScannerStatus("Browsing Yahoo Search results...");
      
      // Smart search query extraction for confirmation/continuation words
      let searchQuery = prompt;
      const confirmationRegex = /^(yes|yep|y|sure|ok|okay|do\s+it|go\s+ahead|continue|more|tell\s+me\s+more|go\s+on)$/i;
      if (confirmationRegex.test(prompt.trim()) && chatHistory.length >= 2) {
        for (let i = chatHistory.length - 2; i >= 0; i--) {
          const msg = chatHistory[i];
          if (msg.sender === "user" && !confirmationRegex.test(msg.text.trim()) && msg.text.length > 2) {
            searchQuery = msg.text;
            break;
          }
        }
      }

      const searchRes = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.status === "success" && searchData.results && searchData.results.length > 0) {
          searchSources = searchData.results.slice(0, 4);
          let searchContext = `[WEB SEARCH CONTEXT]:
Here are the top web search results for "${searchQuery}" (current year is 2026). Use these to provide a highly accurate, up-to-date response. When you cite a fact or detail from a source, append the source page title as a markdown link inline (e.g. "...actor and singer [C. Joseph Vijay - Wikipedia](https://en.wikipedia.org/wiki/C._Joseph_Vijay)"). Never write raw URLs in your text.
\n\n`;
          searchSources.forEach((res, idx) => {
            searchContext += `Source [${idx+1}]:
Title: ${res.title}
URL: ${res.url}
Snippet: ${res.snippet}\n\n`;
          });
          
          finalPrompt = searchContext + finalPrompt;
        }
      }
    } catch (err) {
      console.error("Failed to run web search:", err.message);
    } finally {
      removeOcrScannerStatus();
    }
  }

  const selectedModel = activeState.backendModel || "";
  const isMistralModel = selectedModel.includes("mistral");
  const isNvidiaModel = !isMistralModel && (selectedModel === "sarvamai/sarvam-m" || selectedModel === "minimaxai/minimax-m3" || selectedModel === "moonshotai/kimi-k2.6");
  const isFreeModel = !isMistralModel && (!activeState.apiKey || selectedModel.includes(":free") || selectedModel.includes("llama") || selectedModel.includes("qwen") || selectedModel.includes("gemma"));
  const isOpenRouter = !isNvidiaModel && !isMistralModel && !isFreeModel && activeState.apiKey && activeState.apiKey.startsWith("sk-or-");
  let url, headers, body;

  const lowPrompt = prompt.toLowerCase();
  const requestsImage = lowPrompt.includes("draw") || lowPrompt.includes("generate an image") || lowPrompt.includes("create an image") || lowPrompt.includes("generate image") || lowPrompt.includes("sketch") || lowPrompt.includes("visualize") || lowPrompt.includes("paint") || lowPrompt.includes("show an image of") || lowPrompt.includes("image of") || lowPrompt.includes("want image") || lowPrompt.includes("want an image");

  let systemPrompt = generateSystemInstruction(requestsImage);

  // Parse prompt reminders (No comments in CS, response size tuner)
  const tunerVal = document.getElementById("responseTuner")?.value || activeState.responseTuner || "large";
  
  let promptReminders = [];
  if (activeAgent === "cs") {
    promptReminders.push("CRITICAL: Do not write any comments or explanations inside your code blocks. Just provide the raw program code itself inside code blocks.");
  }
  if (tunerVal === "small") {
    promptReminders.push("Respond very briefly in at most 1-2 short sentences to save tokens.");
  } else if (tunerVal === "medium") {
    promptReminders.push("Respond in at most 1-2 moderate paragraphs.");
  }
  
  if (promptReminders.length > 0) {
    finalPrompt += `\n\n(${promptReminders.join(" ")})`;
  }

  if (isMistralModel) {
    url = "/api/completion";
    headers = {
      "Content-Type": "application/json",
      "X-Mistral-Api-Key": activeState.mistralApiKey || ""
    };

    const lastMsg = chatHistory[chatHistory.length - 1];
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    chatHistory.forEach(msg => {
      if (msg.text !== prompt) {
        messages.push({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.ocrText ? msg.text + `\n\n[Extracted text from attached image]:\n${msg.ocrText}` : msg.text
        });
      }
    });
    const currentPromptText = lastMsg && lastMsg.ocrText ? finalPrompt + `\n\n[Extracted text from attached image]:\n${lastMsg.ocrText}` : finalPrompt;
    messages.push({ role: "user", content: currentPromptText });

    body = {
      model: selectedModel,
      messages: messages,
      temperature: Math.max(0.2, activeState.sliderCreativity / 100)
    };
  } else if (isNvidiaModel) {
    url = "/api/completion";
    headers = {
      "Content-Type": "application/json",
      "X-Nvidia-Api-Key": activeState.nvidiaApiKey || ""
    };

    const lastMsg = chatHistory[chatHistory.length - 1];
    const messages = [
      { role: "system", content: systemPrompt }
    ];
    chatHistory.forEach(msg => {
      if (msg.text !== prompt) {
        messages.push({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.ocrText ? msg.text + `\n\n[Extracted text from attached image]:\n${msg.ocrText}` : msg.text
        });
      }
    });
    const currentPromptText = lastMsg && lastMsg.ocrText ? finalPrompt + `\n\n[Extracted text from attached image]:\n${lastMsg.ocrText}` : finalPrompt;
    messages.push({ role: "user", content: currentPromptText });

    body = {
      model: selectedModel,
      messages: messages,
      temperature: Math.max(0.2, activeState.sliderCreativity / 100)
    };
  } else if (isFreeModel) {
    url = "https://text.pollinations.ai/";
    headers = {
      "Content-Type": "application/json"
    };

    const lastMsg = chatHistory[chatHistory.length - 1];
    const messages = [
      { role: "system", content: systemPrompt } // Prepend system instruction for Free Model!
    ];
    chatHistory.forEach(msg => {
      if (msg.text !== prompt) {
        const textContent = msg.ocrText ? msg.text + `\n\n[Extracted text from attached image]:\n${msg.ocrText}` : msg.text;
        const content = [{ type: "text", text: textContent }];
        if (msg.image) {
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${msg.image.mimeType};base64,${msg.image.data}`
            }
          });
        }
        messages.push({
          role: msg.sender === "user" ? "user" : "assistant",
          content: content
        });
      }
    });
    const currentPromptText = lastMsg && lastMsg.ocrText ? finalPrompt + `\n\n[Extracted text from attached image]:\n${lastMsg.ocrText}` : finalPrompt;
    const currentContent = [{ type: "text", text: currentPromptText }];
    if (lastMsg && lastMsg.sender === "user" && lastMsg.image) {
      currentContent.push({
        type: "image_url",
        image_url: {
          url: `data:${lastMsg.image.mimeType};base64,${lastMsg.image.data}`
        }
      });
    }
    messages.push({ role: "user", content: currentContent });

    let pollinationsModel = "openai";
    if (selectedModel.includes("llama")) {
      pollinationsModel = "llama";
    } else if (selectedModel.includes("qwen")) {
      pollinationsModel = "qwen";
    } else if (selectedModel.includes("gemma")) {
      pollinationsModel = "llama";
    }

    body = {
      messages: messages,
      model: pollinationsModel,
      jsonMode: false
    };
  } else if (isOpenRouter) {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${activeState.apiKey}`
    };

    const messages = [
      { role: "system", content: systemPrompt }
    ];
    let hasSeenUserOpenRouter = false;
    chatHistory.forEach(msg => {
      if (msg.text !== prompt) {
        const role = msg.sender === "user" ? "user" : "assistant";
        if (role === "user") {
          hasSeenUserOpenRouter = true;
        }
        if (!hasSeenUserOpenRouter) {
          // Skip leading assistant/companion messages
          return;
        }
        const textContent = msg.ocrText ? msg.text + `\n\n[Extracted text from attached image]:\n${msg.ocrText}` : msg.text;
        const content = [{ type: "text", text: textContent }];
        if (msg.image) {
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${msg.image.mimeType};base64,${msg.image.data}`
            }
          });
        }
        messages.push({
          role: role,
          content: content
        });
      }
    });
    
    const lastMsg = chatHistory[chatHistory.length - 1];
    const currentPromptText = lastMsg && lastMsg.ocrText ? finalPrompt + `\n\n[Extracted text from attached image]:\n${lastMsg.ocrText}` : finalPrompt;
    const currentContent = [{ type: "text", text: currentPromptText }];
    if (lastMsg && lastMsg.sender === "user" && lastMsg.image) {
      currentContent.push({
        type: "image_url",
        image_url: {
          url: `data:${lastMsg.image.mimeType};base64,${lastMsg.image.data}`
        }
      });
    }
    messages.push({ role: "user", content: currentContent });

    body = {
      model: activeState.backendModel || "mistral-large-latest",
      messages: messages,
      temperature: Math.max(0.2, activeState.sliderCreativity / 100),
      max_tokens: 2048
    };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeState.apiKey}`;
    headers = {
      "Content-Type": "application/json"
    };

    const contents = [];
    let hasSeenUserGemini = false;
    chatHistory.forEach(msg => {
      if (msg.text !== prompt) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === "user") {
          hasSeenUserGemini = true;
        }
        if (!hasSeenUserGemini) {
          // Skip leading model/companion messages to satisfy Gemini API requirements
          return;
        }
        const textContent = msg.ocrText ? msg.text + `\n\n[Extracted text from attached image]:\n${msg.ocrText}` : msg.text;
        const parts = [{ text: textContent }];
        if (msg.image) {
          parts.push({
            inlineData: {
              mimeType: msg.image.mimeType,
              data: msg.image.data
            }
          });
        }
        contents.push({
          role: role,
          parts: parts
        });
      }
    });
    
    const lastMsg = chatHistory[chatHistory.length - 1];
    const currentPromptText = lastMsg && lastMsg.ocrText ? finalPrompt + `\n\n[Extracted text from attached image]:\n${lastMsg.ocrText}` : finalPrompt;
    const currentParts = [{ text: currentPromptText }];
    if (lastMsg && lastMsg.sender === "user" && lastMsg.image) {
      currentParts.push({
        inlineData: {
          mimeType: lastMsg.image.mimeType,
          data: lastMsg.image.data
        }
      });
    }
    contents.push({
      role: "user",
      parts: currentParts
    });

    body = {
      contents: contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: Math.max(0.2, activeState.sliderCreativity / 100),
        maxOutputTokens: 2048
      }
    };
  }

  // Show the wobbly scribble loading bubble
  showScribbleLoader();

  try {
    // Create a new AbortController for this request
    currentAbortController = new AbortController();

    // Show stop button, hide send button
    if (chatDom.btnStop) chatDom.btnStop.style.display = "";
    if (chatDom.btnSend) chatDom.btnSend.style.display = "none";

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
      signal: currentAbortController.signal
    });

    // Hide loader before streaming starts
    hideScribbleLoader();

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errJson.error || errJson.message || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }

    let replyText = "";
    if (isFreeModel) {
      replyText = await response.text();
    } else if (isNvidiaModel || isMistralModel) {
      const payload = await response.json();
      if (payload.status === "error") throw new Error(payload.message);
      replyText = payload.data?.choices?.[0]?.message?.content;
    } else if (isOpenRouter) {
      const data = await response.json();
      replyText = data.choices?.[0]?.message?.content;
    } else {
      const data = await response.json();
      replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    }
    
    if (!replyText) throw new Error("Empty response received from core.");

    // Stream response word-by-word
    addCompanionMessageStream(replyText, searchSources);

    // Save history
    chatHistory.push({
      sender: "companion",
      text: replyText,
      sources: searchSources
    });
    if (chatHistory.length > 45) chatHistory.shift();
    saveActiveSessionHistory();

  } catch (error) {
    hideScribbleLoader();
    // Hide stop button, show send button
    if (chatDom.btnStop) chatDom.btnStop.style.display = "none";
    if (chatDom.btnSend) chatDom.btnSend.style.display = "";

    if (error.name === 'AbortError') {
      window.showToast("Response stopped.", "info");
      return;
    }
    console.error("Communication error:", error);
    window.showToast("Connection failed.", "error");
    addCompanionMessageStream(`⚠️ **Sync Interrupt**: I encountered an error communicating with my neural backend. Details:\n\`${error.message}\`\n\nVerify that your API Key is entered correctly or check your network connection.`);
  }
}

/**
 * Simulated sandbox responses.
 * @param {string} prompt 
 */
function handleOfflineEmulation(prompt) {
  const query = prompt.toLowerCase();
  let reply = "";
  
  if (query.includes("key") || query.includes("api") || query.includes("sync")) {
    reply = `I see you're asking about syncing my core! 
To connect me to a live cognitive engine:
1. Go to [Google AI Studio](https://aistudio.google.com/) and grab a free **Gemini API Key**.
2. Save it in the ignored local **config.js** file.

Once completed, my visualizer light will turn green, and I will dynamically mimic your speech style, bio details, and custom parameters using the live Gemini 2.5 flash engine!`;
  } else {
    reply = `I am currently running in Offline Emulation. Hello, ${activeState.userName}. Please connect my Gemini key to allow me to write, think, and interact as you.

Your active parameters are:
- **Wit**: ${activeState.sliderWit}%
- **Sarcasm**: ${activeState.sliderSarcasm}%
- **Detail**: ${activeState.sliderDetail}%`;
  }

  addCompanionMessageStream(reply);

  // Save companion reply
  chatHistory.push({ sender: "companion", text: reply });
  if (chatHistory.length > 45) chatHistory.shift();
  saveActiveSessionHistory();
}

function handleSend() {
  const text = chatDom.chatInput.value.trim();
  if (!text && !activeAttachedImageBase64) return;
  
  chatDom.chatInput.value = "";
  
  // Intercept play song commands to open YouTube in a new tab
  const playRegex = /(?:can\s+you\s+|could\s+you\s+|please\s+|^)(?:play|listen\s+to|play\s+the\s+song|play\s+song)\s+(.+)$/i;
  const playMatch = text.match(playRegex);
  if (playMatch) {
    const songName = playMatch[1].trim();
    // Exclude common chat requests
    const isExcluded = /^(?:a\s+game|roles|sketches|with|around|here|along)/i.test(songName);
    if (!isExcluded) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`, '_blank');
      window.showToast(`Opening YouTube search for "${songName}" in a new tab! 🎵`, "info");
    }
  } else if (text.toLowerCase() === "play" || text.toLowerCase() === "play music") {
    window.open(`https://www.youtube.com`, '_blank');
    window.showToast("Opening YouTube in a new tab! 🎵", "info");
  }
  
  let msgText = text;
  if (!msgText && activeAttachedImageBase64) {
    msgText = "[Attached Image]";
  }
  
  const userMsg = { sender: "user", text: msgText };
  if (activeAttachedImageBase64 && activeAttachedImageMimeType) {
    userMsg.image = {
      mimeType: activeAttachedImageMimeType,
      data: activeAttachedImageBase64
    };
    
    if (activeAttachedImageOcrText) {
      userMsg.ocrText = activeAttachedImageOcrText;
    }
    
    // Clear attachment state
    activeAttachedImageBase64 = null;
    activeAttachedImageMimeType = null;
    activeAttachedImageOcrText = null;
    
    // Clear preview overlay in UI
    const previewOverlay = document.getElementById("ocrPreviewOverlay");
    if (previewOverlay) previewOverlay.style.display = "none";
  }
  
  // 1. Push user message
  chatHistory.push(userMsg);
  if (chatHistory.length > 45) chatHistory.shift();
  
  // 2. Auto-generate conversation title if New Chat
  updateSessionTitle(msgText);

  // 3. Save to local storage
  saveActiveSessionHistory();

  // 4. Render logs
  renderMessagesLog();

  // 5. Send API request
  processMessage(msgText);
}

// Binds sheet drawers and prompt macros
function setupChatEvents() {
  const btnNewChat = document.getElementById("btnNewChat");
  if (btnNewChat) {
    btnNewChat.addEventListener("click", () => {
      createNewSession("New Chat", activeAgent);
      renderHistorySidebar();
      renderMessagesLog();
      window.showToast("New conversation started.", "info");
    });
  }

  chatDom.btnSend.addEventListener("click", handleSend);
  chatDom.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Stop response button
  if (chatDom.btnStop) {
    chatDom.btnStop.addEventListener("click", () => {
      // Abort active fetch request
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      // Stop active typewriter stream
      if (activeStreamInterval) {
        clearInterval(activeStreamInterval);
        activeStreamInterval = null;
      }
      // Stop TTS speech
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel();
      }
      // Hide loader
      hideScribbleLoader();
      // Reset core animation
      if (chatDom.blobWrapper) {
        chatDom.blobWrapper.className = `brain-sketch-wrapper ${activeState.apiKey ? 'syncing' : ''}`;
      }
      // Hide stop, show send
      chatDom.btnStop.style.display = "none";
      if (chatDom.btnSend) chatDom.btnSend.style.display = "";
      window.showToast("Response stopped.", "info");
    });
  }

  // Fullscreen toggle button
  if (chatDom.btnFullscreen) {
    chatDom.btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        chatDom.btnFullscreen.querySelector("span").textContent = "fullscreen_exit";
        chatDom.btnFullscreen.title = "Exit Fullscreen";
      } else {
        document.exitFullscreen().catch(() => {});
        chatDom.btnFullscreen.querySelector("span").textContent = "fullscreen";
        chatDom.btnFullscreen.title = "Toggle Fullscreen";
      }
    });

    // Listen for fullscreen changes from Escape key
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        chatDom.btnFullscreen.querySelector("span").textContent = "fullscreen";
        chatDom.btnFullscreen.title = "Toggle Fullscreen";
      }
    });
  }

  // OCR button triggers file input click
  chatDom.btnOcr.addEventListener("click", () => {
    chatDom.ocrFileInput.click();
  });

  chatDom.ocrFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      processOcrImage(file);
    }
  });

  // STT recording voice mic trigger
  chatDom.btnMic.addEventListener("click", () => {
    toggleRecording();
  });

  // Auto speak checkbox trigger (if present)
  if (chatDom.chatAutoSpeak) {
    chatDom.chatAutoSpeak.checked = !!activeState.autoSpeak;
    chatDom.chatAutoSpeak.addEventListener("change", (e) => {
      activeState.autoSpeak = e.target.checked;
      window.saveConfig(activeState);
      window.showToast(`Auto-speak ${activeState.autoSpeak ? 'enabled' : 'disabled'}.`, "info");
      
      if (!activeState.autoSpeak && typeof speechSynthesis !== 'undefined') {
        speechSynthesis.cancel();
      }
    });
  }
  

  // Response size tuner change listener
  const responseTuner = document.getElementById("responseTuner");
  if (responseTuner) {
    responseTuner.value = activeState.responseTuner || "large";
    responseTuner.addEventListener("change", (e) => {
      activeState.responseTuner = e.target.value;
      window.saveConfig(activeState);
      window.showToast(`Response size tuned to: ${e.target.value.toUpperCase()}`, "success");
    });
  }
  // Sidebar collapse toggles
  const btnToggleLeftSidebar = document.getElementById("btnToggleLeftSidebar");
  const btnToggleRightSidebar = document.getElementById("btnToggleRightSidebar");
  const appLayoutWrapper = document.getElementById("appLayoutWrapper");

  if (btnToggleLeftSidebar && appLayoutWrapper) {
    btnToggleLeftSidebar.addEventListener("click", () => {
      appLayoutWrapper.classList.toggle("sidebar-left-collapsed");
    });
  }

  if (btnToggleRightSidebar && appLayoutWrapper) {
    btnToggleRightSidebar.addEventListener("click", () => {
      appLayoutWrapper.classList.toggle("sidebar-right-collapsed");
    });
  }

  // Input draw button opens/focuses right sidebar OCR panel
  if (chatDom.btnDraw && appLayoutWrapper) {
    chatDom.btnDraw.addEventListener("click", () => {
      appLayoutWrapper.classList.remove("sidebar-right-collapsed");
      window.showToast("Drag & Drop images into the right sidebar to read text!", "info");
    });
  }

}

window.addEventListener("DOMContentLoaded", () => {
  activeState = window.loadConfig();
  
  // Set custom chat title
  chatDom.chatTitle.textContent = activeState.assistantName;
  
  // Bind actions
  setupChatEvents();
  setupSpeechToText();
  initDragAndDropOcr();
  initSpecialistAgents();
  
  // Initialize ChatGPT-style chat history
  loadSessions();
  renderHistorySidebar();
  renderMessagesLog();

  // Try to sync/restore previous sessions from Supabase database
  syncSessionsFromDb();

  // Update initial active status indicator chip
  updateStatusIndicator();
  
  // Initialize interactive text selection tooltip
  initSelectionTooltip();
  
  // Set initial telemetry mood
  const telemetryMood = document.getElementById("telemetryMood");
  if (telemetryMood && activeState.userMood) {
    telemetryMood.textContent = activeState.userMood;
  }

  // Update core indicator animation
  if (chatDom.blobWrapper) {
    chatDom.blobWrapper.className = `brain-sketch-wrapper ${activeState.apiKey ? 'syncing' : ''}`;
  }
});

// --------------------------------------------------------------------------
// DRAG AND DROP IMAGE OCR ENGINE
// --------------------------------------------------------------------------
function initDragAndDropOcr() {
  const dropzone = document.getElementById("ocrDropzone");
  const fileInput = document.getElementById("sidebarOcrFileInput");
  const progressOverlay = document.getElementById("ocrProgressOverlay");
  const progressText = document.getElementById("ocrProgressText");
  const previewOverlay = document.getElementById("ocrPreviewOverlay");
  const previewImg = document.getElementById("ocrPreviewImg");
  const btnRemovePreview = document.getElementById("btnRemoveOcrPreview");

  if (!dropzone || !fileInput) return;

  // Clicking the dropzone opens the hidden file input
  dropzone.addEventListener("click", (e) => {
    if (e.target === btnRemovePreview || btnRemovePreview?.contains(e.target)) {
      return;
    }
    fileInput.click();
  });

  // Link the bottom OCR button shortcut to this dropzone file selector
  if (chatDom.btnOcr) {
    chatDom.btnOcr.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  // Handle file selections
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) processOcrImage(file);
  });

  // Drag & drop highlights
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.add("dragover");
    }, false);
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.remove("dragover");
    }, false);
  });

  // Handle drops
  dropzone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file && file.type.startsWith("image/")) {
      processOcrImage(file);
    } else {
      window.showToast("Please drop a valid image file.", "error");
    }
  });

  // Clear preview
  if (btnRemovePreview) {
    btnRemovePreview.addEventListener("click", (e) => {
      e.stopPropagation();
      if (previewOverlay) previewOverlay.style.display = "none";
      if (previewImg) previewImg.src = "";
      fileInput.value = "";
      activeAttachedImageBase64 = null;
      activeAttachedImageMimeType = null;
      activeAttachedImageOcrText = null;
    });
  }
}



// Bind specialist index divider bookmarks
function initSpecialistAgents() {
  const tabs = document.querySelectorAll(".sidebar-agent-btn");
  
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const agent = tab.getAttribute("data-agent");
      setActiveAgentTab(agent);
      
      // Update agent in active session
      const activeSession = chatSessions.find(s => s.id === activeSessionId);
      if (activeSession && activeSession.agent !== agent) {
        activeSession.agent = agent;
        saveSessionsList();
        renderHistorySidebar();
      }
    });
  });
}

function setActiveAgentTab(agent) {
  // Save current activeAgent's history before switching
  if (activeSessionId && activeAgent && activeAgent !== agent) {
    saveActiveSessionHistory();
  }

  // Trigger page fold transition and add workspace theme class
  const appLayoutWrapper = document.getElementById("appLayoutWrapper");
  if (appLayoutWrapper) {
    appLayoutWrapper.classList.add("page-fold-transitioning");
    
    setTimeout(() => {
      // Remove any existing workspace classes
      const classes = Array.from(appLayoutWrapper.classList);
      classes.forEach(c => {
        if (c.startsWith("workspace-")) {
          appLayoutWrapper.classList.remove(c);
        }
      });
      appLayoutWrapper.classList.add("workspace-" + agent);
    }, 150);

    setTimeout(() => {
      appLayoutWrapper.classList.remove("page-fold-transitioning");
    }, 300);
  }

  activeAgent = agent;
  localStorage.setItem("friday_active_agent", agent);

  // Update active tab class
  const tabs = document.querySelectorAll(".sidebar-agent-btn");
  tabs.forEach(t => {
    if (t.getAttribute("data-agent") === agent) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });

  // Update Visualizer label and titles
  const visualizerText = chatDom.visualizerText;
  const chatTitle = chatDom.chatTitle;

  let nameSuffix = "Core";
  let shortLabel = "P.";
  
  if (agent === "maths") {
    nameSuffix = "Maths Solver";
    shortLabel = "M.";
  } else if (agent === "physics") {
    nameSuffix = "Physics Sketcher";
    shortLabel = "P.";
  } else if (agent === "english") {
    nameSuffix = "Poetry & English";
    shortLabel = "E.";
  } else if (agent === "cs") {
    nameSuffix = "CS Compiler";
    shortLabel = "C.";
  } else if (agent === "image") {
    nameSuffix = "Artistic Illustrator";
    shortLabel = "I.";
  } else if (agent === "youtube") {
    nameSuffix = "YouTube Companion";
    shortLabel = "Y.";
  } else if (agent === "translate") {
    nameSuffix = "Translation Specialist";
    shortLabel = "T.";
  } else if (agent === "web") {
    nameSuffix = "Search Explorer";
    shortLabel = "W.";
  }

  if (visualizerText) visualizerText.textContent = shortLabel;
  if (chatTitle) chatTitle.textContent = nameSuffix;

  // Update telemetry details in sidebar
  const telemetryPersona = document.getElementById("telemetryPersona");
  if (telemetryPersona) {
    telemetryPersona.textContent = nameSuffix;
  }

  // Update visual theme seed match dynamically
  let tabSeed = "#6750A4"; // Purple default
  if (agent === "maths") tabSeed = "#006A6A"; // Teal
  if (agent === "physics") tabSeed = "#8B5000"; // Amber
  if (agent === "english") tabSeed = "#BA1A1A"; // Rose
  if (agent === "cs") tabSeed = "#005FAF"; // Blue
  if (agent === "image") tabSeed = "#d97706"; // Orange
  if (agent === "youtube") tabSeed = "#ff0000"; // Red
  if (agent === "translate") tabSeed = "#15803d"; // Green
  if (agent === "web") tabSeed = "#00838f"; // Cyan

  window.applyTheme(tabSeed);

  // Load new active history and re-render
  if (activeSessionId) {
    loadActiveSessionHistory();
    renderMessagesLog();
  }
}

// --------------------------------------------------------------------------
// CHAT HISTORY SESSION MANAGEMENT (ChatGPT-style)
// --------------------------------------------------------------------------
let chatSessions = [];
let activeSessionId = null;

function loadSessions() {
  try {
    const raw = localStorage.getItem("friday_chat_sessions");
    if (raw) {
      chatSessions = JSON.parse(raw);
    } else {
      chatSessions = [];
    }
  } catch (e) {
    console.error("Failed to load chat sessions", e);
    chatSessions = [];
  }

  activeSessionId = localStorage.getItem("friday_active_session_id");

  if (chatSessions.length === 0) {
    createNewSession("New Chat", localStorage.getItem("friday_active_agent") || "core");
  } else {
    const exists = chatSessions.some(s => s.id === activeSessionId);
    if (!exists) {
      activeSessionId = chatSessions[0].id;
      localStorage.setItem("friday_active_session_id", activeSessionId);
    }
  }

  // Restore active agent from loaded session
  const activeSession = chatSessions.find(s => s.id === activeSessionId);
  if (activeSession) {
    setActiveAgentTab(activeSession.agent || "core");
  } else {
    setActiveAgentTab(localStorage.getItem("friday_active_agent") || "core");
  }

  loadActiveSessionHistory();
}

function loadActiveSessionHistory() {
  try {
    const raw = localStorage.getItem(`friday_chat_messages_${activeSessionId}_${activeAgent}`);
    if (raw) {
      chatHistory = JSON.parse(raw);
    } else {
      chatHistory = [];
    }
  } catch (e) {
    console.error("Failed to load chat messages for session", activeSessionId, e);
    chatHistory = [];
  }
}

function saveActiveSessionHistory() {
  if (!activeSessionId) return;
  localStorage.setItem(`friday_chat_messages_${activeSessionId}_${activeAgent}`, JSON.stringify(chatHistory));
  triggerDbBackup();
}

function saveSessionsList() {
  localStorage.setItem("friday_chat_sessions", JSON.stringify(chatSessions));
  triggerDbBackup();
}

async function triggerDbBackup() {
  try {
    // 1. Sync session list
    await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'sessions', data: chatSessions })
    });

    // 2. Sync active session messages
    if (activeSessionId) {
      await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `session_messages_${activeSessionId}_${activeAgent}`, data: chatHistory })
      });
    }
  } catch (e) {
    console.warn("Database backup failed:", e);
  }
}

async function syncSessionsFromDb() {
  try {
    const res = await fetch('/api/restore?key=sessions');
    if (res.ok) {
      const payload = await res.json();
      if (payload.status === 'success' && Array.isArray(payload.data) && payload.data.length > 0) {
        chatSessions = payload.data;
        localStorage.setItem("friday_chat_sessions", JSON.stringify(chatSessions));
        
        if (!activeSessionId || !chatSessions.some(s => s.id === activeSessionId)) {
          activeSessionId = chatSessions[0].id;
          localStorage.setItem("friday_active_session_id", activeSessionId);
        }

        const historyRes = await fetch(`/api/restore?key=session_messages_${activeSessionId}_${activeAgent}`);
        if (historyRes.ok) {
          const historyPayload = await historyRes.json();
          if (historyPayload.status === 'success' && Array.isArray(historyPayload.data)) {
            chatHistory = historyPayload.data;
            localStorage.setItem(`friday_chat_messages_${activeSessionId}_${activeAgent}`, JSON.stringify(chatHistory));
          }
        }
        
        renderHistorySidebar();
        renderMessagesLog();

        // Sync active agent tab UI to match
        const activeSession = chatSessions.find(s => s.id === activeSessionId);
        if (activeSession) {
          setActiveAgentTab(activeSession.agent);
        }
        
        updateStatusIndicator("online");
        return;
      }
    }
    updateStatusIndicator("offline");
  } catch (e) {
    console.warn("Could not sync sessions from DB on startup, using local storage:", e);
    updateStatusIndicator("offline");
  }
}

function createNewSession(title = "New Chat", agent = "core") {
  const newId = "session_" + Date.now();
  const sessionObj = {
    id: newId,
    title: title,
    agent: agent
  };
  chatSessions.unshift(sessionObj);
  activeSessionId = newId;
  localStorage.setItem("friday_active_session_id", activeSessionId);
  chatHistory = [];
  
  saveSessionsList();
  saveActiveSessionHistory();
  setActiveAgentTab(agent);
}

async function deleteSession(sessionId, event) {
  if (event) event.stopPropagation();

  if (chatSessions.length <= 1) {
    window.showToast("Cannot delete the only remaining session.", "info");
    return;
  }

  if (!confirm("Are you sure you want to delete this conversation?")) {
    return;
  }

  localStorage.removeItem(`friday_chat_messages_${sessionId}`);
  chatSessions = chatSessions.filter(s => s.id !== sessionId);

  if (activeSessionId === sessionId) {
    activeSessionId = chatSessions[0].id;
    localStorage.setItem("friday_active_session_id", activeSessionId);
  }

  saveSessionsList();
  loadActiveSessionHistory();

  try {
    await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'sessions', data: chatSessions })
    });
  } catch (e) {}

  renderHistorySidebar();
  renderMessagesLog();
  
  const activeSession = chatSessions.find(s => s.id === activeSessionId);
  if (activeSession) {
    setActiveAgentTab(activeSession.agent);
  }
}

function updateSessionTitle(firstPrompt) {
  const activeSession = chatSessions.find(s => s.id === activeSessionId);
  if (activeSession && activeSession.title === "New Chat") {
    let title = firstPrompt.trim().substring(0, 24);
    if (firstPrompt.length > 24) title += "...";
    activeSession.title = title;
    saveSessionsList();
    renderHistorySidebar();
  }
}

function renderHistorySidebar() {
  const container = document.getElementById("historyList");
  if (!container) return;

  container.innerHTML = "";

  chatSessions.forEach(session => {
    const item = document.createElement("div");
    item.className = `history-item ${session.id === activeSessionId ? 'active' : ''}`;
    
    let icon = "psychology";
    if (session.agent === "maths") icon = "calculate";
    if (session.agent === "physics") icon = "science";
    if (session.agent === "english") icon = "history_edu";
    if (session.agent === "cs") icon = "terminal";
    if (session.agent === "image") icon = "image";
    if (session.agent === "youtube") icon = "smart_display";
    if (session.agent === "translate") icon = "g_translate";

    item.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 1.25rem; opacity: 0.8;">${icon}</span>
      <span class="history-item-title">${escapeHtml(session.title)}</span>
      <div class="history-item-actions">
        <button type="button" class="history-item-btn btn-delete" title="Delete conversation">
          <span class="material-symbols-outlined" style="font-size: 1.15rem;">delete</span>
        </button>
      </div>
    `;

    item.addEventListener("click", () => {
      selectSession(session.id);
    });

    const delBtn = item.querySelector(".btn-delete");
    if (delBtn) {
      delBtn.addEventListener("click", (e) => {
        deleteSession(session.id, e);
      });
    }

    container.appendChild(item);
  });
}

function selectSession(sessionId) {
  if (activeSessionId === sessionId) return;

  activeSessionId = sessionId;
  localStorage.setItem("friday_active_session_id", activeSessionId);
  
  renderHistorySidebar();

  const session = chatSessions.find(s => s.id === sessionId);
  if (session) {
    setActiveAgentTab(session.agent || "core");
  }
}

function renderMessagesLog() {
  chatDom.chatMessages.innerHTML = "";
  
  if (chatHistory.length === 0) {
    const welcomeText = `Neural synchronization active. Hello, I am **${activeState.assistantName}**. 

I have loaded your baseline profile and synchronized my reasoning engines with your system key. Feel free to adjust parameters in the Settings tab or switch specialized agents using the bookmarks on the left.

What would you like to explore today?`;
    addCompanionMessage(welcomeText);
    chatHistory.push({ sender: "companion", text: welcomeText });
    saveActiveSessionHistory();
  } else {
    chatHistory.forEach(msg => {
      if (msg.sender === "user") {
        addUserMessage(msg.text, msg.image);
      } else {
        addCompanionMessage(msg.text, msg.sources);
      }
    });
  }
  scrollChat();
}

/**
 * Adds an assistant message bubble instantly (without streaming).
 * Used when loading previous chat history.
 */
function addCompanionMessage(text, sources = null) {
  const msgEl = document.createElement("div");
  msgEl.className = "message companion";
  
  const randRot = (Math.random() * 2 - 1).toFixed(2);
  msgEl.style.transform = `rotate(${randRot}deg)`;

  const citedText = replaceCitationNumbers(text, sources);

  msgEl.innerHTML = `
    <span class="message-label">${activeState.assistantName}</span>
    <div class="message-bubble">
      <div class="message-bubble-header">
        <button type="button" class="btn-speak" title="Read Aloud" data-text="${escapeHtml(text)}">
          <span class="material-symbols-outlined" style="font-size: 1.15rem;">volume_up</span> Speak
        </button>
      </div>
      <div class="bubble-stream-content">${parseSimpleMarkdown(citedText)}</div>
    </div>
  `;
  
  chatDom.chatMessages.appendChild(msgEl);
  bindCodeRunnerListeners(msgEl);
  renderSourcesUsed(msgEl.querySelector(".message-bubble"), sources);
  
  const playBtn = msgEl.querySelector(".btn-speak");
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      speakText(text);
    });
  }
}

/**
 * Updates the syncStatusChip and syncStatusLabel dynamically to reflect
 * active API core status and database cloud connection status.

 */
function updateStatusIndicator(syncState = null) {
  const chip = document.getElementById("syncStatusChip");
  const label = document.getElementById("syncStatusLabel");
  if (!chip || !label) return;

  const selectedModel = activeState.backendModel || "mistral-large-latest";
  const isFreeModel = (!selectedModel.includes("mistral") && !activeState.apiKey) || selectedModel.includes(":free") || selectedModel.includes("llama") || selectedModel.includes("qwen") || selectedModel.includes("gemma");
  
  let statusText = "";
  if (isFreeModel) {
    chip.className = "status-chip free-mode";
    statusText = "AI Core: Free Mode";
  } else {
    chip.className = "status-chip online";
    if (selectedModel.includes("minimax")) {
      statusText = "MiniMax NIM: Synced";
    } else if (selectedModel.includes("sarvam")) {
      statusText = "Sarvam NIM: Synced";
    } else if (selectedModel.includes("kimi")) {
      statusText = "Kimi NIM: Synced";
    } else if (selectedModel.includes("mistral")) {
      statusText = "Mistral Core: Synced";
    } else {
      statusText = "Gemini Core: Synced";
    }
  }

  // Update cloud sync status
  if (syncState === "offline") {
    label.innerHTML = `${statusText} // Cloud: Offline`;
  } else {
    label.innerHTML = `${statusText} // Cloud: Connected`;
  }
}

// --------------------------------------------------------------------------
// INTERACTIVE PAPER TEXT SELECTION TOOLTIP
// --------------------------------------------------------------------------
let activeSelectionTooltip = null;

function initSelectionTooltip() {
  document.addEventListener("mouseup", (e) => {
    setTimeout(() => {
      handleTextSelection(e);
    }, 10);
  });
}

function handleTextSelection(e) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  const chatMessages = chatDom.chatMessages;

  if (!selectedText || !chatMessages || !chatMessages.contains(selection.anchorNode)) {
    removeSelectionTooltip();
    return;
  }

  try {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) {
      removeSelectionTooltip();
      return;
    }

    if (!activeSelectionTooltip) {
      activeSelectionTooltip = document.createElement("div");
      activeSelectionTooltip.className = "interactive-selection-tooltip";
      activeSelectionTooltip.innerHTML = `
        <button type="button" id="btnExplainSelection">Explain this</button>
        <span style="color:var(--color-pencil); opacity:0.3; padding: 0 2px;">|</span>
        <button type="button" id="btnAskSelection">Ask AI</button>
      `;
      document.body.appendChild(activeSelectionTooltip);

      document.getElementById("btnExplainSelection").addEventListener("click", (evt) => {
        evt.stopPropagation();
        const textToExplain = selectedText;
        removeSelectionTooltip();
        selection.removeAllRanges();
        
        const promptText = `Explain this context from our chat: "${textToExplain}"`;
        if (chatDom.chatInput) {
          chatDom.chatInput.value = promptText;
          chatDom.chatInput.dispatchEvent(new Event('input', { bubbles: true }));
          submitUserMessage();
        }
      });

      document.getElementById("btnAskSelection").addEventListener("click", (evt) => {
        evt.stopPropagation();
        const textToAsk = selectedText;
        removeSelectionTooltip();
        selection.removeAllRanges();
        
        if (chatDom.chatInput) {
          chatDom.chatInput.value = `Regarding: "${textToAsk}", `;
          chatDom.chatInput.focus();
          chatDom.chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }

    activeSelectionTooltip.style.top = `${window.scrollY + rect.top - 10}px`;
    activeSelectionTooltip.style.left = `${window.scrollX + rect.left + (rect.width / 2)}px`;
  } catch (err) {
    removeSelectionTooltip();
  }
}

function removeSelectionTooltip() {
  if (activeSelectionTooltip) {
    activeSelectionTooltip.remove();
    activeSelectionTooltip = null;
  }
}
