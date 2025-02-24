// Advanced Telegram Bot for Website Code Extraction (HTML, CSS, JavaScript)
// Designed for Cloudflare Workers with Channel Membership Verification

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// Configuration - Replace with your actual values
const BOT_TOKEN = '7214700180:AAFaJv9C2w3XnKkOyOBtRCnnmrgbWYMpA7U';
const REQUIRED_CHANNEL = 'Codebotx'; // Your channel username with @ symbol
const CHANNEL_LINK = 'https://t.me/Codebotx'; // Link to your channel
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function handleRequest(request) {
  if (request.method === 'POST') {
    const payload = await request.json();
    
    // Check if this is a message from Telegram
    if (payload.message) {
      const chatId = payload.message.chat.id;
      const userId = payload.message.from.id;
      const text = payload.message.text || '';
      
      // Check channel membership first
      const isMember = await checkChannelMembership(userId);
      
      // Handle /start command
      if (text === '/start') {
        if (!isMember) {
          return sendMessage(chatId, 
            `👋 Welcome to Website Code Extractor Bot!\n\n` +
            `⚠️ You must join our channel ${REQUIRED_CHANNEL} to use this bot.\n\n` +
            `After joining, send /verify to start using the bot.`,
            true
          );
        } else {
          return sendMessage(chatId, 
            `✅ Welcome to Website Code Extractor Bot!\n\n` +
            `Send me any website URL, and I'll extract all HTML, CSS, and JavaScript code for you.\n\n` +
            `Simply send a complete URL (like https://example.com) and I'll do the rest!`
          );
        }
      }
      
      // Handle verification command
      if (text === '/verify') {
        if (!isMember) {
          return sendMessage(chatId, 
            `❌ Verification failed! You haven't joined our channel yet.\n\n` +
            `📱 <a href="${CHANNEL_LINK}">Join ${REQUIRED_CHANNEL}</a> and try again.`,
            true
          );
        } else {
          return sendMessage(chatId, 
            `✅ Verification successful!\n\n` +
            `You can now use this bot. Simply send any website URL to extract its code.`
          );
        }
      }
      
      // Check membership before processing any URL
      if (!isMember) {
        return sendMessage(chatId, 
          `⚠️ Access required: Join our channel first.\n\n` +
          `📱 <a href="${CHANNEL_LINK}">Join ${REQUIRED_CHANNEL}</a>\n\n` +
          `After joining, send /verify to use the bot.`,
          true
        );
      }
      
      // Handle URL input (only for members)
      if (text.startsWith('http')) {
        // Send "processing" message
        await sendMessage(chatId, "🔍 Processing website... Please wait a moment.");
        
        try {
          // Extract HTML, CSS, and JavaScript from the website
          const result = await extractWebsiteContent(text);
          
          // Send the extracted content
          if (result.html) {
            // Send HTML file
            await sendDocument(chatId, "website_html.txt", result.html);
            
            // Send CSS file if found
            if (result.css && result.css !== '/* No CSS found */') {
              await sendDocument(chatId, "website_css.txt", result.css);
            }
            
            // Send JS file if found
            if (result.js && result.js !== '/* No JavaScript found */') {
              await sendDocument(chatId, "website_javascript.txt", result.js);
            }
            
            // Send success message
            return sendMessage(chatId, 
              `✅ Website code successfully extracted!\n\n` +
              `📁 Files extracted:\n` +
              `- HTML: Complete\n` +
              `- CSS: ${result.css !== '/* No CSS found */' ? 'Complete' : 'Not found'}\n` +
              `- JavaScript: ${result.js !== '/* No JavaScript found */' ? 'Complete' : 'Not found'}`
            );
          } else {
            return sendMessage(chatId, "⚠️ Had some trouble extracting code from this website. Please verify the URL and try again.");
          }
        } catch (error) {
          return sendMessage(chatId, `❌ Error: ${error.message}`);
        }
      }
      
      // Default response for non-URL messages (for members)
      return sendMessage(chatId, "🔗 Please send a website URL (starting with https:// or http://) so I can extract its HTML, CSS, and JavaScript.");
    }
  }
  
  // Return OK for non-webhook requests
  return new Response('OK', { status: 200 });
}

async function checkChannelMembership(userId) {
  try {
    const url = `${TELEGRAM_API}/getChatMember`;
    const payload = {
      chat_id: REQUIRED_CHANNEL,
      user_id: userId
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.ok) {
      const status = result.result.status;
      // Member statuses that indicate membership: 'creator', 'administrator', 'member'
      return ['creator', 'administrator', 'member'].includes(status);
    }
    
    return false;
  } catch (error) {
    console.error('Error checking channel membership:', error);
    return false;
  }
}

async function extractWebsiteContent(url) {
  try {
    // Fetch the website content
    const response = await fetch(url);
    const html = await response.text();
    
    // CSS extraction (embedded and external)
    let css = '';
    
    // Extract embedded CSS
    const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = styleTagRegex.exec(html)) !== null) {
      css += styleMatch[1] + '\n\n';
    }
    
    // Extract external stylesheet URLs
    const linkRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
    const cssUrls = [];
    let linkMatch;
    
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      let cssUrl = linkMatch[1];
      
      // Handle relative URLs
      if (cssUrl.startsWith('//')) {
        cssUrl = 'https:' + cssUrl;
      } else if (cssUrl.startsWith('/')) {
        const urlObj = new URL(url);
        cssUrl = urlObj.origin + cssUrl;
      } else if (!cssUrl.startsWith('http')) {
        const urlObj = new URL(url);
        cssUrl = urlObj.origin + '/' + cssUrl;
      }
      
      cssUrls.push(cssUrl);
    }
    
    // Fetch external stylesheets
    const cssPromises = cssUrls.map(async cssUrl => {
      try {
        const cssResponse = await fetch(cssUrl);
        return await cssResponse.text();
      } catch (error) {
        return `/* Error fetching ${cssUrl}: ${error.message} */`;
      }
    });
    
    const cssResults = await Promise.all(cssPromises);
    css += cssResults.join('\n\n');
    
    // JavaScript extraction (embedded and external)
    let js = '';
    
    // Extract embedded JavaScript
    const scriptTagRegex = /<script(?![^>]*type=['"](?!text\/javascript))[^>]*>([\s\S]*?)<\/script>/gi;
    let scriptMatch;
    while ((scriptMatch = scriptTagRegex.exec(html)) !== null) {
      js += scriptMatch[1] + '\n\n';
    }
    
    // Extract external JavaScript URLs
    const scriptSrcRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi;
    const jsUrls = [];
    let scriptSrcMatch;
    
    while ((scriptSrcMatch = scriptSrcRegex.exec(html)) !== null) {
      let jsUrl = scriptSrcMatch[1];
      
      // Skip analytics scripts
      if (jsUrl.includes('function=') || 
          jsUrl.includes('analytics') || 
          jsUrl.includes('gtm.js') ||
          jsUrl.includes('googletagmanager')) {
        continue;
      }
      
      // Handle relative URLs
      if (jsUrl.startsWith('//')) {
        jsUrl = 'https:' + jsUrl;
      } else if (jsUrl.startsWith('/')) {
        const urlObj = new URL(url);
        jsUrl = urlObj.origin + jsUrl;
      } else if (!jsUrl.startsWith('http')) {
        const urlObj = new URL(url);
        jsUrl = urlObj.origin + '/' + jsUrl;
      }
      
      jsUrls.push(jsUrl);
    }
    
    // Fetch external JavaScript files
    const jsPromises = jsUrls.map(async jsUrl => {
      try {
        const jsResponse = await fetch(jsUrl);
        return `/* Source: ${jsUrl} */\n` + await jsResponse.text();
      } catch (error) {
        return `/* Error fetching ${jsUrl}: ${error.message} */`;
      }
    });
    
    const jsResults = await Promise.all(jsPromises);
    js += jsResults.join('\n\n');
    
    return {
      html: html,
      css: css || '/* No CSS found */',
      js: js || '/* No JavaScript found */'
    };
  } catch (error) {
    throw new Error(`Problem accessing website: ${error.message}`);
  }
}

async function sendMessage(chatId, text, allowWebPagePreview = false) {
  const url = `${TELEGRAM_API}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    disable_web_page_preview: !allowWebPagePreview
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  return new Response('OK', { status: 200 });
}

async function sendDocument(chatId, filename, content) {
  const url = `${TELEGRAM_API}/sendDocument`;
  
  // Create form data with file
  const formData = new FormData();
  formData.append('chat_id', chatId);
  formData.append('document', new Blob([content], { type: 'text/plain' }), filename);
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });
  
  return response;
}

// Function to set up webhook (run this once via browser)
async function setWebhook(workerUrl) {
  const webhookUrl = `${TELEGRAM_API}/setWebhook?url=${encodeURIComponent(workerUrl)}`;
  const response = await fetch(webhookUrl);
  const result = await response.json();
  console.log('Webhook setup result:', result);
  return result;
}
