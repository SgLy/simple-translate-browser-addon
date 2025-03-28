import OpenAI from 'openai';
import type { TranslateSettings, TranslateTextPayload } from './utils';
import { Action, defaultTranslateSettings, objectKeys, onMessage, sendToTab } from './utils';

let elementPickingTabId: number | null = null;

const updateIcon = () => {
  const icons = {
    active: {
      light: 'icons/icon-active-48.png',
      dark: 'icons/icon-active-dark-48.png',
    },
    inactive: {
      light: 'icons/icon-48.png',
      dark: 'icons/icon-dark-48.png',
    },
  };
  const color = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const status = elementPickingTabId === null ? 'inactive' : 'active';
  const path = icons[status][color];
  browser.browserAction.setIcon({ path: { 48: path } });
};
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateIcon);
updateIcon();

onMessage(Action.RequestEnableElementPick, async payload => {
  if (elementPickingTabId === payload.tabId) return true;
  const result = await sendToTab(payload.tabId, Action.EnableElementPick, {});
  if (result) {
    if (elementPickingTabId !== null) {
      await sendToTab(elementPickingTabId, Action.RequestDisableElementPick, {});
    }
    elementPickingTabId = payload.tabId;
    updateIcon();
  }
  return result;
});
onMessage(Action.RequestDisableElementPick, async () => {
  if (elementPickingTabId !== null) {
    const result = await sendToTab(elementPickingTabId, Action.DisableElementPick, {});
    if (result) {
      elementPickingTabId = null;
      updateIcon();
    }
    return result;
  }
  return false;
});
onMessage(Action.GetCurrentElementPick, async () => {
  return elementPickingTabId;
});
onMessage(Action.GetReplaceMode, async () => {
  const { replaceMode } = await browser.storage.local.get({ replaceMode: defaultTranslateSettings.replaceMode });
  return replaceMode;
});

onMessage(Action.TranslateText, async (payload, sender) => {
  if (sender.tab?.id === undefined) return;
  const tabId: number = sender.tab?.id;
  const settings = await browser.storage.local.get(defaultTranslateSettings);

  const paramOk = objectKeys(defaultTranslateSettings).every(key => {
    if (typeof settings[key] === 'string' && settings[key] === '') {
      sendToTab(tabId, Action.Alert, {
        text: `Please set your ${key} in the extension settings`,
      });
      return false;
    }
    return true;
  });
  if (!paramOk) return;

  const translation = await translateText(payload, settings as TranslateSettings);
  await sendToTab(tabId, Action.ShowTranslation, {
    translation,
    elementId: payload.elementId,
    replaceMode: settings.replaceMode,
  });
});

async function translateText(payload: TranslateTextPayload, settings: TranslateSettings) {
  const client = new OpenAI({
    baseURL: settings.baseURL,
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });
  const completion = await client.chat.completions.create({
    model: settings.model,
    messages: [
      {
        role: 'system',
        content: `Translate the given HTML segment from URL "${payload.url}" with title "${payload.title}" to language "${settings.targetLang}". You should only translate the text contents, and keep all attributes, code snippets or HTML specific syntax untouched. Do not output any other text except the translated text since the user may be a program.`,
      },
      {
        role: 'user',
        content: payload.text,
      },
    ],
  });
  return completion.choices[0].message.content;
}
