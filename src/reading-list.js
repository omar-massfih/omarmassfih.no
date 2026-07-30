(() => {
  const STORAGE_KEY = "reading-list:v1";
  const manifestElement = document.getElementById("reading-list-notes");
  const trigger = document.querySelector("[data-reading-list-trigger]");
  const panel = document.querySelector("[data-reading-list-panel]");
  const closeButton = document.querySelector("[data-reading-list-close]");
  const itemsElement = document.querySelector("[data-reading-list-items]");
  const emptyElement = document.querySelector("[data-reading-list-empty]");
  const countElement = document.querySelector("[data-reading-list-count]");
  const statusElement = document.querySelector("[data-reading-list-status]");
  const unavailableElement = document.querySelector("[data-reading-list-unavailable]");
  const saveButtons = [...document.querySelectorAll("[data-reading-list-save]")];

  if (!manifestElement || !trigger || !panel || !closeButton || !itemsElement ||
      !emptyElement || !countElement || !statusElement || !unavailableElement) return;

  let notes;
  try {
    notes = JSON.parse(manifestElement.textContent);
  } catch (error) {
    notes = [];
  }
  if (!Array.isArray(notes)) notes = [];

  const notesBySlug = new Map(
    notes
      .filter((note) => note && typeof note.slug === "string" &&
        typeof note.url === "string" && typeof note.title === "string")
      .map((note) => [note.slug, note])
  );
  let saved = [];
  let available = false;
  let returnFocus = null;

  const announce = (message) => {
    statusElement.textContent = "";
    statusElement.textContent = message;
  };

  const normalize = (value) => {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((slug) =>
      typeof slug === "string" && notesBySlug.has(slug)
    ))];
  };

  const setUnavailable = () => {
    const focusWasInPanel = !panel.hidden && panel.contains(document.activeElement);
    available = false;
    trigger.hidden = true;
    panel.hidden = true;
    unavailableElement.hidden = false;
    if (focusWasInPanel) {
      unavailableElement.tabIndex = -1;
      unavailableElement.focus();
    }
    saveButtons.forEach((button) => { button.disabled = true; });
    announce("Reading list unavailable in this browser.");
  };

  const persist = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      return true;
    } catch (error) {
      setUnavailable();
      return false;
    }
  };

  const syncButtons = () => {
    saveButtons.forEach((button) => {
      const isSaved = saved.includes(button.dataset.readingListSave);
      button.disabled = !available || !notesBySlug.has(button.dataset.readingListSave);
      button.setAttribute("aria-pressed", String(isSaved));
      button.textContent = isSaved ? "Remove from reading list" : "Save for later";
      const note = notesBySlug.get(button.dataset.readingListSave);
      if (note) {
        button.setAttribute(
          "aria-label",
          isSaved ? `Remove “${note.title}” from reading list` : `Save “${note.title}” for later`
        );
      }
    });
  };

  const render = () => {
    itemsElement.replaceChildren();
    saved.forEach((slug) => {
      const note = notesBySlug.get(slug);
      const item = document.createElement("li");
      const link = document.createElement("a");
      const remove = document.createElement("button");
      link.href = note.url;
      link.textContent = note.title;
      remove.type = "button";
      remove.dataset.readingListRemove = slug;
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove “${note.title}” from reading list`);
      item.append(link, remove);
      itemsElement.append(item);
    });
    emptyElement.hidden = saved.length > 0;
    countElement.textContent = `(${saved.length})`;
    countElement.setAttribute("aria-label", `${saved.length} saved ${saved.length === 1 ? "note" : "notes"}`);
    syncButtons();
  };

  const update = (slug, shouldSave) => {
    const note = notesBySlug.get(slug);
    if (!available || !note) return false;
    saved = shouldSave
      ? normalize([...saved, slug])
      : saved.filter((savedSlug) => savedSlug !== slug);
    if (!persist()) return false;
    render();
    announce(shouldSave
      ? `Saved “${note.title}” for later.`
      : `Removed “${note.title}” from reading list.`);
    return true;
  };

  const openPanel = () => {
    returnFocus = document.activeElement;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    closeButton.focus();
  };

  const closePanel = () => {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
  };

  try {
    const probeKey = `${STORAGE_KEY}:probe`;
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    let stored;
    try {
      stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (error) {
      stored = [];
    }
    saved = normalize(stored);
    available = true;
    if (!persist()) return;
  } catch (error) {
    setUnavailable();
    return;
  }

  unavailableElement.hidden = true;
  trigger.hidden = false;
  render();

  trigger.addEventListener("click", openPanel);
  closeButton.addEventListener("click", closePanel);
  panel.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-reading-list-remove]");
    if (remove) {
      const removeButtons = [...itemsElement.querySelectorAll("[data-reading-list-remove]")];
      const removedIndex = removeButtons.indexOf(remove);
      if (!update(remove.dataset.readingListRemove, false)) return;
      const remainingButtons = [...itemsElement.querySelectorAll("[data-reading-list-remove]")];
      const nextFocus = remainingButtons[removedIndex] ||
        remainingButtons[remainingButtons.length - 1] ||
        closeButton;
      nextFocus.focus();
    }
  });
  saveButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const slug = button.dataset.readingListSave;
      update(slug, !saved.includes(slug));
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      closePanel();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const focusedRemove = document.activeElement.closest?.("[data-reading-list-remove]");
    const removeButtons = [...itemsElement.querySelectorAll("[data-reading-list-remove]")];
    const focusedSlug = focusedRemove?.dataset.readingListRemove;
    const focusedIndex = removeButtons.indexOf(focusedRemove);
    try {
      saved = event.key === null
        ? []
        : normalize(JSON.parse(event.newValue || "[]"));
    } catch (error) {
      saved = [];
    }
    render();
    if (focusedSlug) {
      const remainingButtons = [...itemsElement.querySelectorAll("[data-reading-list-remove]")];
      const sameRemove = remainingButtons.find(
        (button) => button.dataset.readingListRemove === focusedSlug
      );
      const nextFocus = sameRemove ||
        remainingButtons[focusedIndex] ||
        remainingButtons[remainingButtons.length - 1] ||
        closeButton;
      nextFocus.focus();
    }
    announce("Reading list updated in another tab.");
  });
})();
