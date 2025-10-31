// Mobile day accordions (one open at a time) + existing minimal features
// - Sidebar prototypes (click or drag to add)
// - Colored bubbles + optional squared
// - Hamburger toggle
// - Pure CSS layout still controls scrolling; JS only handles interaction

(function () {
  "use strict";

  // --- Constants and Global State ---

  const PROTOTYPES = [
    { text: "Task", color: "#38bdf8" },
    { text: "Idea", color: "#a78bfa" },
    { text: "Bug", color: "#f87171" },
    { text: "Note", color: "#10b981" },
  ];

  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Global state for drag operations
  let activeDragData = null; // { text: string, color: string, square: boolean }
  let dragGhostEl = null;
  let activeDropTarget = null;
  let mobileDrag = false;
  let mobileDragPending = false;
  let mobileStartX = 0;
  let mobileStartY = 0;
  let currentAccordionOpen = 0; // Index of the currently open day accordion (0-6)
  let insertMarkerEl = null; // helper line indicating insertion point
  let dragPreviewEl = null; // desktop HTML5 DnD custom drag image

  document.addEventListener("DOMContentLoaded", () => {
    const addBtn = document.getElementById("addBtn");
    const menuBtn = document.getElementById("menuBtn");
    const sidebar = document.querySelector("aside.sidebar");
    const closeBtn = document.getElementById("closeSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const templates =
      document.getElementById("templates") ||
      document.querySelector(".bubbles-list");
    const dayFlows = document.querySelectorAll(".day-flow");
    const trashZone = document.getElementById("trash");
    const dayAccordionHeaders = document.querySelectorAll(".day-accordion__header");

    // Modal elements
    const modal = document.getElementById("modal");
    const form = document.getElementById("newBubbleForm");
    const cancelBtn = document.getElementById("cancelBtn");

    // --- Utility Functions ---

    /**
     * Sets the position of a fixed element centered on a cursor position.
     * @param {HTMLElement} el The element to position.
     * @param {{x: number, y: number} | MouseEvent | PointerEvent} pos The client position.
     */
    function centerElUnderCursor(el, pos) {
      const x = "clientX" in pos ? pos.clientX : +pos.x;
      const y = "clientY" in pos ? pos.clientY : +pos.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      // Measure once per call
      const r = el.getBoundingClientRect();
      const w = r.width || el.offsetWidth || 0;
      const h = r.height || el.offsetHeight || 0;
      // Ensure fixed positioning and a stable transform origin
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed") {
        el.style.position = "fixed";
      }
      // Explicit anchors to make translate3d predictable across devices
      if (cs.left === 'auto' || cs.left === '' || cs.left === '0') {
        el.style.left = "0px";
      }
      if (cs.top === 'auto' || cs.top === '' || cs.top === '0') {
        el.style.top = "0px";
      }
      el.style.visibility = 'visible';
      el.style.display = 'block';
      // Center under cursor via transform to avoid layout thrash
      const tx = Math.round(x - w / 2);
      const ty = Math.round(y - h / 2);
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    }

    // Removes all transient styles/classes applied during dragging
    function resetDraggedElStyles(el) {
      if (!el) return;
      try {
        el.classList.remove('drag-ghost', 'dragging');
        el.style.removeProperty('position');
        el.style.removeProperty('left');
        el.style.removeProperty('top');
        el.style.removeProperty('transform');
        el.style.removeProperty('width');
        el.style.removeProperty('height');
        el.style.removeProperty('z-index');
        el.style.removeProperty('zIndex');
        el.style.removeProperty('visibility');
        el.style.removeProperty('display');
      } catch (_) {}
    }

    // Add a bubble to a given day index
    function addBubbleToDay(
      dayIndex,
      text,
      backgroundColor,
      { square = false, classes = [], before = null } = {}
    ) {
      const flows = document.querySelectorAll(".day-flow");
      const flow = flows[dayIndex];
      if (!flow) return;
      const el = document.createElement("div");
      el.className = "bubble";
      if (square) {
        el.classList.add("squared");
      }
      classes.forEach((c) => el.classList.add(c));

      el.setAttribute("draggable", true);
      el.setAttribute("role", "listitem");
      el.setAttribute("tabindex", "0");
      el.setAttribute("data-text", text);
      el.setAttribute("data-color", backgroundColor);
      el.setAttribute("data-square", square);
      el.textContent = text;
      el.style.backgroundColor = backgroundColor;
      el.style.borderColor = adjustColor(backgroundColor, -20);
      el.style.color = isLight(backgroundColor) ? "var(--text)" : "white";

      if (before && flow.contains(before)) {
        flow.insertBefore(el, before);
      } else {
        flow.appendChild(el);
      }

      return el;
    }

    /**
     * Lightens or darkens a hex color.
     * @param {string} hex Hex color string (e.g., "#RRGGBB").
     * @param {number} percent Percentage to adjust (negative darkens, positive lightens).
     * @returns {string} Adjusted hex color.
     */
    function adjustColor(hex, percent) {
      let r = parseInt(hex.substring(1, 3), 16);
      let g = parseInt(hex.substring(3, 5), 16);
      let b = parseInt(hex.substring(5, 7), 16);

      const amount = Math.floor(2.55 * percent);

      r = Math.min(255, Math.max(0, r + amount));
      g = Math.min(255, Math.max(0, g + amount));
      b = Math.min(255, Math.max(0, b + amount));

      const rr = r.toString(16).padStart(2, '0');
      const gg = g.toString(16).padStart(2, '0');
      const bb = b.toString(16).padStart(2, '0');

      return "#" + rr + gg + bb;
    }

    /**
     * Checks if a hex color is light.
     * @param {string} hex The hex color string.
     * @returns {boolean} True if the color is light.
     */
    function isLight(hex) {
        const r = parseInt(hex.substring(1, 3), 16);
        const g = parseInt(hex.substring(3, 5), 16);
        const b = parseInt(hex.substring(5, 7), 16);
        // Calculate luminance (standard formula)
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        // Threshold for perceived lightness
        return luminance > 0.6;
    }

    // --- Bubble Template Rendering ---

    function createPrototypeEl({ text, color }) {
      const el = document.createElement("div");
      el.className = "bubble prototype";
      el.setAttribute("draggable", true);
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("data-text", text);
      el.setAttribute("data-color", color);
      el.textContent = text;
      el.style.backgroundColor = color;
      el.style.borderColor = adjustColor(color, -20);
      el.style.color = isLight(color) ? "var(--text)" : "white";

      el.addEventListener("click", () => {
        // Quick add feature: click a prototype to add it to the first day
        addBubbleToDay(0, text, color, {});
      });

      return el;
    }

    PROTOTYPES.forEach((p) => templates.appendChild(createPrototypeEl(p)));

    // --- Sidebar and Accordion Logic ---

    function toggleSidebar(open) {
      if (open) {
        sidebar.classList.add("open");
        if (backdrop) backdrop.classList.add("open");
        menuBtn.setAttribute("aria-expanded", "true");
        // Focus the close button for accessibility when opened
        setTimeout(() => closeBtn && closeBtn.focus(), 100);
      } else {
        sidebar.classList.remove("open");
        if (backdrop) backdrop.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      }
    }

    menuBtn.addEventListener("click", () => {
      toggleSidebar(!sidebar.classList.contains("open"));
    });

    closeBtn.addEventListener("click", () => {
      toggleSidebar(false);
    });

    backdrop.addEventListener("click", () => {
      toggleSidebar(false);
    });

    // Also close modal if open when clicking the backdrop
    backdrop.addEventListener("click", () => {
      if (!modal.hasAttribute("hidden")) {
        modal.setAttribute("hidden", "");
      }
    });

    // Close modal when clicking outside the dialog (modal backdrop area)
    modal.addEventListener("click", (e) => {
      if (e.target === modal || !e.target.closest('.dialog')) {
        modal.setAttribute("hidden", "");
      }
    });

    // Mobile Accordion Logic
    function closeAllAccordions() {
      // Only run this logic if we are on mobile (screen width check)
      if (window.innerWidth > 768) return;

      dayAccordionHeaders.forEach((header) => {
        header.setAttribute("aria-expanded", "false");
        const content = document.getElementById(header.getAttribute("aria-controls"));
        if (!content) return;
        content.setAttribute("aria-hidden", "true");
        content.style.maxHeight = '0px';
      });
    }

    function openAccordion(headerEl) {
      // Only run this logic if we are on mobile (screen width check)
      if (window.innerWidth > 768) return;
      
      closeAllAccordions();
      headerEl.setAttribute("aria-expanded", "true");
      const content = document.getElementById(headerEl.getAttribute("aria-controls"));
      content.setAttribute("aria-hidden", "false");
      // Set max-height large enough to allow content to show/transition smoothly
      content.style.maxHeight = content.scrollHeight + 50 + "px";

      // Update state for drag tracking
      const dayFlow = content.querySelector('.day-flow');
      currentAccordionOpen = parseInt(dayFlow.dataset.dayIndex);
    }
    
    // Initial setup and click handler for accordions (mobile)
    dayAccordionHeaders.forEach((header, index) => {
      const content = document.getElementById(header.getAttribute("aria-controls"));
      
      // Initial state management
      if (index === 0 && window.innerWidth <= 768) {
          // Open the first day on mobile load
          header.setAttribute("aria-expanded", "true");
          content.setAttribute("aria-hidden", "false");
          // Use a timeout to ensure scrollHeight is calculated correctly after CSS transitions
          setTimeout(() => {
              if (content.style.maxHeight !== 'none') { // Don't touch max-height if desktop CSS is active
                  content.style.maxHeight = content.scrollHeight + 50 + "px";
              }
          }, 100);
      } else if (window.innerWidth <= 768) {
          // Ensure others are closed on mobile load
          header.setAttribute("aria-expanded", "false");
          content.setAttribute("aria-hidden", "true");
          content.style.maxHeight = '0px';
      }

      header.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
          const isOpen = header.getAttribute("aria-expanded") === "true";
          if (isOpen) {
            // Close this one only
            header.setAttribute("aria-expanded", "false");
            const content = document.getElementById(header.getAttribute("aria-controls"));
            if (content) {
              content.setAttribute("aria-hidden", "true");
              content.style.maxHeight = '0px';
            }
          } else {
            // Open this one and close others
            closeAllAccordions();
            openAccordion(header);
          }
        }
      });
    });

    // Handle responsive changes so mobile accordion works when resizing
    let resizeTimer = null;
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.innerWidth <= 768) {
          // Ensure only one open (open first if none marked open)
          const anyOpen = Array.from(dayAccordionHeaders).some(h => h.getAttribute('aria-expanded') === 'true');
          if (!anyOpen && dayAccordionHeaders.length) {
            openAccordion(dayAccordionHeaders[0]);
          } else {
            // Re-sync max-heights for currently open one
            dayAccordionHeaders.forEach(h => {
              const isOpen = h.getAttribute('aria-expanded') === 'true';
              const c = document.getElementById(h.getAttribute('aria-controls'));
              if (c) {
                if (isOpen) {
                  c.setAttribute('aria-hidden', 'false');
                  c.style.maxHeight = (c.scrollHeight + 50) + 'px';
                } else {
                  c.setAttribute('aria-hidden', 'true');
                  c.style.maxHeight = '0px';
                }
              }
            });
          }
        } else {
          // Desktop: clear inline styles so CSS can force open
          dayAccordionHeaders.forEach(h => {
            const c = document.getElementById(h.getAttribute('aria-controls'));
            if (c) {
              c.style.maxHeight = '';
              c.removeAttribute('aria-hidden');
            }
            h.removeAttribute('aria-expanded');
          });
        }
      }, 120);
    }
    window.addEventListener('resize', onResize);


    // --- Modal Logic ---

    addBtn.addEventListener("click", () => {
      // Close sidebar if open (especially on mobile)
      toggleSidebar(false);
      // Open modal
      modal.removeAttribute("hidden");
      // Reset form and focus first field
      form.reset();
      document.getElementById("bubbleText").focus();
    });

    cancelBtn.addEventListener("click", () => {
      modal.setAttribute("hidden", "");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const text = document.getElementById("bubbleText").value;
      const color = document.querySelector('input[name="bubbleColor"]:checked').value;
      const square = document.getElementById("bubbleSquared").checked;

      // Add the new prototype to the sidebar
      PROTOTYPES.unshift({ text, color }); // Add to beginning of prototypes array
      templates.prepend(createPrototypeEl({ text, color, square }));

      // Optionally add to the canvas as well
      // If desktop, add to day 0. If mobile, add to the currently open accordion.
      const targetDay = window.innerWidth > 768 ? 0 : currentAccordionOpen;
      addBubbleToDay(targetDay, text, color, { square: square });

      modal.setAttribute("hidden", "");
    });

    // --- Drag and Drop Logic (HTML5 + Pointer Events Hybrid) ---

    function findInsertionAnchor(container, x, y, draggedEl) {
      if (!container) return null;
      const bubbles = Array.from(container.querySelectorAll('.bubble'))
        .filter(b => b !== draggedEl && !b.classList.contains('drag-ghost'));
      if (!bubbles.length) return null;

      const style = getComputedStyle(container);
      const isRow = (style.flexDirection || '').startsWith('row');

      const under = document.elementFromPoint(x, y);
      const underBubble = under && under.closest && under.closest('.bubble');
      if (underBubble && container.contains(underBubble) && underBubble !== draggedEl && !underBubble.classList.contains('drag-ghost')) {
        const r = underBubble.getBoundingClientRect();
        if (isRow) {
          return x < (r.left + r.width / 2) ? underBubble : underBubble.nextSibling;
        } else {
          return y < (r.top + r.height / 2) ? underBubble : underBubble.nextSibling;
        }
      }

      // Fallback: scan in DOM order using vertical position
      for (const b of bubbles) {
        const r = b.getBoundingClientRect();
        if (y < (r.top + r.height / 2)) return b;
      }
      return null; // append at end
    }

    function ensureInsertMarker() {
      if (!insertMarkerEl) {
        insertMarkerEl = document.createElement('div');
        insertMarkerEl.className = 'insert-marker';
      }
      return insertMarkerEl;
    }

    function showInsertMarker(container, anchor) {
      const marker = ensureInsertMarker();
      if (!container) return;
      const hasBubbles = container.querySelectorAll('.bubble:not(.drag-ghost)').length > 0;
      if (!hasBubbles) {
        removeInsertMarker();
        return;
      }
      if (anchor && container.contains(anchor)) {
        container.insertBefore(marker, anchor);
      } else {
        // Place marker at the end if no specific anchor but there are bubbles
        container.appendChild(marker);
      }
    }

    function removeInsertMarker() {
      if (insertMarkerEl && insertMarkerEl.parentNode) {
        insertMarkerEl.parentNode.removeChild(insertMarkerEl);
      }
    }

    // 1. Drag Start (Bubbles and Prototypes)
    document.addEventListener("dragstart", (e) => {
      const target = e.target.closest(".bubble");
      if (!target) {
        return;
      }

      // Check if this is a prototype being dragged from the sidebar
      const isPrototype = target.classList.contains("prototype");

      // Extract data
      const text = target.getAttribute("data-text");
      const color = target.getAttribute("data-color");
      const square = target.getAttribute("data-square") === 'true';
      const dayIndex = target.closest(".day-flow")?.getAttribute("data-day-index");

      activeDragData = {
        text,
        color,
        square,
        source: isPrototype ? "prototype" : "day-flow",
        sourceElement: target,
        sourceDayIndex: dayIndex ? parseInt(dayIndex) : null
      };

      e.dataTransfer.setData("text/plain", text);
      e.dataTransfer.effectAllowed = "move";

      // If dragging from a day-flow on desktop, detach the element immediately
      if (!isPrototype) {
        const origParent = target.closest('.day-flow');
        const origNextSibling = target.nextSibling;
        if (origParent) {
          activeDragData.detached = true;
          activeDragData.origParent = origParent;
          activeDragData.origNextSibling = origNextSibling;
          // Remove from DOM so it doesn't remain ghosted in the list
          target.remove();
        }
      }

      // Provide a centered custom drag image on desktop (HTML5 DnD)
      try {
        const w = Math.max(1, target.offsetWidth);
        const h = Math.max(1, target.offsetHeight);
        dragPreviewEl = target.cloneNode(true);
        dragPreviewEl.classList.remove("dragging", "prototype");
        dragPreviewEl.style.position = 'fixed';
        dragPreviewEl.style.left = '0px';
        dragPreviewEl.style.top = '0px';
        dragPreviewEl.style.width = w + 'px';
        dragPreviewEl.style.height = h + 'px';
        dragPreviewEl.style.pointerEvents = 'none';
        dragPreviewEl.style.opacity = '0';
        dragPreviewEl.style.zIndex = '-1';
        document.body.appendChild(dragPreviewEl);
        if (e.dataTransfer.setDragImage) {
          e.dataTransfer.setDragImage(dragPreviewEl, Math.round(w/2), Math.round(h/2));
        }
      } catch (_) {}

      // Visual state on source (if still present)
      if (activeDragData.sourceElement && activeDragData.sourceElement.isConnected) {
        activeDragData.sourceElement.classList.add("dragging");
      }

      trashZone.classList.add("trash-active");
    });

    // 2. Drag End (Cleanup)
    document.addEventListener("dragend", (e) => {
      if (activeDragData && activeDragData.sourceElement) {
        activeDragData.sourceElement.classList.remove("dragging");
      }
      // If we detached an element from a day and didn't drop on a valid target, restore it
      if (activeDragData && activeDragData.source === 'day-flow' && activeDragData.detached && !activeDragData.wasDropped) {
        const el = activeDragData.sourceElement;
        const parent = activeDragData.origParent;
        const next = activeDragData.origNextSibling;
        if (el && parent) {
          try {
            if (next && next.parentNode === parent) {
              parent.insertBefore(el, next);
            } else {
              parent.appendChild(el);
            }
          } catch (_) {}
        }
      }
      activeDragData = null;
      trashZone.classList.remove("trash-active");
      if (activeDropTarget) {
        activeDropTarget.classList.remove("drop-active");
        activeDropTarget = null;
      }
      removeInsertMarker();
      if (dragPreviewEl) {
        try { dragPreviewEl.remove(); } catch (_) {}
        dragPreviewEl = null;
      }
    });

    // 3. Drag Over (Day Flows and Trash)
    document.addEventListener("dragover", (e) => {
      e.preventDefault(); // Essential to allow drop

      const target = e.target.closest(".day-flow, #trash");
      const isDayFlow = target && target.classList.contains("day-flow");
      const isTrash = target && target.id === "trash";

      // Cleanup previous target
      if (activeDropTarget && activeDropTarget !== target) {
        activeDropTarget.classList.remove("drop-active");
      }

      if (isDayFlow || isTrash) {
        e.dataTransfer.dropEffect = isTrash ? "copy" : "move"; // Trash shows copy, flow shows move
        if (!target.classList.contains("drop-active")) {
          target.classList.add("drop-active");
          activeDropTarget = target;
        }
        if (isDayFlow) {
          const anchor = findInsertionAnchor(
            target,
            e.clientX,
            e.clientY,
            activeDragData && activeDragData.source === 'day-flow' ? activeDragData.sourceElement : null
          );
          showInsertMarker(target, anchor);
        } else {
          removeInsertMarker();
        }
      } else {
        e.dataTransfer.dropEffect = "none";
        activeDropTarget = null;
        removeInsertMarker();
      }
    });

    // 4. Drop (Day Flows and Trash)
    document.addEventListener("drop", (e) => {
      e.preventDefault();

      const target = e.target.closest(".day-flow, #trash");

      if (!activeDragData) return;

      // Handle drop on trash
      if (target && target.id === "trash") {
        if (activeDragData.source === "day-flow") {
          activeDragData.sourceElement.remove();
        }
        activeDragData.wasDropped = true;
      }

      // Handle drop on a day flow
      if (target && target.classList.contains("day-flow")) {
        const dropDayIndex = parseInt(target.getAttribute("data-day-index"));
        const anchor = findInsertionAnchor(target, e.clientX, e.clientY, activeDragData.source === 'day-flow' ? activeDragData.sourceElement : null);

        if (activeDragData.source === "prototype") {
          // Create new bubble
          addBubbleToDay(
            dropDayIndex,
            activeDragData.text,
            activeDragData.color,
            { square: activeDragData.square, before: anchor }
          );
          activeDragData.wasDropped = true;
        } else if (activeDragData.source === "day-flow") {
          // Move/reorder existing bubble
          const el = activeDragData.sourceElement;
          if (anchor) {
            target.insertBefore(el, anchor);
          } else {
            target.appendChild(el);
          }
          activeDragData.wasDropped = true;
        }
      }

      // Cleanup
      if (activeDragData && activeDragData.sourceElement) {
        activeDragData.sourceElement.classList.remove("dragging");
      }
      if (activeDropTarget) {
        activeDropTarget.classList.remove("drop-active");
      }
      trashZone.classList.remove("trash-active");
      activeDragData = null;
      removeInsertMarker();
    });

    // --- Pointer Event (Touch) Drag Logic ---

    // 5. Pointer Down (Start of touch/mobile drag)
    document.addEventListener("pointerdown", (e) => {
      // Check if drag is initiated from a mouse device. If so, let HTML5 DnD handle it.
      if (e.pointerType === "mouse" && window.innerWidth > 768) return;

      const target = e.target.closest(".bubble.prototype, .bubble:not(.prototype)");
      if (!target) return;

      // Check if this is a prototype being dragged from the sidebar
      const isPrototype = target.classList.contains("prototype");

      // Extract data
      const text = target.getAttribute("data-text");
      const color = target.getAttribute("data-color");
      const square = target.getAttribute("data-square") === 'true';
      const dayIndex = target.closest(".day-flow")?.getAttribute("data-day-index");

      activeDragData = {
        text,
        color,
        square,
        source: isPrototype ? "prototype" : "day-flow",
        sourceElement: target,
        sourceDayIndex: dayIndex ? parseInt(dayIndex) : null
      };

      // Defer actual drag start until movement threshold is exceeded
      mobileDrag = false;
      mobileDragPending = true;
      mobileStartX = e.clientX;
      mobileStartY = e.clientY;
    });

    // Treat pointer cancel like pointer up for cleanup
    document.addEventListener("pointercancel", (e) => {
      if (!mobileDrag) {
        mobileDragPending = false;
        activeDragData = null;
        return;
      }
      // If dragging an existing bubble, restore it to its original day/location
      if (activeDragData && activeDragData.source === 'day-flow' && activeDragData.sourceElement) {
        const parent = activeDragData.origParent;
        const next = activeDragData.origNextSibling;
        if (parent) {
          const el = activeDragData.sourceElement;
          resetDraggedElStyles(el);
          if (next && next.parentNode === parent) {
            parent.insertBefore(el, next);
          } else {
            parent.appendChild(el);
          }
        }
      }
      if (dragGhostEl) {
        if (activeDragData && activeDragData.source === 'prototype' && activeDragData.createdElement === dragGhostEl) {
          dragGhostEl.remove();
        }
        dragGhostEl = null;
      }
      if (activeDragData && activeDragData.sourceElement) {
        activeDragData.sourceElement.classList.remove("dragging");
      }
      if (activeDropTarget) {
        activeDropTarget.classList.remove("drop-active");
      }
      trashZone.classList.remove("trash-active");
      mobileDrag = false;
      activeDragData = null;
      removeInsertMarker();
    });

    // 6. Pointer Move (While dragging)
    document.addEventListener("pointermove", (e) => {
      if (!mobileDrag && !mobileDragPending) return;

      // Threshold to initiate drag
      if (!mobileDrag && mobileDragPending) {
        const dx = (e.clientX - mobileStartX) || 0;
        const dy = (e.clientY - mobileStartY) || 0;
        if (Math.hypot(dx, dy) < 6) {
          return;
        }
        // Start drag now
        const target = activeDragData && activeDragData.sourceElement;
        if (!target) return;
        const isPrototype = activeDragData.source === 'prototype';
        try { target.setPointerCapture && target.setPointerCapture(e.pointerId); } catch (_) {}
        target.classList.add('dragging');
        if (isPrototype) {
          const created = document.createElement('div');
          created.className = 'bubble';
          if (activeDragData.square) created.classList.add('squared');
          created.setAttribute('draggable', true);
          created.setAttribute('role', 'listitem');
          created.setAttribute('tabindex', '0');
          created.setAttribute('data-text', activeDragData.text);
          created.setAttribute('data-color', activeDragData.color);
          created.setAttribute('data-square', activeDragData.square);
          created.textContent = activeDragData.text;
          created.style.backgroundColor = activeDragData.color;
          created.style.borderColor = adjustColor(activeDragData.color, -20);
          created.style.color = isLight(activeDragData.color) ? "var(--text)" : "white";

          dragGhostEl = created;
          dragGhostEl.classList.add('drag-ghost');
          dragGhostEl.style.width = Math.max(1, target.offsetWidth) + 'px';
          dragGhostEl.style.height = Math.max(1, target.offsetHeight) + 'px';
          dragGhostEl.style.position = 'fixed';
          dragGhostEl.style.left = '0px';
          dragGhostEl.style.top = '0px';
          dragGhostEl.style.zIndex = '2147483647';
          document.body.appendChild(dragGhostEl);
          toggleSidebar(false);
          requestAnimationFrame(() => centerElUnderCursor(dragGhostEl, e));
          activeDragData.createdElement = created;
        } else {
          // Detach element for drag (lists jump)
          const w = Math.max(1, target.offsetWidth);
          const h = Math.max(1, target.offsetHeight);
          const origParent = target.closest('.day-flow');
          const origNextSibling = target.nextSibling;
          activeDragData.detached = true;
          activeDragData.origParent = origParent;
          activeDragData.origNextSibling = origNextSibling;

          dragGhostEl = target;
          dragGhostEl.classList.add('drag-ghost');
          dragGhostEl.style.width = w + 'px';
          dragGhostEl.style.height = h + 'px';
          dragGhostEl.style.position = 'fixed';
          dragGhostEl.style.left = '0px';
          dragGhostEl.style.top = '0px';
          dragGhostEl.style.zIndex = '2147483647';
          document.body.appendChild(dragGhostEl);
        }
        mobileDrag = true;
        mobileDragPending = false;
        trashZone.classList.add('trash-active');
        centerElUnderCursor(dragGhostEl, e);
      }

      if (!mobileDrag || !dragGhostEl) return;
      // Prevent scrolling while dragging on mobile emulation
      e.preventDefault();

      // Update ghost position
      centerElUnderCursor(dragGhostEl, e);

      // Find potential drop target under the ghost
      dragGhostEl.style.display = 'none'; // Temporarily hide ghost to check element underneath
      const elBelow = document.elementFromPoint(e.clientX, e.clientY);
      dragGhostEl.style.display = '';

      const target = elBelow && elBelow.closest ? elBelow.closest(".day-flow, #trash") : null;
      const isDayFlow = target && target.classList.contains("day-flow");
      const isTrash = target && target.id === "trash";

      // Cleanup previous target
      if (activeDropTarget && activeDropTarget !== target) {
        activeDropTarget.classList.remove("drop-active");
      }

      if (isDayFlow || isTrash) {
        if (!target.classList.contains("drop-active")) {
          target.classList.add("drop-active");
          activeDropTarget = target;
        }

        // Mobile UX Improvement: Auto-open day accordion if drag hovers over an unopened day
        if (isDayFlow && window.innerWidth <= 768) {
          const newDayIndex = parseInt(target.dataset.dayIndex);
          if (newDayIndex !== currentAccordionOpen) {
            const newHeader = dayAccordionHeaders[newDayIndex];
            if (newHeader && newHeader.getAttribute("aria-expanded") === "false") {
               openAccordion(newHeader);
            }
          }
        }
        if (isDayFlow) {
          const anchor = findInsertionAnchor(
            target,
            e.clientX,
            e.clientY,
            activeDragData && activeDragData.source === 'day-flow' ? activeDragData.sourceElement : null
          );
          showInsertMarker(target, anchor);
        } else {
          removeInsertMarker();
        }
      } else {
        activeDropTarget = null;
        removeInsertMarker();
      }

      if (trashZone) {
        if (activeDropTarget && activeDropTarget.id === "trash") {
          trashZone.classList.add("drop-active");
        } else {
          trashZone.classList.remove("drop-active");
        }
      }
    });

    // 7. Pointer Up (End of touch/mobile drag)
    document.addEventListener("pointerup", (e) => {
      if (!mobileDrag) {
        // No drag was initiated; clear pending state
        mobileDragPending = false;
        activeDragData = null;
        return;
      }

      // Final check for drop target
      dragGhostEl.style.display = 'none';
      const elBelow = document.elementFromPoint(e.clientX, e.clientY);
      dragGhostEl.style.display = '';

      const target = elBelow?.closest(".day-flow, #trash");

      // Drop Handling (Identical to HTML5 drop logic, with mobile prototype instance support)
      if (activeDragData) {
        // Handle drop on trash
        if (target && target.id === "trash") {
          if (activeDragData.source === "day-flow") {
            activeDragData.sourceElement.remove();
          } else if (activeDragData.source === 'prototype' && activeDragData.createdElement) {
            activeDragData.createdElement.remove();
          }
          activeDragData.wasDropped = true;
        }

        // Handle drop on a day flow
        if (target && target.classList.contains("day-flow")) {
          const dropDayIndex = parseInt(target.getAttribute("data-day-index"));
          const anchor = findInsertionAnchor(target, e.clientX, e.clientY, activeDragData.source === 'day-flow' ? activeDragData.sourceElement : null);

          if (activeDragData.source === "prototype") {
            if (activeDragData.createdElement) {
              // Use the created instance; place it into the target
              const el = activeDragData.createdElement;
              el.classList.remove('drag-ghost');
              el.style.removeProperty('position');
              el.style.removeProperty('width');
              el.style.removeProperty('height');
              el.style.removeProperty('transform');
              if (anchor) {
                target.insertBefore(el, anchor);
              } else {
                target.appendChild(el);
              }
              // Avoid cleanup removing it
              dragGhostEl = null;
              activeDragData.wasDropped = true;
            } else {
              // Fallback create on drop
              addBubbleToDay(
                dropDayIndex,
                activeDragData.text,
                activeDragData.color,
                { square: activeDragData.square, before: anchor }
              );
              activeDragData.wasDropped = true;
            }
          } else if (activeDragData.source === "day-flow") {
            // Move/reorder existing bubble
            const el = activeDragData.sourceElement;
            if (anchor) {
              target.insertBefore(el, anchor);
            } else {
              target.appendChild(el);
            }
            el.classList.remove('drag-ghost');
            el.style.removeProperty('position');
            el.style.removeProperty('left');
            el.style.removeProperty('top');
            el.style.removeProperty('transform');
            el.style.removeProperty('width');
            el.style.removeProperty('height');
            activeDragData.wasDropped = true;
          }
        }
      }

      // If not dropped onto a valid target and it was a detached day bubble, restore it
      if (activeDragData && activeDragData.source === 'day-flow' && activeDragData.detached && !activeDragData.wasDropped) {
        const el = activeDragData.sourceElement;
        const parent = activeDragData.origParent;
        const next = activeDragData.origNextSibling;
        if (el && parent) {
          if (next && next.parentNode === parent) {
            parent.insertBefore(el, next);
          } else {
            parent.appendChild(el);
          }
          el.classList.remove('drag-ghost');
          el.style.removeProperty('position');
          el.style.removeProperty('left');
          el.style.removeProperty('top');
          el.style.removeProperty('transform');
          el.style.removeProperty('width');
          el.style.removeProperty('height');
        }
      }

      // Cleanup
      if (dragGhostEl) {
      if (activeDragData && activeDragData.source === 'prototype' && activeDragData.createdElement === dragGhostEl) {
          // Drop not on day-flow: it was handled above (trash) or will be cleaned
          dragGhostEl.remove();
        } else if (activeDragData && activeDragData.source === 'day-flow' && activeDragData.sourceElement === dragGhostEl) {
          // It's the actual moved element; ensure styles are reset but do NOT remove
          resetDraggedElStyles(dragGhostEl);
        } else {
          // Fallback cleanup
          try { dragGhostEl.remove(); } catch(_) {}
        }
        dragGhostEl = null;
      }
      if (activeDragData && activeDragData.sourceElement) {
        activeDragData.sourceElement.classList.remove("dragging");
      }
      if (activeDropTarget) {
        activeDropTarget.classList.remove("drop-active");
      }
      trashZone.classList.remove("trash-active");
      mobileDrag = false;
      activeDragData = null;
      removeInsertMarker();
    });

    // --- Demo Initial State ---
    // Add a few starting bubbles for demonstration
    addBubbleToDay(0, "Finish App Merge", "#a78bfa", { square: true });
    addBubbleToDay(0, "Check Emails", "#38bdf8");
    addBubbleToDay(2, "Review PR", "#f87171");
    addBubbleToDay(4, "Deploy Code", "#10b981");

  });
})();
