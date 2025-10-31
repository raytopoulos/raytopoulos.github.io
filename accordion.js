function getContentElement(header) {
  const contentId = header.getAttribute('aria-controls');
  return contentId ? document.getElementById(contentId) : null;
}

function extractDayIndex(header) {
  const content = getContentElement(header);
  if (!content) return null;
  const flow = content.querySelector('.day-flow');
  if (!flow) return null;
  const raw = flow.getAttribute('data-day-index');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createAccordionController(headers) {
  const headerList = Array.from(headers);
  let currentOpenIndex = 0;
  let resizeTimer = null;

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function closeAll() {
    if (!isMobile()) return;
    headerList.forEach((header) => {
      const content = getContentElement(header);
      header.setAttribute('aria-expanded', 'false');
      if (content) {
        content.setAttribute('aria-hidden', 'true');
        content.style.maxHeight = '0px';
      }
    });
  }

  function refreshHeight(dayIndex) {
    if (!isMobile()) return;
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= headerList.length) return;
    const header = headerList[dayIndex];
    const content = getContentElement(header);
    if (!content) return;

    if (header.getAttribute('aria-expanded') !== 'true') {
      content.style.maxHeight = '0px';
      return;
    }

    requestAnimationFrame(() => {
      if (!isMobile()) return;
      if (header.getAttribute('aria-expanded') !== 'true') {
        content.style.maxHeight = '0px';
        return;
      }
      const measured = content.scrollHeight + 50;
      content.style.maxHeight = `${measured}px`;
    });
  }

  function openHeader(header) {
    if (!isMobile()) return;
    closeAll();
    header.setAttribute('aria-expanded', 'true');
    const content = getContentElement(header);
    if (content) {
      content.setAttribute('aria-hidden', 'false');
      content.style.maxHeight = `${content.scrollHeight + 50}px`;
    }
    const dayIndex = extractDayIndex(header);
    if (dayIndex !== null) {
      currentOpenIndex = dayIndex;
      refreshHeight(dayIndex);
    }
  }

  function toggleHeader(header) {
    if (!isMobile()) return;
    const isOpen = header.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      const content = getContentElement(header);
      header.setAttribute('aria-expanded', 'false');
      if (content) {
        content.setAttribute('aria-hidden', 'true');
        content.style.maxHeight = '0px';
      }
    } else {
      openHeader(header);
    }
  }

  function refreshAllOpen() {
    if (!isMobile()) return;
    headerList.forEach((header, idx) => {
      if (header.getAttribute('aria-expanded') === 'true') {
        const content = getContentElement(header);
        if (content) {
          content.setAttribute('aria-hidden', 'false');
          refreshHeight(idx);
        }
      }
    });
  }

  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isMobile()) {
        const anyOpen = headerList.some((header) => header.getAttribute('aria-expanded') === 'true');
        if (!anyOpen && headerList.length) {
          openHeader(headerList[0]);
        } else {
          refreshAllOpen();
        }
      } else {
        headerList.forEach((header) => {
          const content = getContentElement(header);
          header.removeAttribute('aria-expanded');
          if (content) {
            content.style.maxHeight = '';
            content.removeAttribute('aria-hidden');
          }
        });
      }
    }, 120);
  }

  function initInitialState() {
    if (!headerList.length) return;
    if (isMobile()) {
      headerList.forEach((header, idx) => {
        const content = getContentElement(header);
        if (idx === 0) {
          header.setAttribute('aria-expanded', 'true');
          if (content) {
            content.setAttribute('aria-hidden', 'false');
            setTimeout(() => {
              if (content.style.maxHeight !== 'none') {
                refreshHeight(idx);
              }
            }, 100);
          }
          const dayIndex = extractDayIndex(header);
          if (dayIndex !== null) currentOpenIndex = dayIndex;
        } else {
          header.setAttribute('aria-expanded', 'false');
          if (content) {
            content.setAttribute('aria-hidden', 'true');
            content.style.maxHeight = '0px';
          }
        }
      });
    } else {
      headerList.forEach((header) => {
        header.removeAttribute('aria-expanded');
        const content = getContentElement(header);
        if (content) {
          content.style.maxHeight = '';
          content.removeAttribute('aria-hidden');
        }
      });
    }
  }

  function initEventHandlers() {
    headerList.forEach((header) => {
      header.addEventListener('click', () => toggleHeader(header));
    });
    window.addEventListener('resize', handleResize);
  }

  function destroy() {
    window.removeEventListener('resize', handleResize);
    headerList.forEach((header) => {
      header.replaceWith(header.cloneNode(true));
    });
  }

  function openByIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= headerList.length) return;
    openHeader(headerList[index]);
  }

  function getCurrentOpenIndex() {
    return currentOpenIndex;
  }

  return {
    init: () => {
      initInitialState();
      initEventHandlers();
    },
    refreshHeight,
    refreshAllOpen,
    openByIndex,
    getCurrentOpenIndex,
    closeAll,
    destroy,
  };
}
