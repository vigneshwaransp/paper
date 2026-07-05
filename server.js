/* ==========================================================================
   F.R.I.D.A.Y. local host static server with Supabase Sync Endpoints
   ========================================================================== */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Load local .env variables
if (fs.existsSync('.env')) {
  const envText = fs.readFileSync('.env', 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.trim().match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = value;
    }
  });
}

// Import database client
let sql = null;
try {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
    const dbModule = await import('./db.js');
    sql = dbModule.default;
    
    // Auto-create Friday sync table on startup
    await sql`
      CREATE TABLE IF NOT EXISTS friday_sync (
        key VARCHAR(50) PRIMARY KEY,
        data JSONB
      );
    `;
    console.log("Supabase PostgreSQL sync table initialized successfully!");
  } else {
    console.warn("⚠️ Supabase: DATABASE_URL is missing or password is placeholder. DB features disabled until configured in .env.");
  }
} catch (err) {
  console.error("⚠️ Supabase connection failed:", err.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Mistral-Api-Key, X-Nvidia-Api-Key');

  // Handle preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const safeUrl = req.url.split('?')[0];

  // API Route: Backup (POST)
  if (req.method === 'POST' && safeUrl === '/api/backup') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        if (!sql) throw new Error("Database offline. Check your .env credentials.");
        
        const payload = JSON.parse(bodyText);
        const { key, data } = payload;
        if (!key) throw new Error("Missing sync key.");

        // Upsert query
        await sql`
          INSERT INTO friday_sync (key, data)
          VALUES (${key}, ${JSON.stringify(data)})
          ON CONFLICT (key)
          DO UPDATE SET data = EXCLUDED.data
        `;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "success", message: "Saved to Supabase!" }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "error", message: err.message }));
      }
    });
    return;
  }

  // API Route: Restore (GET)
  if (req.method === 'GET' && safeUrl === '/api/restore') {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const key = urlObj.searchParams.get('key');
    try {
      if (!sql) throw new Error("Database offline. Check your .env credentials.");
      if (!key) throw new Error("Missing query key parameter.");

      const result = await sql`
        SELECT data FROM friday_sync WHERE key = ${key}
      `;

      if (result.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "error", message: "Record not found" }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: "success", data: result[0].data }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: "error", message: err.message }));
    }
    return;
  }

  // API Route: Completion proxy for Nvidia API (POST)
  if (req.method === 'POST' && safeUrl === '/api/completion') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyText);
        const { messages, model, temperature } = payload;
        const selectedModel = model || "google/gemini-2.5-flash";
        const isMistral = selectedModel.includes("mistral");

        let url = "https://integrate.api.nvidia.com/v1/chat/completions";
        let apiKey = req.headers['x-nvidia-api-key'] || process.env.FRIDAY_NVIDIA_API_KEY || "";

        if (isMistral) {
          url = "https://api.mistral.ai/v1/chat/completions";
          apiKey = req.headers['x-mistral-api-key'] || process.env.FRIDAY_MISTRAL_API_KEY || "";
        }

        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: `API Key for ${isMistral ? 'Mistral' : 'NVIDIA'} is missing. Please configure it in Settings or set the environment variable.` 
          }));
          return;
        }


        const apiRes = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: messages,
            temperature: temperature || 0.5,
            max_tokens: 1536
          })
        });

        if (!apiRes.ok) {
          const errText = await apiRes.text();
          throw new Error(`${isMistral ? 'Mistral' : 'Nvidia'} API returned ${apiRes.status}: ${errText}`);
        }

        const data = await apiRes.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "success", data: data }));
      } catch (err) {
        console.error("Local server /api/completion error:", err.message, err.stack);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "error", message: err.message }));
      }
    });
    return;
  }
  
  // API Route: Compile and run Java code using local OpenJDK (POST)
  if (req.method === 'POST' && safeUrl === '/api/run-java') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      let tempDir = '';
      let javaFile = '';
      try {
        const payload = JSON.parse(bodyText);
        const { code } = payload;
        if (!code) throw new Error("Missing Java code payload.");

        // Find public class name or fallback to Main
        const classMatch = code.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
        const className = classMatch ? classMatch[1] : "Main";

        // Create temporary directory inside workspace
        tempDir = path.join(__dirname, 'temp_java_' + Date.now());
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
        }

        javaFile = path.join(tempDir, `${className}.java`);
        fs.writeFileSync(javaFile, code, 'utf8');

        // Compile Java code
        const compileCmd = `javac "${javaFile}"`;
        exec(compileCmd, (compileErr, compileStdout, compileStderr) => {
          if (compileErr || compileStderr) {
            // Cleanup temp directory
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: "error", 
              message: "Compilation Failed", 
              output: compileStderr || compileErr.message 
            }));
            return;
          }

          // Run Java code
          const runCmd = `java -cp "${tempDir}" ${className}`;
          exec(runCmd, { timeout: 10000 }, (runErr, runStdout, runStderr) => {
            // Cleanup temp directory
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: "success",
              output: runStdout,
              error: runStderr || (runErr ? runErr.message : "")
            }));
          });
        });
      } catch (err) {
        // Cleanup temp directory if error occurs before compilation completes
        if (tempDir && fs.existsSync(tempDir)) {
          try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "error", message: err.message }));
      }
    });
    return;
  }


  // API Route: Web Search (GET)
  if (req.method === 'GET' && safeUrl === '/api/search') {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const q = urlObj.searchParams.get('q');
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Missing query parameter 'q'" }));
      return;
    }

    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    try {
      const response = await fetch(`https://search.yahoo.com/search?p=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': userAgent }
      });

      if (!response.ok) {
        throw new Error(`Yahoo Search returned status ${response.status}`);
      }

      const html = await response.text();
      const results = [];
      const parts = html.split(/href="(https?:\/\/r\.search\.yahoo\.com\/_ylt=[^"]+)"/gi);

      for (let i = 1; i < parts.length - 1; i += 2) {
        const rawUrl = parts[i];
        const block = parts[i + 1];

        let url = '';
        try {
          if (rawUrl.includes('/RU=')) {
            const ruPart = rawUrl.split('/RU=')[1].split('/')[0];
            url = decodeURIComponent(ruPart);
          }
        } catch (e) {}

        if (!url || url.includes('yahoo.com')) continue;

        const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) || block.match(/<span[^>]*class="[^"]*fc-2015C2[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        let title = '';
        if (titleMatch) {
          title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
        }

        const descMatch = block.match(/<div\s+class="compText[^>]*>([\s\S]*?)<\/div>/i) || 
                          block.match(/<p\s+class="lh-16[^>]*>([\s\S]*?)<\/p>/i) ||
                          block.match(/<span\s+class="fc-2nd[^>]*>([\s\S]*?)<\/span>/i);
        let snippet = '';
        if (descMatch) {
          snippet = descMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
        }

        if (title && url && snippet) {
          if (!results.some(r => r.url === url)) {
            results.push({ title, url, snippet });
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: "success", results: results.slice(0, 5) }));
    } catch (err) {
      console.error("Search API error:", err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static files server fallback
  let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access Denied');
    return;
  }

  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 File Not Found</h1><p>The requested asset could not be located on the local companion server.</p>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Internal Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`F.R.I.D.A.Y. Companion Interface active!`);
  console.log(`Open: http://localhost:${PORT}`);
  console.log('====================================================');
});
