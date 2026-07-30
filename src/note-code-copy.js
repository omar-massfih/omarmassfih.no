(() => {
  const RESET_DELAY = 2000;

  const enhanceNoteCodeBlocks = () => {
    document.querySelectorAll("main.note pre > code").forEach((code, index) => {
      const pre = code.parentElement;
      if (!pre || pre.dataset.copyEnhanced === "true") return;

      const wrapper = document.createElement("div");
      wrapper.className = "code-block";

      const controls = document.createElement("div");
      controls.className = "code-block-controls";

      const status = document.createElement("span");
      status.className = "code-copy-status";
      status.id = `code-copy-status-${index + 1}`;
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy-button";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code to clipboard");
      button.setAttribute("aria-describedby", status.id);

      let resetTimer;
      const setState = (message, state) => {
        window.clearTimeout(resetTimer);
        button.textContent = message || "Copy";
        status.textContent = message;
        button.dataset.state = state || "";

        if (message) {
          resetTimer = window.setTimeout(() => setState("", ""), RESET_DELAY);
        }
      };

      button.addEventListener("click", async () => {
        try {
          if (!navigator.clipboard?.writeText) {
            throw new Error("Clipboard API unavailable");
          }
          await navigator.clipboard.writeText(code.textContent);
          setState("Copied", "success");
        } catch {
          setState("Copy failed", "error");
        }
      });

      pre.before(wrapper);
      wrapper.append(pre, controls);
      controls.append(status, button);
      pre.dataset.copyEnhanced = "true";
    });
  };

  window.enhanceNoteCodeBlocks = enhanceNoteCodeBlocks;
  enhanceNoteCodeBlocks();
})();
