function adjustColor(hex, percent) {
  const safeHex = hex && hex.startsWith('#') ? hex : '#000000';
  let r = parseInt(safeHex.substring(1, 3), 16);
  let g = parseInt(safeHex.substring(3, 5), 16);
  let b = parseInt(safeHex.substring(5, 7), 16);

  const amount = Math.floor(2.55 * percent);
  r = Math.min(255, Math.max(0, r + amount));
  g = Math.min(255, Math.max(0, g + amount));
  b = Math.min(255, Math.max(0, b + amount));

  const rr = r.toString(16).padStart(2, '0');
  const gg = g.toString(16).padStart(2, '0');
  const bb = b.toString(16).padStart(2, '0');

  return `#${rr}${gg}${bb}`;
}

function isLight(hex) {
  if (!hex || !hex.startsWith('#')) return true;
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6;
}

export function createBubbleManager({
  templatesContainer,
  dragController,
  refreshAccordionHeight,
  getCurrentAccordionIndex,
}) {
  const prototypes = [
    { text: 'Task', color: '#38bdf8' },
    { text: 'Idea', color: '#a78bfa' },
    { text: 'Bug', color: '#f87171' },
    { text: 'Note', color: '#10b981' },
  ];

  function createPrototypeElement({ text, color, square = false }) {
    const el = document.createElement('div');
    el.className = 'bubble prototype';
    if (square) {
      el.classList.add('squared');
    }
    el.setAttribute('draggable', 'true');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-text', text);
    el.setAttribute('data-color', color);
    el.setAttribute('data-square', String(square));
    el.textContent = text;
    el.style.backgroundColor = color;
    el.style.borderColor = adjustColor(color, -20);
    el.style.color = isLight(color) ? 'var(--text)' : 'white';

    el.addEventListener('click', () => {
      const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
      if (el.__suppressClickUntil && now < el.__suppressClickUntil) {
        return;
      }
      const targetDay = window.innerWidth > 768 ? 0 : getCurrentAccordionIndex();
      addBubbleToDay(targetDay, text, color, { square });
    });

    dragController.wireBubble(el);
    return el;
  }

  function addBubbleToDay(dayIndex, text, backgroundColor, { square = false, classes = [], before = null } = {}) {
    const flows = document.querySelectorAll('.day-flow');
    const flow = flows[dayIndex];
    if (!flow) return null;

    const el = document.createElement('div');
    el.className = 'bubble';
    if (square) {
      el.classList.add('squared');
    }
    classes.forEach((cls) => el.classList.add(cls));

    el.setAttribute('draggable', 'true');
    el.setAttribute('role', 'listitem');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-text', text);
    el.setAttribute('data-color', backgroundColor);
    el.setAttribute('data-square', String(square));
    el.textContent = text;
    el.style.backgroundColor = backgroundColor;
    el.style.borderColor = adjustColor(backgroundColor, -20);
    el.style.color = isLight(backgroundColor) ? 'var(--text)' : 'white';

    if (before && flow.contains(before)) {
      flow.insertBefore(el, before);
    } else {
      flow.appendChild(el);
    }

    dragController.wireBubble(el);

    if (window.innerWidth <= 768) {
      refreshAccordionHeight(Number(dayIndex));
    }

    return el;
  }

  function prependPrototype(prototype) {
    prototypes.unshift(prototype);
    if (templatesContainer) {
      const el = createPrototypeElement(prototype);
      templatesContainer.prepend(el);
    }
  }

  function renderInitialPrototypes() {
    if (!templatesContainer) return;
    prototypes.forEach((prototype) => {
      const el = createPrototypeElement(prototype);
      templatesContainer.appendChild(el);
    });
  }

  return {
    addBubbleToDay,
    prependPrototype,
    renderInitialPrototypes,
    getPrototypes: () => prototypes.slice(),
  };
}
