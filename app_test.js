// Mobile day accordions (one open at a time) + existing minimal features
// - Sidebar prototypes (click or drag to add)
// - Colored bubbles + optional squared
// - Hamburger toggle
// - Pure CSS layout still controls scrolling; JS only handles interaction

(function(){
  'use strict';

  const PROTOTYPES = [
    { text: 'Task', color: '#38bdf8' },
    { text: 'Idea', color: '#a78bfa' },
    { text: 'Bug',  color: '#f87171' },
    { text: 'Note', color: '#10b981' }
  ];

  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  document.addEventListener('DOMContentLoaded', () => {
    const addBtn    = document.getElementById('addBtn');
    const menuBtn   = document.getElementById('menuBtn');
    const sidebar   = document.querySelector('aside.sidebar');
    const closeBtn  = document.getElementById('closeSidebar');
    const backdrop  = document.getElementById('sidebarBackdrop');
    const templates = document.getElementById('templates') || document.querySelector('.bubbles-list');
    const weekTable = document.querySelector('.week-table');

    // Add demo bubble
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        addBubbleToDay(0, 'New Task', '#38bdf8');
      });
    }

    // Sidebar prototypes
    if (templates) {
      templates.innerHTML = '';
      PROTOTYPES.forEach(t => templates.appendChild(makeTemplateEl(t)));
    }

    // Minimal DnD from prototypes into any day cell
    if (weekTable) {
      weekTable.addEventListener('dragover', (e) => {
        const dt = e.dataTransfer; if (!dt) return;
        if (Array.from(dt.types).includes('application/x-bubble-template')) {
          e.preventDefault(); dt.dropEffect = 'copy';
        }
      });
      weekTable.addEventListener('drop', (e) => {
        const dt = e.dataTransfer; if (!dt) return;
        if (!Array.from(dt.types).includes('application/x-bubble-template')) return;
        e.preventDefault();
        const text  = dt.getData('text/x-bubble-text')  || dt.getData('text/plain') || 'Item';
        const color = dt.getData('text/x-bubble-color') || '';
        const cell  = e.target.closest('td');
        const flows = Array.from(document.querySelectorAll('.day-flow'));
        const flow  = cell ? (cell.querySelector('.day-flow') || null) : null;
        const idx   = flow ? flows.indexOf(flow) : 0;
        addBubbleToDay(Math.max(0, idx), text, color);
      });
    }

    // Inject minimal CSS for mobile accordions
    injectAccordionStyles();

    // Build accordions on mobile
    setupMobileAccordions();

    // Hamburger toggle
    const setExpanded = (open) => { if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    const showBackdrop = () => { if (backdrop) backdrop.hidden = !(window.innerWidth <= 768 && sidebar.classList.contains('open')); };
    const hideBackdrop = () => { if (backdrop) backdrop.hidden = true; };
    function openSidebar(){ if (!sidebar) return; sidebar.classList.add('open'); setExpanded(true);  showBackdrop(); }
    function closeSidebar(){ if (!sidebar) return; sidebar.classList.remove('open'); setExpanded(false); hideBackdrop(); }
    function toggleSidebar(){ if (!sidebar) return; (sidebar.classList.contains('open') ? closeSidebar : openSidebar)(); }
    if (menuBtn)  menuBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    if (backdrop) backdrop.addEventListener('click', closeSidebar);

    // Re-evaluate on resize (show all on desktop, keep accordion on mobile)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        expandAllDays();
        closeSidebar();
      } else {
        ensureAccordionBuilt();
        showBackdrop();
      }
    });
  });

  // ----------------- Accordions -----------------
  function injectAccordionStyles(){
    if (document.getElementById('mobile-accordion-styles')) return;
    const css = `
@media (max-width: 768px){
  .week-table tbody td::before{ display:none; }
  .day-accordion__header{ width:100%; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 0; font-weight:700; color:var(--text); background:none; border:0; cursor:pointer; }
  .day-accordion__header .label{ letter-spacing:.08em; text-transform:uppercase; font-size:12px; color:var(--muted); }
  .day-accordion__header .chev{ width:16px; height:16px; flex:0 0 auto; transition:transform .2s ease; opacity:.7; }
  .day-accordion__header[aria-expanded="true"] .chev{ transform:rotate(180deg); }
  .day-accordion__panel{ overflow:hidden; height:0; transition: height .18s ease; will-change: height; }
  .day-accordion__panel.open{ height:auto; }
}
@media (min-width: 769px){
  .day-accordion__header{ display:none !important; }
  .day-accordion__panel{ overflow:visible !important; height:auto !important; }
}`;
    const style = document.createElement('style');
    style.id = 'mobile-accordion-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function setupMobileAccordions(){
    if (window.innerWidth > 768) return; // only mobile
    const cells = Array.from(document.querySelectorAll('.week-table tbody tr:first-child td, .week-table tbody td'));
    if (!cells.length) return;

    // Build once
    if (cells.every(td => td.dataset.accordionBuilt === '1')) return;

    cells.forEach((td, i) => {
      if (td.dataset.accordionBuilt === '1') return;
      td.dataset.accordionBuilt = '1';

      // Make header
      const hdr = document.createElement('button');
      hdr.type = 'button';
      hdr.className = 'day-accordion__header';
      hdr.setAttribute('aria-expanded', 'false');
      hdr.innerHTML = `<span class="label">${DAY_LABELS[i] || `Day ${i+1}`}</span><svg viewBox="0 0 24 24" class="chev" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      // Panel wraps the flow
      const panel = document.createElement('div');
      panel.className = 'day-accordion__panel';

      // Move existing children (e.g., .day-flow) into panel
      const kids = Array.from(td.childNodes);
      kids.forEach(k => panel.appendChild(k));

      td.appendChild(hdr);
      td.appendChild(panel);

      hdr.addEventListener('click', () => toggleCell(td));
    });

    // Open the first by default
    openOnly(cells[0]);
  }

  function ensureAccordionBuilt(){
    setupMobileAccordions();
  }

  function toggleCell(td){
    const expanded = td.querySelector('.day-accordion__header').getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closeCell(td);
    } else {
      openOnly(td);
    }
  }

  function openOnly(targetTd){
    const all = Array.from(document.querySelectorAll('.week-table tbody td[data-accordion-built="1"]'));
    all.forEach(td => closeCell(td));
    openCell(targetTd);
  }

  function openCell(td){
    const hdr = td.querySelector('.day-accordion__header');
    const panel = td.querySelector('.day-accordion__panel');
    if (!hdr || !panel) return;
    hdr.setAttribute('aria-expanded','true');
    animateOpen(panel);
  }

  function closeCell(td){
    const hdr = td.querySelector('.day-accordion__header');
    const panel = td.querySelector('.day-accordion__panel');
    if (!hdr || !panel) return;
    hdr.setAttribute('aria-expanded','false');
    animateClose(panel);
  }

  // --- Simple height animations ---
  function animateOpen(panel){
    panel.classList.add('open'); // so content can size itself
    panel.style.height = '0px';
    const h = panel.scrollHeight;
    panel.style.height = h + 'px';
    panel.addEventListener('transitionend', onDone);
    function onDone(e){ if (e.propertyName !== 'height') return; panel.style.height = 'auto'; panel.removeEventListener('transitionend', onDone); }
  }
  function animateClose(panel){
    if (panel.style.height === 'auto' || panel.classList.contains('open')){
      panel.style.height = panel.scrollHeight + 'px';
      // force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      panel.offsetHeight;
    }
    panel.style.height = '0px';
    panel.addEventListener('transitionend', onDone);
    function onDone(e){ if (e.propertyName !== 'height') return; panel.classList.remove('open'); panel.removeEventListener('transitionend', onDone); }
  }

  // Expand all panels fully (desktop)
  function expandAllDays(){
    const panels = document.querySelectorAll('.day-accordion__panel');
    panels.forEach(p => { p.classList.add('open'); p.style.height = 'auto'; });
    const headers = document.querySelectorAll('.day-accordion__header');
    headers.forEach(h => h.setAttribute('aria-expanded','true'));
  }

})();

// -------- Color helpers + API --------
function cssToRgb(color){
  const el = document.createElement('span');
  el.style.color = color; el.style.display = 'none'; document.body.appendChild(el);
  const rgb = getComputedStyle(el).color; el.remove();
  const m = rgb.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if(!m) return {r:0,g:0,b:0};
  return { r: +m[1], g: +m[2], b: +m[3] };
}
function relLuminance({r,g,b}){
  const s = [r,g,b].map(v=>{ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
  return 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2];
}
function bestTextForBg(bg){
  const L = relLuminance(cssToRgb(bg));
  return (L > 0.7) ? '#334155' : '#f8fafc';
}

// Build a sidebar prototype element
function makeTemplateEl({ text, color }){
  const el = document.createElement('div');
  el.className = 'bubble template';
  el.setAttribute('draggable', 'true');
  el.dataset.text = text;
  if (color) el.dataset.color = color;
  el.style.setProperty('--bubble-fill', color || '');
  el.style.setProperty('--bubble-fg', color ? bestTextForBg(color) : '');

  const label = document.createElement('span');
  label.textContent = text; label.draggable = false;
  el.appendChild(label);

  // Click adds to Monday (suppressed if a drag just happened)
  let suppressClick = false;
  el.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); suppressClick = false; return; }
    addBubbleToDay(0, text, color);
  });

  // Drag data
  el.addEventListener('dragstart', (e) => {
    const dt = e.dataTransfer; if (!dt) return;
    dt.effectAllowed = 'copy';
    dt.setData('application/x-bubble-template', '1');
    dt.setData('text/x-bubble-text',  text);
    dt.setData('text/x-bubble-color', color || '');
    dt.setData('text/plain', text);
  });

  // Pointer-based drag for mobile (touch/pen)
  el.addEventListener('pointerdown', (e) => {
    // Let mouse use native HTML5 DnD
    if (e.pointerType === 'mouse') return;
    if (e.button !== 0 && e.button !== undefined) return;

    let started = false;
    let ghost = null;
    const pid = e.pointerId;
    const startX = e.clientX, startY = e.clientY;
    const threshold = 6; // px before starting drag
    let lastTd = null;

    function ensureGhost(ev){
      if (started) return;
      started = true;
      suppressClick = true; // prevent the subsequent click-to-add
      try { el.setPointerCapture(pid); } catch(_) {}
      // Reduce scroll interference while dragging
      const prevTouchAction = el.style.touchAction;
      el.__prevTouchAction = prevTouchAction; // stash
      el.style.touchAction = 'none';

      // Create a floating clone that follows the finger
      ghost = el.cloneNode(true);
      ghost.classList.add('drag-ghost');
      const r = el.getBoundingClientRect();
      ghost.style.position = 'fixed';
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';
      ghost.style.width = r.width + 'px';
      ghost.style.transform = 'translate(-50%, -50%)';
      ghost.style.pointerEvents = 'none';
      ghost.style.zIndex = '9999';
      ghost.style.opacity = '0.95';
      ghost.style.boxShadow = 'var(--shadow, 0 6px 24px rgba(0,0,0,.12))';
      document.body.appendChild(ghost);
      // Move pointer capture to the ghost so closing the sidebar doesn't cancel events
      try { ghost.setPointerCapture(pid); } catch(_) {}
      try { el.releasePointerCapture(pid); } catch(_) {}
      // Close the sidebar after capture transfer (next frame to avoid cancel)
      try {
        if (window.innerWidth <= 768) {
          const closeNow = () => {
            const sidebarEl = document.querySelector('aside.sidebar');
            const menuBtnEl = document.getElementById('menuBtn');
            const backdropEl = document.getElementById('sidebarBackdrop');
            if (sidebarEl) sidebarEl.classList.remove('open');
            if (menuBtnEl) menuBtnEl.setAttribute('aria-expanded','false');
            if (backdropEl) backdropEl.hidden = true;
          };
          if ('requestAnimationFrame' in window) requestAnimationFrame(closeNow); else setTimeout(closeNow, 0);
        }
      } catch(_) {}
    }

    const onMove = (ev) => {
      if (ev.pointerId !== pid) return;
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!started && (dx*dx + dy*dy) >= threshold*threshold) {
        ensureGhost(ev);
      }
      if (started && ghost) {
        ev.preventDefault();
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';

        // Find day cell under pointer to optionally auto-open on mobile
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        const td = target ? target.closest('td') : null;
        if (td && td !== lastTd) {
          lastTd = td;
          const hdr = td.querySelector('.day-accordion__header');
          if (hdr && hdr.getAttribute('aria-expanded') !== 'true') {
            // Open the day so user can see drop area
            try { hdr.click(); } catch(_) {}
          }
        }
      }
    };

    const onUp = (ev) => {
      if (ev.pointerId !== pid) return;
      try { ghost && ghost.releasePointerCapture && ghost.releasePointerCapture(pid); } catch(_) {}
      try { el.releasePointerCapture(pid); } catch(_) {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);

      if (!started) return; // treat as tap; click handler will run
      ev.preventDefault();

      if (ghost) { ghost.remove(); ghost = null; }
      // Restore touch-action
      if (typeof el.__prevTouchAction !== 'undefined') {
        el.style.touchAction = el.__prevTouchAction || '';
        try { delete el.__prevTouchAction; } catch(_) {}
      }

      // Determine drop target day by the td under finger
      const x = ev.clientX, y = ev.clientY;
      const target = document.elementFromPoint(x, y);
      const td = target ? target.closest('td') : null;
      if (td) {
        const flows = Array.from(document.querySelectorAll('.day-flow'));
        const flow = td.querySelector('.day-flow');
        const idx = flow ? flows.indexOf(flow) : -1;
        if (idx >= 0) {
          const bubbleText = el.dataset.text || el.textContent.trim() || 'Item';
          const bubbleColor = el.dataset.color || '';
          addBubbleToDay(idx, bubbleText, bubbleColor);
        }
      }
    };

    const onCancel = (ev) => {
      if (ev.pointerId !== pid) return;
      try { ghost && ghost.releasePointerCapture && ghost.releasePointerCapture(pid); } catch(_) {}
      try { el.releasePointerCapture(pid); } catch(_) {}
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (ghost) { ghost.remove(); ghost = null; }
      // Restore touch-action
      if (typeof el.__prevTouchAction !== 'undefined') {
        el.style.touchAction = el.__prevTouchAction || '';
        try { delete el.__prevTouchAction; } catch(_) {}
      }
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    window.addEventListener('pointercancel', onCancel, { passive: false });
  });

  return el;
}

// Add a bubble to a given day index
function addBubbleToDay(dayIndex, text, backgroundColor, { square = false, classes = [] } = {}){
  const flows = document.querySelectorAll('.day-flow');
  const flow = flows[dayIndex];
  if (!flow) return;
  const el = document.createElement('div');
  el.className = 'bubble instance';
  if (backgroundColor) {
    el.style.setProperty('--bubble-fill', backgroundColor);
    el.style.setProperty('--bubble-fg', bestTextForBg(backgroundColor));
  }
  if (square) el.classList.add('square');
  if (Array.isArray(classes) && classes.length) el.classList.add(...classes);
  el.textContent = text;
  flow.appendChild(el);
}
