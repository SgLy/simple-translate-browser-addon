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
let currentPickingElementCursor: string | null = null;
const upcastElements: HTMLElement[] = [];
document.body.prepend(overlayElement);
const userSelect = document.body.style.userSelect;

const enableElementPick = () => {
  document.addEventListener('click', handleElementClick, { capture: true });
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  return true;
};
const disableElementPick = () => {
  document.body.style.userSelect = userSelect;
  document.removeEventListener('click', handleElementClick, { capture: true });
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  overlayElement.hidden = true;
  unpickCurrentElement();
  overlayingElement = null;
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
    case 'W':
      if (currentPickingElement?.parentElement instanceof HTMLElement) {
        upcastElements.push(currentPickingElement);
        pickElement(currentPickingElement.parentElement);
      } else {
        flashOverlay();
      }
      break;
    case 's':
    case 'S':
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

function unpickCurrentElement() {
  if (currentPickingElement !== null) {
    if (currentPickingElementCursor !== null) {
      currentPickingElement.style.cursor = currentPickingElementCursor;
    }
  }
  currentPickingElement = null;
  currentPickingElementCursor = null;
}

function pickElement(element: HTMLElement) {
  unpickCurrentElement();
  currentPickingElement = element;
  currentPickingElementCursor = element.style.cursor;
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
const streamBufferMap = new Map<string, string>();

async function handleElementClick(e: MouseEvent) {
  if (!(e.target instanceof HTMLElement)) return;
  const element = currentPickingElement;
  if (!element || !element.parentNode) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();

  unpickCurrentElement();

  const clonedElement = element.cloneNode(true) as HTMLElement;
  const hint = extractRuby(clonedElement);
  const { outer, inner } = extractHTML(clonedElement);

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
  const originalOpacity = parseFloat(replaceTargetElement.style.opacity) || 1;
  replaceTargetElement.style.opacity = (originalOpacity * 0.3).toString();
  replaceTargetElement.animate(
    [
      { opacity: originalOpacity * 0.3, offset: 0 },
      { opacity: originalOpacity * 0.1, offset: 0.4 },
      { opacity: originalOpacity * 0.3, offset: 0.8 },
      { opacity: originalOpacity * 0.3, offset: 1 },
    ],
    {
      duration: 1500,
      iterations: Infinity,
      direction: 'normal',
      easing: 'ease-in-out',
    },
  );
  await sendToRuntime(Action.TranslateText, {
    outer,
    inner,
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

function extractHTML(e: HTMLElement): { outer: string; inner: string } {
  const inner = e.innerHTML;
  const fullOuter = e.outerHTML;
  const innerPosition = fullOuter.indexOf(inner);
  const before = fullOuter.slice(0, innerPosition);
  const after = fullOuter.slice(innerPosition + inner.length);
  const outer = before + after;
  return { outer, inner };
}
/**
 * Find the last position in the HTML string that is safe to render via innerHTML.
 * Avoids cutting in the middle of an incomplete tag like `<a href="htt`.
 * Structurally unclosed tags (e.g. `<strong>text` without `</strong>`) are fine —
 * the browser auto-closes them within the element boundary.
 */
function findSafeRenderPoint(html: string): number {
  const lastOpenBracket = html.lastIndexOf('<');
  if (lastOpenBracket === -1) return html.length;
  const lastCloseBracket = html.lastIndexOf('>');
  if (lastCloseBracket > lastOpenBracket) return html.length;
  // There's an unclosed `<` — truncate before it
  return lastOpenBracket;
}

onMessage(Action.SendInnerTranslationDelta, async payload => {
  const element = elementMap.get(payload.elementId);
  if (!element) return;
  element.getAnimations().forEach(animation => {
    animation.cancel();
  });
  const originalOpacity = parseFloat(opacityMap.get(payload.elementId) || '1');
  element.animate(
    [
      { opacity: originalOpacity * 0.3, offset: 0 },
      { opacity: originalOpacity * 0.1, offset: 0.5 },
      { opacity: originalOpacity * 0.3, offset: 1 },
    ],
    {
      duration: 200,
      iterations: 1,
      direction: 'normal',
      easing: 'ease-in-out',
    },
  );
  const buffer = (streamBufferMap.get(payload.elementId) ?? '') + payload.delta;
  const newBuffer = buffer.slice(0, findSafeRenderPoint(buffer));
  streamBufferMap.set(payload.elementId, buffer);
  element.innerHTML = newBuffer;
});

onMessage(Action.FinishInnerTranslation, payload => {
  const element = elementMap.get(payload.elementId);
  elementMap.delete(payload.elementId);
  const buffer = streamBufferMap.get(payload.elementId);
  streamBufferMap.delete(payload.elementId);
  if (!element || !element.parentNode) return;
  element.getAnimations().forEach(animation => {
    animation.cancel();
  });
  const originalOpacity = opacityMap.get(payload.elementId);
  opacityMap.delete(payload.elementId);
  if (originalOpacity !== undefined) {
    element.style.opacity = originalOpacity;
  }
  if (payload.error !== null) {
    if (isPlaceholder.has(element)) {
      element.remove();
    }
  } else if (buffer !== undefined) {
    element.innerHTML = buffer;
  }
  isPlaceholder.delete(element);
});

onMessage(Action.FinishOuterTranslation, async payload => {
  const element = elementMap.get(payload.elementId);
  if (!element) return;
  const fragment = document.createRange().createContextualFragment(payload.html);
  if (fragment.childNodes.length !== 1) return;
  const newNode = fragment.firstChild as HTMLElement;
  if (newNode === null || newNode === undefined) return;
  const attributes = newNode.attributes || [];
  for (let i = 0; i < attributes.length; ++i) {
    const attr = attributes[i];
    element.setAttribute(attr.name, attr.value);
  }
});

onMessage(Action.Alert, payload => {
  alert(payload.text);
});
