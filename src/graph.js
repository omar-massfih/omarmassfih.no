(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  const TAG_RADIUS = 4.5;
  const LINK_REST_LENGTH = 70;
  const REPULSION = 2600;
  // Notes carry wide labels; push note pairs harder apart so labels stay legible.
  const NOTE_PAIR_REPULSION = 3;
  const SPRING = 0.06;
  const CENTERING = 0.012;
  const DAMPING = 0.85;
  const MAX_VELOCITY = 12;
  const MAX_TICKS = 300;
  const PRERUN_TICKS = 40;
  const SETTLED_ENERGY = 0.02;
  // Extra clearance around each node's label box in the collision pass.
  const COLLIDE_PADDING = 6;
  // Collision relaxation iterations per tick; higher untangles dense clusters.
  const COLLIDE_ITERATIONS = 4;
  const DRAG_THRESHOLD = 4;
  const ZOOM_STEP = 1.4;
  const MAX_ZOOM_IN = 4;
  const MAX_ZOOM_OUT = 3;
  const CROWDED_NODE_COUNT = 40;

  function neighborhood(graph, rootId) {
    // Root note -> its tags -> notes sharing those tags, plus links between kept nodes.
    const keep = new Set([rootId]);

    for (const link of graph.links) {
      if (link.source === rootId) keep.add(link.target);
      if (link.target === rootId) keep.add(link.source);
    }

    for (const link of graph.links) {
      if (keep.has(link.target) && link.target.startsWith("tag:")) keep.add(link.source);
      if (keep.has(link.source) && link.source.startsWith("tag:")) keep.add(link.target);
    }

    return {
      nodes: graph.nodes.filter((node) => keep.has(node.id)),
      links: graph.links.filter((link) => keep.has(link.source) && keep.has(link.target)),
    };
  }

  function seedPositions(nodes) {
    nodes.forEach((node, index) => {
      if (typeof node.x === "number") return;
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = 40 + 12 * (index % 3);
      node.x = Math.cos(angle) * radius;
      node.y = Math.sin(angle) * radius;
      node.vx = 0;
      node.vy = 0;
    });
  }

  function createTick(nodes, springs) {
    return () => {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = Math.max(dx * dx + dy * dy, 25);
          const boost = a.type === "note" && b.type === "note" ? NOTE_PAIR_REPULSION : 1;
          const force = (REPULSION * boost) / distSq;
          const dist = Math.sqrt(distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      for (const [a, b] of springs) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const rest = b.type === "tag" || a.type === "tag" ? LINK_REST_LENGTH * 0.85 : LINK_REST_LENGTH;
        const force = SPRING * (dist - rest);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      let energy = 0;

      for (const node of nodes) {
        if (node.pinned) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }
        node.vx = (node.vx - node.x * CENTERING) * DAMPING;
        node.vy = (node.vy - node.y * CENTERING) * DAMPING;
        const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
        if (speed > MAX_VELOCITY) {
          node.vx = (node.vx / speed) * MAX_VELOCITY;
          node.vy = (node.vy / speed) * MAX_VELOCITY;
        }
        node.x += node.vx;
        node.y += node.vy;
        energy += node.vx * node.vx + node.vy * node.vy;
      }

      // Hard collision pass. Each node's footprint is a box that includes
      // its label (wide, and hanging below the circle), so tags never land
      // on a note's title. Overlapping boxes separate along whichever axis
      // they overlap least. Iterated a few times so resolving one pair can't
      // leave a node stacked on a third in dense clusters.
      for (let pass = 0; pass < COLLIDE_ITERATIONS; pass++) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;

            const penX = a.halfW + b.halfW - Math.abs(dx);
            if (penX <= 0) continue;
            const penY =
              Math.min(a.y + a.bottom, b.y + b.bottom) - Math.max(a.y - a.top, b.y - b.top);
            if (penY <= 0) continue;

            if (penX < penY) {
              const shift = penX * (dx < 0 ? -0.5 : 0.5);
              if (a.pinned) b.x += shift * 2;
              else if (b.pinned) a.x -= shift * 2;
              else {
                a.x -= shift;
                b.x += shift;
              }
            } else {
              const shift = penY * (dy < 0 ? -0.5 : 0.5);
              if (a.pinned) b.y += shift * 2;
              else if (b.pinned) a.y -= shift * 2;
              else {
                a.y -= shift;
                b.y += shift;
              }
            }
          }
        }
      }

      return energy / nodes.length;
    };
  }

  function render(container, graph, rootId, fullGraph) {
    const nodes = graph.nodes;
    const links = graph.links;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Full-graph indexes: degree drives node size, the tag/note link maps drive expansion.
    const degree = new Map();
    const notesByTag = new Map();
    const noteLinksById = new Map();

    for (const link of fullGraph.links) {
      degree.set(link.source, (degree.get(link.source) || 0) + 1);
      degree.set(link.target, (degree.get(link.target) || 0) + 1);
      if (!notesByTag.has(link.target)) notesByTag.set(link.target, []);
      notesByTag.get(link.target).push(link);
      if (!noteLinksById.has(link.source)) noteLinksById.set(link.source, []);
      noteLinksById.get(link.source).push(link);
    }

    const fullNodeById = new Map(fullGraph.nodes.map((node) => [node.id, node]));

    let byId = new Map(nodes.map((node) => [node.id, node]));
    let linkEnds = [];
    let neighbors = new Map();
    let tick = null;
    let ticks = 0;
    let running = false;
    let dragNode = null;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("role", "group");

    const linkGroup = document.createElementNS(SVG_NS, "g");
    svg.appendChild(linkGroup);

    const linkEls = [];
    const nodeEls = new Map();

    const createLinkEl = () => {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("class", "graph-link");
      linkGroup.appendChild(line);
      linkEls.push(line);
      return line;
    };

    // A tag is expandable while its 2-hop neighborhood (its notes, plus those
    // notes' other tags) is not fully in view.
    const tagHasHiddenNeighborhood = (tagId) =>
      (notesByTag.get(tagId) || []).some(
        (link) =>
          !byId.has(link.source) ||
          (noteLinksById.get(link.source) || []).some((noteLink) => !byId.has(noteLink.target))
      );

    const createNodeEl = (node) => {
      node.r =
        node.type === "note"
          ? Math.min(13, 5.5 + 2 * Math.sqrt(degree.get(node.id) || 0))
          : TAG_RADIUS;

      // Collision footprint: a box around the circle and its label. The label
      // is centered under the node, so it widens halfW and extends bottom.
      const fontPx = node.type === "note" ? 11.2 : 9.9;
      const labelDy = node.type === "note" ? node.r + 14 : TAG_RADIUS + 12;
      const labelHalfW = Math.min((node.label.length * fontPx * 0.55) / 2, 130);
      node.halfW = Math.max(node.r, labelHalfW) + COLLIDE_PADDING;
      node.top = node.r + COLLIDE_PADDING;
      node.bottom = labelDy + fontPx * 0.4 + COLLIDE_PADDING;

      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("class", `graph-node graph-node--${node.type}`);
      group.dataset.id = node.id;

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", node.r);

      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dy", labelDy);
      text.textContent = node.label;

      if (node.type === "note" && node.id !== rootId) {
        const anchor = document.createElementNS(SVG_NS, "a");
        anchor.setAttribute("href", node.url);
        anchor.appendChild(circle);
        anchor.appendChild(text);
        group.appendChild(anchor);
      } else if (node.type === "note") {
        group.classList.add("is-current");
        group.setAttribute("aria-current", "page");
        group.appendChild(circle);
        group.appendChild(text);
      } else {
        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = node.label;
        group.appendChild(title);
        group.appendChild(circle);
        group.appendChild(text);

        if (tagHasHiddenNeighborhood(node.id)) {
          group.classList.add("is-expandable");
          group.setAttribute("role", "button");
          group.setAttribute("tabindex", "0");
          group.setAttribute("aria-label", `Tag: ${node.label}. Show related notes and tags`);
          group.addEventListener("click", () => expandTag(node.id));
          group.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              expandTag(node.id);
            }
          });
        } else {
          group.setAttribute("role", "img");
          group.setAttribute("aria-label", `Tag: ${node.label}`);
        }
      }

      svg.appendChild(group);
      nodeEls.set(node.id, group);
      bindHighlight(node, group);
      return group;
    };

    const setHighlight = (activeId) => {
      const active = activeId ? neighbors.get(activeId) : null;

      nodeEls.forEach((el, id) => {
        el.classList.toggle("is-dimmed", Boolean(active) && !active.has(id));
        el.classList.toggle("is-active", Boolean(active) && active.has(id));
      });
      linkEls.forEach((el, index) => {
        const { source, target } = links[index];
        const touches = Boolean(active) && (source === activeId || target === activeId);
        el.classList.toggle("is-dimmed", Boolean(active) && !touches);
        el.classList.toggle("is-active", touches);
      });
    };

    function bindHighlight(node, el) {
      el.addEventListener("pointerenter", () => setHighlight(node.id));
      el.addEventListener("pointerleave", () => setHighlight(null));
      el.addEventListener("focusin", () => setHighlight(node.id));
      el.addEventListener("focusout", () => setHighlight(null));
    }

    const rebuildIndexes = () => {
      byId = new Map(nodes.map((node) => [node.id, node]));
      linkEnds = links.map((link) => [byId.get(link.source), byId.get(link.target)]);
      tick = createTick(nodes, linkEnds);
      neighbors = new Map(nodes.map((node) => [node.id, new Set([node.id])]));
      for (const link of links) {
        neighbors.get(link.source).add(link.target);
        neighbors.get(link.target).add(link.source);
      }
      const noteCount = nodes.filter((node) => node.type === "note").length;
      svg.setAttribute(
        "aria-label",
        `Knowledge graph: ${noteCount} notes and ${nodes.length - noteCount} tags`
      );
    };

    const position = () => {
      linkEls.forEach((line, index) => {
        const [source, target] = linkEnds[index];
        line.setAttribute("x1", source.x);
        line.setAttribute("y1", source.y);
        line.setAttribute("x2", target.x);
        line.setAttribute("y2", target.y);
      });
      nodes.forEach((node) => {
        nodeEls.get(node.id).setAttribute("transform", `translate(${node.x} ${node.y})`);
      });
    };

    const updateHeight = () => {
      const rem = Math.min(30, Math.max(12, 9 + nodes.length * 0.4));
      container.style.setProperty("--graph-height", `${rem}rem`);
    };

    // Camera: a mutable viewBox the user can pan and zoom. Auto-fit only runs
    // while the user has not moved the camera themselves.
    const view = { x: 0, y: 0, w: 0, h: 0 };
    let fittedW = 0;
    let userMoved = false;

    const updateZoomClass = () => {
      const threshold = nodes.length > CROWDED_NODE_COUNT ? 0.98 : 1.3;
      svg.classList.toggle("is-zoomed-out", view.w > fittedW * threshold);
    };

    const applyView = () => {
      svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
    };

    const fitView = () => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const node of nodes) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
      }

      const padding = 52;
      view.x = minX - padding;
      view.y = minY - padding;
      view.w = maxX - minX + 2 * padding;
      view.h = maxY - minY + 2 * padding;
      fittedW = view.w;
      applyView();
      updateZoomClass();
    };

    const clientToView = (cx, cy) => {
      const rect = svg.getBoundingClientRect();
      return {
        x: view.x + ((cx - rect.left) / rect.width) * view.w,
        y: view.y + ((cy - rect.top) / rect.height) * view.h,
      };
    };

    const zoomAt = (cx, cy, factor) => {
      const p = clientToView(cx, cy);
      const w = Math.min(Math.max(view.w / factor, fittedW / MAX_ZOOM_IN), fittedW * MAX_ZOOM_OUT);
      const k = w / view.w;
      view.x = p.x - (p.x - view.x) * k;
      view.y = p.y - (p.y - view.y) * k;
      view.w = w;
      view.h *= k;
      userMoved = true;
      applyView();
      updateZoomClass();
    };

    const zoomAtCenter = (factor) => {
      const rect = svg.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    };

    const settle = () => {
      while (ticks < MAX_TICKS && tick() > SETTLED_ENERGY) ticks++;
    };

    const settleAndDraw = () => {
      ticks = 0;
      settle();
      position();
      if (!userMoved) fitView();
    };

    const startLoop = () => {
      ticks = 0;
      if (reduceMotion) {
        settleAndDraw();
        return;
      }
      if (running) return;
      running = true;

      const animate = () => {
        const energy = tick();
        ticks++;
        position();
        if (ticks < MAX_TICKS && (energy > SETTLED_ENERGY || dragNode)) {
          requestAnimationFrame(animate);
        } else {
          running = false;
          if (!userMoved) fitView();
        }
      };
      requestAnimationFrame(animate);
    };

    // Tag expansion: pull in the tag's 2-hop neighborhood — its hidden notes
    // and the hidden tags of its notes — then reheat the simulation. The new
    // frontier tags are themselves expandable, so the graph can be explored
    // outward click by click.
    const expandTag = (tagId) => {
      const tagEl = nodeEls.get(tagId);
      if (tagEl.classList.contains("is-expanded")) return;
      const tagNode = byId.get(tagId);

      const missingIds = new Set();
      for (const link of notesByTag.get(tagId) || []) {
        if (!byId.has(link.source)) missingIds.add(link.source);
        for (const noteLink of noteLinksById.get(link.source) || []) {
          if (!byId.has(noteLink.target)) missingIds.add(noteLink.target);
        }
      }

      tagEl.classList.add("is-expanded");
      tagEl.setAttribute("aria-label", `Tag: ${tagNode.label}, expanded`);
      if (missingIds.size === 0) return;

      const added = [];
      for (const id of missingIds) {
        const node = fullNodeById.get(id);
        node.x = tagNode.x + (Math.random() - 0.5) * 30;
        node.y = tagNode.y + (Math.random() - 0.5) * 30;
        node.vx = 0;
        node.vy = 0;
        nodes.push(node);
        byId.set(id, node);
        added.push(node);
      }
      for (const node of added) createNodeEl(node);

      // Links where both endpoints are now visible and not yet drawn.
      for (const node of added) {
        const related =
          node.type === "note" ? noteLinksById.get(node.id) : notesByTag.get(node.id);
        for (const link of related || []) {
          const key = `${link.source}|${link.target}`;
          if (linkKeys.has(key) || !byId.has(link.source) || !byId.has(link.target)) continue;
          linkKeys.add(key);
          links.push(link);
          createLinkEl();
        }
      }

      rebuildIndexes();
      updateHeight();
      const addedNotes = added.filter((node) => node.type === "note").length;
      const addedTags = added.length - addedNotes;
      const parts = [];
      if (addedNotes) parts.push(`${addedNotes} note${addedNotes === 1 ? "" : "s"}`);
      if (addedTags) parts.push(`${addedTags} tag${addedTags === 1 ? "" : "s"}`);
      live.textContent = `Added ${parts.join(" and ")} around tag ${tagNode.label}`;
      startLoop();
    };

    const linkKeys = new Set(links.map((link) => `${link.source}|${link.target}`));

    for (const link of links) createLinkEl();
    for (const node of nodes) createNodeEl(node);
    rebuildIndexes();
    updateHeight();
    seedPositions(nodes);

    // Pointer state machine: distinguishes node drags, background pans, and
    // plain clicks (which keep navigating / expanding).
    let ptr = null;

    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || ptr) return;
      const group = e.target.closest(".graph-node");
      ptr = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        node: group ? byId.get(group.dataset.id) : null,
        moved: false,
        captureEl: group || svg,
        viewX: view.x,
        viewY: view.y,
      };
    });

    svg.addEventListener("pointermove", (e) => {
      if (!ptr || e.pointerId !== ptr.id) return;

      if (!ptr.moved) {
        const dx = e.clientX - ptr.startX;
        const dy = e.clientY - ptr.startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
        ptr.moved = true;
        // Capture only once a real drag starts: capturing on pointerdown
        // would retarget the derived click and break anchor navigation.
        ptr.captureEl.setPointerCapture(ptr.id);
        if (ptr.node) {
          dragNode = ptr.node;
          dragNode.pinned = true;
        }
      }

      if (ptr.node) {
        const p = clientToView(e.clientX, e.clientY);
        ptr.node.x = p.x;
        ptr.node.y = p.y;
        ptr.node.vx = 0;
        ptr.node.vy = 0;
        if (reduceMotion) {
          position();
        } else {
          startLoop();
        }
      } else {
        const rect = svg.getBoundingClientRect();
        view.x = ptr.viewX - ((e.clientX - ptr.startX) / rect.width) * view.w;
        view.y = ptr.viewY - ((e.clientY - ptr.startY) / rect.height) * view.h;
        userMoved = true;
        applyView();
      }
    });

    const endPointer = (e) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      if (ptr.moved) {
        const swallowClick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        svg.addEventListener("click", swallowClick, true);
        setTimeout(() => svg.removeEventListener("click", swallowClick, true), 0);
      }
      if (dragNode) {
        dragNode.pinned = false;
        dragNode = null;
        if (reduceMotion) settleAndDraw();
      }
      ptr = null;
    };

    svg.addEventListener("pointerup", endPointer);
    svg.addEventListener("pointercancel", endPointer);

    svg.addEventListener(
      "wheel",
      (e) => {
        // Only ctrl/cmd+wheel zooms (this is also what trackpad pinch emits),
        // so plain wheel keeps scrolling the page.
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.002));
      },
      { passive: false }
    );

    const controls = document.createElement("div");
    controls.className = "graph-controls";

    const addControl = (label, ariaLabel, onClick) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-label", ariaLabel);
      button.addEventListener("click", onClick);
      controls.appendChild(button);
    };

    addControl("+", "Zoom in", () => zoomAtCenter(ZOOM_STEP));
    addControl("−", "Zoom out", () => zoomAtCenter(1 / ZOOM_STEP));
    addControl("⟲", "Reset view", () => {
      userMoved = false;
      fitView();
    });

    const live = document.createElement("div");
    live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");

    if (reduceMotion) {
      settle();
      fitView();
      position();
    } else {
      while (ticks < PRERUN_TICKS) {
        tick();
        ticks++;
      }
      fitView();
      position();
      startLoop();
    }

    container.appendChild(svg);
    container.appendChild(controls);
    container.appendChild(live);
  }

  const init = async () => {
    const section = document.querySelector(".graph-section");
    const container = section && section.querySelector(".knowledge-graph");
    if (!container || !container.dataset.graphSrc) return;

    let fullGraph;
    try {
      const response = await fetch(container.dataset.graphSrc);
      if (!response.ok) return;
      fullGraph = await response.json();
    } catch {
      return;
    }

    const rootSlug = container.dataset.rootSlug;
    let rootId = null;
    let graph = fullGraph;

    if (rootSlug) {
      rootId = `note:${rootSlug}`;
      graph = neighborhood(fullGraph, rootId);
      if (graph.links.length === 0) return;
    }

    if (graph.nodes.length === 0) return;

    render(container, graph, rootId, fullGraph);
    section.hidden = false;
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
