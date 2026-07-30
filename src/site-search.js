(() => {
  "use strict";

  const trigger = document.getElementById("site-search-trigger");
  const dialog = document.getElementById("site-search-dialog");
  const input = document.getElementById("site-search-input");
  const results = document.getElementById("site-search-results");
  const status = document.getElementById("site-search-status");
  const closeButton = dialog?.querySelector(".site-search-close");
  if (!trigger || !dialog || !input || !results || !status || !closeButton) return;

  const labels = { note: "Notes", project: "Projects", skill: "Skills" };
  const types = ["note", "project", "skill"];
  let index;
  let loading;
  let activeIndex = -1;
  let resultLinks = [];
  let open = false;

  const normalize = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  const isEditable = (element) =>
    element?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element?.tagName || "");

  const setStatus = (message) => {
    status.textContent = message;
  };

  const clearResults = () => {
    results.replaceChildren();
    resultLinks = [];
    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
    input.setAttribute("aria-expanded", "false");
  };

  const loadIndex = async () => {
    if (index) return index;
    if (!loading) {
      loading = fetch("/search-index.json", { headers: { Accept: "application/json" } })
        .then((response) => {
          if (!response.ok) throw new Error(`Search index returned ${response.status}`);
          return response.json();
        })
        .then((data) => {
          if (!Array.isArray(data)) throw new Error("Invalid search index");
          index = data;
          return index;
        })
        .finally(() => {
          loading = undefined;
        });
    }
    return loading;
  };

  const score = (item, query) => {
    const title = normalize(item.title);
    if (title === query) return 0;
    if (title.startsWith(query)) return 1;
    if (title.includes(query)) return 2;
    return 3;
  };

  const setActive = (next) => {
    if (!resultLinks.length) return;
    activeIndex = Math.max(0, Math.min(next, resultLinks.length - 1));
    resultLinks.forEach((link, position) => {
      const active = position === activeIndex;
      link.setAttribute("aria-selected", String(active));
      link.classList.toggle("is-active", active);
    });
    const active = resultLinks[activeIndex];
    input.setAttribute("aria-activedescendant", active.id);
    active.scrollIntoView?.({ block: "nearest" });
  };

  const render = () => {
    clearResults();
    const query = normalize(input.value);
    if (query.length < 2) {
      setStatus("Enter at least two characters to search.");
      return;
    }
    if (!index) return;

    const tokens = query.split(" ");
    const matches = index
      .map((item, position) => ({ item, position, score: score(item, query) }))
      .filter(({ item }) => tokens.every((token) => normalize(item.searchText).includes(token)))
      .sort((a, b) => a.score - b.score || a.position - b.position);

    for (const type of types) {
      const groupMatches = matches.filter(({ item }) => item.type === type).slice(0, 6);
      if (!groupMatches.length) continue;
      const section = document.createElement("section");
      section.className = "site-search-group";
      section.setAttribute("role", "group");
      const heading = document.createElement("h3");
      heading.id = `site-search-group-${type}`;
      heading.textContent = labels[type];
      section.setAttribute("aria-labelledby", heading.id);
      section.append(heading);
      for (const { item } of groupMatches) {
        const link = document.createElement("a");
        link.className = "site-search-result";
        link.id = `site-search-result-${resultLinks.length}`;
        link.href = item.url;
        link.setAttribute("role", "option");
        link.setAttribute("aria-selected", "false");
        const title = document.createElement("span");
        title.className = "site-search-result-title";
        title.textContent = item.title;
        link.append(title);
        if (item.summary) {
          const summary = document.createElement("span");
          summary.className = "site-search-result-summary";
          summary.textContent = item.summary;
          link.append(summary);
        }
        section.append(link);
        resultLinks.push(link);
      }
      results.append(section);
    }

    input.setAttribute("aria-expanded", String(resultLinks.length > 0));
    setStatus(resultLinks.length
      ? `${resultLinks.length} result${resultLinks.length === 1 ? "" : "s"} found.`
      : `No results found for “${input.value.trim()}”.`);
  };

  const close = () => {
    if (!open) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else {
      dialog.removeAttribute("open");
      dialog.hidden = true;
      open = false;
      input.value = "";
      clearResults();
      setStatus("Enter at least two characters to search.");
      trigger.focus();
    }
  };

  const afterClose = () => {
    open = false;
    input.value = "";
    clearResults();
    setStatus("Enter at least two characters to search.");
    trigger.focus();
  };

  const show = async () => {
    if (!open) {
      open = true;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else {
        dialog.hidden = false;
        dialog.setAttribute("open", "");
      }
    }
    input.focus();
    input.select();
    setStatus("Loading search index…");
    try {
      await loadIndex();
      render();
    } catch {
      index = undefined;
      clearResults();
      setStatus("Search could not be loaded. Close and reopen to retry.");
    }
  };

  trigger.addEventListener("click", show);
  closeButton.addEventListener("click", close);
  dialog.addEventListener("close", afterClose);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  input.addEventListener("input", render);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex < 0 ? resultLinks.length - 1 : activeIndex - 1);
    } else if (event.key === "Home" && resultLinks.length) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End" && resultLinks.length) {
      event.preventDefault();
      setActive(resultLinks.length - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      resultLinks[activeIndex].click();
    }
  });
  results.addEventListener("pointermove", (event) => {
    const link = event.target.closest?.(".site-search-result");
    const position = resultLinks.indexOf(link);
    if (position >= 0) setActive(position);
  });
  results.addEventListener("click", (event) => {
    if (event.target.closest?.(".site-search-result")) close();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" &&
        !isEditable(document.activeElement)) {
      event.preventDefault();
      show();
    }
  });

  dialog.hidden = false;
  trigger.hidden = false;
})();
