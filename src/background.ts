let translationEnabled = false;

// Handle browser action click
browser.browserAction.onClicked.addListener((tab) => {
  translationEnabled = !translationEnabled;
  
  // Update icon state
  const path = translationEnabled ? "icons/icon-active-48.png" : "icons/icon-48.png";
  browser.browserAction.setIcon({ path: path });
  
  // Send state to content script
  browser.tabs.sendMessage(tab.id, {
    action: "toggleTranslation",
    enabled: translationEnabled
  });
});

// Handle translation requests
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translateText") {
    browser.storage.local.get(['targetLang', 'apiKey'], (result) => {
      const targetLang = result.targetLang || 'EN';
      const apiKey = result.apiKey;

      if (!apiKey) {
        alert('Please set your API key in the extension settings');
        return;
      }

      translateText(request.text, targetLang, apiKey)
        .then(translation => {
          browser.tabs.sendMessage(sender.tab.id, {
            action: "showTranslation",
            translation: translation,
            position: request.position
          });
        })
        .catch(error => console.error('Translation error:', error));
    });
  }
});

function translateText(text, targetLang, apiKey) {
  return fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `DeepL-Auth-Key ${apiKey}`
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLang
    })
  })
  .then(response => response.json())
  .then(data => data.translations[0].text);
}