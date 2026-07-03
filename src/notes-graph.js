(function () {
  const container = document.querySelector("[data-notes-graph]");
  const dataElement = document.getElementById("notes-graph-data");

  if (!container || !dataElement) return;

  const graph = JSON.parse(dataElement.textContent || "{}");
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) return;

  const svgNS = "http://www.w3.org/2000/svg";
  const width = 900;
  const height = 460;
  const center = { x: width / 2, y: height / 2 };
  const nodes = graph.nodes.map((node) => ({ ...node }));
  const edges = graph.edges || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const categories = nodes.filter((node) => node.type === "category");
  const notes = nodes.filter((node) => node.type === "note");

  positionNodes();
  renderGraph();

  function positionNodes() {
    const categoryRadius = categories.length <= 1 ? 0 : Math.min(210, 90 + categories.length * 34);

    categories.forEach((category, index) => {
      const angle = (-Math.PI / 2) + (index / Math.max(categories.length, 1)) * Math.PI * 2;
      category.x = center.x + Math.cos(angle) * categoryRadius;
      category.y = center.y + Math.sin(angle) * categoryRadius * 0.65;
    });

    for (const category of categories) {
      const categoryNotes = notes.filter((note) => note.category === category.label);
      const radius = Math.min(150, 74 + categoryNotes.length * 14);

      categoryNotes.forEach((note, index) => {
        const angle = (-Math.PI / 2) + (index / Math.max(categoryNotes.length, 1)) * Math.PI * 2;
        note.x = category.x + Math.cos(angle) * radius;
        note.y = category.y + Math.sin(angle) * radius * 0.72;
      });
    }

    for (let iteration = 0; iteration < 80; iteration += 1) {
      spreadNodes();
      pullLinkedNotes();
      clampNodes();
    }
  }

  function spreadNodes() {
    for (let i = 0; i < notes.length; i += 1) {
      for (let j = i + 1; j < notes.length; j += 1) {
        const left = notes[i];
        const right = notes[j];
        const dx = right.x - left.x || 1;
        const dy = right.y - left.y || 1;
        const distance = Math.hypot(dx, dy);
        const minimum = 74;

        if (distance >= minimum) continue;

        const force = (minimum - distance) / distance * 0.18;
        const x = dx * force;
        const y = dy * force;

        left.x -= x;
        left.y -= y;
        right.x += x;
        right.y += y;
      }
    }
  }

  function pullLinkedNotes() {
    for (const edge of edges) {
      if (edge.type !== "link") continue;

      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.hypot(dx, dy) || 1;
      const pull = (distance - 150) / distance * 0.025;
      const x = dx * pull;
      const y = dy * pull;

      source.x += x;
      source.y += y;
      target.x -= x;
      target.y -= y;
    }
  }

  function clampNodes() {
    for (const node of nodes) {
      node.x = Math.min(width - 92, Math.max(92, node.x));
      node.y = Math.min(height - 56, Math.max(56, node.y));
    }
  }

  function renderGraph() {
    container.textContent = "";

    const svg = createSvg("svg", {
      class: "notes-graph-svg",
      viewBox: `0 0 ${width} ${height}`,
      "aria-hidden": "true",
      focusable: "false",
    });
    const edgeLayer = createSvg("g", { class: "notes-graph-edges" });
    const nodeLayer = createSvg("g", { class: "notes-graph-nodes" });

    svg.append(edgeLayer, nodeLayer);

    for (const edge of edges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) continue;

      edgeLayer.append(
        createSvg("line", {
          class: `notes-graph-edge notes-graph-edge-${edge.type}`,
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
          "data-source": edge.source,
          "data-target": edge.target,
        })
      );
    }

    for (const node of nodes) {
      nodeLayer.append(createNode(node));
    }

    container.append(svg);
  }

  function createNode(node) {
    const target = node.url
      ? createSvg("a", { href: node.url, "aria-label": node.label })
      : createSvg("g", { tabindex: "0", role: "img", "aria-label": node.label });
    const group = createSvg("g", {
      class: `notes-graph-node notes-graph-node-${node.type}`,
      transform: `translate(${node.x} ${node.y})`,
      "data-node-id": node.id,
    });
    const radius = node.type === "category" ? 24 : 16;

    group.append(createSvg("circle", { r: radius }));
    group.append(createSvg("text", { y: radius + 19, "text-anchor": "middle" }, shortLabel(node.label)));
    group.append(createSvg("title", {}, node.label));

    target.addEventListener("mouseenter", () => setActiveNode(node.id));
    target.addEventListener("mouseleave", clearActiveNode);
    target.addEventListener("focus", () => setActiveNode(node.id));
    target.addEventListener("blur", clearActiveNode);

    target.append(group);
    return target;
  }

  function setActiveNode(id) {
    container.dataset.activeNode = id;

    for (const element of container.querySelectorAll("[data-node-id]")) {
      const nodeId = element.getAttribute("data-node-id");
      element.classList.toggle("is-active", nodeId === id);
      element.classList.toggle("is-connected", isConnected(id, nodeId));
      element.classList.toggle("is-dimmed", nodeId !== id && !isConnected(id, nodeId));
    }

    for (const edge of container.querySelectorAll("[data-source][data-target]")) {
      const connects =
        edge.getAttribute("data-source") === id || edge.getAttribute("data-target") === id;
      edge.classList.toggle("is-active", connects);
      edge.classList.toggle("is-dimmed", !connects);
    }
  }

  function clearActiveNode() {
    delete container.dataset.activeNode;

    for (const element of container.querySelectorAll(".is-active, .is-connected, .is-dimmed")) {
      element.classList.remove("is-active", "is-connected", "is-dimmed");
    }
  }

  function isConnected(activeId, nodeId) {
    if (activeId === nodeId) return true;

    return edges.some(
      (edge) =>
        (edge.source === activeId && edge.target === nodeId) ||
        (edge.target === activeId && edge.source === nodeId)
    );
  }

  function createSvg(name, attributes = {}, text = "") {
    const element = document.createElementNS(svgNS, name);

    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }

    if (text) {
      element.textContent = text;
    }

    return element;
  }

  function shortLabel(label) {
    return label.length > 28 ? `${label.slice(0, 25)}...` : label;
  }
})();
