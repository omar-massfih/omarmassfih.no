(() => {
  const toggle = document.getElementById("header-menu-toggle");
  const panel = document.getElementById("header-navigation-panel");
  if (!toggle || !panel) return;

  const navigation = toggle.closest("nav");
  const searchDialog = document.getElementById("site-search-dialog");
  const mobile = window.matchMedia("(max-width: 600px)");
  const firstLink = panel.querySelector("a");
  navigation?.classList.add("header-navigation--enhanced");

  const setOpen = (open, { focusPanel = false, restoreFocus = false } = {}) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    if (focusPanel && open) firstLink?.focus();
    if (restoreFocus && !open) toggle.focus();
  };

  const syncBreakpoint = () => {
    if (mobile.matches) {
      toggle.hidden = false;
      setOpen(false, { restoreFocus: panel.contains(document.activeElement) });
    } else {
      toggle.hidden = true;
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation menu");
    }
  };

  toggle.addEventListener("click", () => {
    if (!mobile.matches) return;
    setOpen(toggle.getAttribute("aria-expanded") !== "true", { focusPanel: true });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobile.matches && !panel.hidden) {
      setOpen(false, { restoreFocus: true });
    }
  });

  panel.addEventListener("click", (event) => {
    if (!mobile.matches) return;
    const target = event.target.closest("a, #site-search-trigger");
    if (target) setOpen(false);
  });

  searchDialog?.addEventListener("close", () => {
    if (mobile.matches && panel.hidden) toggle.focus();
  });

  if (typeof mobile.addEventListener === "function") {
    mobile.addEventListener("change", syncBreakpoint);
  } else {
    mobile.addListener(syncBreakpoint);
  }

  syncBreakpoint();
})();
