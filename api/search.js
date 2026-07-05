export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse query string from URL manually since req.query might be empty on direct native http requests
  const urlObj = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const q = urlObj.searchParams.get('q');

  if (!q) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
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

    return res.status(200).json({ status: "success", results: results.slice(0, 5) });
  } catch (err) {
    console.error("Search API Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
