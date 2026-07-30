import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { TextDecoder, TextEncoder } from "node:util";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/chat.js", import.meta.url), "utf8");
const SESSION_KEY = "notes-chat:v1";

function memoryStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(SESSION_KEY, initial);
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function streamedFetch(frames, requests = []) {
  const encoder = new TextEncoder();
  return async (_url, options) => {
    requests.push(JSON.parse(options.body));
    let sent = false;
    return {
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            async read() {
              if (sent) return { done: true };
              sent = true;
              return { done: false, value: encoder.encode(frames) };
            },
          };
        },
      },
    };
  };
}

function setup({ storage = memoryStorage(), fetch = streamedFetch("") } = {}) {
  const dom = new JSDOM("<main>Notes</main>", { url: "https://example.test/notes/one/" });
  Object.defineProperty(dom.window, "sessionStorage", {
    configurable: true,
    value: storage,
  });
  runInNewContext(script, {
    document: dom.window.document,
    window: dom.window,
    fetch,
    AbortSignal: { timeout: () => ({}) },
    TextDecoder,
    JSON,
    Error,
  });
  return { dom, document: dom.window.document, storage };
}

async function ask({ dom, document }, question) {
  const input = document.querySelector(".chat-input");
  input.value = question;
  document.querySelector(".chat-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true })
  );
  for (let attempt = 0; attempt < 20 && input.disabled; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

const successfulFrames =
  'event: sources\ndata: {"sources":[{"title":"Useful note","url":"/notes/useful/"}]}\n\n' +
  'data: {"delta":"A **helpful** answer."}\n\n' +
  "data: [DONE]\n\n";

test("creates an empty, closed, accessible chat with clear disabled", () => {
  const { document } = setup();
  assert.equal(document.querySelector(".chat-panel").hidden, true);
  assert.equal(document.querySelector(".chat-launcher").getAttribute("aria-expanded"), "false");
  assert.match(document.querySelector(".chat-empty").textContent, /answer questions/);
  assert.equal(document.querySelectorAll(".chat-suggestion").length, 4);
  const clear = document.querySelector(".chat-clear");
  assert.equal(clear.type, "button");
  assert.equal(clear.textContent, "Clear conversation");
  assert.equal(clear.disabled, true);
});

test("persists only a completed streamed turn and backend-supported fields", async () => {
  const requests = [];
  const page = setup({ fetch: streamedFetch(successfulFrames, requests) });
  await ask(page, "What is useful?");

  assert.deepEqual(requests[0], {
    messages: [{ role: "user", content: "What is useful?" }],
  });
  assert.deepEqual(JSON.parse(page.storage.getItem(SESSION_KEY)), [
    { role: "user", content: "What is useful?" },
    {
      role: "assistant",
      content: "A **helpful** answer.",
      sources: [{ title: "Useful note", url: "/notes/useful/" }],
    },
  ]);
  assert.equal(page.document.querySelector(".chat-bubble-assistant strong").textContent, "helpful");
  assert.equal(page.document.querySelector(".chat-sources a").getAttribute("href"), "/notes/useful/");
  assert.equal(page.document.querySelector(".chat-clear").disabled, false);
});

test("bounds a long successful response so the persisted conversation restores", async () => {
  const longAnswer = "a".repeat(4001);
  const storage = memoryStorage();
  const page = setup({
    storage,
    fetch: streamedFetch(`data: ${JSON.stringify({ delta: longAnswer })}\n\n`),
  });
  await ask(page, "Give me a long answer");

  const stored = JSON.parse(storage.getItem(SESSION_KEY));
  assert.equal(stored[1].content.length, 4000);
  assert.equal(page.document.querySelector(".chat-bubble-assistant").textContent.length, 4000);

  const restored = setup({ storage });
  assert.equal(restored.document.querySelectorAll(".chat-bubble").length, 2);
  assert.equal(restored.document.querySelector(".chat-bubble-assistant").textContent.length, 4000);
});

test("restores a conversation and sends its citation-free context in a follow-up", async () => {
  const storage = memoryStorage(JSON.stringify([
    { role: "user", content: "Earlier question" },
    {
      role: "assistant",
      content: "Earlier **answer**",
      sources: [{ title: "Earlier note", url: "https://example.test/notes/earlier/" }],
    },
  ]));
  const requests = [];
  const page = setup({ storage, fetch: streamedFetch('data: {"delta":"Follow-up"}\n\n', requests) });

  assert.equal(page.document.querySelector(".chat-empty").hidden, true);
  assert.equal(page.document.querySelectorAll(".chat-bubble").length, 2);
  assert.equal(page.document.querySelector(".chat-bubble-assistant strong").textContent, "answer");
  assert.equal(page.document.querySelector(".chat-sources a").textContent, "Earlier note");

  await ask(page, "Follow-up question");
  assert.deepEqual(requests[0].messages, [
    { role: "user", content: "Earlier question" },
    { role: "assistant", content: "Earlier **answer**" },
    { role: "user", content: "Follow-up question" },
  ]);
});

test("clear removes stored and rendered conversation and focuses the input", () => {
  const storage = memoryStorage(JSON.stringify([
    { role: "user", content: "Question" },
    { role: "assistant", content: "Answer", sources: [{ title: "Note", url: "/note/" }] },
  ]));
  const { document } = setup({ storage });
  document.querySelector(".chat-clear").click();

  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(document.querySelectorAll(".chat-bubble, .chat-sources").length, 0);
  assert.equal(document.querySelector(".chat-empty").hidden, false);
  assert.equal(document.querySelector(".chat-clear").disabled, true);
  assert.equal(document.activeElement, document.querySelector(".chat-input"));
});

test("a persistence write failure removes restored history before reload", async () => {
  const storage = memoryStorage(JSON.stringify([
    { role: "user", content: "Earlier question" },
    { role: "assistant", content: "Earlier answer", sources: [] },
  ]));
  storage.setItem = () => {
    throw new Error("quota");
  };

  const page = setup({
    storage,
    fetch: streamedFetch('data: {"delta":"Follow-up answer"}\n\n'),
  });
  await ask(page, "Follow-up question");

  assert.equal(storage.getItem(SESSION_KEY), null);
  const reloaded = setup({ storage });
  assert.equal(reloaded.document.querySelectorAll(".chat-bubble").length, 0);
  assert.equal(reloaded.document.querySelector(".chat-clear").disabled, true);
});

test("blocked and write-failing session storage retain ephemeral chat behavior", async () => {
  const blocked = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  const first = setup({ storage: blocked, fetch: streamedFetch(successfulFrames) });
  await ask(first, "Still works");
  assert.equal(first.document.querySelectorAll(".chat-bubble").length, 2);
  first.document.querySelector(".chat-clear").click();
  assert.equal(first.document.querySelectorAll(".chat-bubble").length, 0);

  let writes = 0;
  const writeFailing = memoryStorage();
  writeFailing.setItem = () => {
    writes += 1;
    throw new Error("quota");
  };
  const second = setup({ storage: writeFailing, fetch: streamedFetch(successfulFrames) });
  await ask(second, "First");
  await ask(second, "Second");
  assert.equal(writes, 1);
  assert.equal(second.document.querySelectorAll(".chat-bubble").length, 4);
});

test("discards malformed histories and unsafe restored content", () => {
  const invalidValues = [
    "{broken",
    '{"messages":[]}',
    JSON.stringify([{ role: "assistant", content: "wrong role" }]),
    JSON.stringify([{ role: "user", content: "dangling" }]),
    JSON.stringify(Array.from({ length: 22 }, (_, index) => ({
      role: index % 2 ? "assistant" : "user",
      content: "message",
    }))),
  ];

  for (const value of invalidValues) {
    const { document } = setup({ storage: memoryStorage(value) });
    assert.equal(document.querySelectorAll(".chat-bubble").length, 0);
  }

  const safe = setup({ storage: memoryStorage(JSON.stringify([
    { role: "user", content: "<img src=x onerror=alert(1)>" },
    {
      role: "assistant",
      content: "[bad](javascript:alert(1))",
      sources: [
        { title: "Bad", url: "javascript:alert(1)" },
        { title: "Good", url: "/notes/good/" },
      ],
    },
  ])) });
  assert.equal(safe.document.querySelector("img"), null);
  assert.equal(safe.document.querySelector(".chat-bubble-assistant a"), null);
  assert.equal(safe.document.querySelectorAll(".chat-sources a").length, 1);
});

test("rejects protocol-relative and backslash-normalized restored citations", () => {
  const page = setup({ storage: memoryStorage(JSON.stringify([
    { role: "user", content: "Question" },
    {
      role: "assistant",
      content: "Answer",
      sources: [
        { title: "Protocol relative", url: "//attacker.example/path" },
        { title: "Backslash normalized", url: "/\\attacker.example/path" },
        { title: "Same origin", url: "/notes/safe/" },
        { title: "Explicit HTTPS", url: "https://docs.example/guide" },
      ],
    },
  ])) });

  const links = [...page.document.querySelectorAll(".chat-sources a")];
  assert.deepEqual(links.map((link) => link.textContent), ["Same origin", "Explicit HTTPS"]);
  assert.deepEqual(links.map((link) => link.getAttribute("href")), [
    "/notes/safe/",
    "https://docs.example/guide",
  ]);
});

test("bounds restored citations by count and total size", () => {
  const sources = Array.from({ length: 30 }, (_, index) => ({
    title: index < 2 ? "t".repeat(3990) : `Note ${index}`,
    url: `/notes/${index}/`,
  }));
  const page = setup({ storage: memoryStorage(JSON.stringify([
    { role: "user", content: "Question" },
    { role: "assistant", content: "Answer", sources },
  ])) });

  const links = [...page.document.querySelectorAll(".chat-sources a")];
  assert.equal(links.length, 2);
  assert.deepEqual(links.map((link) => link.textContent), [
    "t".repeat(3990),
    "t".repeat(3990),
  ]);
});

test("bounds citations from successful responses before rendering and persistence", async () => {
  const sources = Array.from({ length: 30 }, (_, index) => ({
    title: `Note ${index}`,
    url: `/notes/${index}/`,
  }));
  const frames =
    `event: sources\ndata: ${JSON.stringify({ sources })}\n\n` +
    'data: {"delta":"Answer"}\n\n';
  const page = setup({ fetch: streamedFetch(frames) });
  await ask(page, "Question");

  assert.equal(page.document.querySelectorAll(".chat-sources a").length, 10);
  assert.equal(JSON.parse(page.storage.getItem(SESSION_KEY))[1].sources.length, 10);
});

test("failed, error-event, and empty answers roll back and remain unpersisted", async () => {
  const cases = [
    async () => ({ ok: false, status: 500, body: null }),
    streamedFetch('data: {"error":"failed"}\n\n'),
    streamedFetch("data: [DONE]\n\n"),
    streamedFetch('data: {"delta":" \\n\\t "}\n\n'),
  ];

  for (const fetch of cases) {
    const page = setup({ fetch });
    await ask(page, "Do not retain");
    assert.equal(page.storage.getItem(SESSION_KEY), null);
    assert.equal(page.document.querySelector(".chat-clear").disabled, true);
    assert.match(page.document.querySelector(".chat-bubble-assistant").textContent, /went wrong/);
  }
});

test("trims extended history to the limit and keeps a user-first request", async () => {
  const history = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `message ${index}`,
    ...(index % 2 ? { sources: [] } : {}),
  }));
  const requests = [];
  const page = setup({
    storage: memoryStorage(JSON.stringify(history)),
    fetch: streamedFetch('data: {"delta":"new answer"}\n\n', requests),
  });
  await ask(page, "new question");

  assert.equal(requests[0].messages.length, 19);
  assert.equal(requests[0].messages[0].role, "user");
  const stored = JSON.parse(page.storage.getItem(SESSION_KEY));
  assert.equal(stored.length, 20);
  assert.equal(stored[0].role, "user");
  assert.ok(stored.every(({ role, content }) =>
    (role === "user" || role === "assistant") && typeof content === "string"
  ));
});
