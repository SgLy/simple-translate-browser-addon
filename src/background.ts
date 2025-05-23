import OpenAI from 'openai';
import type { ReplaceMode, TranslateSettings, TranslateTextPayload } from './utils';
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
  return replaceMode as ReplaceMode;
});

onMessage(Action.TranslateText, async (payload, sender) => {
  if (sender.tab?.id === undefined) return;
  const tabId: number = sender.tab?.id;
  try {
    const settings = await browser.storage.local.get(defaultTranslateSettings);

    const invalidKeys = objectKeys(defaultTranslateSettings).filter(key => {
      return !(typeof settings[key] === 'string' && settings[key] !== '');
    });
    if (invalidKeys.length > 0) {
      throw new Error(`Please set your ${invalidKeys.join(', ')} in the extension settings`);
    }

    const translation = await translateText(payload, settings as TranslateSettings);
    await sendToTab(tabId, Action.ShowTranslation, {
      translation,
      elementId: payload.elementId,
    });
  } catch (error) {
    const errMsg =
      error instanceof Error && 'message' in error && typeof error.message === 'string' ? error.message : String(error);
    await sendToTab(tabId, Action.Alert, {
      text: `Error translating text: ${errMsg}`,
    });
    await sendToTab(tabId, Action.ShowTranslation, {
      translation: null,
      elementId: payload.elementId,
    });
  }
});

async function translateText(payload: TranslateTextPayload, settings: TranslateSettings) {
  const client = new OpenAI({
    baseURL: settings.baseURL,
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `Translate the given HTML segment from URL "${payload.url}" with title "${payload.title}" to language "${settings.targetLang}". You should only translate the text contents, and keep all attributes, code snippets or HTML specific syntax untouched. Do not output any other text except the translated text since the user may be a program.`,
    },
  ];
  if (Object.keys(payload.hint).length > 0) {
    const hintsPair = Object.entries(payload.hint)
      .map(([original, translated]) => `- ${original}: ${translated}`)
      .join('\n');
    messages.push({
      role: 'system',
      content: `Here are some hints that may be helpful for translation:\n${hintsPair}`,
    });
  }
  messages.push({
    role: 'user',
    content: payload.text,
  });
  const completion = await client.chat.completions.create({
    model: settings.model,
    messages,
  });

  return completion.choices[0].message.content;
}
