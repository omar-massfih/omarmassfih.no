(() => {
  "use strict";

  const form = document.querySelector(".book-filters");
  const results = document.querySelector("[data-book-results]");
  if (!form || !results) return;

  const genre = form.querySelector('[name="genre"]');
  const rating = form.querySelector('[name="rating"]');
  const count = form.querySelector("[data-book-count]");
  const reset = form.querySelector("[data-book-clear]");
  const empty = document.querySelector("[data-book-empty]");
  const cards = [...results.querySelectorAll(".book-card")];
  if (!genre || !rating || !count || !reset || !empty || !cards.length) return;

  const apply = () => {
    let visible = 0;
    for (const card of cards) {
      card.hidden = !(
        (!genre.value || card.dataset.genre === genre.value) &&
        (!rating.value || card.dataset.rating === rating.value)
      );
      if (!card.hidden) visible += 1;
    }
    count.textContent = `${visible} of ${cards.length} ${cards.length === 1 ? "book" : "books"}`;
    empty.hidden = visible !== 0;
    reset.disabled = !(genre.value || rating.value);
  };

  const revealLinkedBook = () => {
    let id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    const card = document.getElementById(id);
    if (!cards.includes(card) || !card.hidden) return;
    form.reset();
    apply();
    card.scrollIntoView({ block: "start" });
  };

  genre.addEventListener("change", apply);
  rating.addEventListener("change", apply);
  form.addEventListener("submit", (event) => event.preventDefault());
  reset.addEventListener("click", () => {
    form.reset();
    apply();
  });
  form.addEventListener("reset", () => queueMicrotask(apply));
  // Browsers may restore form values when returning to the page.
  window.addEventListener("pageshow", () => {
    apply();
    revealLinkedBook();
  });
  window.addEventListener("hashchange", revealLinkedBook);
  apply();
  revealLinkedBook();
  form.hidden = false;
})();
