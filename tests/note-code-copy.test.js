import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { JSDOM } from "jsdom";

const script = await readFile(new URL("../src/note-code-copy.js", import.meta.url), "utf8");

const setup = ({ clipboard } = {}) => {
  const dom = new JSDOM(`
    <main class="note">
      <p>Use <code>inline()</code> here.</p>
      <pre><code class="language-bash hljs"><span class="hljs-built_in">printf</span> '&lt;tag&gt; &amp; value'
  echo "$HOME"</code></pre>
      <pre><code>plain
  indented
</code></pre>
    </main>
    <aside><pre><code>outside</code></pre></aside>
  `);
  const timers = new Map();
  let nextTimer = 1;
  dom.window.setTimeout = (callback) => {
    const id = nextTimer++;
    timers.set(id, callback);
    return id;
  };
  dom.window.clearTimeout = (id) => timers.delete(id);

  const navigator = clipboard === undefined ? {} : { clipboard };
  runInNewContext(script, {
    document: dom.window.document,
    window: dom.window,
    navigator,
    Error,
  });

  const flushTimers = () => {
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach((callback) => callback());
  };

  return { dom, document: dom.window.document, flushTimers };
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("enhances every note code block without changing its code", () => {
  const { document } = setup({ clipboard: { writeText() {} } });
  const blocks = [...document.querySelectorAll("main.note pre > code")];

  assert.equal(document.querySelectorAll(".code-block").length, 2);
  assert.equal(document.querySelectorAll(".code-copy-button").length, 2);
  assert.equal(document.querySelectorAll("aside .code-copy-button").length, 0);
  assert.equal(document.querySelector("p .code-copy-button"), null);
  assert.equal(blocks[0].className, "language-bash hljs");
  assert.equal(blocks[0].querySelector(".hljs-built_in").textContent, "printf");
  assert.equal(blocks[0].textContent, `printf '<tag> & value'\n  echo "$HOME"`);
});

test("copies exact text independently for each block", async () => {
  const copied = [];
  const { document } = setup({
    clipboard: { writeText: async (value) => copied.push(value) },
  });
  const buttons = [...document.querySelectorAll(".code-copy-button")];

  buttons[0].click();
  buttons[1].click();
  await settle();

  assert.deepEqual(copied, [
    `printf '<tag> & value'\n  echo "$HOME"`,
    "plain\n  indented\n",
  ]);
  assert.equal(buttons[0].textContent, "Copied");
  assert.equal(buttons[1].textContent, "Copied");
});

test("provides native controls and visible polite status feedback", async () => {
  const { document, flushTimers } = setup({
    clipboard: { writeText: async () => {} },
  });
  const button = document.querySelector(".code-copy-button");
  const status = document.getElementById(button.getAttribute("aria-describedby"));

  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.type, "button");
  assert.equal(button.getAttribute("aria-label"), "Copy code to clipboard");
  assert.equal(status.getAttribute("role"), "status");
  assert.equal(status.getAttribute("aria-live"), "polite");
  assert.equal(status.classList.contains("visually-hidden"), false);

  button.click();
  await settle();
  assert.equal(status.textContent, "Copied");
  assert.equal(button.dataset.state, "success");

  flushTimers();
  assert.equal(button.textContent, "Copy");
  assert.equal(status.textContent, "");
  assert.equal(button.dataset.state, "");
});

test("reports clipboard rejection without an unhandled rejection", async () => {
  const { document } = setup({
    clipboard: { writeText: async () => { throw new Error("denied"); } },
  });
  const button = document.querySelector(".code-copy-button");

  button.click();
  await settle();

  assert.equal(button.textContent, "Copy failed");
  assert.equal(button.dataset.state, "error");
  assert.equal(
    document.getElementById(button.getAttribute("aria-describedby")).textContent,
    "Copy failed"
  );
});

test("reports an unavailable Clipboard API", async () => {
  const { document } = setup();
  const button = document.querySelector(".code-copy-button");

  button.click();
  await settle();

  assert.equal(button.textContent, "Copy failed");
});

test("initialization is idempotent and handles a native click event", async () => {
  let calls = 0;
  const { document, dom } = setup({
    clipboard: { writeText: async () => { calls += 1; } },
  });

  dom.window.enhanceNoteCodeBlocks();
  assert.equal(document.querySelectorAll(".code-copy-button").length, 2);

  document.querySelector(".code-copy-button").dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true })
  );
  await settle();
  assert.equal(calls, 1);
});
