/**
 * AutoFlow Curated Prompt Templates & Personal Library
 * Browse 100+ high-grade curated prompts, filter by category/style/media type,
 * interpolate placeholders, and 1-click apply to generations.
 */

window.PromptTemplates = {
  templates: [],
  userTemplates: [],
  activeCategory: "All",
  activeMediaType: "All",
  searchQuery: "",

  init: async function() {
    await this.loadTemplates();
    this.setupEvents();
    this.renderTemplates();
  },

  async loadTemplates() {
    try {
      const res = await fetch(chrome.runtime.getURL("assets/demo-presets.json"));
      const presets = await res.json();
      this.templates = presets.promptTemplates || [];
    } catch (e) {
      console.warn("Could not load curated templates:", e);
    }

    const data = await chrome.storage.local.get(['userPromptTemplates']);
    this.userTemplates = data.userPromptTemplates || [];
  },

  setupEvents: function() {
    document.getElementById("tpl-search-input")?.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderTemplates();
    });

    document.querySelectorAll(".tpl-cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tpl-cat-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.activeCategory = btn.getAttribute("data-cat") || "All";
        this.renderTemplates();
      });
    });

    document.getElementById("tpl-btn-new-custom")?.addEventListener("click", () => this.createCustomTemplate());
  },

  renderTemplates: function() {
    const grid = document.getElementById("templates-grid");
    if (!grid) return;

    const all = [...this.userTemplates, ...this.templates];
    const filtered = all.filter(t => {
      const matchCat = this.activeCategory === "All" || t.category === this.activeCategory;
      const matchSearch = !this.searchQuery || 
        t.title.toLowerCase().includes(this.searchQuery) ||
        t.prompt.toLowerCase().includes(this.searchQuery) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(this.searchQuery)));
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#64748b;padding:32px;">No templates found matching your criteria.</div>`;
      return;
    }

    grid.innerHTML = filtered.map(t => `
      <div class="card" style="padding:16px;display:flex;flex-direction:column;justify-content:space-between;margin-bottom:0;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <div style="font-weight:600;font-size:14px;color:#fff;">${t.title}</div>
            <span class="badge badge-flow" style="font-size:10px;">${t.category}</span>
          </div>
          <div style="font-size:12px;color:#94a3b8;line-height:1.5;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
            ${escapeHTML(t.prompt)}
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:14px;">
            ${(t.tags || []).map(tag => `<span style="background:rgba(255,255,255,0.05);color:#cbd5e1;padding:2px 6px;border-radius:4px;font-size:10px;">#${tag}</span>`).join("")}
          </div>
        </div>
        <div style="display:flex;gap:6px;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">
          <button class="btn btn-sm btn-primary" style="flex:1;" onclick="window.PromptTemplates.openApplyModal('${t.id}')">⚡ Use Template</button>
          <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${escapeHTML(t.prompt)}'); window.AutoFlow.showToast('📋 Copied prompt!','success');">Copy</button>
        </div>
      </div>
    `).join("");
  },

  openApplyModal: function(templateId) {
    const all = [...this.userTemplates, ...this.templates];
    const t = all.find(item => item.id === templateId);
    if (!t) return;

    const modal = document.createElement("div");
    modal.style.cssText = `
      position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);
      backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:9999;
    `;

    // Extract placeholders like {subject}, {style}
    const placeholders = t.prompt.match(/\{([\w]+)\}/g) || [];
    const uniqueKeys = [...new Set(placeholders.map(p => p.replace(/[{}]/g, "")))];

    const fieldsHTML = uniqueKeys.map(k => `
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;text-transform:capitalize;">${k}</label>
        <input type="text" id="var-field-${k}" class="form-control" placeholder="Enter ${k}..." value="${k === "subject" ? "a futuristic cyber samurai" : ""}" />
      </div>
    `).join("");

    modal.innerHTML = `
      <div style="background:#0f172a;border:1px solid #334155;border-radius:16px;padding:24px;width:440px;box-shadow:var(--shadow-lg);color:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:600;">✨ Apply Template: ${t.title}</h3>
          <span style="cursor:pointer;font-size:20px;color:#94a3b8;" id="modal-close-btn">×</span>
        </div>
        ${fieldsHTML || `<p style="font-size:13px;color:#94a3b8;margin-bottom:14px;">No variables in this template.</p>`}
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px;">
          <button class="btn btn-secondary" id="modal-copy-filled">Copy</button>
          <button class="btn btn-primary" id="modal-send-gen">✨ Send to Prompt Box</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#modal-close-btn").onclick = () => modal.remove();

    const getFinalPrompt = () => {
      let final = t.prompt;
      uniqueKeys.forEach(k => {
        const val = modal.querySelector(`#var-field-${k}`)?.value || k;
        final = final.replaceAll(`{${k}}`, val);
      });
      return final;
    };

    modal.querySelector("#modal-copy-filled").onclick = () => {
      const finalPrompt = getFinalPrompt();
      navigator.clipboard.writeText(finalPrompt);
      window.AutoFlow.showToast("📋 Copied filled prompt to clipboard!", "success");
      modal.remove();
    };

    modal.querySelector("#modal-send-gen").onclick = () => {
      const finalPrompt = getFinalPrompt();
      const textarea = document.getElementById("gen-prompt-input");
      if (textarea) {
        textarea.value = finalPrompt;
        if (window.FlowConnector) window.FlowConnector.updatePromptCount();
      }
      document.querySelector('[data-tab="gen"]')?.click();
      window.AutoFlow.showToast(`✨ Loaded template "${t.title}" into Prompt Box!`, "success");
      modal.remove();
    };
  },

  createCustomTemplate: async function() {
    const title = prompt("Template Title:", "My Masterpiece Prompt");
    if (!title) return;
    const promptText = prompt("Prompt (use {subject} for variables):", "8k cinematic wallpaper of {subject}, Unreal Engine 5 --ar 16:9");
    if (!promptText) return;

    this.userTemplates.unshift({
      id: "usr_tpl_" + Date.now(),
      title,
      category: "Custom",
      style: "Custom",
      difficulty: "Custom",
      prompt: promptText,
      tags: ["custom", "user"]
    });

    await chrome.storage.local.set({ userPromptTemplates: this.userTemplates });
    this.renderTemplates();
    window.AutoFlow.showToast("✅ Saved custom template!", "success");
  }
};
