import { Action, generateId, onMessage, sendToRuntime } from './utils';

const overlayMargin = 8; // px
const overlayElement = document.createElement('div');
overlayElement.hidden = true;
overlayElement.style.position = 'fixed';
overlayElement.style.backgroundColor = 'hsl(200deg 100% 70% / 40%)';
overlayElement.style.pointerEvents = 'none';
overlayElement.style.zIndex = Number.MAX_SAFE_INTEGER.toString(10);
let overlayingElement: HTMLElement | null = null;
document.body.appendChild(overlayElement);

let originalCursor: string | null = null;

const enableElementPick = () => {
  document.addEventListener('click', handleElementClick, true);
  document.addEventListener('mousemove', handleMouseMove);
  return true;
};
const disableElementPick = () => {
  document.removeEventListener('click', handleElementClick, true);
  document.removeEventListener('mousemove', handleMouseMove);
  overlayElement.hidden = true;
  if (overlayingElement !== null && originalCursor !== null) {
    overlayingElement.style.cursor = originalCursor;
  }
  overlayingElement = null;
  originalCursor = null;
  return true;
};

onMessage(Action.EnableElementPick, enableElementPick);
onMessage(Action.DisableElementPick, disableElementPick);

function handleMouseMove(e: MouseEvent) {
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (!(element instanceof HTMLElement)) return;
  if (element && element !== overlayingElement) {
    if (overlayingElement !== null && originalCursor !== null) {
      overlayingElement.style.cursor = originalCursor;
    }
    overlayingElement = element;
    originalCursor = overlayingElement.style.cursor;
    overlayingElement.style.cursor = 'crosshair';
    overlayElement.hidden = false;
    const rect = overlayingElement.getBoundingClientRect();
    overlayElement.style.left = rect.x - overlayMargin + 'px';
    overlayElement.style.top = rect.y - overlayMargin + 'px';
    overlayElement.style.width = rect.width + 2 * overlayMargin + 'px';
    overlayElement.style.height = rect.height + 2 * overlayMargin + 'px';
  }
}

const elementMap = new Map<string, HTMLElement>();
const opacityMap = new Map<string, string>();

async function handleElementClick(e: MouseEvent) {
  if (!(e.target instanceof HTMLElement)) return;
  if (!e.target.parentNode) return;
  const element = e.target;
  e.preventDefault();
  e.stopPropagation();

  const text = e.target.innerHTML;
  if (text === '') return;

  await sendToRuntime(Action.RequestDisableElementPick, {});

  const elementId = generateId();

  const targetElement = await (async () => {
    const replaceMode = await sendToRuntime(Action.GetReplaceMode, {});
    if (replaceMode) return element;
    const newElement = element.cloneNode(true) as HTMLElement;
    element.parentNode!.insertBefore(newElement, element.nextSibling);
    return newElement;
  })();
  elementMap.set(elementId, targetElement);
  opacityMap.set(elementId, targetElement.style.opacity);
  targetElement.style.opacity = ((parseFloat(targetElement.style.opacity) || 1) * 0.3).toFixed(5);
  await sendToRuntime(Action.TranslateText, {
    text,
    elementId,
    url: document.location.href,
    title: document.title,
  });
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
  if (payload.translation === null) return;
  element.innerHTML = payload.translation;
});

onMessage(Action.Alert, payload => {
  alert(payload.text);
});
