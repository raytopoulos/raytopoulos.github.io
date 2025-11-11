const _states = new WeakMap();

const defaults = {
  onStart: null,
  onMove: null,
  onDrop: null,
  useNativeOnDesktop: true,
  dragCursor: 'grabbing',
  dragImage: null,
  dataText: 'drag-anywhere',
  addSyntheticTextFile: true,
  // When true, do not create a mirror element.
  // Instead, temporarily move and position the original element itself.
  // Useful for cases where the UI should show the real element detaching
  // from its container during drag (no shadow/ghost element).
  useOriginalAsMirror: false,
};

function isTouchCapable() {
  return (
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    (typeof window !== 'undefined' && 'ontouchstart' in window)
  );
}

function preferNativeDnD() {
  if (isTouchCapable()) return false;
  try {
    return window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  } catch {
    return true;
  }
}

function getClientXY(ev) {
  if (ev && typeof ev.clientX === 'number') return { x: ev.clientX, y: ev.clientY };
  const t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]);
  if (t) return { x: t.clientX, y: t.clientY };
  return { x: 0, y: 0 };
}

function rectFrom(el) {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function createMirror(el, rect, { zIndex = 999999 } = {}) {
  const mirror = el.cloneNode(true);
  mirror.style.position = 'fixed';
  mirror.style.left = '0px';
  mirror.style.top = '0px';
  mirror.style.width = rect.width + 'px';
  mirror.style.height = rect.height + 'px';
  mirror.style.pointerEvents = 'none';
  mirror.style.margin = '0';
  mirror.style.boxSizing = 'border-box';
  mirror.style.transform = 'translate(-50%, -50%)';
  mirror.style.willChange = 'transform, left, top';
  mirror.style.zIndex = String(zIndex);
  mirror.style.opacity = '0.9';
  mirror.setAttribute('aria-hidden', 'true');
  return mirror;
}

function placeMirror(mirror, x, y) {
  mirror.style.left = x + 'px';
  mirror.style.top = y + 'px';
}

function setDragImage(ev, el, ox, oy) {
  try {
    if (ev && ev.dataTransfer && ev.dataTransfer.setDragImage) {
      ev.dataTransfer.setDragImage(el, ox, oy);
    }
  } catch {}
}

function tryPopulateDataTransfer(ev, opts) {
  if (!ev || !ev.dataTransfer) return;
  try {
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.dropEffect = 'move';
    ev.dataTransfer.setData('text/plain', String(opts.dataText || 'drag-anywhere'));
    if (opts.addSyntheticTextFile && ev.dataTransfer.items && ev.dataTransfer.items.add) {
      const blob = new Blob([String(opts.dataText || 'drag-anywhere') + '\n'], { type: 'text/plain' });
      const file = new File([blob], 'drag.txt', { type: 'text/plain' });
      ev.dataTransfer.items.add(file);
    }
  } catch {}
}

export function makeDraggable(el, options = {}) {
  if (!el || !(el instanceof Element)) throw new Error('makeDraggable: expected a DOM Element');
  if (_states.has(el)) return _states.get(el);

  const opts = Object.assign({}, defaults, options);
  const state = {
    el,
    opts,
    nativeEligible: opts.useNativeOnDesktop && preferNativeDnD(),
    active: false,
    source: 'pointer',
    startPos: null,
    lastPos: null,
    rect: null,
    mirror: null,
    originalDraggableAttr: el.getAttribute('draggable'),
    // Track styles we temporarily override when using original as mirror
    _origInlineStyles: null,
    cleanupFns: [],
  };

  function emit(cb, payload) {
    try {
      if (typeof cb === 'function') cb(payload);
    } catch (err) {
      setTimeout(() => {
        throw err;
      });
    }
  }

  function beginCommon(pos, source, ev) {
    state.active = true;
    state.source = source;
    state.startPos = pos;
    state.lastPos = pos;
    state.rect = rectFrom(el);

    // Important: Fire onStart BEFORE moving the element to <body> when
    // using the original as the mirror. This lets callers capture the
    // original parent/position to restore on invalid drops.
    emit(opts.onStart, { x: pos.x, y: pos.y, rect: state.rect, source, event: ev });

    const useOriginal = !!opts.useOriginalAsMirror;
    if (useOriginal) {
      // Preserve a snapshot of inline styles we are about to modify
      state._origInlineStyles = {
        position: el.style.position,
        left: el.style.left,
        top: el.style.top,
        width: el.style.width,
        height: el.style.height,
        pointerEvents: el.style.pointerEvents,
        margin: el.style.margin,
        boxSizing: el.style.boxSizing,
        transform: el.style.transform,
        willChange: el.style.willChange,
        zIndex: el.style.zIndex,
        opacity: el.style.opacity,
      };
      state.mirror = el;
      // Position the original element as a fixed, non-interactive drag image
      el.style.position = 'fixed';
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.width = state.rect.width + 'px';
      el.style.height = state.rect.height + 'px';
      el.style.pointerEvents = 'none';
      el.style.margin = '0';
      el.style.boxSizing = 'border-box';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.willChange = 'transform, left, top';
      el.style.zIndex = '999999';
      // Do not force opacity here; let caller's styles (e.g. .dragging) control it
      if (el.parentNode !== document.body) {
        document.body.appendChild(el);
      }
    } else {
      const mirror = opts.dragImage || createMirror(el, state.rect);
      state.mirror = mirror;
      document.body.appendChild(mirror);
    }

    placeMirror(state.mirror, pos.x, pos.y);
    if (opts.dragCursor) el.style.cursor = opts.dragCursor;
  }

  function moveCommon(pos, ev) {
    state.lastPos = pos;
    if (state.mirror) placeMirror(state.mirror, pos.x, pos.y);
    emit(opts.onMove, { x: pos.x, y: pos.y, rect: state.rect, source: state.source, event: ev });
  }

  function endCommon(canceled, ev) {
    const last = state.lastPos || state.startPos || { x: 0, y: 0 };
    emit(opts.onDrop, { x: last.x, y: last.y, rect: state.rect, canceled: !!canceled, source: state.source, event: ev });
    if (state.mirror && state.mirror.parentNode) {
      // If we used the original element as the mirror, don't remove it from the DOM.
      // Instead, restore its inline styles so it can be reinserted normally by the caller.
      if (opts.useOriginalAsMirror && state.mirror === el) {
        try {
          const s = state._origInlineStyles || {};
          el.style.position = s.position || '';
          el.style.left = s.left || '';
          el.style.top = s.top || '';
          el.style.width = s.width || '';
          el.style.height = s.height || '';
          el.style.pointerEvents = s.pointerEvents || '';
          el.style.margin = s.margin || '';
          el.style.boxSizing = s.boxSizing || '';
          el.style.transform = s.transform || '';
          el.style.willChange = s.willChange || '';
          el.style.zIndex = s.zIndex || '';
          el.style.opacity = s.opacity || '';
        } catch {}
      } else {
        state.mirror.parentNode.removeChild(state.mirror);
      }
    }
    state.mirror = null;
    state.active = false;
    state.startPos = null;
    state.lastPos = null;
    state.rect = null;
    if (opts.dragCursor) el.style.removeProperty('cursor');
    state._origInlineStyles = null;
  }

  function setupNative() {
    el.setAttribute('draggable', 'true');
    const onMouseDown = (ev) => {
      state._pendingStartPos = { x: ev.clientX, y: ev.clientY };
    };
    const onDragStart = (ev) => {
      state.source = 'native';
      const startPos = state._pendingStartPos || { x: ev.clientX, y: ev.clientY };
      beginCommon(startPos, 'native', ev);
      tryPopulateDataTransfer(ev, opts);
      const imgEl = opts.dragImage || state.mirror;
      if (imgEl) {
        const r = imgEl.getBoundingClientRect();
        setDragImage(ev, imgEl, r.width / 2, r.height / 2);
      }
    };
    const onDragOverDoc = (ev) => {
      ev.preventDefault();
      if (!state.active) return;
      moveCommon({ x: ev.clientX, y: ev.clientY }, ev);
    };
    const onDragEnd = (ev) => {
      if (!state.active) return;
      endCommon(false, ev);
    };
    el.addEventListener('mousedown', onMouseDown, { passive: true });
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend', onDragEnd);
    document.addEventListener('dragover', onDragOverDoc);
    state.cleanupFns.push(() => {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('dragstart', onDragStart);
      el.removeEventListener('dragend', onDragEnd);
      document.removeEventListener('dragover', onDragOverDoc);
    });
  }

  function setupPointer() {
    let pointerDownTimer = null;
    let initialPointerId = null;
    let hasCapturedPointer = false;

    let downPos = null;
    const onPointerDown = (ev) => {
      if (ev.button && ev.button !== 0) return;
      // Do not preventDefault here so clicks can fire if no drag starts
      
      // Clear any existing timer
      if (pointerDownTimer) {
        clearTimeout(pointerDownTimer);
      }
      
      initialPointerId = ev.pointerId;
      const pos = getClientXY(ev);
      downPos = pos;
      
      try {
        // Capture the pointer immediately to prevent scrolling
        el.setPointerCapture && el.setPointerCapture(ev.pointerId);
        hasCapturedPointer = true;
      } catch {}

      // Desktop should start immediately; delay only on touch or in edit mode
      let isEditMode = false;
      try { isEditMode = !!(document && document.body && document.body.classList && document.body.classList.contains('edit-mode')); } catch {}
      const isTouch = ev.pointerType === 'touch';
      const shouldDelay = isTouch || isEditMode;
      if (shouldDelay) {
        const delay = isTouch ? 500 : 200;
        pointerDownTimer = setTimeout(() => {
          if (hasCapturedPointer && initialPointerId === ev.pointerId) {
            beginCommon(pos, 'pointer', ev);
          }
        }, delay);
      } else {
        beginCommon(pos, 'pointer', ev);
      }
    };

    const onPointerMove = (ev) => {
      if (pointerDownTimer) {
        // If we haven't started dragging yet but moved significantly, cancel the timer
        const posNow = getClientXY(ev);
        const dx = (posNow.x - (downPos?.x || posNow.x));
        const dy = (posNow.y - (downPos?.y || posNow.y));
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          clearTimeout(pointerDownTimer);
          pointerDownTimer = null;
          if (hasCapturedPointer) {
            try {
              el.releasePointerCapture(ev.pointerId);
              hasCapturedPointer = false;
            } catch {}
          }
          return;
        }
      }

      if (!state.active) return;
      moveCommon(getClientXY(ev), ev);
      ev.preventDefault();
    };

    const onPointerUp = (ev) => {
      if (pointerDownTimer) {
        clearTimeout(pointerDownTimer);
        pointerDownTimer = null;
      }

      if (!state.active) {
        if (hasCapturedPointer) {
          try {
            el.releasePointerCapture(ev.pointerId);
            hasCapturedPointer = false;
          } catch {}
        }
        return;
      }

      endCommon(false, ev);
      try {
        el.releasePointerCapture(ev.pointerId);
        hasCapturedPointer = false;
      } catch {}
      ev.preventDefault();
    };

    const onPointerCancel = (ev) => {
      if (pointerDownTimer) {
        clearTimeout(pointerDownTimer);
        pointerDownTimer = null;
      }

      if (!state.active) {
        if (hasCapturedPointer) {
          try {
            el.releasePointerCapture(ev.pointerId);
            hasCapturedPointer = false;
          } catch {}
        }
        return;
      }

      endCommon(true, ev);
      try {
        el.releasePointerCapture(ev.pointerId);
        hasCapturedPointer = false;
      } catch {}
    };
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerCancel, { passive: true });
    state.cleanupFns.push(() => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    });
  }

  if (state.nativeEligible) {
    setupNative();
  } else {
    setupPointer();
  }

  const destroy = () => {
    state.cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    state.cleanupFns.length = 0;
    if (state.mirror && state.mirror.parentNode) {
      state.mirror.parentNode.removeChild(state.mirror);
    }
    if (state.originalDraggableAttr === null) {
      el.removeAttribute('draggable');
    } else {
      el.setAttribute('draggable', state.originalDraggableAttr);
    }
    _states.delete(el);
  };

  _states.set(el, destroy);
  return destroy;
}
