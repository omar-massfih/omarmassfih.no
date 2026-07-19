(() => {
  "use strict";

  const filterBar = document.querySelector(".notes-filter");
  const list = document.querySelector(".notes-list");
  if (!filterBar || !list) return;

  const rows = Array.from(list.querySelectorAll(".list-row"));
  const emptyState = list.querySelector(".notes-empty");
  const clearButton = filterBar.querySelector("[data-clear]");
  const searchInput = filterBar.querySelector(".notes-search-input");
  const categoryButtons = Array.from(filterBar.querySelectorAll(".tag-filter[data-category]"));
  if (!rows.length || !categoryButtons.length) return;

  const normalize = (value) =>
    String(value || "").toLowerCase().trim().replace(/\s+/g, " ");

  const readSearchMetadata = () => {
    const data = document.querySelector("#notes-search-data");
    if (!data) return new Map();

    try {
      const notes = JSON.parse(data.textContent || "[]");
      return new Map(notes.map((note) => [note.url, note]));
    } catch {
      return new Map();
    }
  };

  const searchMetadata = readSearchMetadata();
  for (const row of rows) {
    const note = searchMetadata.get(row.getAttribute("href"));
    const tags = Array.isArray(note?.tags) ? note.tags : [];
    const searchable = [
      note?.title,
      note?.description,
      note?.category,
      ...tags,
      ...tags.map((tag) => String(tag).replace(/-/g, " ")),
    ];
    row.dataset.search = normalize(searchable.join(" "));
  }

  // Group each category header with the rows that follow it, so headers with no
  // visible rows can be hidden while filtering.
  const groups = [];
  let current = null;
  for (const node of list.children) {
    if (node.matches(".notes-head")) {
      current = { header: node, rows: [] };
      groups.push(current);
    } else if (node.matches(".list-row") && current) {
      current.rows.push(node);
    }
  }

  const activeCategories = new Set();
  let query = "";

  const apply = ({ notifyCategories = true } = {}) => {
    const categories = Array.from(activeCategories);
    let anyVisible = false;
    for (const row of rows) {
      const categoryMatches =
        activeCategories.size === 0 || activeCategories.has(row.dataset.category);
      const searchMatches = !query || row.dataset.search.includes(query);
      const visible = categoryMatches && searchMatches;
      row.hidden = !visible;
      if (visible) anyVisible = true;
    }

    for (const group of groups) {
      group.header.hidden = group.rows.every((row) => row.hidden);
    }

    if (emptyState) emptyState.hidden = anyVisible;
    if (clearButton) clearButton.setAttribute("aria-pressed", String(activeCategories.size === 0 && !query));

    if (notifyCategories) {
      window.notesCategoryFilter = categories;
      window.dispatchEvent(
        new CustomEvent("notes:categories-changed", { detail: { categories } })
      );
    }
  };

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      query = normalize(searchInput.value);
      apply({ notifyCategories: false });
    });
  }

  for (const button of categoryButtons) {
    button.addEventListener("click", () => {
      const category = button.dataset.category;
      if (activeCategories.has(category)) {
        activeCategories.delete(category);
        button.setAttribute("aria-pressed", "false");
      } else {
        activeCategories.add(category);
        button.setAttribute("aria-pressed", "true");
      }
      apply();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      activeCategories.clear();
      for (const button of categoryButtons) button.setAttribute("aria-pressed", "false");
      if (searchInput) searchInput.value = "";
      query = "";
      apply();
    });
  }

  filterBar.hidden = false;
})();
