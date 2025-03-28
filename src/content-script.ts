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

async function handleElementClick(e: MouseEvent) {
  if (!(e.target instanceof HTMLElement)) return;
  e.preventDefault();
  e.stopPropagation();

  await sendToRuntime(Action.RequestDisableElementPick, {});

  const text = e.target.innerHTML;
  if (text !== '') {
    const elementId = generateId();
    elementMap.set(elementId, e.target);
    await sendToRuntime(Action.TranslateText, {
      text,
      elementId,
      url: document.location.href,
      title: document.title,
    });
  }
}

onMessage(Action.ShowTranslation, payload => {
  const element = elementMap.get(payload.elementId);
  elementMap.delete(payload.elementId);
  if (!element || !element.parentNode) return;
  if (payload.translation === null) return;
  const newElement = element.cloneNode() as HTMLElement;
  newElement.innerHTML = payload.translation;
  element.parentNode.insertBefore(newElement, element.nextSibling);
});

onMessage(Action.Alert, payload => {
  alert(payload.text);
});
