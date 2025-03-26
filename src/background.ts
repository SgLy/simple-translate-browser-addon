let translationEnabled = false;

function toggleTranslation(tabId: number, enabled: boolean) {
  translationEnabled = enabled;

  // Update icon state
  // current color scheme
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const path = translationEnabled
    ? dark
      ? 'icons/icon-active-dark-48.png'
      : 'icons/icon-active-48.png'
    : dark
      ? 'icons/icon-dark-48.png'
      : 'icons/icon-48.png';
  browser.browserAction.setIcon({ path: { 48: path } });

  console.log(tabId, {
    action: 'toggleTranslation',
    enabled: translationEnabled,
  });
  // Send state to content script
  browser.tabs.sendMessage(tabId, {
    action: 'toggleTranslation',
    enabled: translationEnabled,
  });
}

// Handle translation requests
browser.runtime.onMessage.addListener(async (request, sender) => {
  if (request.action === 'translateText') {
    if (sender.tab?.id === undefined) return;
    const tabId: number = sender.tab?.id;
    const result = await browser.storage.local.get(['targetLang', 'apiKey']);
    const targetLang = result.targetLang || 'EN';
    const apiKey = result.apiKey;

    if (typeof apiKey !== 'string' || apiKey === '') {
      await browser.tabs.sendMessage(tabId, {
        action: 'alert',
        text: 'Please set your API key in the extension settings',
      });
      return;
    }

    const translation = await translateText(request.text, targetLang, apiKey);
    await browser.tabs.sendMessage(tabId, {
      action: 'showTranslation',
      translation: translation,
      elementId: request.elementId,
    });
  } else if (request.action === 'toggleTranslation') {
    toggleTranslation(sender.tab?.id || request.tabId, request.enabled);
  }
});

function translateText(text: string, targetLang: string, apiKey: string) {
  return new Promise<string>(resolve => {
    setTimeout(() => {
      resolve(text);
    }, 1000);
  });
  // return fetch('https://api-free.deepl.com/v2/translate', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     Authorization: `DeepL-Auth-Key ${apiKey}`,
  //   },
  //   body: JSON.stringify({
  //     text: [text],
  //     target_lang: targetLang,
  //   }),
  // })
  //   .then(response => response.json())
  //   .then(data => data.translations[0].text);
}
