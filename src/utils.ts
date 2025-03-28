export const enum Action {
  Alert,
  RequestEnableElementPick,
  EnableElementPick,
  RequestDisableElementPick,
  DisableElementPick,
  GetCurrentElementPick,
  ShowTranslation,
  TranslateText,
}

export interface AlertPayload {
  text: string;
}
type AlertResponse = void;

export interface RequestEnableElementPickPayload {
  tabId: number;
}
type RequestEnableElementPickResponse = boolean;

export type EnableElementPickPayload = Record<string, never>;
type EnableElementPickResponse = boolean;

export type RequestDisableElementPickPayload = Record<string, never>;
type RequestDisableElementPickResponse = boolean;

export type DisableElementPickPayload = Record<string, never>;
type DisableElementPickResponse = boolean;

export type GetCurrentElementPickPayload = Record<string, never>;
type GetCurrentElementPickResponse = number | null;

export interface ShowTranslationPayload {
  translation: string | null;
  elementId: string;
}
type ShowTranslationResponse = void;

export interface TranslateTextPayload {
  text: string;
  elementId: string;
  url: string;
  title: string;
}
type TranslateTextResponse = void;

type ActionToPayloadMap<A extends Action> = A extends Action.Alert
  ? AlertPayload
  : A extends Action.RequestEnableElementPick
    ? RequestEnableElementPickPayload
    : A extends Action.EnableElementPick
      ? EnableElementPickPayload
      : A extends Action.RequestDisableElementPick
        ? RequestDisableElementPickPayload
        : A extends Action.DisableElementPick
          ? DisableElementPickPayload
          : A extends Action.GetCurrentElementPick
            ? GetCurrentElementPickPayload
            : A extends Action.ShowTranslation
              ? ShowTranslationPayload
              : A extends Action.TranslateText
                ? TranslateTextPayload
                : never;

type ActionToResponseMap<A extends Action> = A extends Action.Alert
  ? AlertResponse
  : A extends Action.RequestEnableElementPick
    ? RequestEnableElementPickResponse
    : A extends Action.EnableElementPick
      ? EnableElementPickResponse
      : A extends Action.RequestDisableElementPick
        ? RequestDisableElementPickResponse
        : A extends Action.DisableElementPick
          ? DisableElementPickResponse
          : A extends Action.GetCurrentElementPick
            ? GetCurrentElementPickResponse
            : A extends Action.ShowTranslation
              ? ShowTranslationResponse
              : A extends Action.TranslateText
                ? TranslateTextResponse
                : never;

type PromiseOrValue<T> = T | Promise<T>;

type OnMessageCallback<P, R> = (payload: P, sender: browser.runtime.MessageSender) => PromiseOrValue<R>;

const listenerMap = new Map<Action, OnMessageCallback<any, any>>();

export const sendToTab = async <A extends Action>(
  tabId: number,
  action: A,
  payload: ActionToPayloadMap<A>,
): Promise<ActionToResponseMap<A>> => {
  return await browser.tabs.sendMessage(tabId, { action, payload });
};
export const sendToRuntime = async <A extends Action>(
  action: A,
  payload: ActionToPayloadMap<A>,
): Promise<ActionToResponseMap<A>> => {
  return await browser.runtime.sendMessage({ action, payload });
};
export const onMessage = <A extends Action>(
  action: A,
  cb: OnMessageCallback<ActionToPayloadMap<A>, ActionToResponseMap<A>>,
) => {
  listenerMap.set(action, cb);
};

browser.runtime.onMessage.addListener((message, sender) => {
  return new Promise(resolve => {
    const action = message.action as Action;
    const cb = listenerMap.get(action);
    if (typeof cb === 'function') {
      try {
        const result = cb(message.payload, sender);
        resolve(result);
      } catch (error) {
        console.error('Error in onMessage:', error);
        resolve(null);
      }
    } else {
      resolve(null);
    }
  });
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
