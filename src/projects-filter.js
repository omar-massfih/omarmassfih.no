(() => {
  "use strict";

  const form = document.querySelector(".project-filter");
  const results = document.querySelector("[data-project-results]");
  if (!form || !results) return;

  const technologySelect = form.querySelector('[name="technology"]');
  const sourceSelect = form.querySelector('[name="source"]');
  const count = form.querySelector("[data-project-count]");
  const emptyState = document.querySelector("[data-project-empty]");
  const cards = Array.from(results.querySelectorAll(".project-box"));
  const featuredCard = results.querySelector(".project-box--featured");
  const featuredRegion = featuredCard?.closest(".featured-project-region");
  const clearButtons = Array.from(document.querySelectorAll("[data-project-clear]"));
  if (!technologySelect || !sourceSelect || !count || !emptyState || !cards.length) return;

  const options = (select) => new Set(Array.from(select.options, (option) => option.value));
  const validTechnologies = options(technologySelect);
  const validSources = options(sourceSelect);

  const cardTechnologies = new Map();
  try {
    for (const card of cards) {
      const tags = JSON.parse(card.dataset.technologies || "[]");
      cardTechnologies.set(card, Array.isArray(tags) ? tags : []);
    }
  } catch {
    return;
  }

  const updateUrl = (mode) => {
    const url = new URL(window.location.href);
    for (const [name, value] of [
      ["technology", technologySelect.value],
      ["source", sourceSelect.value],
    ]) {
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    }
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
  };

  const apply = ({ historyMode } = {}) => {
    const technology = technologySelect.value;
    const source = sourceSelect.value;
    let visible = 0;

    for (const card of cards) {
      const matchesTechnology =
        !technology || cardTechnologies.get(card).includes(technology);
      const matchesSource = !source || card.dataset.source === source;
      card.hidden = !(matchesTechnology && matchesSource);
      if (!card.hidden) visible += 1;
    }
    if (featuredRegion && featuredCard) featuredRegion.hidden = featuredCard.hidden;

    const noun = cards.length === 1 ? "project" : "projects";
    count.textContent = `${visible} of ${cards.length} ${noun}`;
    emptyState.hidden = visible !== 0;
    const active = Boolean(technology || source);
    for (const button of clearButtons) button.disabled = !active;
    if (historyMode) updateUrl(historyMode);
  };

  const readUrl = ({ canonicalize = false } = {}) => {
    const params = new URLSearchParams(window.location.search);
    const technology = params.get("technology") || "";
    const source = params.get("source") || "";
    technologySelect.value = validTechnologies.has(technology) ? technology : "";
    sourceSelect.value = validSources.has(source) ? source : "";
    apply();
    if (
      canonicalize &&
      ((technology && technologySelect.value !== technology) ||
        (source && sourceSelect.value !== source))
    ) {
      updateUrl("replace");
    }
  };

  technologySelect.addEventListener("change", () => apply({ historyMode: "push" }));
  sourceSelect.addEventListener("change", () => apply({ historyMode: "push" }));
  for (const button of clearButtons) {
    button.addEventListener("click", () => {
      technologySelect.value = "";
      sourceSelect.value = "";
      apply({ historyMode: "push" });
    });
  }
  window.addEventListener("popstate", () => readUrl());

  readUrl({ canonicalize: true });
  form.hidden = false;
})();
