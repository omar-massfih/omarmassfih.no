(() => {
  "use strict";

  // Mirrors DEFAULT_BACKEND_URL in lib/notesLoader.js; the localStorage
  // override exists so the widget can point at a local backend during dev.
  const BACKEND_URL =
    window.localStorage.getItem("notesChatBackendUrl") || "https://backend.omarmassfih.no";
  const MAX_MESSAGE_LENGTH = 4000;
  const MAX_HISTORY = 20;

  const container = document.querySelector(".notes-chat");
  if (!container) return;

  const messages = [];

  const log = document.createElement("div");
  log.className = "chat-log";
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "chat-form";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "chat-input";
  input.placeholder = "Ask about the notes…";
  input.maxLength = MAX_MESSAGE_LENGTH;
  input.setAttribute("aria-label", "Ask a question about the notes");

  const button = document.createElement("button");
  button.type = "submit";
  button.className = "chat-send";
  button.textContent = "Ask";

  form.append(input, button);
  container.append(log, form);

  function addBubble(role) {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble chat-bubble-${role}`;
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function renderText(bubble, text) {
    bubble.replaceChildren();
    for (const paragraph of text.split("\n\n")) {
      const p = document.createElement("p");
      p.textContent = paragraph;
      bubble.append(p);
    }
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
      renderSources(payload.sources);
    } else if (payload.delta) {
      state.answer += payload.delta;
      renderText(bubble, state.answer);
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

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();

    const question = input.value.trim();
    if (!question || input.disabled) return;

    messages.push({ role: "user", content: question });
    while (messages.length > MAX_HISTORY) messages.shift();
    if (messages[0] && messages[0].role !== "user") messages.shift();

    renderText(addBubble("user"), question);
    input.value = "";
    setBusy(true);

    const bubble = addBubble("assistant");
    renderText(bubble, "…");
    const state = { answer: "", failed: false };

    try {
      await streamAnswer(bubble, state);
      if (state.failed || !state.answer) {
        renderText(bubble, "Something went wrong, please try again.");
        messages.pop();
      } else {
        messages.push({ role: "assistant", content: state.answer });
      }
    } catch {
      renderText(bubble, "Something went wrong, please try again.");
      messages.pop();
    } finally {
      setBusy(false);
    }
  });
})();
