export const enum Action {
  Alert,
  RequestEnableElementPick,
  EnableElementPick,
  RequestDisableElementPick,
  DisableElementPick,
  GetCurrentElementPick,
  GetReplaceMode,
  FinishInnerTranslation,
  SendInnerTranslationDelta,
  FinishOuterTranslation,
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

export type GetReplaceModePayload = Record<string, never>;
type GetReplaceModeResponse = ReplaceMode;

export interface FinishInnerTranslationPayload {
  elementId: string;
  error: string | null;
}
type FinishInnerTranslationResponse = void;

export interface FinishOuterTranslationPayload {
  html: string;
  elementId: string;
  error: string | null;
}
type FinishOuterTranslationResponse = void;

export interface SendInnerTranslationDeltaPayload {
  elementId: string;
  delta: string;
}
type SendInnerTranslationDeltaResponse = void;

export interface TranslateTextPayload {
  inner: string;
  outer: string;
  hint: Record<string, string>;
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
            : A extends Action.GetReplaceMode
              ? GetReplaceModePayload
              : A extends Action.FinishInnerTranslation
                ? FinishInnerTranslationPayload
                : A extends Action.FinishOuterTranslation
                  ? FinishOuterTranslationPayload
                  : A extends Action.SendInnerTranslationDelta
                    ? SendInnerTranslationDeltaPayload
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
            : A extends Action.GetReplaceMode
              ? GetReplaceModeResponse
              : A extends Action.FinishInnerTranslation
                ? FinishInnerTranslationResponse
                : A extends Action.FinishOuterTranslation
                  ? FinishOuterTranslationResponse
                  : A extends Action.SendInnerTranslationDelta
                    ? SendInnerTranslationDeltaResponse
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
  const { promise, resolve } = Promise.withResolvers<any>();
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
  return promise;
});

export const enum ReplaceMode {
  Append = 'append',
  Replace = 'replace',
}

export interface ApiProfile {
  id: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ProfileStorage {
  profiles: ApiProfile[];
  activeProfileId: string | null;
}

export const defaultProfileStorage: ProfileStorage = {
  profiles: [],
  activeProfileId: null,
};

export interface GlobalSettings {
  targetLang: string;
  replaceMode: ReplaceMode;
}

export const defaultGlobalSettings: GlobalSettings = {
  targetLang: '',
  replaceMode: ReplaceMode.Append,
};

export interface TranslateSettings {
  baseURL: string;
  targetLang: string;
  apiKey: string;
  model: string;
  replaceMode: ReplaceMode;
}

export const generateId = () =>
  Math.round(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');

export const camelToDash = (str: string) => str.replace(/([A-Z]+)/g, '-$1').toLowerCase();

export const objectKeys = Object.keys as <T extends string>(obj: Record<T, any>) => T[];

export function createThrottledAccumulator(callback: (accumulated: string) => void, interval: number) {
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer.length > 0) {
      const data = buffer;
      buffer = '';
      callback(data);
    }
  };

  const push = (delta: string) => {
    buffer += delta;
    if (timer === null) {
      timer = setTimeout(flush, interval);
    }
  };

  return { push, flush };
}
export type ThrottledAccumulator = ReturnType<typeof createThrottledAccumulator>;

export function sleep(ms: number) {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(() => resolve(), ms);
  return promise;
}

export function raf() {
  const { promise, resolve } = Promise.withResolvers<void>();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => resolve());
  } else {
    setTimeout(() => resolve(), 16);
  }
  return promise;
}
