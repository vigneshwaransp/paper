export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Nvidia-Api-Key,X-Mistral-Api-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { messages, model, temperature } = req.body;
    const selectedModel = model || "google/gemini-2.5-flash";
    const isMistral = selectedModel.includes("mistral");

    let url = "https://integrate.api.nvidia.com/v1/chat/completions";
    let apiKey = req.headers['x-nvidia-api-key'] || process.env.FRIDAY_NVIDIA_API_KEY || "";

    if (isMistral) {
      url = "https://api.mistral.ai/v1/chat/completions";
      apiKey = req.headers['x-mistral-api-key'] || process.env.FRIDAY_MISTRAL_API_KEY || "";
    }

    if (!apiKey) {
      return res.status(400).json({ 
        status: 'error', 
        message: `API Key for ${isMistral ? 'Mistral' : 'NVIDIA'} is missing. Please configure it in Settings or set the environment variable.` 
      });
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
    return res.status(200).json({ status: "success", data: data });
  } catch (err) {
    console.error("api/completion error:", err.message, err.stack);
    return res.status(500).json({ status: "error", message: err.message });
  }
}
