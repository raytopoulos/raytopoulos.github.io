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
  const templates = document.getElementById('templates') || document.querySelector('.bubbles-list');
  const dayFlows = document.querySelectorAll('.day-flow');
  const trashZone = document.getElementById('trash');
  const dayAccordionHeaders = document.querySelectorAll('.day-accordion__header');

  const modal = document.getElementById('modal');
  const form = document.getElementById('newBubbleForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const bubbleTextInput = document.getElementById('bubbleText');

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
    const square = el.getAttribute('data-square') === 'true';
    return { title: text, color, square };
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

  dragController.setAddBubbleHandler(async ({ dayIndex, text, color, square, before }) => {
    try {
      const el = bubbleManager.addBubbleToDay(dayIndex, text, color, { square, before });
      const id = await ensureInstanceId();
      const dayName = dayIndexToName(dayIndex);
      if (!dayName) return;
      const created = await pushDayItem(id, dayName, { title: text, color, square, position: 0 });
      el.setAttribute('data-id', created.id);
      await persistDayPositions(dayIndex);
    } catch (e) {
      console.warn('Failed to save new bubble', e);
    }
  });

  dragController.setMoveBubbleHandler((payload) => { handleMove(payload).catch((e) => console.warn('Move persist failed', e)); });
  dragController.setDeleteBubbleHandler((payload) => { handleDelete(payload).catch((e) => console.warn('Delete persist failed', e)); });

  bubbleManager.renderInitialPrototypes();

  function openModal() {
    if (!modal) return;
    modal.removeAttribute('hidden');
    form.reset();
    if (bubbleTextInput) {
      bubbleTextInput.focus();
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.setAttribute('hidden', '');
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      toggleSidebar(false);
      openModal();
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

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = bubbleTextInput ? bubbleTextInput.value.trim() : '';
      const colorInput = document.querySelector('input[name="bubbleColor"]:checked');
      const color = colorInput ? colorInput.value : '#38bdf8';
      const square = Boolean(document.getElementById('bubbleSquared')?.checked);

      if (!text) return;

      bubbleManager.prependPrototype({ text, color, square });
      closeModal();
    });
  }
  // Load instance (from URL or localStorage) and render saved bubbles
  (async () => {
    const id = await ensureInstanceId();
    try {
      const snap = await loadInstance(id);
      const days = (snap && snap.days) || {};
      DAYS.forEach((dayName, idx) => {
        const items = days[dayName] || {};
        const ordered = Object.entries(items).map(([key, val]) => ({ id: key, ...val }))
          .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
        for (const item of ordered) {
          const el = bubbleManager.addBubbleToDay(idx, item.title || '', `#${item.color || '38bdf8'}`, { square: Boolean(item.square) });
          el.setAttribute('data-id', item.id);
        }
      });
    } catch (e) {
      // Non-fatal: if load fails, continue with empty state
      console.warn('Failed to load instance', e);
    }
  })();
});
