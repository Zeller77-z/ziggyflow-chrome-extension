/**
 * ZiggyFlow Visual Workflow Builder & Pipeline Execution Engine
 * Drag-and-drop Multi-AI Pipeline Editor with interactive bezier wires,
 * cross-provider node chaining, upstream data passing, validation, and execution.
 */

window.WorkflowBuilder = {
  canvas: null,
  container: null,
  svgLayer: null,
  nodes: [],
  connections: [],
  scale: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  startPanX: 0,
  startPanY: 0,
  activeWireStart: null,
  selectedNode: null,

  presets: [
    {
      id: "wf_chatgpt_flow",
      name: "🎨 GPT Image → 🎬 Flow Veo 3.1 Video",
      nodes: [
        { id: "n1", type: "generator_chatgpt", x: 40, y: 80, data: { title: "Step 1: ChatGPT (GPT Image 2)", prompt: "Hyperdetailed concept art of cyberpunk ronin samurai on rainy Tokyo neon rooftop, cinematic 8k", aspectRatio: "16:9", mediaType: "image" } },
        { id: "n2", type: "generator_flow", x: 380, y: 80, data: { title: "Step 2: Google Flow (Veo 3.1)", model: "Veo 3.1 Quality", prompt: "Animate samurai slowly unsheathing glowing katana, rain ripples, 4k 60fps cinematic camera zoom", duration: "6s", aspectRatio: "16:9", mediaType: "video" } },
        { id: "n3", type: "download", x: 720, y: 80, data: { title: "Step 3: Auto-Download 4K", folder: "ziggyflow-01", resolution: "4K" } }
      ],
      connections: [{ from: "n1", to: "n2" }, { from: "n2", to: "n3" }]
    },
    {
      id: "wf_storyboard",
      name: "🎬 4-Scene Veo 3.1 Storyboard",
      nodes: [
        { id: "s1", type: "generator_flow", x: 40, y: 40, data: { title: "Scene 1: Establishing Shot", model: "Veo 3.1 Quality", prompt: "Aerial drone shot approaching colossal cyber citadel in dense fog", duration: "6s", aspectRatio: "16:9", mediaType: "video" } },
        { id: "s2", type: "generator_flow", x: 380, y: 40, data: { title: "Scene 2: Infiltration", model: "Veo 3.1 Quality", prompt: "Hero operative rappelling down futuristic glass skyscraper at night", duration: "6s", aspectRatio: "16:9", mediaType: "video" } },
        { id: "s3", type: "generator_flow", x: 720, y: 40, data: { title: "Scene 3: Climax", model: "Veo 3.1 Quality", prompt: "Dynamic camera sweep as energy core activates with blinding shockwave", duration: "6s", aspectRatio: "16:9", mediaType: "video" } }
      ],
      connections: [{ from: "s1", to: "s2" }, { from: "s2", to: "s3" }]
    },
    {
      id: "wf_grok_aurora",
      name: "⚡ Grok Aurora Video Suite",
      nodes: [
        { id: "g1", type: "enhancer", x: 40, y: 80, data: { title: "Prompt Expansion", style: "scifi" } },
        { id: "g2", type: "generator_grok", x: 380, y: 80, data: { title: "Grok Aurora Video", prompt: "Futuristic spaceship warp jump into glittering nebula, photorealistic", mediaType: "video" } },
        { id: "g3", type: "download", x: 720, y: 80, data: { title: "Auto-Download", folder: "ziggyflow-grok", resolution: "4K" } }
      ],
      connections: [{ from: "g1", to: "g2" }, { from: "g2", to: "g3" }]
    }
  ],

  init: async function() {
    this.container = document.getElementById("wf-canvas-container");
    this.canvas = document.getElementById("wf-canvas");
    this.svgLayer = document.getElementById("wf-svg-layer");

    if (!this.container || !this.canvas) return;

    this.renderPresetBar();
    this.setupEvents();
    this.setupToolbar();
    this.loadPreset(this.presets[0]);
  },

  renderPresetBar: function() {
    let bar = document.getElementById("wf-preset-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "wf-preset-bar";
      bar.className = "workflow-preset-bar";
      const toolbar = document.querySelector(".workflow-toolbar");
      if (toolbar && toolbar.parentNode) {
        toolbar.parentNode.insertBefore(bar, toolbar);
      }
    }

    bar.innerHTML = this.presets.map((p, idx) => `
      <div class="wf-preset-chip ${idx === 0 ? 'active' : ''}" onclick="window.WorkflowBuilder.loadPresetById('${p.id}')">
        ${p.name}
      </div>
    `).join("");
  },

  loadPresetById: function(id) {
    const match = this.presets.find(p => p.id === id);
    if (match) {
      document.querySelectorAll(".wf-preset-chip").forEach(c => c.classList.remove("active"));
      event?.target?.classList.add("active");
      this.loadPreset(match);
      window.AutoFlow.showToast(`✨ Loaded pipeline: ${match.name}`, "info");
    }
  },

  loadPreset: function(preset) {
    this.clearCanvas();
    (preset.nodes || []).forEach(n => {
      this.addNode(n.type, n.x, n.y, n.data, n.id);
    });
    this.connections = [...(preset.connections || [])];
    this.renderWires();
  },

  setupEvents: function() {
    this.container.addEventListener("mousedown", (e) => {
      if (e.target === this.container || e.target === this.canvas || e.target === this.svgLayer) {
        this.isPanning = true;
        this.startPanX = e.clientX - this.panX;
        this.startPanY = e.clientY - this.panY;
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.startPanX;
        this.panY = e.clientY - this.startPanY;
        this.updateCanvasTransform();
      }

      if (this.activeWireStart) {
        this.updateDraftWire(e);
      }
    });

    window.addEventListener("mouseup", () => {
      this.isPanning = false;
      if (this.activeWireStart) {
        this.cancelDraftWire();
      }
    });

    this.container.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      this.scale = Math.min(Math.max(0.4, this.scale * zoomFactor), 2);
      this.updateCanvasTransform();
    });
  },

  updateCanvasTransform: function() {
    if (this.canvas) {
      this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
  },

  setupToolbar: function() {
    document.getElementById("wf-btn-add-node")?.addEventListener("click", () => {
      const palette = document.getElementById("wf-palette");
      if (palette) palette.style.display = palette.style.display === "flex" ? "none" : "flex";
    });

    document.querySelectorAll(".palette-item").forEach(item => {
      item.addEventListener("click", () => {
        const type = item.getAttribute("data-node-type");
        this.addNode(type, 140 - this.panX, 120 - this.panY);
        document.getElementById("wf-palette").style.display = "none";
      });
    });

    document.getElementById("wf-btn-run")?.addEventListener("click", () => this.runCurrentWorkflow(false));
    document.getElementById("wf-btn-sim-run")?.addEventListener("click", () => this.runCurrentWorkflow(true));
    document.getElementById("wf-btn-clear")?.addEventListener("click", () => this.clearCanvas());
    document.getElementById("wf-btn-export")?.addEventListener("click", () => this.exportWorkflowJSON());
    document.getElementById("wf-btn-import")?.addEventListener("click", () => this.importWorkflowJSON());
  },

  addNode: function(type, x = 100, y = 100, existingData = null, customId = null) {
    const id = customId || ("node_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 5));
    const nodeObj = {
      id,
      type,
      x,
      y,
      data: existingData || this.getDefaultNodeData(type)
    };

    this.nodes.push(nodeObj);
    this.renderNodeElement(nodeObj);
    this.renderWires();
    return nodeObj;
  },

  getDefaultNodeData: function(type) {
    switch (type) {
      case "generator_flow":
        return { title: "Google Flow (Omni Flash / Veo 3.1)", model: "Veo 3.1 Quality", prompt: "Cinematic shot of flying drone over futuristic ocean city, 4k 60fps", duration: "6s", aspectRatio: "16:9", mediaType: "video" };
      case "generator_chatgpt":
        return { title: "ChatGPT (GPT Image 2)", prompt: "Hyperrealistic concept art of cyberpunk ronin samurai on rainy Tokyo roof", aspectRatio: "16:9", mediaType: "image" };
      case "generator_grok":
        return { title: "Grok (Aurora Video)", prompt: "Aurora borealis shimmering over mountain peaks in winter", mediaType: "video" };
      case "enhancer":
        return { title: "AI Prompt Enhancer", style: "cinematic" };
      case "camera_angle":
        return { title: "Multi-Angle Camera", preset: "Low Angle Hero" };
      case "download":
        return { title: "Auto-Download 4K", folder: "ziggyflow-01", resolution: "4K" };
      default:
        return { title: "Custom Node", prompt: "" };
    }
  },

  renderNodeElement: function(node) {
    const el = document.createElement("div");
    el.id = `wf-el-${node.id}`;
    el.className = `wf-node wf-node-${node.type.replace("generator_", "").replace("camera_", "")}`;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;

    let bodyHTML = "";

    if (node.type.startsWith("generator_")) {
      bodyHTML = `
        <div style="margin-bottom:6px;">
          <label style="font-size:10px;color:#9ca3af;">Prompt</label>
          <textarea class="wf-input-prompt" style="font-size:11px;min-height:50px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;padding:6px;width:100%;resize:vertical;">${node.data.prompt || ""}</textarea>
        </div>
        <div style="display:flex;gap:6px;">
          <div style="flex:1;">
            <label style="font-size:10px;color:#9ca3af;">Ratio</label>
            <select class="wf-input-ratio" style="font-size:11px;padding:3px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;width:100%;">
              <option ${node.data.aspectRatio === "16:9" ? "selected" : ""}>16:9</option>
              <option ${node.data.aspectRatio === "9:16" ? "selected" : ""}>9:16</option>
              <option ${node.data.aspectRatio === "1:1" ? "selected" : ""}>1:1</option>
            </select>
          </div>
          <div style="flex:1;">
            <label style="font-size:10px;color:#9ca3af;">Type</label>
            <select class="wf-input-type" style="font-size:11px;padding:3px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;width:100%;">
              <option value="image" ${node.data.mediaType === "image" ? "selected" : ""}>Image</option>
              <option value="video" ${node.data.mediaType === "video" ? "selected" : ""}>Video</option>
            </select>
          </div>
        </div>
      `;
    } else if (node.type === "enhancer") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Expansion Style</label>
          <select class="wf-input-style" style="font-size:11px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;padding:4px;width:100%;">
            <option value="cinematic">Cinematic 35mm</option>
            <option value="photorealistic">8K Photorealism</option>
            <option value="anime">Studio Ghibli</option>
            <option value="scifi">Sci-Fi Cyberpunk</option>
          </select>
        </div>
      `;
    } else if (node.type === "download") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Target Subfolder</label>
          <input type="text" class="wf-input-folder" value="${node.data.folder || "ziggyflow-01"}" style="font-size:11px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;padding:4px;width:100%;" />
        </div>
      `;
    }

    el.innerHTML = `
      <div class="wf-node-header">
        <span>${node.data.title}</span>
        <span class="wf-btn-del" style="cursor:pointer;color:#94a3b8;font-size:14px;">×</span>
      </div>
      <div class="wf-node-body">
        ${bodyHTML}
      </div>
      <div class="wf-port wf-port-in" data-node-id="${node.id}"></div>
      <div class="wf-port wf-port-out" data-node-id="${node.id}"></div>
    `;

    this.canvas.appendChild(el);

    // Node Dragging
    const header = el.querySelector(".wf-node-header");
    let isDragging = false;
    let startX = 0, startY = 0;

    header.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("wf-btn-del")) return;
      isDragging = true;
      startX = e.clientX - node.x * this.scale;
      startY = e.clientY - node.y * this.scale;
      e.stopPropagation();
    });

    window.addEventListener("mousemove", (e) => {
      if (isDragging) {
        node.x = (e.clientX - startX) / this.scale;
        node.y = (e.clientY - startY) / this.scale;
        el.style.left = `${node.x}px`;
        el.style.top = `${node.y}px`;
        this.renderWires();
      }
    });

    window.addEventListener("mouseup", () => { isDragging = false; });

    el.querySelector(".wf-btn-del").addEventListener("click", () => this.deleteNode(node.id));

    // Ports
    const outPort = el.querySelector(".wf-port-out");
    const inPort = el.querySelector(".wf-port-in");

    outPort.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      this.activeWireStart = { nodeId: node.id, x: node.x + 270, y: node.y + 60 };
    });

    inPort.addEventListener("mouseup", (e) => {
      e.stopPropagation();
      if (this.activeWireStart && this.activeWireStart.nodeId !== node.id) {
        this.connections.push({ from: this.activeWireStart.nodeId, to: node.id });
        this.activeWireStart = null;
        this.renderWires();
        window.AutoFlow.showToast("🔗 Connected pipeline wire!", "success");
      }
    });

    el.querySelector(".wf-input-prompt")?.addEventListener("input", (e) => { node.data.prompt = e.target.value; });
  },

  deleteNode: function(nodeId) {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.connections = this.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    document.getElementById(`wf-el-${nodeId}`)?.remove();
    this.renderWires();
  },

  renderWires: function() {
    if (!this.svgLayer) return;
    this.svgLayer.innerHTML = "";

    this.connections.forEach(conn => {
      const fromNode = this.nodes.find(n => n.id === conn.from);
      const toNode = this.nodes.find(n => n.id === conn.to);
      if (fromNode && toNode) {
        const x1 = fromNode.x + 270;
        const y1 = fromNode.y + 60;
        const x2 = toNode.x;
        const y2 = toNode.y + 60;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const dx = Math.abs(x2 - x1) * 0.5;
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
        path.setAttribute("d", d);
        path.setAttribute("class", "workflow-wire");

        path.addEventListener("click", () => {
          this.connections = this.connections.filter(c => c !== conn);
          this.renderWires();
        });

        this.svgLayer.appendChild(path);
      }
    });
  },

  updateDraftWire: function(e) {
    if (!this.activeWireStart) return;
    let draft = document.getElementById("wf-draft-wire");
    if (!draft) {
      draft = document.createElementNS("http://www.w3.org/2000/svg", "path");
      draft.id = "wf-draft-wire";
      draft.setAttribute("class", "workflow-wire active");
      this.svgLayer.appendChild(draft);
    }

    const rect = this.canvas.getBoundingClientRect();
    const x2 = (e.clientX - rect.left) / this.scale;
    const y2 = (e.clientY - rect.top) / this.scale;
    const x1 = this.activeWireStart.x;
    const y1 = this.activeWireStart.y;
    const dx = Math.abs(x2 - x1) * 0.5;

    draft.setAttribute("d", `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
  },

  cancelDraftWire: function() {
    this.activeWireStart = null;
    document.getElementById("wf-draft-wire")?.remove();
  },

  clearCanvas: function() {
    this.nodes = [];
    this.connections = [];
    this.canvas.querySelectorAll(".wf-node").forEach(el => el.remove());
    this.renderWires();
  },

  async runCurrentWorkflow(isSimulation = false) {
    if (this.nodes.length === 0) {
      window.AutoFlow.showToast("⚠️ Add generator nodes to run pipeline.", "error");
      return;
    }

    window.AutoFlow.showToast(isSimulation ? "🧪 Running Workflow Simulation..." : "⚡ Starting Multi-AI Pipeline on live browser tabs...", "info");
    document.querySelectorAll(".workflow-wire").forEach(w => w.classList.add("active"));

    const tasks = [];
    for (const node of this.nodes) {
      if (node.type.startsWith("generator_")) {
        const provider = node.type.replace("generator_", "");
        const upstreamConn = this.connections.find(c => c.to === node.id);

        tasks.push({
          id: "node_task_" + node.id,
          nodeId: node.id,
          upstreamNodeId: upstreamConn ? upstreamConn.from : null,
          provider: provider,
          prompt: node.data.prompt || "Cinematic scene",
          type: node.data.mediaType || (provider === "flow" ? "video" : "image"),
          model: node.data.model,
          aspectRatio: node.data.aspectRatio || "16:9",
          project: "ziggyflow-pipeline"
        });
      }
    }

    if (isSimulation) {
      for (const t of tasks) {
        const el = document.getElementById(`wf-el-${t.nodeId}`);
        if (el) el.classList.add("running");
        await new Promise(r => {
          chrome.runtime.sendMessage({ action: "SIMULATE_TASK", payload: t }, () => {
            if (el) {
              el.classList.remove("running");
              el.classList.add("completed");
            }
            r();
          });
        });
      }
      window.AutoFlow.showToast("🏁 Workflow simulation completed successfully!", "success");
    } else {
      chrome.runtime.sendMessage({
        action: "ENQUEUE_BATCH",
        payload: { tasks }
      }, () => {
        window.AutoFlow.showToast(`🚀 Dispatched ${tasks.length} pipeline tasks to background!`, "success");
      });
    }
  },

  exportWorkflowJSON: function() {
    const payload = {
      name: "ZiggyFlow_Workflow_" + Date.now(),
      nodes: this.nodes,
      connections: this.connections,
      version: "1.0.0"
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ziggyflow_workflow_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importWorkflowJSON: function() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          this.loadPreset(data);
          window.AutoFlow.showToast("✅ Imported workflow successfully!", "success");
        } catch (err) {
          window.AutoFlow.showToast("❌ Invalid workflow JSON file.", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
};
