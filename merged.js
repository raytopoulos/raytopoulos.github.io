import { createAccordionController } from './accordion.js';
import { createBubbleManager } from './bubble-manager.js';
import { createDragController } from './drag-controller.js';
import { i18n } from './i18n.js';
import {
  createInstance,
  loadInstance,
  pushDayItem,
  setDayItem,
  removeDayItem,
  DAYS,
  PROTOTYPE_ID_LENGTH,
  createPrototypeSet,
  loadPrototypeSet,
  savePrototypeSet,
  saveColorStatsToDb,
  saveInstanceLabel,
} from './instances.js';

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
  const submitBtn = document.getElementById('submitBtn');
    const bubbleTextInput = document.getElementById('bubbleText');
  const bubbleDescriptionInput = document.getElementById('bubbleDescription');
  const bubbleTimeHourInput = document.getElementById('bubbleTimeHour');
  const bubbleTimeMinuteInput = document.getElementById('bubbleTimeMinute');
  const bubbleTimeSecondInput = document.getElementById('bubbleTimeSecond');
  const bubbleTimeFormRow = document.getElementById('bubbleTimeFormRow');
  const colorGroup = document.querySelector('.color-swatch-group');
  const addColorBtn = document.getElementById('addColorBtn');
  let modalPointerStartedInside = false;
  let recordColorUsage = () => {};
  let sortSwatchesByUsage = () => {};
  let recordPrototypeUsage = () => {};
  let isEditMode = false;
  let modalMode = 'create';
  let editingEl = null;

  // Toolbar title: initial visibility is controlled via CSS.
  // We only reveal it once we have the correct label.
  const toolbarTitleEl = document.querySelector('.toolbar-title');
  if (toolbarTitleEl) {
    toolbarTitleEl.dataset.defaultTitle = i18n.t('toolbarTitleDefault');
    if (!toolbarTitleEl.textContent || toolbarTitleEl.textContent === 'Weekly Planner') {
      toolbarTitleEl.textContent = i18n.t('toolbarTitleDefault');
    }
  }

  function setToolbarTitle(label) {
    if (!toolbarTitleEl) return;
    const defaultTitle = toolbarTitleEl.dataset.defaultTitle || i18n.t('toolbarTitleDefault');
    const text = String(label || '').trim() || defaultTitle;
    toolbarTitleEl.textContent = text;
    toolbarTitleEl.style.visibility = 'visible';
  }

  function formatInstanceLabel(n) {
    return i18n.t('instanceLabelTemplate', { n });
  }

  function getDefaultPrototypeSeedForDb() {
    return [
      { text: i18n.t('defaultPrototypeTask'), color: '38bdf8', description: '' },
      { text: i18n.t('defaultPrototypeIdea'), color: 'a78bfa', description: '' },
      { text: i18n.t('defaultPrototypeBug'), color: 'f87171', description: '' },
      { text: i18n.t('defaultPrototypeNote'), color: '10b981', description: '' },
    ];
  }

  function getDefaultPrototypesForUi() {
    return getDefaultPrototypeSeedForDb().map((p) => ({
      ...p,
      color: `#${String(p.color || '').replace(/^#/, '')}`,
    }));
  }

  function getDayNameList() {
    return [
      i18n.t('weekdayMon'),
      i18n.t('weekdayTue'),
      i18n.t('weekdayWed'),
      i18n.t('weekdayThu'),
      i18n.t('weekdayFri'),
      i18n.t('weekdaySat'),
      i18n.t('weekdaySun'),
    ];
  }

  function applyDayTranslations() {
    const dayNames = getDayNameList();
    const headers = document.querySelectorAll('.week-table th');
    headers.forEach((th, idx) => {
      if (dayNames[idx]) th.textContent = dayNames[idx];
    });
    const accordionLabels = document.querySelectorAll('.day-accordion__header .label');
    accordionLabels.forEach((labelEl, idx) => {
      if (dayNames[idx]) labelEl.textContent = dayNames[idx];
    });
    const flows = document.querySelectorAll('.day-flow');
    flows.forEach((flow, idx) => {
      const label = i18n.t('weekdayTasks', { day: dayNames[idx] || '' });
      flow.setAttribute('aria-label', label);
      const cell = flow.closest('td[data-day]');
      if (cell && dayNames[idx]) {
        cell.setAttribute('data-day', dayNames[idx]);
      }
    });
    dayAccordionHeaders?.forEach?.((btn, idx) => {
      const label = i18n.t('weekdayTasks', { day: dayNames[idx] || '' });
      btn.setAttribute('aria-label', label);
    });
  }

  function applyEditorCopy() {
    document.title = i18n.t('pageTitleEditor');
    const appRoot = document.querySelector('.app');
    if (appRoot) appRoot.setAttribute('aria-label', i18n.t('appAriaLabel'));
    if (sidebar) {
      sidebar.setAttribute('aria-label', i18n.t('sidebarTitle'));
      const titleSpan = sidebar.querySelector('.sidebar-title-text');
      if (titleSpan) titleSpan.textContent = i18n.t('sidebarTitle');
    }
    if (closeBtn) {
      const closeLabel = i18n.t('sidebarClose');
      closeBtn.setAttribute('aria-label', closeLabel);
      closeBtn.title = closeLabel;
    }
    const hint = sidebar?.querySelector('.hint');
    if (hint) hint.textContent = i18n.t('sidebarHint');
    if (addBtn) {
      addBtn.textContent = i18n.t('sidebarAdd');
      addBtn.setAttribute('aria-label', i18n.t('sidebarAddAria'));
    }
    if (menuBtn) {
      menuBtn.setAttribute('aria-label', i18n.t('toolbarMenu'));
    }
    if (toolbarTitleEl) {
      const defaultTitle = i18n.t('toolbarTitleDefault');
      const previousDefault = toolbarTitleEl.dataset.defaultTitle;
      toolbarTitleEl.dataset.defaultTitle = defaultTitle;
      if (!toolbarTitleEl.textContent || toolbarTitleEl.textContent === 'Weekly Planner' || (previousDefault && toolbarTitleEl.textContent === previousDefault)) {
        toolbarTitleEl.textContent = defaultTitle;
      }
      toolbarTitleEl.style.visibility = 'visible';
    }
    if (editBtn) {
      const editLabel = i18n.t('toolbarEditTooltip');
      editBtn.textContent = isEditMode ? i18n.t('toolbarDone') : i18n.t('toolbarEdit');
      editBtn.title = isEditMode ? i18n.t('toolbarDone') : editLabel;
      editBtn.setAttribute('aria-label', editLabel);
    }
    const titleInput = document.getElementById('instanceTitleInput');
    if (titleInput) {
      titleInput.setAttribute('aria-label', i18n.t('toolbarNameAria'));
    }
    applyDayTranslations();
    if (trashZone) {
      trashZone.setAttribute('aria-label', i18n.t('trashAria'));
      const label = trashZone.querySelector('.label');
      if (label) label.textContent = i18n.t('trashLabel');
    }
    const dlgTitle = document.getElementById('dlg-title');
    if (dlgTitle) dlgTitle.textContent = i18n.t('modalTitle');
    const bubbleTextLabel = document.querySelector('label[for="bubbleText"]');
    if (bubbleTextLabel) bubbleTextLabel.textContent = i18n.t('modalLabelText');
    if (bubbleTextInput) bubbleTextInput.placeholder = i18n.t('modalPlaceholderText');
    const bubbleDescLabel = document.querySelector('label[for="bubbleDescription"]');
    if (bubbleDescLabel) bubbleDescLabel.textContent = i18n.t('modalLabelDescription');
    if (bubbleDescriptionInput) bubbleDescriptionInput.placeholder = i18n.t('modalPlaceholderDescription');
    const bubbleTimeLabel = document.querySelector('label[for="bubbleTimeHour"]');
    if (bubbleTimeLabel) bubbleTimeLabel.textContent = i18n.t('modalLabelTime');
    if (bubbleTimeHourInput) {
      bubbleTimeHourInput.placeholder = 'HH';
      bubbleTimeHourInput.setAttribute('aria-label', i18n.t('modalTimeHour'));
    }
    if (bubbleTimeMinuteInput) {
      bubbleTimeMinuteInput.placeholder = 'MM';
      bubbleTimeMinuteInput.setAttribute('aria-label', i18n.t('modalTimeMinute'));
    }
    if (bubbleTimeSecondInput) {
      bubbleTimeSecondInput.placeholder = 'SS';
      bubbleTimeSecondInput.setAttribute('aria-label', i18n.t('modalTimeSecond'));
    }
    const legend = document.querySelector('#newBubbleForm fieldset legend');
    if (legend) legend.textContent = i18n.t('modalLegendColor');
    if (colorGroup) colorGroup.setAttribute('aria-label', i18n.t('modalAriaColor'));
    if (addColorBtn) {
      addColorBtn.setAttribute('aria-label', i18n.t('modalAddColor'));
      addColorBtn.title = i18n.t('modalAddColorTitle');
    }
    const colorTitles = [
      { id: 'color-blue', title: i18n.t('colorBlue') },
      { id: 'color-purple', title: i18n.t('colorPurple') },
      { id: 'color-red', title: i18n.t('colorRed') },
      { id: 'color-green', title: i18n.t('colorGreen') },
      { id: 'color-yellow', title: i18n.t('colorYellow') },
    ];
    colorTitles.forEach(({ id, title }) => {
      const labelEl = document.querySelector(`label[for="${id}"]`);
      if (labelEl) labelEl.title = title;
    });
    if (cancelBtn) cancelBtn.textContent = i18n.t('modalCancel');
    if (submitBtn) submitBtn.textContent = modalMode === 'create' ? i18n.t('modalSubmitCreate') : i18n.t('modalSubmitSave');
  }
  i18n.onChange(() => {
    applyEditorCopy();
  });
  applyEditorCopy();

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
      try {
        // Also persist color stats to Firebase under /prototypes/<id>/colors
        if (typeof currentPrototypeId === 'string' && currentPrototypeId) {
          saveColorStatsToDb(currentPrototypeId, colorStats).catch(() => {});
        }
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
          <input type="text" class="hex" aria-label="${i18n.t('colorPickerHexLabel')}" />
          <div class="actions">
            <button type="button" class="primary ok">${i18n.t('colorPickerOk')}</button>
            <button type="button" class="cancel">${i18n.t('modalCancel')}</button>
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
        if (ok) ok.textContent = i18n.t('colorPickerOk');
        if (cancel) cancel.textContent = i18n.t('modalCancel');
        if (inputHex) inputHex.setAttribute('aria-label', i18n.t('colorPickerHexLabel'));
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

  // Prototype usage tracking (for sorting sidebar by most-used)
  const PROTOTYPE_USAGE_KEY = 'organizer:prototypeUsage';
  let prototypeUsageCache = null;

  function loadPrototypeUsage() {
    if (prototypeUsageCache) return prototypeUsageCache;
    try {
      const raw = localStorage.getItem(PROTOTYPE_USAGE_KEY);
      if (!raw) {
        prototypeUsageCache = {};
        return prototypeUsageCache;
      }
      const data = JSON.parse(raw);
      prototypeUsageCache = (data && typeof data === 'object') ? data : {};
    } catch {
      prototypeUsageCache = {};
    }
    return prototypeUsageCache;
  }

  function savePrototypeUsage() {
    if (!prototypeUsageCache) return;
    try {
      localStorage.setItem(PROTOTYPE_USAGE_KEY, JSON.stringify(prototypeUsageCache));
    } catch {}
  }

  function normalizePrototypeColorForKey(color) {
    if (!color) return '';
    try {
      let c = String(color).trim().toLowerCase();
      if (c.startsWith('rgb(') || c.startsWith('rgba(')) {
        // Best-effort: leave RGB strings as-is
        return c;
      }
      if (c.startsWith('#')) c = c.slice(1);
      if (/^[0-9a-f]{3}$/.test(c)) {
        const r = c[0];
        const g = c[1];
        const b = c[2];
        c = `${r}${r}${g}${g}${b}${b}`;
      }
      if (/^[0-9a-f]{6}$/.test(c)) {
        return `#${c}`;
      }
      return c;
    } catch {
      return '';
    }
  }

  function makePrototypeUsageKey(protoLike) {
    if (!protoLike) return null;
    const text = String(protoLike.text || '').trim();
    const color = normalizePrototypeColorForKey(protoLike.color || protoLike.dataColor || '');
    const description = String(protoLike.description || '').trim();
    if (!text && !color && !description) return null;
    return `${text}||${color}||${description}`;
  }

  function ensurePrototypeUsageEntry(proto, fallbackCreatedAt) {
    const usage = loadPrototypeUsage();
    const key = makePrototypeUsageKey(proto);
    if (!key) return { key: null, stats: null };
    let stats = usage[key];
    let dirty = false;
    if (!stats || typeof stats !== 'object') {
      stats = { useCount: 0, lastUsed: 0, createdAt: fallbackCreatedAt };
      usage[key] = stats;
      dirty = true;
    } else {
      if (typeof stats.createdAt !== 'number') {
        stats.createdAt = fallbackCreatedAt;
        dirty = true;
      }
      if (typeof stats.useCount !== 'number') {
        stats.useCount = 0;
        dirty = true;
      }
      if (typeof stats.lastUsed !== 'number') {
        stats.lastUsed = 0;
        dirty = true;
      }
    }
    if (dirty) savePrototypeUsage();
    return { key, stats };
  }

  function sortPrototypesByUsage(list) {
    if (!Array.isArray(list) || list.length <= 1) return Array.isArray(list) ? list.slice() : [];
    const now = Date.now();
    const baseCreatedAt = now - list.length;
    const usage = loadPrototypeUsage();

    const annotated = list.map((proto, index) => {
      const fallbackCreatedAt = baseCreatedAt + index;
      const key = makePrototypeUsageKey(proto);
      if (!key) {
        return {
          proto,
          useCount: 0,
          lastUsed: 0,
          createdAt: fallbackCreatedAt,
          index,
        };
      }
      let stats = usage[key];
      if (!stats || typeof stats !== 'object') {
        stats = { useCount: 0, lastUsed: 0, createdAt: fallbackCreatedAt };
        usage[key] = stats;
      } else {
        if (typeof stats.createdAt !== 'number') stats.createdAt = fallbackCreatedAt;
        if (typeof stats.useCount !== 'number') stats.useCount = 0;
        if (typeof stats.lastUsed !== 'number') stats.lastUsed = 0;
      }
      return {
        proto,
        useCount: stats.useCount || 0,
        lastUsed: stats.lastUsed || 0,
        createdAt: stats.createdAt || fallbackCreatedAt,
        index,
      };
    });

    // Persist any new/normalized stats (e.g., createdAt defaults)
    savePrototypeUsage();

    annotated.sort((a, b) => {
      if (b.useCount !== a.useCount) return b.useCount - a.useCount; // most used first
      if (b.lastUsed !== a.lastUsed) return b.lastUsed - a.lastUsed; // most recently used first
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt; // older entries first
      return a.index - b.index; // stable tiebreaker
    });

    return annotated.map((entry) => entry.proto);
  }

  recordPrototypeUsage = (protoOrText, colorMaybe, descriptionMaybe) => {
    try {
      let proto;
      if (protoOrText && typeof protoOrText === 'object') {
        proto = {
          text: protoOrText.text,
          color: protoOrText.color,
          description: protoOrText.description,
        };
      } else {
        proto = {
          text: protoOrText,
          color: colorMaybe,
          description: descriptionMaybe,
        };
      }
      const usage = loadPrototypeUsage();
      const key = makePrototypeUsageKey(proto);
      if (!key) return;
      const now = Date.now();
      let stats = usage[key];
      if (!stats || typeof stats !== 'object') {
        stats = { useCount: 0, lastUsed: 0, createdAt: now };
        usage[key] = stats;
      }
      stats.useCount = (stats.useCount || 0) + 1;
      stats.lastUsed = now;
      savePrototypeUsage();
    } catch {
      // Swallow errors to avoid breaking UX if localStorage is unavailable
    }
  };

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
    initialPrototypes: getDefaultPrototypesForUi(),
  });
  // Allow editing prototypes via bubble-manager
  if (bubbleManager && typeof bubbleManager.setPrototypeEditHandler === 'function') {
    bubbleManager.setPrototypeEditHandler((el) => openModal('edit-prototype', el));
  }

  // Instance + persistence wiring using instances.js
  const LS_KEY = 'organizer:instanceId';
  const LS_INSTANCE_COUNTER_PREFIX = 'organizer:instanceCounter:';
  let currentInstanceId = null;
  let currentPrototypeId = null;
  let currentInstanceNumber = null;

  function dayIndexToName(i) { return DAYS[i] || null; }

  function getDayFlowEl(index) {
    return document.querySelector(`.day-flow[data-day-index="${index}"]`);
  }

  function parseCompositeInstanceId(id) {
    if (!id) return { prototypeId: null, instanceNumber: null };
    const raw = String(id);
    if (!Number.isFinite(PROTOTYPE_ID_LENGTH) || PROTOTYPE_ID_LENGTH <= 0) {
      return { prototypeId: null, instanceNumber: null };
    }
    if (raw.length <= PROTOTYPE_ID_LENGTH) {
      return { prototypeId: null, instanceNumber: null };
    }
    const prototypeId = raw.slice(0, PROTOTYPE_ID_LENGTH);
    const suffix = raw.slice(PROTOTYPE_ID_LENGTH);
    const n = Number.parseInt(suffix, 10);
    if (!Number.isFinite(n) || n < 0) {
      return { prototypeId: null, instanceNumber: null };
    }
    return { prototypeId, instanceNumber: n };
  }

  function makeCompositeInstanceId(prototypeId, instanceNumber) {
    const pid = String(prototypeId || '').trim();
    const suffix = String(instanceNumber ?? '').trim();
    if (!pid || !suffix) throw new Error('Missing prototypeId or instanceNumber');
    return `${pid}${suffix}`;
  }

  async function persistPrototypes() {
    if (!currentPrototypeId) return;
    if (!bubbleManager || typeof bubbleManager.getPrototypes !== 'function') return;
    try {
      const sidebarPrototypes = bubbleManager.getPrototypes();
      const toSave = Array.isArray(sidebarPrototypes)
        ? sidebarPrototypes.map((p) => ({
            text: p.text || '',
            color: (p.color || '#38bdf8').replace(/^#/, ''),
            description: p.description || '',
          }))
        : [];
      await savePrototypeSet(currentPrototypeId, toSave);
    } catch (e) {
      console.warn('Failed to persist prototypes', e);
    }
  }

  async function bootstrapInstanceAndPrototypes() {
    if (currentInstanceId) {
      return { id: currentInstanceId, prototypeId: currentPrototypeId };
    }

    const url = new URL(location.href);
    const fromUrl = url.searchParams.get('id') || null;
    const fromLS = localStorage.getItem(LS_KEY) || null;
    let rawId = fromUrl || fromLS || null;

    const parsed = parseCompositeInstanceId(rawId);
    const hasComposite = !!(parsed.prototypeId && parsed.instanceNumber !== null && parsed.instanceNumber >= 0);
    let prototypeId = parsed.prototypeId || null;
    let instanceNumber = (parsed.instanceNumber !== null && parsed.instanceNumber >= 0)
      ? parsed.instanceNumber
      : null;

    let prototypesPayload = null;

    // If we already have a composite id, try to load its prototype set.
    if (hasComposite && prototypeId) {
      try {
        const protoSnap = await loadPrototypeSet(prototypeId);
        if (protoSnap && Array.isArray(protoSnap.prototypes)) {
          prototypesPayload = protoSnap.prototypes;
        }
      } catch (e) {
        console.warn('Failed to load prototypes set', e);
      }
    }

    // If no id at all, create a new prototype set and composite instance id.
    if (!rawId) {
      let seedList = [];
      try {
        seedList = bubbleManager.getPrototypes().map((p) => ({
          text: p.text || '',
          color: (p.color || '#38bdf8').replace(/^#/, ''),
          description: p.description || '',
        }));
      } catch {
        seedList = getDefaultPrototypeSeedForDb();
      }
      const createdProto = await createPrototypeSet(seedList);
      prototypeId = createdProto.id;
      prototypesPayload = createdProto.data && Array.isArray(createdProto.data.prototypes)
        ? createdProto.data.prototypes
        : seedList;

      const counterKey = `${LS_INSTANCE_COUNTER_PREFIX}${prototypeId}`;
      let next = Number(localStorage.getItem(counterKey) || '0');
      if (!Number.isFinite(next) || next < 0) next = 0;
      next += 1;
      try { localStorage.setItem(counterKey, String(next)); } catch {}
      instanceNumber = next;

      rawId = makeCompositeInstanceId(prototypeId, instanceNumber);
    }

    // If we have an id but it is not a composite id, treat it as legacy.
    if (rawId && !hasComposite) {
      currentInstanceId = rawId;
      currentPrototypeId = null;
      try { localStorage.setItem(LS_KEY, rawId); } catch {}
      try {
        if (!fromUrl) {
          url.searchParams.set('id', rawId);
          history.replaceState({}, '', url.toString());
        }
      } catch {}
      // Legacy instances don't have a prototype set; render defaults sorted by usage.
      let legacyPrototypes = [];
      try {
        legacyPrototypes = bubbleManager.getPrototypes();
      } catch {
        legacyPrototypes = [];
      }
      if (legacyPrototypes && legacyPrototypes.length) {
        const sortedLegacy = sortPrototypesByUsage(legacyPrototypes);
        bubbleManager.renderInitialPrototypes(sortedLegacy);
      } else {
        bubbleManager.renderInitialPrototypes(getDefaultPrototypesForUi());
      }
      // Show default title for legacy instances
      try {
        setToolbarTitle(toolbarTitleEl && toolbarTitleEl.dataset.defaultTitle);
      } catch {}
      return { id: rawId, prototypeId: null };
    }

    const compositeId = rawId;

    // If composite id exists but prototype set is missing, seed it from current sidebar.
    if (hasComposite && prototypeId && !prototypesPayload) {
      let seedList = [];
      try {
        seedList = bubbleManager.getPrototypes().map((p) => ({
          text: p.text || '',
          color: (p.color || '#38bdf8').replace(/^#/, ''),
          description: p.description || '',
        }));
      } catch {
        seedList = getDefaultPrototypeSeedForDb();
      }
      try {
        await savePrototypeSet(prototypeId, seedList);
        prototypesPayload = seedList;
      } catch (e) {
        console.warn('Failed to backfill prototypes set', e);
      }
    }

    try { localStorage.setItem(LS_KEY, compositeId); } catch {}
    try {
      if (!fromUrl || fromUrl !== compositeId) {
        url.searchParams.set('id', compositeId);
        history.replaceState({}, '', url.toString());
      }
    } catch {}

    currentInstanceId = compositeId;
    currentPrototypeId = prototypeId;
    currentInstanceNumber = instanceNumber;

    // Ensure instance document exists for this id.
    try {
      const existing = await loadInstance(compositeId);
      if (!existing) {
        const defaultLabel = formatInstanceLabel(instanceNumber != null ? instanceNumber : '');
        await createInstance({ id: compositeId, prototypeId, instanceNumber, instanceLabel: defaultLabel });
      }
    } catch (e) {
      console.warn('Failed to ensure instance document', e);
    }

    // If we can, load a human-friendly instance label from
    // /prototypes/<prototypeId>/instances/<n> and use it for
    // the toolbar title in the editor instead of the generic
    // "Weekly Planner" text.
    try {
      if (prototypeId && instanceNumber !== null && instanceNumber >= 0) {
        const protoDoc = await loadPrototypeSet(prototypeId);
        if (protoDoc && protoDoc.instances && typeof protoDoc.instances === 'object') {
          const rawLabel = protoDoc.instances[String(instanceNumber)];
          const label = (typeof rawLabel === 'string' && rawLabel.trim())
            ? rawLabel.trim()
            : toolbarTitleEl && toolbarTitleEl.dataset.defaultTitle;
          setToolbarTitle(label);
        } else {
          setToolbarTitle(toolbarTitleEl && toolbarTitleEl.dataset.defaultTitle);
        }
      }
    } catch (e) {
      console.warn('Failed to load instance label for toolbar title', e);
      try {
        setToolbarTitle(toolbarTitleEl && toolbarTitleEl.dataset.defaultTitle);
      } catch {}
    }

    // Build sidebar prototype list (from DB payload or defaults), then sort by usage.
    let sidebarPrototypes = [];
    if (Array.isArray(prototypesPayload) && prototypesPayload.length) {
      sidebarPrototypes = prototypesPayload.map((p) => ({
        text: p.text || '',
        color: `#${String(p.color || '38bdf8').replace(/^#/, '')}`,
        description: p.description || '',
      }));
    } else {
      try {
        sidebarPrototypes = bubbleManager.getPrototypes();
      } catch {
        sidebarPrototypes = [];
      }
    }

    if (sidebarPrototypes.length) {
      const sortedPrototypes = sortPrototypesByUsage(sidebarPrototypes);
      bubbleManager.renderInitialPrototypes(sortedPrototypes);
    } else {
      bubbleManager.renderInitialPrototypes(getDefaultPrototypesForUi());
    }

    return { id: compositeId, prototypeId };
  }

  async function ensureInstanceId() {
    if (currentInstanceId) return currentInstanceId;
    const { id } = await bootstrapInstanceAndPrototypes();
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
      try {
        recordPrototypeUsage({ text, color, description });
      } catch {}
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
  try {
    if (typeof dragController.setDeletePrototypeHandler === 'function') {
      dragController.setDeletePrototypeHandler(() => {
        // Defer until after the DOM element is removed so getPrototypes sees the new state.
        setTimeout(() => {
          persistPrototypes().catch((e) => console.warn('Failed to save prototype deletion', e));
        }, 0);
      });
    }
  } catch {}

  function openModal(mode = 'create', el = null) {
    if (!modal) return;
    if (mode === 'create') {
      try { sortSwatchesByUsage(); } catch {}
    }
    modalMode = mode;
    editingEl = el;
    if (submitBtn) {
      submitBtn.textContent = mode === 'create' ? i18n.t('modalSubmitCreate') : i18n.t('modalSubmitSave');
    }
    modal.removeAttribute('hidden');
    form.reset();
    // In edit modes, do not pre-select any color swatch; color only changes if user explicitly picks one.
    if (mode === 'edit' || mode === 'edit-prototype') {
      try {
        const swatches = document.querySelectorAll('input[name="bubbleColor"]');
        swatches.forEach((input) => { input.checked = false; });
      } catch {}
    }
    // Show time field only in edit mode
    if (bubbleTimeFormRow) {
      if (mode === 'edit') bubbleTimeFormRow.removeAttribute('hidden');
      else bubbleTimeFormRow.setAttribute('hidden', '');
    }
    if ((mode === 'edit' || mode === 'edit-prototype') && el) {
      try {
        const txt = el.getAttribute('data-text') || '';
        const desc = el.getAttribute('data-description') || '';
        if (bubbleTextInput) bubbleTextInput.value = txt;
        if (bubbleDescriptionInput) bubbleDescriptionInput.value = desc;
        // Prefill time input only when editing existing instance
        if (mode === 'edit') {
          const ins = Number(el.getAttribute('data-inserted-at'));
          const ts = Number.isFinite(ins) ? ins : Date.now();
          const d = new Date(ts);
          const pad = (n) => String(n).padStart(2, '0');
          if (bubbleTimeHourInput) bubbleTimeHourInput.value = pad(d.getHours());
          if (bubbleTimeMinuteInput) bubbleTimeMinuteInput.value = pad(d.getMinutes());
          if (bubbleTimeSecondInput) bubbleTimeSecondInput.value = pad(d.getSeconds());
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
    modal.addEventListener('pointerdown', (event) => {
      modalPointerStartedInside = !!event.target.closest('.dialog');
    });
    modal.addEventListener('click', (event) => {
      const startedInside = modalPointerStartedInside;
      modalPointerStartedInside = false;
      if (startedInside) return;
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

  // Allow toggling color swatches in edit modes:
  // - No color is pre-selected when editing
  // - Clicking a swatch selects it
  // - Clicking the selected swatch again unselects it
  if (colorGroup) {
    colorGroup.addEventListener('click', (event) => {
      // Only customize behavior for edit modes; creation keeps native radio behavior.
      if (modalMode !== 'edit' && modalMode !== 'edit-prototype') return;
      const label = event.target.closest('label[for]');
      const inputFromLabel = label ? document.getElementById(label.getAttribute('for')) : null;
      const input = inputFromLabel || event.target.closest('input[name="bubbleColor"]');
      if (!input || input.name !== 'bubbleColor') return;
      event.preventDefault();
      const wasChecked = input.checked;
      const all = colorGroup.querySelectorAll('input[name="bubbleColor"]');
      all.forEach((el) => { el.checked = false; });
      if (!wasChecked) {
        input.checked = true;
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
      let color;
      if (modalMode === 'edit' || modalMode === 'edit-prototype') {
        const fallbackColor = editingEl ? (editingEl.getAttribute('data-color') || '#38bdf8') : '#38bdf8';
        color = colorInput ? colorInput.value : fallbackColor;
      } else {
        color = colorInput ? colorInput.value : '#38bdf8';
      }
      const description = bubbleDescriptionInput ? bubbleDescriptionInput.value.trim() : '';

      if (!text) return;

      if (modalMode === 'edit' && editingEl) {
        // Update the bubble element and persist edits (including time) to the DB.
        let insertedAtFinal;
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
          try {
            const existingAttr = editingEl.getAttribute('data-inserted-at');
            const existingNum = Number(existingAttr);
            const base = Number.isFinite(existingNum) ? new Date(existingNum) : new Date();
            const parseField = (input, min, max, fallback) => {
              if (!input) return fallback;
              const raw = String(input.value ?? '').trim();
              if (raw === '') return fallback; // empty => use fallback (0 for our calls)
              const n = Number(raw);
              if (!Number.isFinite(n)) return fallback;
              return Math.min(max, Math.max(min, n));
            };
            // Empty fields are treated as 0 (e.g. HH/MM/SS default to 00)
            const hh = parseField(bubbleTimeHourInput, 0, 23, 0);
            const mm = parseField(bubbleTimeMinuteInput, 0, 59, 0);
            const ss = parseField(bubbleTimeSecondInput, 0, 59, 0);
            base.setHours(hh, mm, ss, 0);
            insertedAtFinal = base.getTime();
            editingEl.setAttribute('data-inserted-at', String(insertedAtFinal));
            // Update visible time label
            let tsSpan = timeSpan;
            if (!tsSpan) {
              tsSpan = document.createElement('span');
              tsSpan.className = 'bubble-time';
              editingEl.appendChild(tsSpan);
            }
            let formattedTime = '';
            try {
              const formatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
              formattedTime = formatter.format(base);
            } catch {
              const pad = (n) => String(n).padStart(2, '0');
              formattedTime = `${pad(base.getHours())}:${pad(base.getMinutes())}:${pad(base.getSeconds())}`;
            }
            tsSpan.textContent = formattedTime;
          } catch {
            // If anything goes wrong, fall back to existing timestamp if present.
            const existingAttr = editingEl.getAttribute('data-inserted-at');
            const existingNum = Number(existingAttr);
            if (Number.isFinite(existingNum)) {
              insertedAtFinal = existingNum;
            }
          }
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

          // Persist to DB (including updated time) by re-saving the entire day.
          (async () => {
            const flow = editingEl.closest('.day-flow');
            if (!flow) return;
            const rawIndex = flow.getAttribute('data-day-index');
            const dayIndex = Number(rawIndex);
            if (!Number.isFinite(dayIndex)) return;
            await persistDayPositions(dayIndex);
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
            // Persist updated prototypes
            (async () => {
              await ensureInstanceId();
              await persistPrototypes();
            })().catch((e) => console.warn('Failed to save edited prototype', e));
          } finally {
            closeModal();
            recordColorUsage(color);
          }
        } else {
          bubbleManager.prependPrototype({ text, color, description });
          (async () => {
            await ensureInstanceId();
            await persistPrototypes();
          })().catch((e) => console.warn('Failed to save new prototype', e));
          closeModal();
          recordColorUsage(color);
        }
      }
    });
  }

  function setEditMode(on) {
    let titleInput = document.getElementById('instanceTitleInput');

    isEditMode = !!on;
    document.body.classList.toggle('edit-mode', isEditMode);
    try { editBtn.setAttribute('aria-pressed', isEditMode ? 'true' : 'false'); } catch {}
    try {
      editBtn.textContent = isEditMode ? i18n.t('toolbarDone') : i18n.t('toolbarEdit');
      editBtn.title = isEditMode ? i18n.t('toolbarDone') : i18n.t('toolbarEditTooltip');
      editBtn.setAttribute('aria-label', i18n.t('toolbarEditTooltip'));
    } catch {}
    dragController.setCanvasDragEnabled(!isEditMode);
    try { dragController.setEditMode(isEditMode); } catch {}

    // When entering edit mode, replace the static title with an editable textbox.
    if (isEditMode && toolbarTitleEl) {
      if (!titleInput) {
        titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.id = 'instanceTitleInput';
        titleInput.className = 'toolbar-title-input';
        titleInput.setAttribute('aria-label', i18n.t('toolbarNameAria'));
        toolbarTitleEl.parentNode.insertBefore(titleInput, toolbarTitleEl.nextSibling);
      }
      titleInput.value = toolbarTitleEl.textContent || '';
      toolbarTitleEl.style.display = 'none';
      titleInput.style.display = '';
      try { titleInput.focus(); titleInput.select(); } catch {}
    }

    // When leaving edit mode, persist any edited title to Firebase
    // and switch back to static text.
    if (!isEditMode && toolbarTitleEl && titleInput) {
      const newLabel = String(titleInput.value || '').trim();
      const labelToUse = newLabel || (toolbarTitleEl.textContent || i18n.t('toolbarTitleDefault'));
      toolbarTitleEl.textContent = labelToUse;
      titleInput.style.display = 'none';
      toolbarTitleEl.style.display = '';

      // Persist label under /prototypes/<prototypeId>/instances/<instanceNumber>
      if (currentPrototypeId && currentInstanceNumber !== null && currentInstanceNumber >= 0) {
        try {
          saveInstanceLabel(currentPrototypeId, currentInstanceNumber, labelToUse).catch(() => {});
        } catch {}
      }
    }
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

