(() => {
  const RESET_DELAY = 2000;

  const enhanceNoteShare = () => {
    const panel = document.querySelector("[data-note-share]");
    const canonical = document.querySelector('link[rel="canonical"]');
    const copyButton = panel?.querySelector("[data-note-share-copy]");
    const shareButton = panel?.querySelector("[data-note-share-native]");
    const status = panel?.querySelector("[data-note-share-status]");

    if (!panel || !canonical || !copyButton || !shareButton || !status) return;
    if (panel.dataset.shareEnhanced === "true") return;

    const url = canonical.href;
    const title = panel.dataset.shareTitle || document.title;
    if (!url) return;

    panel.dataset.shareEnhanced = "true";
    copyButton.hidden = false;
    shareButton.hidden = typeof navigator.share !== "function";

    let resetTimer;
    const announce = (message, state = "") => {
      window.clearTimeout(resetTimer);
      status.textContent = message;
      status.dataset.state = state;
      if (message) {
        resetTimer = window.setTimeout(() => announce(""), RESET_DELAY);
      }
    };

    copyButton.addEventListener("click", async () => {
      try {
        if (typeof navigator.clipboard?.writeText !== "function") {
          throw new Error("Clipboard API unavailable");
        }
        await navigator.clipboard.writeText(url);
        announce("Link copied", "success");
      } catch {
        announce("Could not copy link. Try the email option instead.", "error");
      }
    });

    shareButton.addEventListener("click", async () => {
      try {
        await navigator.share({ title, url });
        announce("Note shared", "success");
      } catch (error) {
        if (error?.name !== "AbortError") {
          announce("Could not share this note. Try copying the link instead.", "error");
        }
      }
    });
  };

  window.enhanceNoteShare = enhanceNoteShare;
  enhanceNoteShare();
})();
