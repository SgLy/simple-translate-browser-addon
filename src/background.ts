import OpenAI from 'openai';
import type { TranslateSettings, TranslateTextPayload } from './utils';
import { Action, onMessage, sendToTab, translateSettingsKeys } from './utils';

function toggleTranslation(pickEnabled: boolean) {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const path = pickEnabled
    ? dark
      ? 'icons/icon-active-dark-48.png'
      : 'icons/icon-active-48.png'
    : dark
      ? 'icons/icon-dark-48.png'
      : 'icons/icon-48.png';
  browser.browserAction.setIcon({ path: { 48: path } });
}

onMessage(Action.EnableElementPickBackground, payload => {
  toggleTranslation(true);
  sendToTab(payload.tabId, Action.EnableElementPickInPage, {});
});
onMessage(Action.DisableElementPickBackground, (_, sender) => {
  if (sender.tab?.id === undefined) return;
  toggleTranslation(false);
});

onMessage(Action.TranslateText, async (payload, sender) => {
  if (sender.tab?.id === undefined) return;
  const tabId: number = sender.tab?.id;
  const result = await browser.storage.local.get(translateSettingsKeys);

  const paramOk = translateSettingsKeys.every(key => {
    if (typeof result[key] !== 'string' || result[key] === '') {
      sendToTab(tabId, Action.Alert, {
        text: `Please set your ${key} in the extension settings`,
      });
      return false;
    }
    return true;
  });
  if (!paramOk) return;

  const translation = await translateText(payload, result as TranslateSettings);
  await sendToTab(tabId, Action.ShowTranslation, {
    translation,
    elementId: payload.elementId,
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
