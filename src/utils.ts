export const enum Action {
  Alert,
  EnableElementPickBackground,
  EnableElementPickInPage,
  DisableElementPickBackground,
  ShowTranslation,
  TranslateText,
}

export interface AlertPayload {
  text: string;
}

export interface EnableElementPickBackgroundPayload {
  tabId: number;
}

export type EnableElementPickInPagePayload = Record<string, never>;

export type DisableElementPickBackgroundPayload = Record<string, never>;

export interface ShowTranslationPayload {
  translation: string | null;
  elementId: string;
}

export interface TranslateTextPayload {
  text: string;
  elementId: string;
  url: string;
  title: string;
}

type ActionToPayloadMap<A extends Action> = A extends Action.Alert
  ? AlertPayload
  : A extends Action.EnableElementPickBackground
    ? EnableElementPickBackgroundPayload
    : A extends Action.EnableElementPickInPage
      ? EnableElementPickInPagePayload
      : A extends Action.DisableElementPickBackground
        ? DisableElementPickBackgroundPayload
        : A extends Action.ShowTranslation
          ? ShowTranslationPayload
          : A extends Action.TranslateText
            ? TranslateTextPayload
            : never;

type OnMessageCallback<T> = (payload: T, sender: browser.runtime.MessageSender) => void | Promise<void>;

const listenerMap = new Map<Action, OnMessageCallback<any>>();

export const sendToTab = <A extends Action>(tabId: number, action: A, payload: ActionToPayloadMap<A>) => {
  return browser.tabs.sendMessage(tabId, { action, payload });
};
export const sendToRuntime = <A extends Action>(action: A, payload: ActionToPayloadMap<A>) => {
  return browser.runtime.sendMessage({ action, payload });
};
export const onMessage = <A extends Action>(action: A, cb: OnMessageCallback<ActionToPayloadMap<A>>) => {
  listenerMap.set(action, cb);
};

browser.runtime.onMessage.addListener((message, sender) => {
  const action = message.action as Action;
  const cb = listenerMap.get(action);
  if (typeof cb === 'function') {
    cb(message.payload, sender);
  }
});

export const translateSettingsKeys = ['baseURL', 'targetLang', 'apiKey', 'model'] as const;
export interface TranslateSettings {
  baseURL: string;
  targetLang: string;
  apiKey: string;
  model: string;
}

export const generateId = () =>
  Math.round(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');

export const camelToDash = (str: string) => str.replace(/([A-Z]+)/g, '-$1').toLowerCase();
