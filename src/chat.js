(() => {
  "use strict";

  // Mirrors DEFAULT_BACKEND_URL in lib/notesLoader.js; the localStorage
  // override exists so the widget can point at a local backend during dev.
  const BACKEND_URL =
    window.localStorage.getItem("notesChatBackendUrl") || "https://backend.omarmassfih.no";
  const MAX_MESSAGE_LENGTH = 4000;
  const MAX_HISTORY = 20;

  const messages = [];

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "chat-launcher";
  launcher.setAttribute("aria-label", "Open notes chatbot");
  launcher.setAttribute("aria-controls", "notes-chat-panel");
  launcher.setAttribute("aria-expanded", "false");
  launcher.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>' +
    "</svg>";

  const panel = document.createElement("section");
  panel.id = "notes-chat-panel";
  panel.className = "chat-panel";
  panel.setAttribute("aria-label", "Notes chatbot");
  panel.hidden = true;

  const header = document.createElement("div");
  header.className = "chat-panel-head";

  const title = document.createElement("h2");
  title.textContent = "Ask the notes";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "chat-close";
  closeButton.setAttribute("aria-label", "Close notes chatbot");
  closeButton.textContent = "×";

  const body = document.createElement("div");
  body.className = "chat-body";

  const empty = document.createElement("div");
  empty.className = "chat-empty";

  const greeting = document.createElement("p");
  greeting.textContent = "Hi! I can answer questions about Omar's notes.";
  empty.append(greeting);

  const suggestions = [
    "What's the difference between a fault and a failure?",
    "Why split documents into chunks for RAG?",
    "What are the three laws of software architecture?",
    "How do you protect an app with oauth2-proxy on Kubernetes?",
  ];

  for (const suggestion of suggestions) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chat-suggestion";
    chip.textContent = suggestion;
    chip.addEventListener("click", () => {
      input.value = suggestion;
      form.requestSubmit();
    });
    empty.append(chip);
  }

  const log = document.createElement("div");
  log.className = "chat-log";
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "chat-form";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "chat-input";
  input.placeholder = "Ask about the notes...";
  input.maxLength = MAX_MESSAGE_LENGTH;
  input.setAttribute("aria-label", "Ask a question about the notes");

  const button = document.createElement("button");
  button.type = "submit";
  button.className = "chat-send";
  button.textContent = "Ask";

  header.append(title, closeButton);
  body.append(empty, log);
  form.append(input, button);
  panel.append(header, body, form);
  document.body.append(launcher, panel);

  function setOpen(open) {
    panel.hidden = !open;
    launcher.hidden = open;
    launcher.setAttribute("aria-expanded", String(open));

    if (open) {
      input.focus();
    } else {
      launcher.focus();
    }
  }

  function addBubble(role) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble-${role}`;
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function appendInlineMarkdown(parent, text) {
    const pattern =
      /(`[^`]+`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*)/g;
    let cursor = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) {
        parent.append(document.createTextNode(text.slice(cursor, match.index)));
      }

      if (match[0].startsWith("`")) {
        const code = document.createElement("code");
        code.textContent = match[0].slice(1, -1);
        parent.append(code);
      } else if (match[0].startsWith("**")) {
        const strong = document.createElement("strong");
        appendInlineMarkdown(strong, match[4]);
        parent.append(strong);
      } else if (match[0].startsWith("*")) {
        const em = document.createElement("em");
        appendInlineMarkdown(em, match[5]);
        parent.append(em);
      } else {
        const href = match[3].trim();
        const isSafeHref =
          href.startsWith("/") ||
          href.startsWith("#") ||
          href.startsWith("https://") ||
          href.startsWith("http://") ||
          href.startsWith("mailto:");

        if (isSafeHref) {
          const link = document.createElement("a");
          link.href = href;
          link.textContent = match[2];
          if (href.startsWith("http")) {
            link.rel = "noopener noreferrer";
          }
          parent.append(link);
        } else {
          parent.append(document.createTextNode(match[0]));
        }
      }

      cursor = pattern.lastIndex;
    }

    if (cursor < text.length) {
      parent.append(document.createTextNode(text.slice(cursor)));
    }
  }

  function renderParagraph(bubble, lines) {
    const p = document.createElement("p");
    appendInlineMarkdown(p, lines.join(" ").trim());
    bubble.append(p);
  }

  function renderMarkdown(bubble, text) {
    bubble.replaceChildren();

    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) continue;

      if (trimmed.startsWith("```")) {
        const codeLines = [];
        index += 1;
        while (index < lines.length && !lines[index].trim().startsWith("```")) {
          codeLines.push(lines[index]);
          index += 1;
        }

        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = codeLines.join("\n");
        pre.append(code);
        bubble.append(pre);
        continue;
      }

      const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
      const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (unorderedMatch || orderedMatch) {
        const list = document.createElement(unorderedMatch ? "ul" : "ol");
        const listPattern = unorderedMatch ? /^[-*]\s+(.+)$/ : /^\d+[.)]\s+(.+)$/;

        while (index < lines.length) {
          const itemMatch = lines[index].trim().match(listPattern);
          if (!itemMatch) break;

          const item = document.createElement("li");
          appendInlineMarkdown(item, itemMatch[1]);
          list.append(item);
          index += 1;
        }

        index -= 1;
        bubble.append(list);
        continue;
      }

      const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/);
      if (headingMatch) {
        const heading = document.createElement("h3");
        appendInlineMarkdown(heading, headingMatch[1]);
        bubble.append(heading);
        continue;
      }

      const paragraph = [trimmed];
      while (index + 1 < lines.length) {
        const next = lines[index + 1].trim();
        if (
          !next ||
          next.startsWith("```") ||
          /^[-*]\s+/.test(next) ||
          /^\d+[.)]\s+/.test(next) ||
          /^#{1,3}\s+/.test(next)
        ) {
          break;
        }
        paragraph.push(next);
        index += 1;
      }
      renderParagraph(bubble, paragraph);
    }

    log.scrollTop = log.scrollHeight;
  }

  function renderText(bubble, text, { markdown = false } = {}) {
    bubble.classList.remove("is-loading");

    if (markdown) {
      renderMarkdown(bubble, text);
      return;
    }

    bubble.replaceChildren();
    for (const paragraph of text.split("\n\n")) {
      const p = document.createElement("p");
      p.textContent = paragraph;
      bubble.append(p);
    }
    log.scrollTop = log.scrollHeight;
  }

  function renderLoading(bubble) {
    bubble.classList.add("is-loading");
    bubble.replaceChildren();

    const loader = document.createElement("span");
    loader.className = "chat-loading";
    loader.setAttribute("aria-label", "Waiting for answer");

    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement("span");
      dot.className = "chat-loading-dot";
      dot.setAttribute("aria-hidden", "true");
      loader.append(dot);
    }

    bubble.append(loader);
    log.scrollTop = log.scrollHeight;
  }

  function renderSources(sources) {
    if (!Array.isArray(sources) || sources.length === 0) return;

    const row = document.createElement("p");
    row.className = "chat-sources";
    row.append("Sources: ");

    sources.forEach((source, index) => {
      if (index > 0) row.append(", ");
      const link = document.createElement("a");
      link.href = source.url;
      link.textContent = source.title;
      row.append(link);
    });

    log.append(row);
    log.scrollTop = log.scrollHeight;
  }

  function setBusy(busy) {
    input.disabled = busy;
    button.disabled = busy;
    closeButton.disabled = busy;
    if (!busy) input.focus();
  }

  function handleFrame(frame, bubble, state) {
    let event = null;
    let data = "";

    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data = line.slice(5).trim();
    }

    if (!data || data === "[DONE]") return;

    const payload = JSON.parse(data);
    if (event === "sources") {
      state.sources = payload.sources;
    } else if (payload.delta) {
      state.answer += payload.delta;
      renderText(bubble, state.answer, { markdown: true });
    } else if (payload.error) {
      state.failed = true;
    }
  }

  async function streamAnswer(bubble, state) {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`chat request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (frame.trim()) handleFrame(frame, bubble, state);
      }
    }
  }

  launcher.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden && !input.disabled) {
      setOpen(false);
    }
  });

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();

    const question = input.value.trim();
    if (!question || input.disabled) return;

    empty.hidden = true;
    messages.push({ role: "user", content: question });
    while (messages.length > MAX_HISTORY) messages.shift();
    if (messages[0] && messages[0].role !== "user") messages.shift();

    renderText(addBubble("user"), question);
    input.value = "";
    setBusy(true);

    const bubble = addBubble("assistant");
    renderLoading(bubble);
    const state = { answer: "", failed: false, sources: [] };

    try {
      await streamAnswer(bubble, state);
      if (state.failed || !state.answer) {
        renderText(bubble, "Something went wrong, please try again.");
        messages.pop();
      } else {
        messages.push({ role: "assistant", content: state.answer });
        renderSources(state.sources);
      }
    } catch {
      renderText(bubble, "Something went wrong, please try again.");
      messages.pop();
    } finally {
      setBusy(false);
    }
  });
})();
