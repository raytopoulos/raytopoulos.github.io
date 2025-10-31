import { makeDraggable } from './drag-anywhere.js';

function findInsertionAnchor(container, x, y, draggedEl) {
  if (!container) return null;
  const bubbles = Array.from(container.querySelectorAll('.bubble'))
    .filter((bubble) => bubble !== draggedEl);
  if (!bubbles.length) return null;

  const style = getComputedStyle(container);
  const isRow = (style.flexDirection || '').startsWith('row');

  const under = document.elementFromPoint(x, y);
  const underBubble = under && under.closest && under.closest('.bubble');
  if (underBubble && container.contains(underBubble) && underBubble !== draggedEl) {
    const r = underBubble.getBoundingClientRect();
    if (isRow) {
      return x < r.left + r.width / 2 ? underBubble : underBubble.nextSibling;
    }
    return y < r.top + r.height / 2 ? underBubble : underBubble.nextSibling;
  }

  for (const bubble of bubbles) {
    const r = bubble.getBoundingClientRect();
    if (y < r.top + r.height / 2) return bubble;
  }
  return null;
}

function ensureInsertMarker(insertMarkerElRef) {
  if (!insertMarkerElRef.current) {
    const marker = document.createElement('div');
    marker.className = 'insert-marker';
    insertMarkerElRef.current = marker;
  }
  return insertMarkerElRef.current;
}

function getDropTargetAt(x, y) {
  const elBelow = document.elementFromPoint(x, y);
  return elBelow ? elBelow.closest('.day-flow, #trash') : null;
}

export function createDragController({
  dayFlows,
  trashZone,
  toggleSidebar,
  refreshAccordionHeight,
  accordion,
}) {
  let addBubbleHandler = null;
  let currentDrag = null;
  let activeDropTarget = null;
  const insertMarkerRef = { current: null };

  const trash = trashZone || null;

  const registerRefresh = new Set();

  function setActiveDropTarget(target) {
    if (activeDropTarget && activeDropTarget !== target) {
      activeDropTarget.classList.remove('drop-active');
    }
    activeDropTarget = target;
    if (activeDropTarget) {
      activeDropTarget.classList.add('drop-active');
    }
  }

  function removeInsertMarker() {
    const marker = insertMarkerRef.current;
    if (marker && marker.parentNode) {
      marker.parentNode.removeChild(marker);
    }
  }

  function showInsertMarker(container, anchor) {
    const marker = ensureInsertMarker(insertMarkerRef);
    if (!container) return;
    if (anchor && container.contains(anchor)) {
      container.insertBefore(marker, anchor);
    } else {
      container.appendChild(marker);
    }
  }

  function autoOpenDay(target) {
    if (!target) return;
    if (window.innerWidth > 768) return;
    const rawIndex = target.getAttribute('data-day-index');
    const index = Number(rawIndex);
    if (!Number.isFinite(index)) return;
    if (accordion.getCurrentOpenIndex() === index) return;
    accordion.openByIndex(index);
  }

  function cleanupDragState() {
    if (!currentDrag) return;
    const sourceEl = currentDrag.sourceElement;
    if (sourceEl) {
      sourceEl.classList.remove('dragging');
      if (currentDrag.sourceType === 'prototype') {
        const now = (typeof performance !== 'undefined' && performance.now)
          ? performance.now()
          : Date.now();
        sourceEl.__suppressClickUntil = now + 400;
      }
    }
    setActiveDropTarget(null);
    if (trash) {
      trash.classList.remove('drop-active');
      trash.classList.remove('trash-active');
    }
    removeInsertMarker();
    registerRefresh.clear();
    currentDrag = null;
  }

  function updateDropState(x, y) {
    if (!currentDrag) return;

    const target = getDropTargetAt(x, y);
    setActiveDropTarget(target);

    if (trash) {
      if (target === trash) {
        trash.classList.add('drop-active');
      } else {
        trash.classList.remove('drop-active');
      }
    }

    if (target && target.classList.contains('day-flow')) {
      const anchor = findInsertionAnchor(
        target,
        x,
        y,
        currentDrag.sourceType === 'day-flow' ? currentDrag.sourceElement : null,
      );
      currentDrag.anchor = anchor;
      showInsertMarker(target, anchor);
      autoOpenDay(target);
    } else {
      currentDrag.anchor = null;
      removeInsertMarker();
    }
  }

  function registerRefreshIndex(index) {
    if (Number.isInteger(index) && index >= 0) {
      registerRefresh.add(index);
    }
  }

  function flushRefresh() {
    registerRefresh.forEach((idx) => refreshAccordionHeight(idx));
    registerRefresh.clear();
  }

  function handleDragStart(el, payload) {
    const data = {
      text: el.getAttribute('data-text') || el.textContent.trim(),
      color: el.getAttribute('data-color') || el.style.backgroundColor || '#38bdf8',
      square: el.getAttribute('data-square') === 'true',
    };
    const parentFlow = el.closest('.day-flow');
    const dayIndexAttr = parentFlow ? parentFlow.getAttribute('data-day-index') : null;
    const sourceDayIndex = dayIndexAttr != null ? Number(dayIndexAttr) : null;
    const isPrototype = el.classList.contains('prototype');

    currentDrag = {
      sourceElement: el,
      sourceType: isPrototype ? 'prototype' : 'day-flow',
      data,
      origParent: parentFlow,
      origNextSibling: el.nextSibling,
      sourceDayIndex,
      anchor: null,
    };

    el.classList.add('dragging');
    if (trash) {
      trash.classList.add('trash-active');
    }
    if (isPrototype) {
      toggleSidebar(false);
    }
    updateDropState(payload.x, payload.y);
  }

  function handleDragMove(x, y) {
    updateDropState(x, y);
  }

  function restoreDetachedBubble() {
    if (!currentDrag) return;
    if (currentDrag.sourceType !== 'day-flow') return;
    const { sourceElement, origParent, origNextSibling } = currentDrag;
    if (!sourceElement || !origParent) return;
    if (origNextSibling && origNextSibling.parentNode === origParent) {
      origParent.insertBefore(sourceElement, origNextSibling);
    } else {
      origParent.appendChild(sourceElement);
    }
  }

  function handleDragDrop(x, y, canceled) {
    if (!currentDrag) return;

    registerRefreshIndex(currentDrag.sourceDayIndex);

    const target = canceled ? null : getDropTargetAt(x, y);

    if (!canceled && target && target.id === 'trash') {
      if (currentDrag.sourceType === 'day-flow' && currentDrag.sourceElement) {
        currentDrag.sourceElement.remove();
      }
      cleanupDragState();
      flushRefresh();
      return;
    }

    if (!canceled && target && target.classList.contains('day-flow')) {
      const dropDayIndex = Number(target.getAttribute('data-day-index'));
      registerRefreshIndex(dropDayIndex);

      const anchor =
        currentDrag.anchor && target.contains(currentDrag.anchor)
          ? currentDrag.anchor
          : findInsertionAnchor(
              target,
              x,
              y,
              currentDrag.sourceType === 'day-flow' ? currentDrag.sourceElement : null,
            );

      if (currentDrag.sourceType === 'prototype') {
        if (typeof addBubbleHandler === 'function') {
          addBubbleHandler({
            dayIndex: dropDayIndex,
            text: currentDrag.data.text,
            color: currentDrag.data.color,
            square: currentDrag.data.square,
            before: anchor || null,
          });
        }
      } else if (currentDrag.sourceType === 'day-flow') {
        const el = currentDrag.sourceElement;
        if (el) {
          if (anchor && anchor.parentNode === target) {
            target.insertBefore(el, anchor);
          } else {
            target.appendChild(el);
          }
        }
      }

      cleanupDragState();
      flushRefresh();
      return;
    }

    if (!canceled && currentDrag.sourceType === 'day-flow') {
      restoreDetachedBubble();
    }

    cleanupDragState();
    flushRefresh();
  }

  function wireBubble(el) {
    if (!el || el.__dragDestroy) return;
    const destroy = makeDraggable(el, {
      dataText: el.getAttribute('data-text') || el.textContent || 'Bubble',
      addSyntheticTextFile: true,
      dragCursor: 'grabbing',
      useNativeOnDesktop: false,
      onStart: (payload) => handleDragStart(el, payload),
      onMove: ({ x, y }) => handleDragMove(x, y),
      onDrop: ({ x, y, canceled }) => handleDragDrop(x, y, canceled),
    });
    el.__dragDestroy = destroy;
  }

  function setAddBubbleHandler(handler) {
    addBubbleHandler = handler;
  }

  window.addEventListener('dragover', (ev) => {
    try {
      ev.preventDefault();
    } catch {}
  });

  window.addEventListener('drop', (ev) => {
    try {
      ev.preventDefault();
    } catch {}
  });

  return {
    wireBubble,
    setAddBubbleHandler,
  };
}
