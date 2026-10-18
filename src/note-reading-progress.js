(() => {
  const ACTIVATION_OFFSET = 48;

  const enhanceNoteReadingProgress = () => {
    const toc = document.querySelector(".note-toc");
    const content = document.querySelector("[data-note-content]");
    const progressContainer = toc?.querySelector("[data-note-reading-progress]");
    const progress = progressContainer?.querySelector("[data-note-reading-progress-value]");
    const progressText = progressContainer?.querySelector("[data-note-reading-progress-text]");

    if (!toc || !content || !progressContainer || !progress || !progressText) return;
    if (toc.dataset.readingProgressEnhanced === "true") return;

    const sections = [...toc.querySelectorAll("[data-note-toc-link]")].flatMap((link) => {
      const fragment = link.getAttribute("href");
      if (!fragment?.startsWith("#")) return [];

      try {
        const heading = document.getElementById(decodeURIComponent(fragment.slice(1)));
        return heading ? [{ link, heading }] : [];
      } catch {
        return [];
      }
    });

    if (!sections.length) return;

    toc.dataset.readingProgressEnhanced = "true";
    progressContainer.hidden = false;

    let currentLink = null;
    let framePending = false;

    const update = () => {
      framePending = false;
      const contentRect = content.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const rawProgress = contentRect.height > 0
        ? ((viewportHeight - contentRect.top) / contentRect.height) * 100
        : 100;
      const completion = Math.round(Math.min(100, Math.max(0, rawProgress)));

      progress.value = completion;
      progress.textContent = `${completion}%`;
      progressText.textContent = `${completion}%`;

      const activationOffset = Number.parseFloat(
        window.getComputedStyle(sections[0].heading).scrollMarginTop
      ) || ACTIVATION_OFFSET;
      let nextLink = null;
      for (const section of sections) {
        // Fragment scrolling can leave a fractional pixel at the target.
        if (section.heading.getBoundingClientRect().top <= activationOffset + 1) {
          nextLink = section.link;
        } else {
          break;
        }
      }

      if (nextLink !== currentLink) {
        currentLink?.classList.remove("is-current");
        currentLink?.removeAttribute("aria-current");
        nextLink?.classList.add("is-current");
        nextLink?.setAttribute("aria-current", "location");
        currentLink = nextLink;
      }
    };

    const scheduleUpdate = () => {
      if (framePending) return;
      framePending = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    toc.querySelector(".note-toc-disclosure")?.addEventListener("toggle", scheduleUpdate);
    update();
  };

  window.enhanceNoteReadingProgress = enhanceNoteReadingProgress;
  enhanceNoteReadingProgress();
})();
