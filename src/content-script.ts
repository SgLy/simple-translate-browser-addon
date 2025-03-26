let hoverElement: HTMLElement | null = null;

// Listen for mode toggle
browser.runtime.onMessage.addListener(message => {
  if (message.action === 'toggleTranslation') {
    toggleCursorStyle(message.enabled);
  }
});

function toggleCursorStyle(enabled: boolean) {
  if (enabled) {
    document.body.style.cursor = 'crosshair';
    document.addEventListener('click', handleElementClick, true);
    document.addEventListener('mousemove', handleMouseMove);
  } else {
    document.body.style.cursor = 'default';
    document.removeEventListener('click', handleElementClick, true);
    document.removeEventListener('mousemove', handleMouseMove);
    if (hoverElement) {
      hoverElement.style.outline = '';
      hoverElement = null;
    }
  }
}

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
  console.log(e.target, e.target instanceof HTMLElement);
  if (!(e.target instanceof HTMLElement)) return;
  e.preventDefault();
  e.stopPropagation();

  console.log('sending message toggleTranslation');
  browser.runtime.sendMessage({ action: 'toggleTranslation', enabled: false });

  const text = getTextFromElement(e.target);
  if (text !== '') {
    const elementId = Math.random().toFixed(10).slice(2);
    elementMap.set(elementId, e.target);
    await browser.runtime.sendMessage({
      action: 'translateText',
      text: text,
      elementId,
    });
  }
}

function getTextFromElement(element: Element) {
  return element.innerHTML;
}

// Handle translation display
browser.runtime.onMessage.addListener(message => {
  if (message.action === 'showTranslation') {
    showTranslation(message.translation, message.elementId);
  } else if (message.action === 'alert') {
    alert(message.text);
  }
});

function showTranslation(text: string, elementId: string) {
  const element = elementMap.get(elementId);
  elementMap.delete(elementId);
  console.log(element, element?.parentNode, element?.nextSibling);
  if (!element || !element.parentNode) return;
  const newElement = element.cloneNode() as HTMLElement;
  newElement.innerHTML = text;
  element.parentNode.insertBefore(newElement, element.nextSibling);
}
