document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const { targetLang = 'EN', apiKey = '' } = await browser.storage.local.get(['targetLang', 'apiKey']);
  document.getElementById('api-key').value = apiKey;
  document.getElementById('target-lang').value = targetLang;

  // Save settings
  document.getElementById('save-settings').addEventListener('click', () => {
    browser.storage.local.set({
      apiKey: document.getElementById('api-key').value,
      targetLang: document.getElementById('target-lang').value
    });
    alert('Settings saved!');
  });
});
