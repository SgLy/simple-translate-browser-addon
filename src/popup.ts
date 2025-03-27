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
  const saveSettingsElement = document.getElementById('save-settings');
  const translateElement = document.getElementById('translate');

  if (settingElements.some(el => el === null) || saveSettingsElement === null || translateElement === null) {
    status.innerText = 'Error: unexpected html structure';
    status.style.color = 'red';
    return;
  }

  const settingsInputs = settingElements as unknown as HTMLInputElement[];
  const saveSettingsButton = saveSettingsElement as HTMLButtonElement;
  const translateButton = translateElement as HTMLButtonElement;

  const settings = await browser.storage.local.get(translateSettingsKeys);
  translateSettingsKeys.forEach((key, i) => {
    settingsInputs[i].value = settings[key] || '';
  });

  saveSettingsButton.addEventListener('click', () => {
    const settings = {} as TranslateSettings;
    translateSettingsKeys.forEach((key, i) => {
      settings[key] = settingsInputs[i].value;
    });
    browser.storage.local.set(settings);
    status.innerText = 'Settings saved.';
    status.style.color = 'green';
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
