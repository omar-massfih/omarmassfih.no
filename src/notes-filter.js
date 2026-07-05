(() => {
  "use strict";

  const filterBar = document.querySelector(".notes-filter");
  const list = document.querySelector(".notes-list");
  if (!filterBar || !list) return;

  const rows = Array.from(list.querySelectorAll(".list-row"));
  const emptyState = list.querySelector(".notes-empty");
  const clearButton = filterBar.querySelector("[data-clear]");
  const categoryButtons = Array.from(filterBar.querySelectorAll(".tag-filter[data-category]"));
  if (!rows.length || !categoryButtons.length) return;

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

  const apply = () => {
    let anyVisible = false;
    for (const row of rows) {
      const visible =
        activeCategories.size === 0 || activeCategories.has(row.dataset.category);
      row.hidden = !visible;
      if (visible) anyVisible = true;
    }

    for (const group of groups) {
      group.header.hidden = group.rows.every((row) => row.hidden);
    }

    if (emptyState) emptyState.hidden = anyVisible;
    if (clearButton) clearButton.setAttribute("aria-pressed", String(activeCategories.size === 0));
  };

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
      apply();
    });
  }

  filterBar.hidden = false;
})();
