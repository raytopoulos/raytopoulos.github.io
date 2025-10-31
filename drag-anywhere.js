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
    const mirror = opts.dragImage || createMirror(el, state.rect);
    state.mirror = mirror;
    document.body.appendChild(mirror);
    placeMirror(mirror, pos.x, pos.y);
    if (opts.dragCursor) el.style.cursor = opts.dragCursor;
    emit(opts.onStart, { x: pos.x, y: pos.y, rect: state.rect, source, event: ev });
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
      state.mirror.parentNode.removeChild(state.mirror);
    }
    state.mirror = null;
    state.active = false;
    state.startPos = null;
    state.lastPos = null;
    state.rect = null;
    if (opts.dragCursor) el.style.removeProperty('cursor');
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
    const onPointerDown = (ev) => {
      if (ev.button && ev.button !== 0) return;
      try {
        el.setPointerCapture && el.setPointerCapture(ev.pointerId);
      } catch {}
      const pos = getClientXY(ev);
      beginCommon(pos, 'pointer', ev);
      ev.preventDefault();
    };
    const onPointerMove = (ev) => {
      if (!state.active) return;
      moveCommon(getClientXY(ev), ev);
      ev.preventDefault();
    };
    const onPointerUp = (ev) => {
      if (!state.active) return;
      endCommon(false, ev);
      try {
        el.releasePointerCapture && el.releasePointerCapture(ev.pointerId);
      } catch {}
      ev.preventDefault();
    };
    const onPointerCancel = (ev) => {
      if (!state.active) return;
      endCommon(true, ev);
      try {
        el.releasePointerCapture && el.releasePointerCapture(ev.pointerId);
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
