import type { TranslateSettings } from './utils';
import { Action, camelToDash, defaultTranslateSettings, objectKeys, sendToRuntime } from './utils';

document.addEventListener('DOMContentLoaded', async () => {
  const status = (() => {
    const el = document.getElementById('status');
    if (el !== null) return el as HTMLDivElement;
    const newEl = document.createElement('div');
    newEl.id = 'status';
    document.body.appendChild(newEl);
    return newEl;
  })();

  const translateElement = document.getElementById('translate');
  if (translateElement === null) {
    status.innerText = 'Error: unexpected html structure';
    status.className = 'error';
    return;
  }

  const translateButton = translateElement as HTMLButtonElement;

  const settings = (await browser.storage.local.get(defaultTranslateSettings)) as TranslateSettings;

  objectKeys(defaultTranslateSettings).forEach(async <T extends keyof TranslateSettings>(key: T) => {
    const elementId = camelToDash(key);
    const el = document.getElementById(elementId);
    if (el === null) {
      status.innerText = `Error: missing setting element for ${key}`;
      status.className = 'error';
      return;
    }
    const input = el as HTMLInputElement;
    if (typeof defaultTranslateSettings[key] === 'boolean') {
      if (input.type !== 'checkbox') {
        status.innerText = `Error: unexpected input type for ${key}`;
        status.className = 'error';
        return;
      }
      input.checked = (settings[key] as boolean | null) || false;
    } else {
      if (input.type !== 'text') {
        status.innerText = `Error: unexpected input type for ${key}`;
        status.className = 'error';
        return;
      }
      input.value = (settings[key] as string | null) || '';
    }
    input.addEventListener('change', () => {
      if (typeof defaultTranslateSettings[key] === 'boolean') {
        (settings[key] as boolean) = input.checked;
      } else {
        (settings[key] as string) = input.value;
      }
      browser.storage.local.set(settings);
      status.innerText = `Settings saved: ${key}`;
      status.className = 'success';
    });
  });

  let elementPickingNow = false;
  translateButton.addEventListener('click', async () => {
    if (!elementPickingNow) {
      const activeTab = await browser.tabs.query({ active: true, currentWindow: true });
      if (activeTab.length !== 1) return;
      const tabId = activeTab[0].id;
      if (tabId === undefined) return;
      const result = await sendToRuntime(Action.RequestEnableElementPick, { tabId });
      if (result) window.close();
    } else {
      const result = await sendToRuntime(Action.RequestDisableElementPick, {});
      if (result) window.close();
    }
  });

  sendToRuntime(Action.GetCurrentElementPick, {}).then(tabId => {
    if (tabId !== null) {
      elementPickingNow = true;
      translateButton.classList.add('cancel');
      translateButton.innerText = 'Cancel Translation';
    }
  });
});
