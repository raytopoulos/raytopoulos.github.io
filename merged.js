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
  const colorGroup = document.querySelector('.color-swatch-group');
  const addColorBtn = document.getElementById('addColorBtn');
  let recordColorUsage = () => {};
  let sortSwatchesByUsage = () => {};

  // Custom color FIFO history for modal color swatches
  (function setupCustomColorPicker(){
    if (!colorGroup || !addColorBtn) return;

    function parsePx(v){
      const n = parseFloat(String(v||''));
      return Number.isFinite(n) ? n : 0;
    }

    function computeCapacity(){
      try {
        const groupRect = colorGroup.getBoundingClientRect();
        const firstLabel = colorGroup.querySelector('label');
        const labelRect = firstLabel ? firstLabel.getBoundingClientRect() : { width: 28 };
        const styles = getComputedStyle(colorGroup);
        const gap = parsePx(styles.gap || styles.columnGap || 8);
        const slot = (labelRect.width || 28) + gap;
        const addBtnRect = addColorBtn.getBoundingClientRect();
        const usable = Math.max(0, groupRect.width - addBtnRect.width - gap);
        const count = Math.max(1, Math.floor((usable + gap) / slot));
        // total radiobuttons allowed (excluding add button)
        return count;
      } catch {
        return 8; // sensible default
      }
    }

    function getAllSwatches(){
      return Array.from(colorGroup.querySelectorAll('input[type="radio"][name="bubbleColor"]'));
    }

    function findSwatchByValue(val){
      const norm = normalizeHex(val);
      if (!norm) return null;
      return getAllSwatches().find((i) => normalizeHex(i.value) === norm) || null;
    }

    function normalizeHex(hex){
      try {
        if (!hex) return null;
        let h = hex.trim();
        if (!h.startsWith('#')) h = '#' + h;
        if (h.length === 4) {
          const r = h[1], g = h[2], b = h[3];
          h = '#' + r + r + g + g + b + b;
        }
        if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
      } catch {}
      return null;
    }

    const COLOR_STATS_KEY = 'organizer:colorStats';
    let colorStats = loadColorStats();

    function loadColorStats(){
      try {
        const raw = localStorage.getItem(COLOR_STATS_KEY);
        if (!raw) return {};
        const data = JSON.parse(raw);
        return (data && typeof data === 'object') ? data : {};
      } catch {
        return {};
      }
    }

    function saveColorStats(){
      try {
        localStorage.setItem(COLOR_STATS_KEY, JSON.stringify(colorStats));
      } catch {}
    }

    function ensureSwatchMetadata(radio, fallbackCreatedAt = Date.now()){
      if (!radio) return null;
      const value = normalizeHex(radio.value || radio.getAttribute('data-color'));
      if (!value) return null;
      radio.value = value;
      let stats = colorStats[value];
      let dirty = false;
      if (!stats) {
        stats = { useCount: 0, lastUsed: 0, createdAt: fallbackCreatedAt };
        colorStats[value] = stats;
        dirty = true;
      } else {
        if (!stats.createdAt) {
          stats.createdAt = fallbackCreatedAt;
          dirty = true;
        }
        if (typeof stats.useCount !== 'number') { stats.useCount = 0; dirty = true; }
        if (typeof stats.lastUsed !== 'number') { stats.lastUsed = 0; dirty = true; }
      }
      radio.dataset.createdAt = stats.createdAt;
      radio.dataset.useCount = stats.useCount;
      radio.dataset.lastUsed = stats.lastUsed;
      if (dirty) saveColorStats();
      return { value, stats };
    }

    function getLabelForRadio(radio){
      if (!radio) return null;
      return colorGroup.querySelector(`label[for="${escCssIdent(radio.id)}"]`);
    }

    const initialSwatches = getAllSwatches();
    const baseCreatedAt = Date.now() - initialSwatches.length;
    initialSwatches.forEach((radio, idx) => {
      ensureSwatchMetadata(radio, baseCreatedAt + idx);
    });

    function addCustomSwatch(hex){
      const value = normalizeHex(hex);
      if (!value) return;

      // If a swatch with this value exists, just select it
      const existing = findSwatchByValue(value);
      if (existing) {
        try { existing.checked = true; existing.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
        return;
      }

      // Create radio + label pair
      const id = `color-custom-${Date.now()}`;
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'bubbleColor';
      radio.id = id;
      radio.value = value;
      radio.setAttribute('data-custom', 'true');

      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.title = value;
      label.style.backgroundColor = value;

      // Ensure metadata/stats
      ensureSwatchMetadata(radio);
      saveColorStats();

      // Insert before the + button
      colorGroup.insertBefore(radio, addColorBtn);
      colorGroup.insertBefore(label, addColorBtn);

      // Select the new color
      try { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); } catch {}

      enforceCapacity();
    }

    function escCssIdent(s){
      try {
        if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(s);
      } catch {}
      // basic fallback: escape non-word chars
      return String(s).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    }

    function enforceCapacity(){
      const capacity = computeCapacity();
      const radios = getAllSwatches();
      const excess = Math.max(0, radios.length - capacity);
      if (excess <= 0) return;
      const ranked = radios
        .map((radio) => ({
          radio,
          label: getLabelForRadio(radio),
          useCount: Number(radio.dataset.useCount) || 0,
          lastUsed: Number(radio.dataset.lastUsed) || 0,
          createdAt: Number(radio.dataset.createdAt) || 0,
        }))
        .sort((a, b) => {
          if (a.useCount !== b.useCount) return a.useCount - b.useCount;
          if (a.lastUsed !== b.lastUsed) return a.lastUsed - b.lastUsed;
          return a.createdAt - b.createdAt;
        });
      for (let i = 0; i < excess; i++) {
        const target = ranked[i];
        if (!target) break;
        const { radio, label } = target;
        const value = normalizeHex(radio.value);
        try { radio.remove(); } catch {}
        if (label) { try { label.remove(); } catch {} }
        if (value && colorStats[value]) {
          delete colorStats[value];
        }
      }
      saveColorStats();
    }

    function sortSwatchesByUsageInternal(){
      if (!addColorBtn) return;
      const radios = getAllSwatches();
      const entries = radios.map((radio) => ({
        radio,
        label: getLabelForRadio(radio),
        useCount: Number(radio.dataset.useCount) || 0,
        lastUsed: Number(radio.dataset.lastUsed) || 0,
        createdAt: Number(radio.dataset.createdAt) || 0,
      }));
      entries.sort((a, b) => {
        if (a.useCount !== b.useCount) return a.useCount - b.useCount;
        if (a.lastUsed !== b.lastUsed) return a.lastUsed - b.lastUsed;
        return a.createdAt - b.createdAt;
      });
      entries.forEach(({ radio, label }) => {
        colorGroup.insertBefore(radio, addColorBtn);
        if (label) colorGroup.insertBefore(label, addColorBtn);
      });
    }

    function recordColorUsageInternal(hex){
      const value = normalizeHex(hex);
      if (!value) return;
      let radio = findSwatchByValue(value);
      if (!radio) {
        addCustomSwatch(value);
        radio = findSwatchByValue(value);
        if (!radio) return;
      }
      const info = ensureSwatchMetadata(radio);
      if (!info) return;
      info.stats.useCount = (info.stats.useCount || 0) + 1;
      info.stats.lastUsed = Date.now();
      radio.dataset.useCount = info.stats.useCount;
      radio.dataset.lastUsed = info.stats.lastUsed;
      saveColorStats();
    }

    // Simple confirm popover management
    let confirmEl = null;
    let pendingHex = null;
    let docClickHandler = null;
    let docKeyHandler = null;
    let pointerDownInside = false;
    let pointerDownHandlerRef = null;
    let pointerUpHandlerRef = null;
    let pickerCleanupFns = [];
    let resizeHandlerRef = null;

    function placeConfirm() {
      if (!confirmEl) return;
      const rect = addColorBtn.getBoundingClientRect();
      const w = confirmEl.offsetWidth || 220;
      const h = confirmEl.offsetHeight || 44;
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left - 4));
      // Prefer placing above the color button to avoid overlapping native picker
      const aboveTop = rect.top - h - 8;
      const canPlaceAbove = aboveTop >= 8;
      const belowTop = rect.bottom + 8;
      const top = canPlaceAbove ? aboveTop : Math.max(8, Math.min(window.innerHeight - h - 8, belowTop));
      confirmEl.style.left = left + 'px';
      confirmEl.style.top = top + 'px';
    }

    function hideConfirm(){
      if (confirmEl && confirmEl.parentNode) {
        try { confirmEl.parentNode.removeChild(confirmEl); } catch {}
      }
      confirmEl = null;
      pendingHex = null;
      if (pickerCleanupFns.length) {
        pickerCleanupFns.forEach((fn) => { try { fn(); } catch {} });
        pickerCleanupFns = [];
      }
      pointerDownInside = false;
      if (resizeHandlerRef) {
        window.removeEventListener('resize', resizeHandlerRef);
        resizeHandlerRef = null;
      }
      if (docClickHandler) { try { document.removeEventListener('click', docClickHandler, true); } catch {} docClickHandler = null; }
      if (docKeyHandler) { try { document.removeEventListener('keydown', docKeyHandler, true); } catch {} docKeyHandler = null; }
    }

    function showConfirm(hex){
      pendingHex = hex;
      if (!confirmEl) {
        confirmEl = document.createElement('div');
        confirmEl.className = 'color-confirm-popover';
        confirmEl.innerHTML = `
          <div class="preview"></div>
          <div class="picker-inline">
            <div class="sv-plane"><div class="sv-thumb"></div></div>
            <div class="hue-bar"><div class="hue-thumb"></div></div>
          </div>
          <input type="text" class="hex" aria-label="Hex color" />
          <div class="actions">
            <button type="button" class="primary ok">OK</button>
            <button type="button" class="cancel">Cancel</button>
          </div>
        `;
        document.body.appendChild(confirmEl);
        const currentConfirm = confirmEl;
        pickerCleanupFns = [];
        pointerDownHandlerRef = () => { pointerDownInside = true; };
        pointerUpHandlerRef = () => {
          setTimeout(() => { pointerDownInside = false; }, 60);
        };
        currentConfirm.addEventListener('pointerdown', pointerDownHandlerRef);
        window.addEventListener('pointerup', pointerUpHandlerRef, true);
        pickerCleanupFns.push(() => {
          if (pointerDownHandlerRef && currentConfirm) {
            currentConfirm.removeEventListener('pointerdown', pointerDownHandlerRef);
          }
          if (pointerUpHandlerRef) {
            window.removeEventListener('pointerup', pointerUpHandlerRef, true);
          }
          pointerDownHandlerRef = null;
          pointerUpHandlerRef = null;
        });
        const ok = confirmEl.querySelector('.ok');
        const cancel = confirmEl.querySelector('.cancel');
        const pickerInline = confirmEl.querySelector('.picker-inline');
        const svPlane = confirmEl.querySelector('.sv-plane');
        const svThumb = confirmEl.querySelector('.sv-thumb');
        const hueBar = confirmEl.querySelector('.hue-bar');
        const hueThumb = confirmEl.querySelector('.hue-thumb');
        const inputHex = confirmEl.querySelector('.hex');
        const preview = confirmEl.querySelector('.preview');
        // HSV utilities
        function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }
        function hsvToRgb(h, s, v){
          h = (h % 360 + 360) % 360; s = clamp(s,0,1); v = clamp(v,0,1);
          const c = v * s;
          const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
          const m = v - c;
          let r=0,g=0,b=0;
          if (h < 60) { r=c; g=x; b=0; }
          else if (h < 120) { r=x; g=c; b=0; }
          else if (h < 180) { r=0; g=c; b=x; }
          else if (h < 240) { r=0; g=x; b=c; }
          else if (h < 300) { r=x; g=0; b=c; }
          else { r=c; g=0; b=x; }
          return { r: Math.round((r+m)*255), g: Math.round((g+m)*255), b: Math.round((b+m)*255) };
        }
        function rgbToHex(r,g,b){
          const toHex = (n) => n.toString(16).padStart(2,'0');
          return '#' + toHex(r) + toHex(g) + toHex(b);
        }
        function hsvToHex(h,s,v){ const {r,g,b} = hsvToRgb(h,s,v); return rgbToHex(r,g,b); }
        function hexToRgb(hex){
          let h = (hex||'').trim();
          if (!h) return null;
          if (h[0] !== '#') h = '#'+h;
          if (h.length === 4) h = '#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
          const m = /^#([0-9a-fA-F]{6})$/.exec(h);
          if (!m) return null;
          const x = parseInt(m[1],16);
          return { r:(x>>16)&255, g:(x>>8)&255, b:x&255 };
        }
        function rgbToHsv(r,g,b){
          r/=255; g/=255; b/=255;
          const max = Math.max(r,g,b), min = Math.min(r,g,b);
          const d = max - min;
          let h;
          if (d === 0) h = 0;
          else if (max === r) h = 60 * (((g-b)/d) % 6);
          else if (max === g) h = 60 * (((b-r)/d) + 2);
          else h = 60 * (((r-g)/d) + 4);
          if (h < 0) h += 360;
          const s = max === 0 ? 0 : d / max;
          const v = max;
          return { h, s, v };
        }

        // State
        let H = 0, S = 1, V = 1;

        function setSVBackground(){
          svPlane.style.background = `linear-gradient(to right, #fff, rgba(255,255,255,0)), linear-gradient(to top, #000, rgba(0,0,0,0)), hsl(${H}, 100%, 50%)`;
        }
        function positionThumbs(){
          const rectSV = svPlane.getBoundingClientRect();
          const x = clamp(S,0,1) * rectSV.width;
          const y = (1 - clamp(V,0,1)) * rectSV.height;
          svThumb.style.left = `${x}px`;
          svThumb.style.top = `${y}px`;
          const rectHue = hueBar.getBoundingClientRect();
          const hx = (H/360) * rectHue.width;
          hueThumb.style.left = `${hx}px`;
        }
        function updateAllFromHSV(){
          setSVBackground();
          positionThumbs();
          const hexNow = hsvToHex(H,S,V);
          inputHex.value = hexNow;
          preview.style.backgroundColor = hexNow;
        }
        function updateHSVFromHex(hex){
          const rgb = hexToRgb(hex);
          if (!rgb) return;
          const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
          H = hsv.h; S = hsv.s; V = hsv.v;
          updateAllFromHSV();
        }
        // Initialize from pendingHex
        updateHSVFromHex(pendingHex);

        function svPointer(e){
          const rect = svPlane.getBoundingClientRect();
          const px = clamp((e.clientX - rect.left)/rect.width, 0, 1);
          const py = clamp((e.clientY - rect.top)/rect.height, 0, 1);
          S = px; V = 1 - py; updateAllFromHSV();
        }
        function huePointer(e){
          const rect = hueBar.getBoundingClientRect();
          const px = clamp((e.clientX - rect.left)/rect.width, 0, 1);
          H = px * 360; updateAllFromHSV();
        }
        function bindDrag(el, onMove){
          let down = false;
          const handleMouseDown = (ev) => { down = true; onMove(ev); ev.preventDefault(); };
          const handleMouseMove = (ev) => { if (!down) return; onMove(ev); ev.preventDefault(); };
          const handleMouseUp = () => { down = false; };
          const handleTouchStart = (ev) => {
            down = true;
            const t = ev.touches[0];
            onMove({ clientX: t.clientX, clientY: t.clientY });
            ev.preventDefault();
          };
          const handleTouchMove = (ev) => {
            if (!down) return;
            const t = ev.touches[0];
            onMove({ clientX: t.clientX, clientY: t.clientY });
            ev.preventDefault();
          };
          const handleTouchEnd = () => { down = false; };
          el.addEventListener('mousedown', handleMouseDown);
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          el.addEventListener('touchstart', handleTouchStart, { passive: false });
          window.addEventListener('touchmove', handleTouchMove, { passive: false });
          window.addEventListener('touchend', handleTouchEnd);
          window.addEventListener('touchcancel', handleTouchEnd);
          pickerCleanupFns.push(() => {
            el.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            el.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
          });
        }
        bindDrag(svPlane, svPointer);
        bindDrag(hueBar, huePointer);

        const updatePreview = (val) => {
          const v = (val || '').trim();
          const norm = v.startsWith('#') ? v : ('#' + v);
          inputHex.value = norm;
          preview.style.backgroundColor = norm;
          updateHSVFromHex(norm);
        };
        ok.addEventListener('click', () => {
          const val = inputHex.value.trim();
          addCustomSwatch(val);
          hideConfirm();
        });
        cancel.addEventListener('click', hideConfirm);
        inputHex.addEventListener('input', () => { updatePreview(inputHex.value); });
        docClickHandler = (e) => {
          if (!confirmEl) return;
          if (confirmEl.contains(e.target) || addColorBtn.contains(e.target)) return;
          if (pointerDownInside) return;
          hideConfirm();
        };
        docKeyHandler = (e) => {
          if (e.key === 'Escape') hideConfirm();
        };
        document.addEventListener('click', docClickHandler, true);
        document.addEventListener('keydown', docKeyHandler, true);
        resizeHandlerRef = () => placeConfirm();
        window.addEventListener('resize', resizeHandlerRef);
        setTimeout(placeConfirm, 0);
      } else {
        const inputHex = confirmEl.querySelector('.hex');
        const preview = confirmEl.querySelector('.preview');
        if (inputHex && preview) {
          inputHex.value = hex;
          preview.style.backgroundColor = hex;
        }
        setTimeout(placeConfirm, 0);
      }
    }

    addColorBtn.addEventListener('click', () => {
      const selected = (colorGroup.querySelector('input[name="bubbleColor"]:checked') || {}).value || '#38bdf8';
      showConfirm(selected);
    });

    // No external floating color picker; selection happens inside the confirm popover.

    // Recompute capacity on resize
    window.addEventListener('resize', () => {
      enforceCapacity();
      placeConfirm();
    });

    recordColorUsage = recordColorUsageInternal;
    sortSwatchesByUsage = sortSwatchesByUsageInternal;
  })();

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
    if (mode === 'create') {
      try { sortSwatchesByUsage(); } catch {}
    }
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
            recordColorUsage(color);
          }
        } else {
          bubbleManager.prependPrototype({ text, color, description });
          closeModal();
          recordColorUsage(color);
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
