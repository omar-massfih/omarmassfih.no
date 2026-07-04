(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XHTML_NS = "http://www.w3.org/1999/xhtml";

  const NOTE_RADIUS = 8;
  const TAG_RADIUS = 4.5;
  const LINK_REST_LENGTH = 70;
  const REPULSION = 2600;
  const SPRING = 0.06;
  const CENTERING = 0.012;
  const DAMPING = 0.85;
  const MAX_VELOCITY = 12;
  const MAX_TICKS = 300;
  const PRERUN_TICKS = 40;
  const SETTLED_ENERGY = 0.02;

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

  function simulate(nodes, links) {
    const byId = new Map(nodes.map((node) => [node.id, node]));

    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = 40 + 12 * (index % 3);
      node.x = Math.cos(angle) * radius;
      node.y = Math.sin(angle) * radius;
      node.vx = 0;
      node.vy = 0;
    });

    const springs = links.map((link) => [byId.get(link.source), byId.get(link.target)]);

    const tick = () => {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = Math.max(dx * dx + dy * dy, 25);
          const force = REPULSION / distSq;
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

      return energy / nodes.length;
    };

    return tick;
  }

  function fitViewBox(svg, nodes) {
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
    svg.setAttribute(
      "viewBox",
      [minX - padding, minY - padding, maxX - minX + 2 * padding, maxY - minY + 2 * padding].join(" ")
    );
  }

  function render(container, graph, rootId) {
    const { nodes, links } = graph;
    const noteCount = nodes.filter((node) => node.type === "note").length;

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("role", "group");
    svg.setAttribute(
      "aria-label",
      `Knowledge graph: ${noteCount} notes and ${nodes.length - noteCount} tags`
    );

    const linkGroup = document.createElementNS(SVG_NS, "g");
    svg.appendChild(linkGroup);

    const linkEls = links.map((link) => {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("class", "graph-link");
      linkGroup.appendChild(line);
      return line;
    });

    const nodeEls = new Map();

    for (const node of nodes) {
      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("class", `graph-node graph-node--${node.type}`);

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("r", node.type === "note" ? NOTE_RADIUS : TAG_RADIUS);

      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dy", node.type === "note" ? NOTE_RADIUS + 14 : TAG_RADIUS + 12);
      text.textContent = node.label;

      if (node.type === "note" && node.id !== rootId) {
        const anchor = document.createElementNS(SVG_NS, "a");
        anchor.setAttribute("href", node.url);
        anchor.appendChild(circle);
        anchor.appendChild(text);
        group.appendChild(anchor);
      } else {
        if (node.id === rootId) {
          group.classList.add("is-current");
          group.setAttribute("aria-current", "page");
        } else {
          const title = document.createElementNS(SVG_NS, "title");
          title.textContent = node.label;
          group.appendChild(title);
          group.setAttribute("role", "img");
          group.setAttribute("aria-label", `Tag: ${node.label}`);
        }
        group.appendChild(circle);
        group.appendChild(text);
      }

      svg.appendChild(group);
      nodeEls.set(node.id, group);
    }

    const neighbors = new Map(nodes.map((node) => [node.id, new Set([node.id])]));

    links.forEach((link) => {
      neighbors.get(link.source).add(link.target);
      neighbors.get(link.target).add(link.source);
    });

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

    nodes.forEach((node) => {
      const el = nodeEls.get(node.id);
      el.addEventListener("pointerenter", () => setHighlight(node.id));
      el.addEventListener("pointerleave", () => setHighlight(null));
      el.addEventListener("focusin", () => setHighlight(node.id));
      el.addEventListener("focusout", () => setHighlight(null));
    });

    const position = () => {
      linkEls.forEach((line, index) => {
        const source = nodes.find((node) => node.id === links[index].source);
        const target = nodes.find((node) => node.id === links[index].target);
        line.setAttribute("x1", source.x);
        line.setAttribute("y1", source.y);
        line.setAttribute("x2", target.x);
        line.setAttribute("y2", target.y);
      });
      nodes.forEach((node) => {
        nodeEls.get(node.id).setAttribute("transform", `translate(${node.x} ${node.y})`);
      });
    };

    const tick = simulate(nodes, links);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let ticks = 0;

    const settle = () => {
      while (ticks < MAX_TICKS && tick() > SETTLED_ENERGY) ticks++;
    };

    if (reduceMotion) {
      settle();
      fitViewBox(svg, nodes);
      position();
    } else {
      while (ticks < PRERUN_TICKS) {
        tick();
        ticks++;
      }
      fitViewBox(svg, nodes);
      position();

      const animate = () => {
        const energy = tick();
        ticks++;
        position();
        if (ticks < MAX_TICKS && energy > SETTLED_ENERGY) {
          requestAnimationFrame(animate);
        } else {
          fitViewBox(svg, nodes);
        }
      };
      requestAnimationFrame(animate);
    }

    container.appendChild(svg);
  }

  const init = () => {
    document.querySelectorAll(".graph-section").forEach((section) => {
      const container = section.querySelector(".knowledge-graph");
      const dataEl = container && container.querySelector(".graph-data");
      if (!dataEl) return;

      let graph;
      try {
        graph = JSON.parse(dataEl.textContent);
      } catch {
        return;
      }

      const rootSlug = container.dataset.rootSlug;
      let rootId = null;

      if (rootSlug) {
        rootId = `note:${rootSlug}`;
        graph = neighborhood(graph, rootId);
        if (graph.links.length === 0) return;
      }

      if (graph.nodes.length === 0) return;

      render(container, graph, rootId);
      section.hidden = false;
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
