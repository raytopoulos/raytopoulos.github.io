import { createAccordionController } from './accordion.js';
import { createBubbleManager } from './bubble-manager.js';
import { createDragController } from './drag-controller.js';

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

  dragController.setAddBubbleHandler(({ dayIndex, text, color, square, before }) => {
    bubbleManager.addBubbleToDay(dayIndex, text, color, { square, before });
  });

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

      const targetDay = window.innerWidth > 768 ? 0 : accordion.getCurrentOpenIndex();
      bubbleManager.addBubbleToDay(targetDay, text, color, { square });

      closeModal();
    });
  }

  bubbleManager.addBubbleToDay(0, 'Finish App Merge', '#a78bfa', { square: true });
  bubbleManager.addBubbleToDay(0, 'Check Emails', '#38bdf8');
  bubbleManager.addBubbleToDay(2, 'Review PR', '#f87171');
  bubbleManager.addBubbleToDay(4, 'Deploy Code', '#10b981');
});
