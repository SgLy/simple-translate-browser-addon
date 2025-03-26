document.addEventListener('DOMContentLoaded', async () => {
  const status = (() => {
    const el = document.getElementById('status');
    if (el !== null) return el as HTMLDivElement;
    const newEl = document.createElement('div');
    newEl.id = 'status';
    document.body.appendChild(newEl);
    return newEl;
  })();

  const apiKeyElement = document.getElementById('api-key');
  const targetLangElement = document.getElementById('target-lang');
  const saveSettingsElement = document.getElementById('save-settings');
  const translateElement = document.getElementById('translate');

  if (
    apiKeyElement === null ||
    targetLangElement === null ||
    saveSettingsElement === null ||
    translateElement === null
  ) {
    status.innerText = 'Error: unexpected html structure';
    status.style.color = 'red';
    return;
  }

  const apiKeyInput = apiKeyElement as HTMLInputElement;
  const targetLangInput = targetLangElement as HTMLInputElement;
  const saveSettingsButton = saveSettingsElement as HTMLButtonElement;
  const translateButton = translateElement as HTMLButtonElement;

  // Load saved settings
  const { targetLang = 'EN', apiKey = '' } = await browser.storage.local.get(['targetLang', 'apiKey']);
  apiKeyInput.value = apiKey;
  targetLangInput.value = targetLang;

  // Save settings
  saveSettingsButton.addEventListener('click', () => {
    browser.storage.local.set({
      apiKey: apiKeyInput.value,
      targetLang: targetLangInput.value,
    });
    status.innerText = 'Settings saved.';
    status.style.color = 'green';
  });

  // Translate text
  translateButton.addEventListener('click', async () => {
    const activeTab = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab.length !== 1) return;
    const tabId = activeTab[0].id;
    if (tabId === undefined) return;
    browser.runtime.sendMessage({ action: 'toggleTranslation', enabled: true, tabId });
    window.close();
  });
});
