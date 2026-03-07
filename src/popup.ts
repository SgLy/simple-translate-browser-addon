import type { ApiProfile, GlobalSettings, ProfileStorage } from './utils';
import { Action, defaultGlobalSettings, defaultProfileStorage, ReplaceMode, sendToRuntime } from './utils';

document.addEventListener('DOMContentLoaded', async () => {
  const status = (() => {
    const el = document.getElementById('status');
    if (el !== null) return el as HTMLDivElement;
    const newEl = document.createElement('div');
    newEl.id = 'status';
    document.body.appendChild(newEl);
    return newEl;
  })();

  const translateButton = document.getElementById('translate') as HTMLButtonElement | null;
  const profileTabsContainer = document.getElementById('profile-tabs') as HTMLDivElement | null;
  const baseUrlInput = document.getElementById('base-url') as HTMLInputElement | null;
  const apiKeyInput = document.getElementById('api-key') as HTMLInputElement | null;
  const modelInput = document.getElementById('model') as HTMLInputElement | null;
  const targetLangInput = document.getElementById('target-lang') as HTMLInputElement | null;
  const replaceModeInput = document.getElementById('replace-mode') as HTMLInputElement | null;

  if (
    !translateButton ||
    !profileTabsContainer ||
    !baseUrlInput ||
    !apiKeyInput ||
    !modelInput ||
    !targetLangInput ||
    !replaceModeInput
  ) {
    status.innerText = 'Error: unexpected html structure';
    status.className = 'error';
    return;
  }

  // Load storage
  const storage = await browser.storage.local.get({
    ...defaultProfileStorage,
    ...defaultGlobalSettings,
  });
  const profiles: ApiProfile[] = storage.profiles as ApiProfile[];
  let activeProfileId: string | null = storage.activeProfileId as string | null;
  const globalSettings: GlobalSettings = {
    targetLang: storage.targetLang as string,
    replaceMode: storage.replaceMode as ReplaceMode,
  };

  // --- Helpers ---

  function getActiveProfile(): ApiProfile | undefined {
    if (activeProfileId === null) return undefined;
    return profiles.find(p => p.id === activeProfileId);
  }

  async function saveProfiles() {
    await browser.storage.local.set({ profiles, activeProfileId } satisfies ProfileStorage);
  }

  async function saveGlobal() {
    await browser.storage.local.set(globalSettings);
  }

  function setApiFieldsDisabled(disabled: boolean) {
    baseUrlInput!.disabled = disabled;
    apiKeyInput!.disabled = disabled;
    modelInput!.disabled = disabled;
  }

  function fillApiFields(profile: ApiProfile | undefined) {
    if (profile) {
      baseUrlInput!.value = profile.baseURL;
      apiKeyInput!.value = profile.apiKey;
      modelInput!.value = profile.model;
      setApiFieldsDisabled(false);
    } else {
      baseUrlInput!.value = '';
      apiKeyInput!.value = '';
      modelInput!.value = '';
      setApiFieldsDisabled(true);
    }
  }

  function updateTranslateButton() {
    const picking = translateButton!.classList.contains('cancel');
    if (!picking) {
      translateButton!.disabled = activeProfileId === null;
    }
  }

  // --- Render tabs ---

  function renderTabs() {
    profileTabsContainer!.innerHTML = '';

    profiles.forEach((profile, index) => {
      const tab = document.createElement('div');
      tab.className = 'profile-tab' + (profile.id === activeProfileId ? ' active' : '');

      const label = document.createElement('span');
      label.textContent = profile.id;
      tab.appendChild(label);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '×';
      deleteBtn.title = `Delete "${profile.id}"`;
      deleteBtn.addEventListener('click', async e => {
        e.stopPropagation();
        profiles.splice(index, 1);
        if (activeProfileId === profile.id) {
          if (profiles.length === 0) {
            activeProfileId = null;
          } else if (index < profiles.length) {
            activeProfileId = profiles[index].id;
          } else {
            activeProfileId = profiles[profiles.length - 1].id;
          }
        }
        await saveProfiles();
        fillApiFields(getActiveProfile());
        updateTranslateButton();
        renderTabs();
        status.innerText = `Profile "${profile.id}" deleted`;
        status.className = 'success';
      });
      tab.appendChild(deleteBtn);

      tab.addEventListener('click', async () => {
        if (activeProfileId === profile.id) return;
        activeProfileId = profile.id;
        await saveProfiles();
        fillApiFields(profile);
        updateTranslateButton();
        renderTabs();
      });

      profileTabsContainer!.appendChild(tab);
    });

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-profile-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add new profile';
    addBtn.addEventListener('click', async () => {
      const id = prompt('Enter profile ID:');
      if (id === null || id.trim() === '') return;
      const trimmedId = id.trim();
      if (profiles.some(p => p.id === trimmedId)) {
        status.innerText = `Error: profile "${trimmedId}" already exists`;
        status.className = 'error';
        return;
      }
      const newProfile: ApiProfile = { id: trimmedId, baseURL: '', apiKey: '', model: '' };
      profiles.push(newProfile);
      activeProfileId = trimmedId;
      await saveProfiles();
      fillApiFields(newProfile);
      updateTranslateButton();
      renderTabs();
      status.innerText = `Profile "${trimmedId}" created`;
      status.className = 'success';
    });
    profileTabsContainer!.appendChild(addBtn);
  }

  // --- Init UI ---

  // Fill global settings
  targetLangInput.value = globalSettings.targetLang;
  replaceModeInput.checked = globalSettings.replaceMode === ReplaceMode.Replace;

  // Fill API fields from active profile
  fillApiFields(getActiveProfile());
  updateTranslateButton();
  renderTabs();

  // --- API field change handlers ---

  const apiFieldMap: [HTMLInputElement, keyof Omit<ApiProfile, 'id'>][] = [
    [baseUrlInput, 'baseURL'],
    [apiKeyInput, 'apiKey'],
    [modelInput, 'model'],
  ];

  for (const [input, key] of apiFieldMap) {
    input.addEventListener('change', async () => {
      const profile = getActiveProfile();
      if (!profile) return;
      profile[key] = input.value;
      await saveProfiles();
      status.innerText = `Settings saved: ${key}`;
      status.className = 'success';
    });
  }

  // --- Global settings change handlers ---

  targetLangInput.addEventListener('change', async () => {
    globalSettings.targetLang = targetLangInput.value;
    await saveGlobal();
    status.innerText = 'Settings saved: targetLang';
    status.className = 'success';
  });

  replaceModeInput.addEventListener('change', async () => {
    globalSettings.replaceMode = replaceModeInput.checked ? ReplaceMode.Replace : ReplaceMode.Append;
    await saveGlobal();
    status.innerText = 'Settings saved: replaceMode';
    status.className = 'success';
  });

  // --- Translate button ---

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
      translateButton.disabled = false;
    }
  });
});
