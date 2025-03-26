let translationMode = false;
let hoverElement = null;

// Listen for mode toggle
browser.runtime.onMessage.addListener(message => {
  if (message.action === 'toggleTranslation') {
    translationMode = message.enabled;
    toggleCursorStyle(message.enabled);
  }
});

function toggleCursorStyle(enabled) {
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

function handleMouseMove(e) {
  const element = document.elementFromPoint(e.clientX, e.clientY);
  if (element && element !== hoverElement) {
    if (hoverElement) {
      hoverElement.style.outline = '';
    }
    hoverElement = element;
    hoverElement.style.outline = '2px solid #ff0000';
  }
}

function handleElementClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const text = getTextFromElement(e.target);
  if (text) {
    const rect = e.target.getBoundingClientRect();
    browser.runtime.sendMessage({
      action: 'translateText',
      text: text,
      position: {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
      },
    });
  }

  // Disable translation mode after selection
  browser.runtime.sendMessage({ action: 'toggleTranslation', enabled: false });
}

function getTextFromElement(element) {
  return element.textContent.trim().replace(/\s+/g, ' ');
}

// Handle translation display
browser.runtime.onMessage.addListener(message => {
  if (message.action === 'showTranslation') {
    showTranslation(message.translation, message.position);
  }
});

function showTranslation(text, position) {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.backgroundColor = '#ffff88';
  div.style.border = '1px solid #cccc00';
  div.style.padding = '8px';
  div.style.borderRadius = '4px';
  div.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
  div.style.zIndex = '2147483647';
  div.textContent = text;

  div.style.left = `${position.x}px`;
  div.style.top = `${position.y - 30}px`;

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 5000);
}
