export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'MINIMAX_API_KEY not set' } });
  }

  try {
    const body = req.body;
    
    let userMessage = '';
    let imageBase64 = null;
    
    for (const msg of body.messages || []) {
      if (msg.role === 'user' && msg.content) {
        for (const content of msg.content) {
          if (content.type === 'text') {
            userMessage += content.text + '\n';
          } else if (content.type === 'image') {
            imageBase64 = content.source?.data;
          }
        }
      }
    }

    const messages = [];
    if (body.system) messages.push({ role: 'system', content: body.system });
    
    const userContent = [];
    if (imageBase64) {
      userContent.push({ type: 'image', image_url: `data:image/jpeg;base64,${imageBase64}` });
    }
    if (userMessage) {
      userContent.push({ type: 'text', text: userMessage });
    }
    if (userContent.length > 0) {
      messages.push({ role: 'user', content: userContent });
    }

    const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        max_tokens: body.max_tokens || 2000,
        messages: messages
      })
    });

    const data = await response.json();
    
    let responseText = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      responseText = data.choices[0].message.content;
    } else if (data.error) {
      return res.status(400).json({ error: { message: data.error.message || 'API error' } });
    }

    return res.status(200).json({
      content: [{ type: 'text', text: responseText }]
    });
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
