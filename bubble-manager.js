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
  initialPrototypes = null,
}) {
  let prototypeEditHandler = null;
  const prototypes = (Array.isArray(initialPrototypes) && initialPrototypes.length
    ? initialPrototypes
    : [
        { text: 'Task', color: '#38bdf8' },
        { text: 'Idea', color: '#a78bfa' },
        { text: 'Bug', color: '#f87171' },
        { text: 'Note', color: '#10b981' },
      ])
    .map((p) => ({
      text: p.text || '',
      color: p.color || '#38bdf8',
      description: p.description || '',
    }));

  function createPrototypeElement({ text, color, square = false, description = '' }) {
    const el = document.createElement('div');
    el.className = 'bubble prototype';
    // squared style removed
    // Suppress native drag/copy/long-press actions
    el.setAttribute('draggable', 'false');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-text', text);
    el.setAttribute('data-color', color);
    el.setAttribute('data-description', description || '');
    el.textContent = text;
    el.style.backgroundColor = color;
    el.style.borderColor = adjustColor(color, -20);
    el.style.color = isLight(color) ? 'var(--text)' : 'white';
    el.style.userSelect = 'none';
    el.style.webkitUserDrag = 'none';

    // Prevent long-press context menu and native drag/copy without blocking scroll
    el.addEventListener('contextmenu', e => e.preventDefault());

    el.addEventListener('click', () => {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (el.__suppressClickUntil && now < el.__suppressClickUntil) return;
      // While in edit mode, treat small clicks as edit request for prototypes
      if (typeof prototypeEditHandler === 'function' && document.body.classList.contains('edit-mode')) {
        prototypeEditHandler(el);
      }
    });
    // Fallback: on quick pointer up (no drag), open edit in edit-mode
    el.addEventListener('pointerup', () => {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (el.__suppressClickUntil && now < el.__suppressClickUntil) return;
      if (document.body.classList.contains('edit-mode') && typeof prototypeEditHandler === 'function') {
        if (!el.classList.contains('dragging') && !document.body.classList.contains('is-dragging')) {
          prototypeEditHandler(el);
        }
      }
    });

    dragController.wireBubble(el);
    return el;
  }

  function addBubbleToDay(dayIndex, text, backgroundColor, { square = false, classes = [], before = null, insertedAt, description = '' } = {}) {
    const flows = document.querySelectorAll('.day-flow');
    const flow = flows[dayIndex];
    if (!flow) return null;

    const el = document.createElement('div');
    el.className = 'bubble';
    // squared style removed
    classes.forEach((cls) => el.classList.add(cls));

    el.setAttribute('draggable', 'true');
    el.setAttribute('role', 'listitem');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-text', text);
    el.setAttribute('data-color', backgroundColor);
    el.setAttribute('data-description', description || '');

    // Build inner content: label + optional time-of-day
    const labelSpan = document.createElement('span');
    labelSpan.className = 'bubble-label';
    labelSpan.textContent = text;

    el.textContent = '';
    el.appendChild(labelSpan);

    if (typeof insertedAt !== 'undefined' && insertedAt !== null) {
      const ts = Number(insertedAt);
      if (Number.isFinite(ts)) {
        el.setAttribute('data-inserted-at', String(ts));
        const timeSpan = document.createElement('span');
        timeSpan.className = 'bubble-time';
        let formattedTime = '';
        try {
          const formatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
          formattedTime = formatter.format(new Date(ts));
        } catch {
          const d = new Date(ts);
          const pad = (n) => String(n).padStart(2, '0');
          formattedTime = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }
        timeSpan.textContent = formattedTime;
        el.appendChild(timeSpan);
      }
    }
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
    if (!templatesContainer) return;
    const el = createPrototypeElement(prototype);
    templatesContainer.prepend(el);
  }

  function renderInitialPrototypes(initialList) {
    if (!templatesContainer) return;
    templatesContainer.innerHTML = '';
    const source = Array.isArray(initialList) && initialList.length
      ? initialList
      : prototypes;
    source.forEach((prototype) => {
      const el = createPrototypeElement(prototype);
      templatesContainer.appendChild(el);
    });
  }

  return {
    addBubbleToDay,
    prependPrototype,
    renderInitialPrototypes,
    getPrototypes: () => {
      if (templatesContainer) {
        const nodes = templatesContainer.querySelectorAll('.bubble.prototype');
        if (nodes.length) {
          return Array.from(nodes).map((el) => ({
            text: el.getAttribute('data-text') || el.textContent || '',
            color: el.getAttribute('data-color') || '#38bdf8',
            description: el.getAttribute('data-description') || '',
          }));
        }
      }
      return prototypes.slice();
    },
    setPrototypeEditHandler: (handler) => { prototypeEditHandler = handler; },
  };
}

