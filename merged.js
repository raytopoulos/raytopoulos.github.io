import { createAccordionController } from './accordion.js';
import { createBubbleManager } from './bubble-manager.js';
import { createDragController } from './drag-controller.js';
import { createInstance, loadInstance, pushDayItem, setDayItem, removeDayItem, DAYS } from './instances.js';

// Prevent native drag ghost and context menu interfering with custom DnD
document.addEventListener('dragstart', (e) => {
  e.preventDefault();
}, true);

window.addEventListener('contextmenu', (e) => {
  if (document.body.classList.contains('is-dragging')) {
    e.preventDefault();
  }
}, { capture: true });

// On coarse pointers (touch), avoid native HTML draggable elements
try {
  const isCoarse = matchMedia && matchMedia('(pointer: coarse)').matches;
  if (isCoarse) {
    document.querySelectorAll('[draggable="true"]').forEach((el) => el.removeAttribute('draggable'));
  }
} catch {}

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('aside.sidebar');
  const menuBtn = document.getElementById('menuBtn');
  const closeBtn = document.getElementById('closeSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const addBtn = document.getElementById('addBtn');
  const editBtn = document.getElementById('editBtn');
  const templates = document.getElementById('templates') || document.querySelector('.bubbles-list');
  const dayFlows = document.querySelectorAll('.day-flow');
  const trashZone = document.getElementById('trash');
  const dayAccordionHeaders = document.querySelectorAll('.day-accordion__header');

  const modal = document.getElementById('modal');
  const form = document.getElementById('newBubbleForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const bubbleTextInput = document.getElementById('bubbleText');
  const bubbleDescriptionInput = document.getElementById('bubbleDescription');
  const bubbleTimeInput = document.getElementById('bubbleTime');
  const bubbleTimeFormRow = document.getElementById('bubbleTimeFormRow');

  function toggleSidebar(open) {
    if (!sidebar || !menuBtn || !backdrop) return;
    const shouldOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('open');
    if (shouldOpen) {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
      menuBtn.setAttribute('aria-expanded', 'true');
      if (closeBtn) {
        setTimeout(() => closeBtn.focus(), 100);
      }
    } else {
      sidebar.classList.remove('open');
      backdrop.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  }

  if (menuBtn) {
    menuBtn.addEventListener('click', () => toggleSidebar());
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => toggleSidebar(false));
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => toggleSidebar(false));
  }

  const accordion = createAccordionController(dayAccordionHeaders);
  accordion.init();

  const dragController = createDragController({
    dayFlows,
    trashZone,
    toggleSidebar,
    refreshAccordionHeight: (index) => accordion.refreshHeight(index),
    accordion,
  });

  const bubbleManager = createBubbleManager({
    templatesContainer: templates,
    dragController,
    refreshAccordionHeight: (index) => accordion.refreshHeight(index),
    getCurrentAccordionIndex: () => accordion.getCurrentOpenIndex(),
  });
  // Allow editing prototypes via bubble-manager
  if (bubbleManager && typeof bubbleManager.setPrototypeEditHandler === 'function') {
    bubbleManager.setPrototypeEditHandler((el) => openModal('edit-prototype', el));
  }

  // Instance + persistence wiring using instances.js
  const LS_KEY = 'organizer:instanceId';
  let currentInstanceId = null;

  function dayIndexToName(i) { return DAYS[i] || null; }

  function getDayFlowEl(index) {
    return document.querySelector(`.day-flow[data-day-index="${index}"]`);
  }

  async function ensureInstanceId() {
    if (currentInstanceId) return currentInstanceId;
    const url = new URL(location.href);
    const fromUrl = url.searchParams.get('id');
    const fromLS = localStorage.getItem(LS_KEY) || null;
    let id = fromUrl || fromLS;
    if (!id) {
      const created = await createInstance();
      id = created.id;
      try { localStorage.setItem(LS_KEY, id); } catch {}
      try {
        url.searchParams.set('id', id);
        history.replaceState({}, '', url.toString());
      } catch {}
    } else {
      // keep LS and URL in sync if they differ
      try { localStorage.setItem(LS_KEY, id); } catch {}
      try {
        if (!fromUrl) {
          url.searchParams.set('id', id);
          history.replaceState({}, '', url.toString());
        }
      } catch {}
    }
    currentInstanceId = id;
    return id;
  }

  function getBubbleDataFromEl(el) {
    const text = el.getAttribute('data-text') || el.textContent || '';
    const color = el.getAttribute('data-color') || '#38bdf8';
    const insertedAttr = el.getAttribute('data-inserted-at');
    const insertedAt = insertedAttr != null ? Number(insertedAttr) : undefined;
    const description = el.getAttribute('data-description') || '';
    return { title: text, color, insertedAt, description };
  }

  async function persistDayPositions(dayIndex) {
    const id = await ensureInstanceId();
    const dayName = dayIndexToName(dayIndex);
    if (!dayName) return;
    const flow = getDayFlowEl(dayIndex);
    if (!flow) return;
    const bubbles = Array.from(flow.querySelectorAll('.bubble'));
    let position = 0;
    for (const el of bubbles) {
      // Skip insert markers or non-bubbles just in case
      if (!el || !el.classList.contains('bubble')) continue;
      let childId = el.getAttribute('data-id');
      const data = getBubbleDataFromEl(el);
      if (!childId) {
        const created = await pushDayItem(id, dayName, { ...data, position });
        childId = created.id;
        el.setAttribute('data-id', childId);
      }
      await setDayItem(id, dayName, childId, { ...data, position });
      position += 1;
    }
  }

  async function handleMove({ el, fromDayIndex, toDayIndex }) {
    const id = await ensureInstanceId();
    const fromName = dayIndexToName(fromDayIndex);
    const toName = dayIndexToName(toDayIndex);
    if (fromName == null || toName == null) return;
    const childId = el.getAttribute('data-id');
    const data = getBubbleDataFromEl(el);
    if (!childId) {
      // No id yet; treat this as a new insert into destination
      const created = await pushDayItem(id, toName, { ...data, position: 0 });
      el.setAttribute('data-id', created.id);
    } else if (fromName !== toName) {
      // Move across days: write to new day with same id, then remove from old
      // Position will be finalized by persistDayPositions
      const flow = getDayFlowEl(toDayIndex);
      const pos = flow ? Array.from(flow.querySelectorAll('.bubble')).indexOf(el) : 0;
      await setDayItem(id, toName, childId, { ...data, position: Math.max(0, pos) });
      await removeDayItem(id, fromName, childId);
    }
    // Update positions for both days as needed
    await persistDayPositions(toDayIndex);
    if (fromName !== toName) {
      await persistDayPositions(fromDayIndex);
    }
  }

  async function handleDelete({ el, fromDayIndex }) {
    const id = await ensureInstanceId();
    const dayName = dayIndexToName(fromDayIndex);
    if (!dayName) return;
    const childId = el.getAttribute('data-id');
    if (childId) {
      await removeDayItem(id, dayName, childId);
    }
    await persistDayPositions(fromDayIndex);
  }

  dragController.setAddBubbleHandler(async ({ dayIndex, text, color, description, before }) => {
    try {
      const insertedAt = Date.now();
      const el = bubbleManager.addBubbleToDay(dayIndex, text, color, { before, insertedAt, description });
      const id = await ensureInstanceId();
      const dayName = dayIndexToName(dayIndex);
      if (!dayName) return;
      const created = await pushDayItem(id, dayName, { title: text, color, position: 0, insertedAt, description });
      el.setAttribute('data-id', created.id);
      await persistDayPositions(dayIndex);
    } catch (e) {
      console.warn('Failed to save new bubble', e);
    }
  });

  dragController.setMoveBubbleHandler((payload) => { handleMove(payload).catch((e) => console.warn('Move persist failed', e)); });
  dragController.setDeleteBubbleHandler((payload) => { handleDelete(payload).catch((e) => console.warn('Delete persist failed', e)); });

  bubbleManager.renderInitialPrototypes();

  let isEditMode = false;
  let modalMode = 'create';
  let editingEl = null;

  function openModal(mode = 'create', el = null) {
    if (!modal) return;
    modalMode = mode;
    editingEl = el;
    modal.removeAttribute('hidden');
    form.reset();
    // Show time field only in edit mode
    if (bubbleTimeFormRow) {
      if (mode === 'edit') bubbleTimeFormRow.removeAttribute('hidden');
      else bubbleTimeFormRow.setAttribute('hidden', '');
    }
    if ((mode === 'edit' || mode === 'edit-prototype') && el) {
      try {
        const txt = el.getAttribute('data-text') || '';
        const color = el.getAttribute('data-color') || '#38bdf8';
        const desc = el.getAttribute('data-description') || '';
        if (bubbleTextInput) bubbleTextInput.value = txt;
        if (bubbleDescriptionInput) bubbleDescriptionInput.value = desc;
        const colorInput = document.querySelector(`input[name="bubbleColor"][value="${color}"]`);
        if (colorInput) colorInput.checked = true;
        // Prefill time input only when editing existing instance
        if (bubbleTimeInput && mode === 'edit') {
          const ins = Number(el.getAttribute('data-inserted-at'));
          const ts = Number.isFinite(ins) ? ins : Date.now();
          const d = new Date(ts);
          const pad = (n) => String(n).padStart(2, '0');
          bubbleTimeInput.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        }
      } catch {}
    }
    if (bubbleTextInput) {
      setTimeout(() => bubbleTextInput.focus(), 0);
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.setAttribute('hidden', '');
    modalMode = 'create';
    editingEl = null;
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      toggleSidebar(false);
      openModal('create');
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal || !event.target.closest('.dialog')) {
        closeModal();
      }
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      if (modal && !modal.hasAttribute('hidden')) {
        closeModal();
      }
    });
  }

  // Subtle bubble click animation (skip during drag)
  document.addEventListener('click', (e) => {
    const bubble = e.target && e.target.closest && e.target.closest('.bubble');
    if (!bubble) return;
    if (document.body.classList.contains('is-dragging')) return;
    try {
      bubble.classList.remove('pop-anim');
      // force reflow to restart animation if repeatedly clicked
      void bubble.offsetWidth;
      bubble.classList.add('pop-anim');
      setTimeout(() => bubble.classList.remove('pop-anim'), 220);
    } catch {}
  }, true);

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = bubbleTextInput ? bubbleTextInput.value.trim() : '';
      const colorInput = document.querySelector('input[name="bubbleColor"]:checked');
      const color = colorInput ? colorInput.value : '#38bdf8';
      const description = bubbleDescriptionInput ? bubbleDescriptionInput.value.trim() : '';

      if (!text) return;

      if (modalMode === 'edit' && editingEl) {
        // Update the bubble element
        try {
          editingEl.setAttribute('data-text', text);
          editingEl.setAttribute('data-color', color);
          editingEl.setAttribute('data-description', description);
          // Update content label while preserving timestamp span
          const timeSpan = editingEl.querySelector('.bubble-time');
          let labelSpan = editingEl.querySelector('.bubble-label');
          if (!labelSpan) {
            labelSpan = document.createElement('span');
            labelSpan.className = 'bubble-label';
            if (timeSpan) {
              editingEl.insertBefore(labelSpan, timeSpan);
            } else {
              editingEl.appendChild(labelSpan);
            }
          }
          labelSpan.textContent = text;
          // Apply time change if provided
          let insertedAtFinal;
          try {
            const existing = Number(editingEl.getAttribute('data-inserted-at'));
            const base = Number.isFinite(existing) ? new Date(existing) : new Date();
            const t = (bubbleTimeInput && bubbleTimeInput.value || '').trim();
            if (t) {
              const parts = t.split(':').map((s) => Number(s));
              const hh = Number.isFinite(parts[0]) ? parts[0] : base.getHours();
              const mm = Number.isFinite(parts[1]) ? parts[1] : base.getMinutes();
              const ss = Number.isFinite(parts[2]) ? parts[2] : 0;
              base.setHours(hh, mm, ss, 0);
            }
            insertedAtFinal = base.getTime();
            editingEl.setAttribute('data-inserted-at', String(insertedAtFinal));
            // Update visible time label
            const pad = (n) => String(n).padStart(2, '0');
            const hh = pad(base.getHours());
            const mm = pad(base.getMinutes());
            const ss = pad(base.getSeconds());
            let tsSpan = timeSpan;
            if (!tsSpan) {
              tsSpan = document.createElement('span');
              tsSpan.className = 'bubble-time';
              editingEl.appendChild(tsSpan);
            }
            tsSpan.textContent = ` · ${hh}:${mm}:${ss}`;
          } catch {}
          // Reapply colors
          editingEl.style.backgroundColor = color;
          try {
            const adjustColor = (hex, percent) => {
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
            };
            const isLight = (hex) => {
              if (!hex || !hex.startsWith('#')) return true;
              const r = parseInt(hex.substring(1, 3), 16);
              const g = parseInt(hex.substring(3, 5), 16);
              const b = parseInt(hex.substring(5, 7), 16);
              const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
              return luminance > 0.6;
            };
            editingEl.style.borderColor = adjustColor(color, -20);
            editingEl.style.color = isLight(color) ? 'var(--text)' : 'white';
          } catch {}

          // Persist to DB
          (async () => {
            const id = await ensureInstanceId();
            const flow = editingEl.closest('.day-flow');
            if (!flow) return;
            const dayIndex = Number(flow.getAttribute('data-day-index'));
            const dayName = dayIndexToName(dayIndex);
            if (!dayName) return;
            const childId = editingEl.getAttribute('data-id');
            const pos = Array.from(flow.querySelectorAll('.bubble')).indexOf(editingEl);
            const insertedAttr = editingEl.getAttribute('data-inserted-at');
            const insertedAt = insertedAttr != null ? Number(insertedAttr) : undefined;
            await setDayItem(id, dayName, childId, { title: text, color, position: Math.max(0, pos), insertedAt, description });
          })().catch((e) => console.warn('Failed to save edited bubble', e));
        } finally {
          closeModal();
        }
      } else {
        if (modalMode === 'edit-prototype' && editingEl) {
          // Update prototype element (no time field)
          try {
            editingEl.setAttribute('data-text', text);
            editingEl.setAttribute('data-color', color);
            editingEl.setAttribute('data-description', description);
            editingEl.textContent = '';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'bubble-label';
            labelSpan.textContent = text;
            editingEl.appendChild(labelSpan);
            // Apply styles
            editingEl.style.backgroundColor = color;
            try {
              const adjustColor = (hex, percent) => {
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
              };
              const isLight = (hex) => {
                if (!hex || !hex.startsWith('#')) return true;
                const r = parseInt(hex.substring(1, 3), 16);
                const g = parseInt(hex.substring(3, 5), 16);
                const b = parseInt(hex.substring(5, 7), 16);
                const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                return luminance > 0.6;
              };
              editingEl.style.borderColor = adjustColor(color, -20);
              editingEl.style.color = isLight(color) ? 'var(--text)' : 'white';
            } catch {}
          } finally {
            closeModal();
          }
        } else {
          bubbleManager.prependPrototype({ text, color, description });
          closeModal();
        }
      }
    });
  }

  function setEditMode(on) {
    isEditMode = !!on;
    document.body.classList.toggle('edit-mode', isEditMode);
    try { editBtn.setAttribute('aria-pressed', isEditMode ? 'true' : 'false'); } catch {}
    try { editBtn.textContent = isEditMode ? 'Done' : 'Edit'; } catch {}
    dragController.setCanvasDragEnabled(!isEditMode);
    try { dragController.setEditMode(isEditMode); } catch {}
  }

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      setEditMode(!isEditMode);
    });
  }

  // While in edit mode, clicking a canvas bubble opens edit modal
  document.addEventListener('click', (e) => {
    if (!isEditMode) return;
    const bubble = e.target && e.target.closest && e.target.closest('.day-flow .bubble');
    if (bubble) {
      e.preventDefault();
      openModal('edit', bubble);
    }
  });
  // Load instance (from URL or localStorage) and render saved bubbles
  (async () => {
    const id = await ensureInstanceId();
    try {
      const snap = await loadInstance(id);
      const days = (snap && snap.days) || {};
      DAYS.forEach((dayName, idx) => {
        const items = days[dayName] || {};
        const entries = Object.entries(items).map(([key, val]) => ({ id: key, ...val }));

        // Determine current DB order by position
        const byPosition = entries
          .slice()
          .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
          .map((e) => e.id);

        // Desired order: by insertedAt (asc), fallback to position
        const ordered = entries
          .slice()
          .sort((a, b) => {
            const atA = Number(a.insertedAt);
            const atB = Number(b.insertedAt);
            const aHas = Number.isFinite(atA);
            const bHas = Number.isFinite(atB);
            if (aHas && bHas) {
              if (atA !== atB) return atA - atB;
            } else if (aHas !== bHas) {
              // Items with insertedAt come first
              return aHas ? -1 : 1;
            }
            // Fallback stable ordering by position
            const pa = Number(a.position) || 0;
            const pb = Number(b.position) || 0;
            if (pa !== pb) return pa - pb;
            // Final tie-breaker by id for stability
            return a.id.localeCompare(b.id);
          });

        const byTimestamp = ordered.map((e) => e.id);
        const alreadySorted = byPosition.length === byTimestamp.length && byPosition.every((idVal, i) => idVal === byTimestamp[i]);

        // Render DOM in timestamp order
        for (const item of ordered) {
          const el = bubbleManager.addBubbleToDay(idx, item.title || '', `#${item.color || '38bdf8'}`, { insertedAt: (typeof item.insertedAt !== 'undefined' ? Number(item.insertedAt) : undefined), description: item.description || '' });
          el.setAttribute('data-id', item.id);
        }

        // If DB is not already in timestamp order, minimally reindex positions
        if (!alreadySorted) {
          ordered.forEach((item, position) => {
            if ((Number(item.position) || 0) !== position) {
              setDayItem(id, dayName, item.id, {
                title: item.title || '',
                color: item.color || '38bdf8',
                position,
                insertedAt: Number.isFinite(Number(item.insertedAt)) ? Number(item.insertedAt) : undefined,
                description: item.description || '',
              }).catch((e) => console.warn('Failed to reindex item', item.id, e));
            }
          });
        }
      });
    } catch (e) {
      // Non-fatal: if load fails, continue with empty state
      console.warn('Failed to load instance', e);
    }
  })();
});
