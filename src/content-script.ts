import { Action, generateId, onMessage, sendToRuntime } from './utils';

let hoverElement: HTMLElement | null = null;

onMessage(Action.EnableElementPickInPage, () => {
  document.body.style.cursor = 'crosshair';
  document.addEventListener('click', handleElementClick, true);
  document.addEventListener('mousemove', handleMouseMove);
});

function handleMouseMove(e: MouseEvent) {
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (!(element instanceof HTMLElement)) return;
  if (element && element !== hoverElement) {
    if (hoverElement) {
      hoverElement.style.outline = '';
    }
    hoverElement = element;
    hoverElement.style.outline = '2px solid #ff0000';
  }
}

const elementMap = new Map<string, HTMLElement>();

async function handleElementClick(e: MouseEvent) {
  if (!(e.target instanceof HTMLElement)) return;
  e.preventDefault();
  e.stopPropagation();

  document.body.style.cursor = 'default';
  document.removeEventListener('click', handleElementClick, true);
  document.removeEventListener('mousemove', handleMouseMove);
  if (hoverElement) {
    hoverElement.style.outline = '';
    hoverElement = null;
  }

  await sendToRuntime(Action.DisableElementPickBackground, {});

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
