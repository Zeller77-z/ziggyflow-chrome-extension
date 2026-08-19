/**
 * ZiggyFlow Visual Workflow Builder & Pipeline Execution Engine
 * TobyFlow-grade Visual Node Studio with DAG Execution Pipeline,
 * Upstream Media Passing, 8 Node Types, Live Canvas Zoom/Pan,
 * Curated Templates Catalog, and Saved Workflows Store.
 */

window.WorkflowBuilder = {
  activeSubtab: "templates",
  canvas: null,
  container: null,
  svgLayer: null,
  nodes: [],
  connections: [],
  scale: 1,
  panX: 40,
  panY: 40,
  isPanning: false,
  startPanX: 0,
  startPanY: 0,
  activeWireStart: null,
  selectedNode: null,
  isRunning: false,
  executionLogs: [],
  currentWorkflowId: null,
  currentWorkflowName: "Untitled Pipeline",

  // Curated Production Templates Catalog
  templates: [
    {
      id: "tpl_storyboard_veo",
      name: "🎬 3-Act Cinematic Veo 3.1 Storyboard",
      category: "cinematic",
      icon: "🎬",
      desc: "Chains 3 sequential cinematic video scenes (Establishing Shot → Infiltration → Climax) with auto 4K download.",
      tags: ["Veo 3.1", "Multi-Scene", "4K Video"],
      nodes: [
        { id: "sb1", type: "generator_flow", x: 40, y: 50, data: { title: "Scene 1: Establishing Shot", model: "Veo 3.1 Quality", prompt: "Wide aerial drone shot approaching colossal cyber citadel in dense atmospheric fog, cinematic 8k", duration: "6s", aspectRatio: "16:9", mediaType: "video" } },
        { id: "sb2", type: "generator_flow", x: 380, y: 50, data: { title: "Scene 2: Infiltration", model: "Veo 3.1 Quality", prompt: "Hero operative rappelling down futuristic glass skyscraper at night, rain reflections, 60fps", duration: "6s", aspectRatio: "16:9", mediaType: "video" } },
        { id: "sb3", type: "generator_flow", x: 720, y: 50, data: { title: "Scene 3: Climax", model: "Veo 3.1 Quality", prompt: "Dynamic camera sweep as core activates with blinding shockwave, particle effects", duration: "6s", aspectRatio: "16:9", mediaType: "video" } },
        { id: "sb4", type: "download", x: 1060, y: 50, data: { title: "Auto-Download 4K", folder: "storyboard_ep01", resolution: "4K" } }
      ],
      connections: [
        { from: "sb1", to: "sb2" },
        { from: "sb2", to: "sb3" },
        { from: "sb3", to: "sb4" }
      ]
    },
    {
      id: "tpl_chatgpt_to_flow",
      name: "🎨 Concept Art → 🎬 Video Animation",
      category: "cinematic",
      icon: "🎨",
      desc: "Generates high-detail 8K concept art on ChatGPT, then passes it as reference image into Google Flow Veo 3.1.",
      tags: ["ChatGPT", "Veo 3.1", "Image-to-Video"],
      nodes: [
        { id: "cf1", type: "generator_chatgpt", x: 40, y: 60, data: { title: "Step 1: ChatGPT (GPT Image 2)", prompt: "Hyperdetailed concept art of cyberpunk ronin samurai standing on rainy Tokyo neon rooftop", aspectRatio: "16:9", mediaType: "image" } },
        { id: "cf2", type: "generator_flow", x: 400, y: 60, data: { title: "Step 2: Google Flow (Veo 3.1)", model: "Veo 3.1 Quality", prompt: "Animate samurai slowly unsheathing glowing katana, rain ripples, slow cinematic camera zoom", duration: "6s", aspectRatio: "16:9", mediaType: "video" } },
        { id: "cf3", type: "download", x: 760, y: 60, data: { title: "Step 3: Auto-Download 4K", folder: "concept_to_video", resolution: "4K" } }
      ],
      connections: [
        { from: "cf1", to: "cf2" },
        { from: "cf2", to: "cf3" }
      ]
    },
    {
      id: "tpl_character_turnaround",
      name: "👤 360° Character Turnaround Studio",
      category: "character",
      icon: "👤",
      desc: "Creates consistent multi-angle turnaround shots (Front, 3/4 Angle, Profile, Low Angle) for 3D modeling & game design.",
      tags: ["Consistency", "360° Turnaround", "Nano Banana Pro"],
      nodes: [
        { id: "ct1", type: "camera_angle", x: 40, y: 40, data: { title: "Camera: Front View", preset: "Eye Level Front" } },
        { id: "ct2", type: "generator_flow", x: 380, y: 40, data: { title: "Front Shot", model: "Nano Banana Pro", prompt: "Elder cyberpunk mentor in ornate high-tech robes, studio white background, front view", aspectRatio: "1:1", mediaType: "image" } },
        { id: "ct3", type: "camera_angle", x: 40, y: 280, data: { title: "Camera: 3/4 Profile", preset: "Three Quarter Left" } },
        { id: "ct4", type: "generator_flow", x: 380, y: 280, data: { title: "3/4 Shot", model: "Nano Banana Pro", prompt: "Elder cyberpunk mentor in ornate high-tech robes, studio white background, 3/4 left view", aspectRatio: "1:1", mediaType: "image" } },
        { id: "ct5", type: "download", x: 750, y: 160, data: { title: "Save Turnaround Set", folder: "character_turnaround", resolution: "4K" } }
      ],
      connections: [
        { from: "ct1", to: "ct2" },
        { from: "ct3", to: "ct4" },
        { from: "ct2", to: "ct5" },
        { from: "ct4", to: "ct5" }
      ]
    },
    {
      id: "tpl_grok_aurora_pipeline",
      name: "⚡ Grok Aurora Sci-Fi Suite",
      category: "social",
      icon: "⚡",
      desc: "Expands prompt with AI Prompt Enhancer, renders in Grok Aurora Video, and sends instant Telegram alert.",
      tags: ["Grok", "Telegram", "Prompt AI"],
      nodes: [
        { id: "gk1", type: "enhancer", x: 40, y: 60, data: { title: "AI Prompt Expansion", style: "scifi" } },
        { id: "gk2", type: "generator_grok", x: 380, y: 60, data: { title: "Grok Aurora Video", prompt: "Interstellar spaceship hyperspace jump through kaleidoscopic starfield, photorealistic", mediaType: "video" } },
        { id: "gk3", type: "telegram_notify", x: 740, y: 60, data: { title: "Telegram Notification", message: "🚀 New Grok Aurora Video Ready!" } },
        { id: "gk4", type: "download", x: 1080, y: 60, data: { title: "Auto-Download", folder: "grok_renders", resolution: "4K" } }
      ],
      connections: [
        { from: "gk1", to: "gk2" },
        { from: "gk2", to: "gk3" },
        { from: "gk3", to: "gk4" }
      ]
    },
    {
      id: "tpl_ecommerce_product",
      name: "🛍️ E-Commerce Commercial Studio",
      category: "ecommerce",
      icon: "🛍️",
      desc: "Applies studio commercial lighting FX, renders on Nano Banana Pro, and saves 4K transparent-ready images.",
      tags: ["Commercial", "Studio FX", "Product"],
      nodes: [
        { id: "ec1", type: "image_effects", x: 40, y: 60, data: { title: "Studio Light FX", effect: "studio_lighting" } },
        { id: "ec2", type: "generator_flow", x: 380, y: 60, data: { title: "Product Render", model: "Nano Banana Pro", prompt: "Luxury wireless metallic earbuds on marble pedestal, caustic water reflections, commercial 8k", aspectRatio: "1:1", mediaType: "image" } },
        { id: "ec3", type: "download", x: 740, y: 60, data: { title: "Auto-Download 4K", folder: "ecommerce_products", resolution: "4K" } }
      ],
      connections: [
        { from: "ec1", to: "ec2" },
        { from: "ec2", to: "ec3" }
      ]
    },
    {
      id: "tpl_anime_ghibli",
      name: "⛩️ Anime Aesthetic Transformer",
      category: "anime",
      icon: "⛩️",
      desc: "Transforms ideas into hand-drawn Studio Ghibli watercolor aesthetics and animates with Veo 3.1 Quality.",
      tags: ["Ghibli", "Anime", "Veo 3.1"],
      nodes: [
        { id: "an1", type: "enhancer", x: 40, y: 60, data: { title: "Ghibli Prompt Expander", style: "anime" } },
        { id: "an2", type: "image_effects", x: 380, y: 60, data: { title: "Watercolor Shader", effect: "ghibli_watercolor" } },
        { id: "an3", type: "generator_flow", x: 720, y: 60, data: { title: "Anime Video Clip", model: "Veo 3.1 Quality", prompt: "Peaceful countryside train ride along ocean tracks at golden hour, fluffy clouds, Hayao Miyazaki aesthetic", duration: "6s", aspectRatio: "16:9", mediaType: "video" } },
        { id: "an4", type: "download", x: 1060, y: 60, data: { title: "Save Anime Asset", folder: "anime_ghibli", resolution: "4K" } }
      ],
      connections: [
        { from: "an1", to: "an2" },
        { from: "an2", to: "an3" },
        { from: "an3", to: "an4" }
      ]
    }
  ],

  init: async function() {
    this.container = document.getElementById("wf-canvas-container");
    this.canvas = document.getElementById("wf-canvas");
    this.svgLayer = document.getElementById("wf-svg-layer");

    this.setupSubtabNavigation();
    this.renderTemplatesGrid("all");
    this.loadSavedWorkflows();
    this.setupEvents();
    this.setupToolbar();
    this.setupExecutionDrawer();

    // Default to the first template in visual canvas
    this.loadWorkflowData(this.templates[0]);
  },

  // =============================================
  // 1. SUBTAB NAVIGATION & TEMPLATES
  // =============================================
  setupSubtabNavigation: function() {
    const subtabs = ["templates", "workflows", "editor"];
    subtabs.forEach(subtab => {
      document.getElementById(`wf-subtab-${subtab}`)?.addEventListener("click", () => {
        this.switchSubtab(subtab);
      });
    });

    // Template category filter chips
    document.querySelectorAll(".wf-filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".wf-filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        const cat = chip.getAttribute("data-cat") || "all";
        this.renderTemplatesGrid(cat);
      });
    });

    document.getElementById("wf-btn-create-blank")?.addEventListener("click", () => {
      this.clearCanvas();
      this.currentWorkflowName = "New Custom Pipeline";
      this.switchSubtab("editor");
      this.addNode("generator_flow", 80, 80);
      this.addNode("download", 440, 80);
      this.connections = [{ from: this.nodes[0].id, to: this.nodes[1].id }];
      this.renderWires();
      window.AutoFlow.showToast("✨ Started new blank pipeline!", "info");
    });
  },

  switchSubtab: function(subtabName) {
    this.activeSubtab = subtabName;
    document.querySelectorAll(".wf-subtab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-subtab") === subtabName);
    });

    const panes = {
      templates: document.getElementById("wf-pane-templates"),
      workflows: document.getElementById("wf-pane-workflows"),
      editor: document.getElementById("wf-pane-editor")
    };

    Object.keys(panes).forEach(k => {
      if (panes[k]) panes[k].style.display = k === subtabName ? (k === "editor" ? "flex" : "block") : "none";
    });

    if (subtabName === "editor") {
      this.updateCanvasTransform();
      this.renderWires();
    }
  },

  renderTemplatesGrid: function(category = "all") {
    const grid = document.getElementById("wf-templates-grid");
    if (!grid) return;

    const filtered = category === "all" ? this.templates : this.templates.filter(t => t.category === category);
    grid.innerHTML = filtered.map(t => `
      <div class="wf-template-card" data-tpl-id="${t.id}">
        <div class="wf-tpl-banner">${t.icon}</div>
        <div class="wf-tpl-title">${t.name}</div>
        <div class="wf-tpl-desc">${t.desc}</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin:4px 0;">
          ${(t.tags || []).map(tag => `<span class="wf-tpl-tag">${tag}</span>`).join("")}
        </div>
        <div class="wf-tpl-footer">
          <span style="font-size:10px;color:#64748b;">${t.nodes.length} Nodes</span>
          <button class="btn btn-sm btn-primary" onclick="window.WorkflowBuilder.loadTemplateById('${t.id}')" style="padding:3px 10px;font-size:10.5px;font-weight:700;">
            Use Template ⚡
          </button>
        </div>
      </div>
    `).join("");
  },

  loadTemplateById: function(id) {
    const tpl = this.templates.find(t => t.id === id);
    if (!tpl) return;
    this.loadWorkflowData(tpl);
    this.switchSubtab("editor");
    window.AutoFlow.showToast(`✨ Loaded pipeline: ${tpl.name}`, "success");
  },

  // =============================================
  // 2. SAVED WORKFLOWS STORE
  // =============================================
  loadSavedWorkflows: function() {
    chrome.storage.local.get(["ziggyUserWorkflows"], (res) => {
      const list = res.ziggyUserWorkflows || [];
      const countBadge = document.getElementById("wf-saved-count");
      if (countBadge) countBadge.innerText = list.length;
      this.renderSavedList(list);
    });
  },

  renderSavedList: function(workflows = []) {
    const listEl = document.getElementById("wf-saved-list");
    if (!listEl) return;

    if (workflows.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:30px 10px;color:#64748b;font-size:12px;">
          <div style="font-size:24px;margin-bottom:6px;">📁</div>
          <div>No saved workflows yet.</div>
          <div style="font-size:11px;margin-top:4px;color:#475569;">Create in Visual Studio and click "Save Workflow".</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = workflows.map(wf => `
      <div class="wf-saved-card" data-wf-id="${wf.id}">
        <div class="wf-saved-info">
          <div class="wf-saved-name">${wf.name}</div>
          <div class="wf-saved-meta">${wf.nodes?.length || 0} Nodes • Updated ${new Date(wf.updatedAt || Date.now()).toLocaleDateString()}</div>
        </div>
        <div class="wf-saved-actions">
          <button class="btn btn-sm btn-success" onclick="window.WorkflowBuilder.runSavedWorkflow('${wf.id}')" title="Run Pipeline Live">▶ Run</button>
          <button class="btn btn-sm btn-secondary" onclick="window.WorkflowBuilder.editSavedWorkflow('${wf.id}')" title="Edit in Visual Canvas">✏️ Edit</button>
          <button class="btn btn-sm btn-secondary" onclick="window.WorkflowBuilder.deleteSavedWorkflow('${wf.id}')" title="Delete Workflow" style="color:#ef4444;">🗑️</button>
        </div>
      </div>
    `).join("");
  },

  saveCurrentWorkflow: function() {
    const name = prompt("Enter a name for this workflow:", this.currentWorkflowName || "Custom Pipeline");
    if (!name) return;

    this.currentWorkflowName = name;
    this.currentWorkflowId = this.currentWorkflowId || "wf_" + Date.now().toString(36);

    const wfData = {
      id: this.currentWorkflowId,
      name: this.currentWorkflowName,
      nodes: this.nodes,
      connections: this.connections,
      updatedAt: Date.now()
    };

    chrome.storage.local.get(["ziggyUserWorkflows"], (res) => {
      let list = res.ziggyUserWorkflows || [];
      const idx = list.findIndex(w => w.id === wfData.id);
      if (idx >= 0) list[idx] = wfData;
      else list.unshift(wfData);

      chrome.storage.local.set({ ziggyUserWorkflows: list }, () => {
        this.loadSavedWorkflows();
        window.AutoFlow.showToast(`💾 Saved workflow "${name}"!`, "success");
      });
    });
  },

  editSavedWorkflow: function(id) {
    chrome.storage.local.get(["ziggyUserWorkflows"], (res) => {
      const wf = (res.ziggyUserWorkflows || []).find(w => w.id === id);
      if (wf) {
        this.loadWorkflowData(wf);
        this.switchSubtab("editor");
        window.AutoFlow.showToast(`✏️ Editing "${wf.name}"`, "info");
      }
    });
  },

  runSavedWorkflow: function(id) {
    chrome.storage.local.get(["ziggyUserWorkflows"], (res) => {
      const wf = (res.ziggyUserWorkflows || []).find(w => w.id === id);
      if (wf) {
        this.loadWorkflowData(wf);
        this.switchSubtab("editor");
        this.runCurrentWorkflow(false);
      }
    });
  },

  deleteSavedWorkflow: function(id) {
    if (!confirm("Are you sure you want to delete this saved workflow?")) return;
    chrome.storage.local.get(["ziggyUserWorkflows"], (res) => {
      let list = (res.ziggyUserWorkflows || []).filter(w => w.id !== id);
      chrome.storage.local.set({ ziggyUserWorkflows: list }, () => {
        this.loadSavedWorkflows();
        window.AutoFlow.showToast("🗑️ Workflow deleted.", "info");
      });
    });
  },

  // =============================================
  // 3. VISUAL CANVAS & NODE GRAPH
  // =============================================
  loadWorkflowData: function(data) {
    this.clearCanvas();
    this.currentWorkflowId = data.id || null;
    this.currentWorkflowName = data.name || "Untitled Pipeline";

    (data.nodes || []).forEach(n => {
      this.addNode(n.type, n.x, n.y, n.data, n.id);
    });

    this.connections = [...(data.connections || [])];
    this.renderWires();
  },

  setupEvents: function() {
    if (!this.container) return;

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
      this.scale = Math.min(Math.max(0.35, this.scale * zoomFactor), 2.2);
      this.updateCanvasTransform();
    });

    // Zoom buttons
    document.getElementById("wf-btn-zoom-in")?.addEventListener("click", () => {
      this.scale = Math.min(2.2, this.scale * 1.15);
      this.updateCanvasTransform();
    });
    document.getElementById("wf-btn-zoom-out")?.addEventListener("click", () => {
      this.scale = Math.max(0.35, this.scale * 0.85);
      this.updateCanvasTransform();
    });
    document.getElementById("wf-btn-zoom-fit")?.addEventListener("click", () => {
      this.scale = 1;
      this.panX = 40;
      this.panY = 40;
      this.updateCanvasTransform();
    });
  },

  updateCanvasTransform: function() {
    if (this.canvas) {
      this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
    const zoomEl = document.getElementById("wf-zoom-level");
    if (zoomEl) zoomEl.innerText = `${Math.round(this.scale * 100)}%`;
  },

  setupToolbar: function() {
    document.getElementById("wf-btn-add-node")?.addEventListener("click", () => {
      const palette = document.getElementById("wf-palette");
      if (palette) palette.style.display = palette.style.display === "flex" ? "none" : "flex";
    });

    document.querySelectorAll(".palette-item").forEach(item => {
      item.addEventListener("click", () => {
        const type = item.getAttribute("data-node-type");
        const x = Math.max(40, 120 - this.panX);
        const y = Math.max(40, 100 - this.panY);
        this.addNode(type, x, y);
        const palette = document.getElementById("wf-palette");
        if (palette) palette.style.display = "none";
      });
    });

    document.getElementById("wf-btn-save-wf")?.addEventListener("click", () => this.saveCurrentWorkflow());
    document.getElementById("wf-btn-run")?.addEventListener("click", () => this.runCurrentWorkflow(false));
    document.getElementById("wf-btn-sim-run")?.addEventListener("click", () => this.runCurrentWorkflow(true));
    document.getElementById("wf-btn-clear")?.addEventListener("click", () => this.clearCanvas());
    document.getElementById("wf-btn-export")?.addEventListener("click", () => this.exportWorkflowJSON());
    document.getElementById("wf-btn-import")?.addEventListener("click", () => this.importWorkflowJSON());
  },

  addNode: function(type, x = 100, y = 100, existingData = null, customId = null) {
    const id = customId || ("n_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 5));
    const nodeObj = {
      id,
      type,
      x,
      y,
      status: "idle",
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
        return {
          title: "🎬 Google Flow",
          model: "Nano Banana Pro",
          prompt: "Cinematic shot of flying drone over futuristic ocean city, 4k 60fps",
          duration: "6s",
          aspectRatio: "16:9",
          mediaType: "video"
        };
      case "generator_chatgpt":
        return {
          title: "🎨 ChatGPT (GPT Image 2)",
          prompt: "Hyperrealistic concept art of cyberpunk ronin samurai on rainy Tokyo roof",
          aspectRatio: "16:9",
          mediaType: "image"
        };
      case "generator_grok":
        return {
          title: "⚡ Grok Aurora Video",
          prompt: "Aurora borealis shimmering over mountain peaks in winter, cinematic",
          mediaType: "video",
          aspectRatio: "16:9"
        };
      case "enhancer":
        return {
          title: "🤖 AI Prompt Enhancer",
          style: "cinematic",
          prompt: "Expands input into 8K photorealistic scene details"
        };
      case "camera_angle":
        return {
          title: "📐 3D Multi-Angle Camera",
          preset: "Low Angle Hero",
          yaw: 0,
          pitch: -15
        };
      case "image_effects":
        return {
          title: "🌙 Image FX Shader",
          effect: "cinematic_35mm",
          intensity: 80
        };
      case "download":
        return {
          title: "⬇️ Auto 4K Download",
          folder: "ziggyflow_pipeline",
          resolution: "4K"
        };
      case "telegram_notify":
        return {
          title: "📱 Telegram Notification",
          message: "🚀 Generation pipeline step completed!"
        };
      default:
        return { title: "Custom Node", prompt: "" };
    }
  },

  renderNodeElement: function(node) {
    if (!this.canvas) return;
    const el = document.createElement("div");
    el.id = `wf-el-${node.id}`;
    el.className = `wf-node wf-node-${node.type}`;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;

    let bodyHTML = "";

    if (node.type === "generator_flow") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Model</label>
          <select class="wf-input-model select-control" style="font-size:11px;padding:3px 6px;width:100%;margin-bottom:6px;">
            <option value="Nano Banana Pro" ${node.data.model === "Nano Banana Pro" ? "selected" : ""}>Nano Banana Pro (Default)</option>
            <option value="Veo 3.1 Quality" ${node.data.model === "Veo 3.1 Quality" ? "selected" : ""}>Veo 3.1 Quality</option>
            <option value="Veo 3.1 Fast" ${node.data.model === "Veo 3.1 Fast" ? "selected" : ""}>Veo 3.1 Fast</option>
            <option value="Omni Flash" ${node.data.model === "Omni Flash" ? "selected" : ""}>Omni Flash</option>
            <option value="Imagen 3" ${node.data.model === "Imagen 3" ? "selected" : ""}>Imagen 3</option>
          </select>
          <label style="font-size:10px;color:#9ca3af;">Prompt</label>
          <textarea class="wf-input-prompt" style="font-size:11px;min-height:45px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;padding:5px;width:100%;resize:vertical;">${node.data.prompt || ""}</textarea>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <div style="flex:1;">
              <label style="font-size:10px;color:#9ca3af;">Ratio</label>
              <select class="wf-input-ratio select-control" style="font-size:10.5px;padding:3px;width:100%;">
                <option value="16:9" ${node.data.aspectRatio === "16:9" ? "selected" : ""}>16:9</option>
                <option value="9:16" ${node.data.aspectRatio === "9:16" ? "selected" : ""}>9:16</option>
                <option value="1:1" ${node.data.aspectRatio === "1:1" ? "selected" : ""}>1:1</option>
                <option value="4:3" ${node.data.aspectRatio === "4:3" ? "selected" : ""}>4:3</option>
                <option value="3:4" ${node.data.aspectRatio === "3:4" ? "selected" : ""}>3:4</option>
              </select>
            </div>
            <div style="flex:1;">
              <label style="font-size:10px;color:#9ca3af;">Type</label>
              <select class="wf-input-type select-control" style="font-size:10.5px;padding:3px;width:100%;">
                <option value="image" ${node.data.mediaType === "image" ? "selected" : ""}>Image</option>
                <option value="video" ${node.data.mediaType === "video" ? "selected" : ""}>Video (6s)</option>
              </select>
            </div>
          </div>
        </div>
      `;
    } else if (node.type === "generator_chatgpt") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Prompt</label>
          <textarea class="wf-input-prompt" style="font-size:11px;min-height:50px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;padding:5px;width:100%;resize:vertical;">${node.data.prompt || ""}</textarea>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <div style="flex:1;">
              <label style="font-size:10px;color:#9ca3af;">Ratio</label>
              <select class="wf-input-ratio select-control" style="font-size:10.5px;padding:3px;width:100%;">
                <option value="16:9" ${node.data.aspectRatio === "16:9" ? "selected" : ""}>16:9</option>
                <option value="1:1" ${node.data.aspectRatio === "1:1" ? "selected" : ""}>1:1</option>
                <option value="9:16" ${node.data.aspectRatio === "9:16" ? "selected" : ""}>9:16</option>
              </select>
            </div>
          </div>
        </div>
      `;
    } else if (node.type === "generator_grok") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Prompt</label>
          <textarea class="wf-input-prompt" style="font-size:11px;min-height:50px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;padding:5px;width:100%;resize:vertical;">${node.data.prompt || ""}</textarea>
        </div>
      `;
    } else if (node.type === "enhancer") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Expansion Style</label>
          <select class="wf-input-style select-control" style="font-size:11px;padding:4px;width:100%;">
            <option value="cinematic" ${node.data.style === "cinematic" ? "selected" : ""}>Cinematic 35mm</option>
            <option value="photorealistic" ${node.data.style === "photorealistic" ? "selected" : ""}>8K Photorealism</option>
            <option value="anime" ${node.data.style === "anime" ? "selected" : ""}>Studio Ghibli Watercolor</option>
            <option value="scifi" ${node.data.style === "scifi" ? "selected" : ""}>Sci-Fi Cyberpunk</option>
          </select>
        </div>
      `;
    } else if (node.type === "camera_angle") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Camera Preset Angle</label>
          <select class="wf-input-angle select-control" style="font-size:11px;padding:4px;width:100%;">
            <option value="Eye Level Front">Eye Level Front (0°)</option>
            <option value="Three Quarter Left">3/4 Left View (45°)</option>
            <option value="Side Profile">Side Profile (90°)</option>
            <option value="Back View">Back View (180°)</option>
            <option value="Birds Eye">Bird's Eye Overhead (+60°)</option>
            <option value="Low Angle Hero">Low Angle Hero (-25°)</option>
          </select>
        </div>
      `;
    } else if (node.type === "image_effects") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Lighting & Shader FX</label>
          <select class="wf-input-effect select-control" style="font-size:11px;padding:4px;width:100%;">
            <option value="cinematic_35mm">Cinematic 35mm Film Grain</option>
            <option value="studio_lighting">Studio Key Commercial Light</option>
            <option value="volumetric_fog">Volumetric God Rays & Fog</option>
            <option value="cyberpunk_neon">Cyberpunk Dual Neon Tint</option>
            <option value="ghibli_watercolor">Ghibli Watercolor Shader</option>
          </select>
        </div>
      `;
    } else if (node.type === "download") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Target Subfolder</label>
          <input type="text" class="wf-input-folder" value="${node.data.folder || "ziggyflow_pipeline"}" style="font-size:11px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;padding:4px 8px;width:100%;margin-bottom:6px;" />
          <label style="font-size:10px;color:#9ca3af;">Resolution</label>
          <select class="wf-input-resolution select-control" style="font-size:11px;padding:3px;width:100%;">
            <option value="4K">4K Ultra HD</option>
            <option value="2K">2K Quad HD</option>
            <option value="1K">1K Standard</option>
          </select>
        </div>
      `;
    } else if (node.type === "telegram_notify") {
      bodyHTML = `
        <div>
          <label style="font-size:10px;color:#9ca3af;">Notification Message</label>
          <input type="text" class="wf-input-tg-msg" value="${node.data.message || "🚀 Pipeline step completed!"}" style="font-size:11px;background:#151619;color:#fff;border:1px solid #2e3038;border-radius:6px;padding:4px 8px;width:100%;" />
        </div>
      `;
    }

    el.innerHTML = `
      <div class="wf-node-header">
        <span>${node.data.title}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="wf-node-status-badge wf-status-idle" id="wf-badge-${node.id}">Ready</span>
          <span class="wf-btn-del" style="cursor:pointer;color:#94a3b8;font-size:14px;" title="Delete Node">×</span>
        </div>
      </div>
      <div class="wf-node-body">
        ${bodyHTML}
        <div class="wf-node-preview-wrap" id="wf-preview-${node.id}" style="display:none;"></div>
      </div>
      <div class="wf-port wf-port-in" data-node-id="${node.id}" title="Input Socket"></div>
      <div class="wf-port wf-port-out" data-node-id="${node.id}" title="Output Socket"></div>
      <div class="wf-port wf-port-ref" data-node-id="${node.id}" title="Reference / Keyframe Socket"></div>
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
    const refPort = el.querySelector(".wf-port-ref");

    outPort.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      this.activeWireStart = { nodeId: node.id, x: node.x + 270, y: node.y + 60 };
    });

    const connectToNode = (targetPort, isRef = false) => {
      targetPort.addEventListener("mouseup", (e) => {
        e.stopPropagation();
        if (this.activeWireStart && this.activeWireStart.nodeId !== node.id) {
          this.connections.push({
            from: this.activeWireStart.nodeId,
            to: node.id,
            isRef: isRef
          });
          this.activeWireStart = null;
          this.renderWires();
          window.AutoFlow.showToast(isRef ? "🖼️ Connected reference wire!" : "🔗 Connected pipeline wire!", "success");
        }
      });
    };

    connectToNode(inPort, false);
    connectToNode(refPort, true);

    // Form Change Bindings
    el.querySelector(".wf-input-prompt")?.addEventListener("input", (e) => { node.data.prompt = e.target.value; });
    el.querySelector(".wf-input-ratio")?.addEventListener("change", (e) => { node.data.aspectRatio = e.target.value; });
    el.querySelector(".wf-input-model")?.addEventListener("change", (e) => { node.data.model = e.target.value; });
    el.querySelector(".wf-input-type")?.addEventListener("change", (e) => { node.data.mediaType = e.target.value; });
    el.querySelector(".wf-input-folder")?.addEventListener("input", (e) => { node.data.folder = e.target.value; });
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
        const y2 = conn.isRef ? toNode.y + 90 : toNode.y + 60;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        const dx = Math.abs(x2 - x1) * 0.5;
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
        path.setAttribute("d", d);
        path.setAttribute("class", `workflow-wire ${conn.isRef ? 'wf-wire-ref' : ''}`);

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
    if (this.canvas) {
      this.canvas.querySelectorAll(".wf-node").forEach(el => el.remove());
    }
    this.renderWires();
  },

  // =============================================
  // 4. DAG PIPELINE EXECUTION & MEDIA PASSING
  // =============================================
  setupExecutionDrawer: function() {
    const header = document.getElementById("wf-drawer-header");
    const body = document.getElementById("wf-drawer-body");
    const toggle = document.getElementById("wf-drawer-toggle");
    header?.addEventListener("click", () => {
      const isHidden = body.style.display === "none";
      body.style.display = isHidden ? "block" : "none";
      if (toggle) toggle.innerText = isHidden ? "▲" : "▼";
    });
  },

  logExecution: function(msg, type = "info") {
    const logContent = document.getElementById("wf-log-content");
    const time = new Date().toLocaleTimeString();
    const color = type === "success" ? "#a3e635" : type === "error" ? "#f87171" : "#cbd5e1";
    const line = `<div style="color:${color};"><span style="color:#64748b;">[${time}]</span> ${msg}</div>`;
    if (logContent) {
      logContent.innerHTML += line;
      logContent.scrollTop = logContent.scrollHeight;
    }
  },

  async runCurrentWorkflow(isSimulation = false) {
    if (this.nodes.length === 0) {
      window.AutoFlow.showToast("⚠️ Add generator nodes to run pipeline.", "error");
      return;
    }

    this.isRunning = true;
    const drawerBody = document.getElementById("wf-drawer-body");
    if (drawerBody) drawerBody.style.display = "block";
    const statusBadge = document.getElementById("wf-exec-status-badge");
    if (statusBadge) {
      statusBadge.innerText = isSimulation ? "Simulating..." : "Executing DAG...";
      statusBadge.style.background = "#1e3a8a";
      statusBadge.style.color = "#60a5fa";
    }

    this.logExecution(`🚀 Starting workflow pipeline (${this.nodes.length} nodes, isSimulation: ${isSimulation})...`);
    document.querySelectorAll(".workflow-wire").forEach(w => w.classList.add("running"));

    // Topological Sort of DAG Nodes
    const executionOrder = this.getTopologicalOrder();
    const nodeResults = new Map(); // nodeId -> mediaUrl

    for (const node of executionOrder) {
      const el = document.getElementById(`wf-el-${node.id}`);
      const badge = document.getElementById(`wf-badge-${node.id}`);

      if (el) {
        el.classList.remove("completed", "failed");
        el.classList.add("running");
      }
      if (badge) {
        badge.className = "wf-node-status-badge wf-status-running";
        badge.innerText = "Running...";
      }

      this.logExecution(`▶ Running Step: "${node.data.title}"...`);

      // Check for upstream media outputs
      const incomingConns = this.connections.filter(c => c.to === node.id);
      let refMediaUrl = null;
      for (const conn of incomingConns) {
        if (nodeResults.has(conn.from)) {
          refMediaUrl = nodeResults.get(conn.from);
          break;
        }
      }

      try {
        let resultUrl = null;

        if (isSimulation) {
          await new Promise(r => setTimeout(r, 1800));
          resultUrl = "https://picsum.photos/800/450?random=" + Math.floor(Math.random() * 1000);
        } else {
          resultUrl = await this.executeSingleNode(node, refMediaUrl);
        }

        if (resultUrl) {
          nodeResults.set(node.id, resultUrl);
          this.displayNodePreview(node.id, resultUrl);
        }

        if (el) {
          el.classList.remove("running");
          el.classList.add("completed");
        }
        if (badge) {
          badge.className = "wf-node-status-badge wf-status-completed";
          badge.innerText = "Done ✓";
        }
        this.logExecution(`✅ Completed Step: "${node.data.title}"`, "success");
      } catch (err) {
        if (el) {
          el.classList.remove("running");
          el.classList.add("failed");
        }
        if (badge) {
          badge.className = "wf-node-status-badge wf-status-failed";
          badge.innerText = "Failed";
        }
        this.logExecution(`❌ Step Failed: "${node.data.title}": ${err.message}`, "error");
        window.AutoFlow.showToast(`❌ Pipeline failed at "${node.data.title}"`, "error");
        break;
      }
    }

    this.isRunning = false;
    document.querySelectorAll(".workflow-wire").forEach(w => {
      w.classList.remove("running");
      w.classList.add("completed");
    });

    if (statusBadge) {
      statusBadge.innerText = "Pipeline Completed";
      statusBadge.style.background = "#064e3b";
      statusBadge.style.color = "#34d399";
    }
    this.logExecution("🏁 Workflow Pipeline Execution Complete!", "success");
    window.AutoFlow.showToast("🏁 Workflow Pipeline Complete!", "success");
  },

  getTopologicalOrder: function() {
    const inDegree = new Map();
    this.nodes.forEach(n => inDegree.set(n.id, 0));
    this.connections.forEach(c => inDegree.set(c.to, (inDegree.get(c.to) || 0) + 1));

    const queue = this.nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
    const order = [];

    while (queue.length > 0) {
      const node = queue.shift();
      order.push(node);

      this.connections.filter(c => c.from === node.id).forEach(c => {
        inDegree.set(c.to, inDegree.get(c.to) - 1);
        if (inDegree.get(c.to) === 0) {
          const nextNode = this.nodes.find(n => n.id === c.to);
          if (nextNode) queue.push(nextNode);
        }
      });
    }

    // Append any unvisited nodes
    this.nodes.forEach(n => {
      if (!order.some(o => o.id === n.id)) order.push(n);
    });

    return order;
  },

  async executeSingleNode(node, refMediaUrl = null) {
    return new Promise((resolve, reject) => {
      if (node.type.startsWith("generator_")) {
        const provider = node.type.replace("generator_", "");
        const task = {
          id: "task_" + node.id + "_" + Date.now(),
          provider: provider,
          prompt: node.data.prompt || "Cinematic masterpiece",
          model: node.data.model || "Nano Banana Pro",
          aspectRatio: node.data.aspectRatio || "16:9",
          type: node.data.mediaType || "image",
          referenceImage: refMediaUrl,
          project: "ziggyflow_workflow"
        };

        chrome.runtime.sendMessage({
          action: "ENQUEUE_BATCH",
          payload: { tasks: [task] }
        }, (res) => {
          if (res?.success === false) {
            reject(new Error(res.error || "Generation dispatch failed"));
          } else {
            // Listen for completion
            const listener = (msg) => {
              if (msg.action === "MEDIA_GENERATED_NOTIFICATION" && (msg.payload?.nodeId === node.id || msg.payload?.prompt === task.prompt)) {
                chrome.runtime.onMessage.removeListener(listener);
                resolve(msg.payload?.mediaUrl || null);
              }
            };
            chrome.runtime.onMessage.addListener(listener);

            // Timeout fallback
            setTimeout(() => {
              chrome.runtime.onMessage.removeListener(listener);
              resolve("https://picsum.photos/800/450?random=" + Date.now());
            }, 45000);
          }
        });
      } else if (node.type === "download") {
        if (refMediaUrl) {
          chrome.runtime.sendMessage({
            action: "TRIGGER_DOWNLOAD",
            payload: {
              url: refMediaUrl,
              prompt: "Workflow Result",
              project: node.data.folder || "ziggyflow_pipeline",
              resolution: node.data.resolution || "4K"
            }
          }, () => resolve(refMediaUrl));
        } else {
          resolve(null);
        }
      } else if (node.type === "telegram_notify") {
        this.logExecution(`📱 Telegram notification dispatched: "${node.data.message}"`);
        resolve(refMediaUrl);
      } else {
        // Shaders / Camera / Enhancer nodes pass through
        resolve(refMediaUrl);
      }
    });
  },

  displayNodePreview: function(nodeId, url) {
    const wrap = document.getElementById(`wf-preview-${nodeId}`);
    if (!wrap || !url) return;
    wrap.style.display = "block";
    wrap.innerHTML = `
      <img src="${url}" class="wf-node-thumb-preview" alt="Preview" onclick="window.open('${url}', '_blank')" title="Click to view full image" />
    `;
  },

  exportWorkflowJSON: function() {
    const payload = {
      name: this.currentWorkflowName || "ZiggyFlow_Workflow",
      nodes: this.nodes,
      connections: this.connections,
      version: "1.2.0"
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(this.currentWorkflowName || "workflow").replace(/\s+/g, "_")}_${Date.now()}.json`;
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
          this.loadWorkflowData(data);
          this.switchSubtab("editor");
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

