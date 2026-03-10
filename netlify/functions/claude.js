exports.handler = async function(event) {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { message: "MINIMAX_API_KEY not set" } })
    };
  }

  try {
    const body = JSON.parse(event.body);
    
    // Convert Anthropic format to Minimax
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

    const response = await fetch("https://api.minimax.chat/v1/text/chatcompletion_v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "MiniMax-Text-01",
        max_tokens: body.max_tokens || 2000,
        messages: messages
      })
    });

    const data = await response.json();
    
    // Convert back to Anthropic format
    let responseText = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      responseText = data.choices[0].message.content;
    } else if (data.error) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: { message: data.error.message || 'API error' } })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        content: [{ type: 'text', text: responseText }]
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: { message: err.message } })
    };
  }
};
