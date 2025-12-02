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
  const target = elBelow ? elBelow.closest('.day-flow, #trash') : null;
  if (target && target.id === 'trash' && !target.classList.contains('trash-active')) {
    // Ignore trash when it's not active/visible
    return null;
  }
  return target;
}

export function createDragController({
  dayFlows,
  trashZone,
  toggleSidebar,
  refreshAccordionHeight,
  accordion,
}) {
  let canvasDragEnabled = true;
  let isEditMode = false;
  let addBubbleHandler = null;
  let moveBubbleHandler = null;
  let deleteBubbleHandler = null;
  let deletePrototypeHandler = null;
  let currentDrag = null;
  let activeDropTarget = null;
  const insertMarkerRef = { current: null };
  let touchDragBlocker = null;

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

  let hoverOpenTimer = null;
  let hoverOpenTarget = null;
  
  function autoOpenDay(target) {
    if (!target) return;
    if (window.innerWidth > 768) return;
    // While editing on mobile, do NOT auto-open when dragging a prototype
    if (isEditMode && currentDrag && currentDrag.sourceType === 'prototype') return;
    // If we're already planning to open this same target, do nothing
    if (hoverOpenTarget === target) return;

    // Clear any existing hover timer for a different target
    if (hoverOpenTimer) {
      clearTimeout(hoverOpenTimer);
      hoverOpenTimer = null;
      hoverOpenTarget = null;
    }

    const rawIndex = target.getAttribute('data-day-index');
    const index = Number(rawIndex);
    if (!Number.isFinite(index)) return;
    if (accordion.getCurrentOpenIndex() === index) return;

    // Remember the target we're about to open and set a short timer
    hoverOpenTarget = target;
    hoverOpenTimer = setTimeout(() => {
      // Only open if the target is still the same
      if (hoverOpenTarget === target) {
        accordion.openByIndex(index);
      }
      hoverOpenTimer = null;
      hoverOpenTarget = null;
    }, 120); // 120ms hover delay: responsive but small
  }

  function cleanupHoverTimer() {
    if (hoverOpenTimer) {
      clearTimeout(hoverOpenTimer);
      hoverOpenTimer = null;
      hoverOpenTarget = null;
    }
  }

  function cleanupDragState() {
    cleanupHoverTimer();
    if (touchDragBlocker) {
      try { window.removeEventListener('touchmove', touchDragBlocker); } catch {}
      touchDragBlocker = null;
    }
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
      if (currentDrag.lockTouchAction) {
        try {
          sourceEl.style.touchAction = currentDrag.prevTouchAction || '';
        } catch {}
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
    try { document.body.classList.remove('is-dragging'); } catch {}
  }

  function updateDropState(x, y) {
    if (!currentDrag) return;

    // Get the element directly under the pointer for hover detection
    const elementUnderPointer = document.elementFromPoint(x, y);
    const accordionHeader = elementUnderPointer?.closest('.day-accordion__header');
  const accordionContent = elementUnderPointer?.closest('.day-accordion__content');
  const dayFlowUnder = elementUnderPointer?.closest('.day-flow');
  const dayCell = elementUnderPointer?.closest('td[data-day]');

    // Prefer header -> content -> direct day-flow for hover target
    let target = null;
    if (accordionHeader) {
      const contentId = accordionHeader.getAttribute('aria-controls');
      const content = contentId ? document.getElementById(contentId) : null;
      target = content?.querySelector('.day-flow') || null;
      if (target) autoOpenDay(target);
    } else if (accordionContent) {
      target = accordionContent.querySelector('.day-flow') || null;
      if (target) autoOpenDay(target);
    } else if (dayFlowUnder) {
      target = dayFlowUnder;
      // hovering over the day area should also open it
      autoOpenDay(target);
    } else if (dayCell) {
      // Hovering over the table cell area (label gaps) should open the accordion too
      target = dayCell.querySelector('.day-flow') || null;
      if (target) autoOpenDay(target);
    } else {
      target = getDropTargetAt(x, y);
      cleanupHoverTimer();
    }

    // In edit mode: prototypes can only be dropped into trash, not day-flow
    if (isEditMode && currentDrag.sourceType === 'prototype' && target && target.classList && target.classList.contains('day-flow')) {
      target = null;
    }

    setActiveDropTarget(target);

    if (trash) {
      if (target === trash) {
        trash.classList.add('drop-active');
      } else {
        trash.classList.remove('drop-active');
      }
    }

    if (target && target.classList.contains('day-flow')) {
      if (isEditMode && currentDrag.sourceType === 'prototype') {
        currentDrag.anchor = null;
        removeInsertMarker();
        return;
      }
      const anchor = findInsertionAnchor(
        target,
        x,
        y,
        currentDrag.sourceType === 'day-flow' ? currentDrag.sourceElement : null,
      );
      currentDrag.anchor = anchor;
      showInsertMarker(target, anchor);
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
      description: el.getAttribute('data-description') || '',
    };
    const parentFlow = el.closest('.day-flow');
    const dayIndexAttr = parentFlow ? parentFlow.getAttribute('data-day-index') : null;
    const sourceDayIndex = dayIndexAttr != null ? Number(dayIndexAttr) : null;
    const isPrototype = el.classList.contains('prototype');
    const pointerType = payload?.event?.pointerType || '';

    const lockTouchAction = isPrototype && pointerType === 'touch';
    const prevTouchAction = lockTouchAction ? el.style.touchAction : null;
    if (lockTouchAction) {
      el.style.touchAction = 'none';
    }

    currentDrag = {
      sourceElement: el,
      sourceType: isPrototype ? 'prototype' : 'day-flow',
      data,
      origParent: parentFlow,
      origNextSibling: el.nextSibling,
      sourceDayIndex,
      anchor: null,
      pointerType,
      lockTouchAction,
      prevTouchAction,
    };

    el.classList.add('dragging');
    try { document.body.classList.add('is-dragging'); } catch {}
    if (isPrototype && pointerType === 'touch' && !touchDragBlocker) {
      touchDragBlocker = (ev) => {
        try {
          if (ev.cancelable) ev.preventDefault();
        } catch {}
      };
      window.addEventListener('touchmove', touchDragBlocker, { passive: false });
    }
    if (trash && (!isPrototype || isEditMode)) {
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

    let target = getDropTargetAt(x, y);
    const allowCanceledPrototypeDrop = canceled
      && currentDrag.sourceType === 'prototype'
      && currentDrag.pointerType === 'touch';
    const isCanceled = canceled && !allowCanceledPrototypeDrop;

    if (!isCanceled && target && target.id === 'trash') {
      if (currentDrag.sourceType === 'day-flow' && currentDrag.sourceElement) {
        try {
          if (typeof deleteBubbleHandler === 'function') {
            deleteBubbleHandler({
              el: currentDrag.sourceElement,
              fromDayIndex: currentDrag.sourceDayIndex,
            });
          }
        } catch {}
        currentDrag.sourceElement.remove();
      } else if (currentDrag.sourceType === 'prototype' && currentDrag.sourceElement) {
        // Only allow deleting prototypes (sidebar items) in edit mode
        if (isEditMode) {
          try {
            if (typeof deletePrototypeHandler === 'function') {
              deletePrototypeHandler({ el: currentDrag.sourceElement });
            }
          } catch {}
          currentDrag.sourceElement.remove();
        }
      }
      cleanupDragState();
      flushRefresh();
      return;
    }

    if (!isCanceled && target && target.classList.contains('day-flow')) {
      if (isEditMode && currentDrag.sourceType === 'prototype') {
        // Disallow prototype drops onto canvas in edit mode
        cleanupDragState();
        flushRefresh();
        return;
      }
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
            description: currentDrag.data.description,
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
          try {
            if (typeof moveBubbleHandler === 'function') {
              moveBubbleHandler({
                el,
                fromDayIndex: currentDrag.sourceDayIndex,
                toDayIndex: dropDayIndex,
              });
            }
          } catch {}
        }
      }

      cleanupDragState();
      flushRefresh();
      return;
    }

    // If drag came from a day-flow and either was canceled or did not drop into
    // a valid day-flow/trash, restore the element back to its original spot.
    if (currentDrag.sourceType === 'day-flow') {
      if (isCanceled || !target) {
        restoreDetachedBubble();
      }
    }

    cleanupDragState();
    flushRefresh();
  }

  function wireBubble(el) {
    if (!el || el.__dragDestroy) return;
    const isPrototype = el.classList.contains('prototype');
    if (!isPrototype && !canvasDragEnabled) {
      // Do not wire canvas bubbles when drag is disabled (edit mode)
      return;
    }
    const destroy = makeDraggable(el, {
      dataText: el.getAttribute('data-text') || el.textContent || 'Bubble',
      addSyntheticTextFile: true,
      dragCursor: 'grabbing',
      useNativeOnDesktop: false,
      startOnMoveDuringDelay: isPrototype, // allow quick yank on prototypes without canceling
      moveStartThreshold: 6,
      ignoreVerticalDuringDelay: isPrototype, // let vertical flicks scroll sidebar instead of forcing drag
      touchDelay: isPrototype ? 220 : 500, // Faster start for prototypes on touch so sidebar close can't kill drag
      // For bubbles on the canvas (non-prototypes), drag the actual element
      // so it visibly detaches and no shadow element is shown.
      useOriginalAsMirror: !isPrototype,
      onStart: (payload) => handleDragStart(el, payload),
      onMove: ({ x, y }) => handleDragMove(x, y),
      onDrop: ({ x, y, canceled }) => handleDragDrop(x, y, canceled),
    });
    el.__dragDestroy = destroy;
  }

  function setCanvasDragEnabled(enabled) {
    canvasDragEnabled = !!enabled;
    const all = document.querySelectorAll('.day-flow .bubble');
    for (const el of all) {
      if (el.classList.contains('prototype')) continue;
      if (canvasDragEnabled) {
        if (!el.__dragDestroy) {
          wireBubble(el);
        }
      } else {
        if (el.__dragDestroy) {
          try { el.__dragDestroy(); } catch {}
          try { delete el.__dragDestroy; } catch {}
        }
      }
    }
  }

  function setAddBubbleHandler(handler) {
    addBubbleHandler = handler;
  }

  function setDeletePrototypeHandler(handler) {
    deletePrototypeHandler = handler;
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
    setMoveBubbleHandler: (handler) => { moveBubbleHandler = handler; },
    setDeleteBubbleHandler: (handler) => { deleteBubbleHandler = handler; },
    setCanvasDragEnabled,
    setDeletePrototypeHandler,
    setEditMode: (on) => { isEditMode = !!on; },
  };
}
