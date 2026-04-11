import OpenAI from 'openai';
import type { ApiProfile, ReplaceMode, TranslateSettings, TranslateTextPayload } from './utils';
import {
  Action,
  createThrottledAccumulator,
  defaultGlobalSettings,
  defaultProfileStorage,
  normalizeCustomArgs,
  onMessage,
  sendToTab,
} from './utils';

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
  const { replaceMode } = await browser.storage.local.get({ replaceMode: defaultGlobalSettings.replaceMode });
  return replaceMode as ReplaceMode;
});

onMessage(Action.TranslateText, async (payload, sender) => {
  if (sender.tab?.id === undefined) return;
  const tabId: number = sender.tab?.id;
  try {
    const storage = await browser.storage.local.get({
      ...defaultProfileStorage,
      ...defaultGlobalSettings,
    });
    const profiles = storage.profiles as ApiProfile[];
    const activeProfileId = storage.activeProfileId as string | null;
    const targetLang = storage.targetLang as string;
    const replaceMode = storage.replaceMode as ReplaceMode;

    if (activeProfileId === null) {
      throw new Error('No active API profile selected');
    }
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile) {
      throw new Error(`Active profile "${activeProfileId}" not found`);
    }

    const settings: TranslateSettings = {
      baseURL: profile.baseURL,
      apiKey: profile.apiKey,
      model: profile.model,
      targetLang,
      replaceMode,
      customArgs: normalizeCustomArgs(profile.customArgs),
    };

    const missingFields = (['baseURL', 'apiKey', 'model', 'targetLang'] as const).filter(key => !settings[key]);
    if (missingFields.length > 0) {
      throw new Error(`Please set your ${missingFields.join(', ')} in the extension settings`);
    }

    const throttled = createThrottledAccumulator(delta => {
      sendToTab(tabId, Action.SendInnerTranslationDelta, {
        elementId: payload.elementId,
        delta,
      });
    }, 500);

    await translateText(
      payload,
      settings,
      delta => {
        throttled.push(delta);
      },
      outer => {
        sendToTab(tabId, Action.FinishOuterTranslation, {
          elementId: payload.elementId,
          html: outer,
          error: null,
        });
      },
    );
    throttled.flush();
    await sendToTab(tabId, Action.FinishInnerTranslation, {
      elementId: payload.elementId,
      error: null,
    });
  } catch (error) {
    const errMsg =
      error instanceof Error && 'message' in error && typeof error.message === 'string' ? error.message : String(error);
    await sendToTab(tabId, Action.Alert, {
      text: `Error translating text: ${errMsg}`,
    });
    await sendToTab(tabId, Action.FinishInnerTranslation, {
      error: errMsg,
      elementId: payload.elementId,
    });
  }
});

async function translateText(
  payload: TranslateTextPayload,
  settings: TranslateSettings,
  onInnerDelta: (delta: string) => void,
  onOuter: (outer: string) => void,
) {
  const client = new OpenAI({
    baseURL: settings.baseURL,
    apiKey: settings.apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a professional translator. Translate the given HTML segment from URL "${payload.url}" with title "${payload.title}" to language "${settings.targetLang}". You should translate all text contents for displaying, and keep all functional attributes, code snippets or HTML specific syntax untouched. Do not output any other text except the translated HTML segment since the user is a program.`,
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

  const inner = (async () => {
    if (payload.inner === '') return;
    const innerMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...messages,
      {
        role: 'user',
        content: payload.inner,
      },
    ];

    const config: Record<string, unknown> = Object.assign(
      {
        model: settings.model,
        messages: innerMessages,
        stream: true,
      } satisfies OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      settings.customArgs,
    );

    if (config.stream === true) {
      const stream = await client.chat.completions.create(
        config as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      );

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          onInnerDelta(delta);
        }
      }
      return;
    }

    const completion = await client.chat.completions.create(
      config as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    );
    const content = completion.choices[0]?.message?.content;
    if (content) {
      onInnerDelta(content);
    }
  })();

  const outer = (async () => {
    const innerMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...messages,
      {
        role: 'system',
        content: `Additionally, set correct lang="lang_CODE" for the outmost element.`,
      },
      {
        role: 'user',
        content: payload.outer,
      },
    ];

    const config: Record<string, unknown> = Object.assign(
      {
        model: settings.model,
        messages: innerMessages,
      } satisfies OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      settings.customArgs,
    );

    if (config.stream === true) {
      const stream = await client.chat.completions.create(
        config as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      );
      let html = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          html += delta;
        }
      }
      onOuter(html);
      return;
    }

    const completion = await client.chat.completions.create(
      config as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
    );
    onOuter(completion.choices[0]?.message?.content ?? '');
  })();

  await Promise.all([inner, outer]);
}
