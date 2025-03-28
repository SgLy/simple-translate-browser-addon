import type { TranslateSettings } from './utils';
import { Action, camelToDash, sendToRuntime, translateSettingsKeys } from './utils';

document.addEventListener('DOMContentLoaded', async () => {
  const status = (() => {
    const el = document.getElementById('status');
    if (el !== null) return el as HTMLDivElement;
    const newEl = document.createElement('div');
    newEl.id = 'status';
    document.body.appendChild(newEl);
    return newEl;
  })();

  const settingElements = translateSettingsKeys.map(key => document.getElementById(camelToDash(key)));
  const translateElement = document.getElementById('translate');

  if (settingElements.some(el => el === null) || translateElement === null) {
    status.innerText = 'Error: unexpected html structure';
    status.className = 'error';
    return;
  }

  const settingsInputs = settingElements as unknown as HTMLInputElement[];
  const translateButton = translateElement as HTMLButtonElement;

  const settings = (await browser.storage.local.get(translateSettingsKeys)) as TranslateSettings;
  translateSettingsKeys.forEach((key, i) => {
    settingsInputs[i].value = settings[key] || '';
  });

  settingsInputs.forEach((input, i) => {
    input.addEventListener('change', () => {
      settings[translateSettingsKeys[i]] = input.value;
      browser.storage.local.set(settings);
      status.innerText = `Settings saved: ${translateSettingsKeys[i]}`;
      status.className = 'success';
    });
  });

  // Translate text
  translateButton.addEventListener('click', async () => {
    const activeTab = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab.length !== 1) return;
    const tabId = activeTab[0].id;
    if (tabId === undefined) return;
    sendToRuntime(Action.EnableElementPickBackground, { tabId });
    window.close();
  });
});
