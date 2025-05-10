import { Action, generateId, onMessage, ReplaceMode, sendToRuntime } from './utils';

const overlayMargin = 8; // px
const overlayElement = document.createElement('div');
overlayElement.hidden = true;
overlayElement.style.position = 'fixed';
overlayElement.style.backgroundColor = 'hsl(200deg 100% 70% / 40%)';
overlayElement.style.pointerEvents = 'none';
overlayElement.style.zIndex = Number.MAX_SAFE_INTEGER.toString(10);
overlayElement.style.borderRadius = '4px';
overlayElement.style.transition = 'background-color 0.1s ease-in-out';
let overlayingElement: HTMLElement | null = null;
let currentPickingElement: HTMLElement | null = null;
const upcastElements: HTMLElement[] = [];
document.body.appendChild(overlayElement);

let originalCursor: string | null = null;

const enableElementPick = () => {
  document.addEventListener('click', handleElementClick, true);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  return true;
};
const disableElementPick = () => {
  document.removeEventListener('click', handleElementClick, true);
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  overlayElement.hidden = true;
  if (currentPickingElement !== null && originalCursor !== null) {
    currentPickingElement.style.cursor = originalCursor;
  }
  currentPickingElement = null;
  overlayingElement = null;
  originalCursor = null;
  return true;
};

let flashing = false;
async function flashOverlay() {
  if (flashing) return;
  flashing = true;
  const currentBackgroundColor = overlayElement.style.backgroundColor;
  overlayElement.style.backgroundColor = 'hsl(200deg 100% 100% / 40%)';
  await new Promise(resolve => setTimeout(resolve, 100));
  overlayElement.style.backgroundColor = currentBackgroundColor;
  await new Promise(resolve => setTimeout(resolve, 100));
  flashing = false;
}

onMessage(Action.EnableElementPick, enableElementPick);
onMessage(Action.DisableElementPick, disableElementPick);

let pickingMultipleElements = false;
let pickedElements = 0;

async function handleKeyDown(e: KeyboardEvent) {
  switch (e.key) {
    case 'Shift':
      if (pickingMultipleElements === false) {
        pickingMultipleElements = true;
        pickedElements = 0;
      }
      break;
    case 'w':
      if (currentPickingElement?.parentElement instanceof HTMLElement) {
        upcastElements.push(currentPickingElement);
        pickElement(currentPickingElement.parentElement);
      } else {
        flashOverlay();
      }
      break;
    case 's':
      if (upcastElements.length > 0) {
        const lastElement = upcastElements.pop()!;
        pickElement(lastElement);
      } else {
        flashOverlay();
      }
      break;
    case 'Escape':
      await sendToRuntime(Action.RequestDisableElementPick, {});
      break;
  }
}
async function handleKeyUp(e: KeyboardEvent) {
  if (e.key === 'Shift' && pickingMultipleElements === true) {
    pickingMultipleElements = false;
    if (pickedElements > 0) {
      await sendToRuntime(Action.RequestDisableElementPick, {});
    }
  }
}

function handleMouseMove(e: MouseEvent) {
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (!(element instanceof HTMLElement)) return;
  if (element && element !== overlayingElement) {
    overlayingElement = element;
    upcastElements.length = 0;
    pickElement(element);
  }
}

function pickElement(element: HTMLElement) {
  if (currentPickingElement !== null && originalCursor !== null) {
    currentPickingElement.style.cursor = originalCursor;
  }
  currentPickingElement = element;
  originalCursor = element.style.cursor;
  element.style.cursor = 'crosshair';
  overlayElement.hidden = false;
  const rect = element.getBoundingClientRect();
  overlayElement.style.left = rect.x - overlayMargin + 'px';
  overlayElement.style.top = rect.y - overlayMargin + 'px';
  overlayElement.style.width = rect.width + 2 * overlayMargin + 'px';
  overlayElement.style.height = rect.height + 2 * overlayMargin + 'px';
}

const isPlaceholder = new Set<HTMLElement>();
const elementMap = new Map<string, HTMLElement>();
const opacityMap = new Map<string, string>();

async function handleElementClick(e: MouseEvent) {
  if (!(e.target instanceof HTMLElement)) return;
  if (!e.target.parentNode) return;
  const element = e.target;
  e.preventDefault();
  e.stopPropagation();

  const clonedElement = element.cloneNode(true) as HTMLElement;
  const hint = extractRuby(clonedElement);
  const text = clonedElement.innerHTML;
  if (text === '') return;

  if (pickingMultipleElements) {
    pickedElements += 1;
  } else {
    await sendToRuntime(Action.RequestDisableElementPick, {});
  }

  const elementId = generateId();

  const replaceTargetElement = await (async () => {
    const replaceMode = await sendToRuntime(Action.GetReplaceMode, {});
    if (replaceMode === ReplaceMode.Replace) return element;
    const newElement = element.cloneNode(true) as HTMLElement;
    element.parentNode!.insertBefore(newElement, element.nextSibling);
    isPlaceholder.add(newElement);
    return newElement;
  })();
  elementMap.set(elementId, replaceTargetElement);
  opacityMap.set(elementId, replaceTargetElement.style.opacity);
  replaceTargetElement.style.opacity = ((parseFloat(replaceTargetElement.style.opacity) || 1) * 0.3).toFixed(5);
  await sendToRuntime(Action.TranslateText, {
    text,
    hint,
    elementId,
    url: document.location.href,
    title: document.title,
  });
}

function extractRuby(e: HTMLElement): Record<string, string> {
  const rubyElements = e.querySelectorAll('ruby');
  const entries = Array.from(rubyElements)
    .map(ruby => {
      const rt = Array.from(ruby.childNodes).find(c => 'tagName' in c && c.tagName === 'RT');
      if (!rt) return null;
      ruby.removeChild(rt);
      const rtText = (rt as HTMLElement).textContent;
      const rubyText = ruby.textContent;
      if (rtText === null || rubyText === null) return null;
      const ret = [rtText, rubyText] as const;
      try {
        ruby.replaceWith(...Array.from(rt.childNodes));
      } catch {
        /* do nothing */
      }
      return ret;
    })
    .filter(e => e !== null);
  return Object.fromEntries(entries);
}

onMessage(Action.ShowTranslation, payload => {
  const element = elementMap.get(payload.elementId);
  elementMap.delete(payload.elementId);
  if (!element || !element.parentNode) return;
  const originalOpacity = opacityMap.get(payload.elementId);
  opacityMap.delete(payload.elementId);
  if (originalOpacity !== undefined) {
    element.style.opacity = originalOpacity;
  }
  if (payload.translation === null) {
    if (isPlaceholder.has(element)) {
      element.remove();
    }
  } else {
    element.innerHTML = payload.translation;
  }
  isPlaceholder.delete(element);
});

onMessage(Action.Alert, payload => {
  alert(payload.text);
});
