/**
 * AutoFlow Image Effects Engine
 * 28+ cinematic effects across 5 categories with real-time intensity modulation.
 */

window.ImageEffects = {
  effects: [],
  activeCategory: "Color",
  intensity: 75,

  init: async function() {
    await this.loadEffects();
    this.setupEvents();
    this.renderCategoryButtons();
    this.renderEffectCards();
  },

  async loadEffects() {
    try {
      const res = await fetch(chrome.runtime.getURL("assets/demo-presets.json"));
      const presets = await res.json();
      this.effects = presets.effects || [];
    } catch (e) {
      console.warn("Could not load preset effects:", e);
    }
  },

  setupEvents: function() {
    const slider = document.getElementById("fx-intensity-slider");
    slider?.addEventListener("input", (e) => {
      this.intensity = parseInt(e.target.value, 10);
      document.getElementById("fx-intensity-val").innerText = `${this.intensity}%`;
      this.renderEffectCards();
    });
  },

  renderCategoryButtons: function() {
    const container = document.getElementById("fx-categories-nav");
    if (!container) return;

    const categories = ["Color", "Light", "Weather", "Artistic", "Texture"];
    container.innerHTML = categories.map(cat => `
      <button class="btn btn-sm ${cat === this.activeCategory ? 'btn-primary' : 'btn-secondary'}" onclick="window.ImageEffects.switchCategory('${cat}')">
        ${this.getCategoryIcon(cat)} ${cat}
      </button>
    `).join("");
  },

  getCategoryIcon: function(cat) {
    switch (cat) {
      case "Color": return "🎨";
      case "Light": return "💡";
      case "Weather": return "🌧️";
      case "Artistic": return "🖌️";
      case "Texture": return "📜";
      default: return "✨";
    }
  },

  switchCategory: function(cat) {
    this.activeCategory = cat;
    this.renderCategoryButtons();
    this.renderEffectCards();
  },

  renderEffectCards: function() {
    const grid = document.getElementById("fx-grid-container");
    if (!grid) return;

    const filtered = this.effects.filter(fx => fx.category === this.activeCategory);

    grid.innerHTML = filtered.map(fx => {
      const formattedModifier = this.formatModifierWithIntensity(fx.promptModifier);

      return `
        <div class="card" style="padding:14px;margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-weight:600;font-size:14px;color:#fff;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
              <span>${this.getCategoryIcon(fx.category)}</span>
              <span>${fx.name}</span>
            </div>
            <div style="font-size:11px;color:#94a3b8;line-height:1.4;margin-bottom:12px;background:#0f172a;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.05);">
              ${formattedModifier}
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-primary" style="flex:1;" onclick="window.ImageEffects.applyEffect('${fx.id}')">
              ⚡ Apply to Prompt
            </button>
            <button class="btn btn-sm btn-secondary" onclick="navigator.clipboard.writeText('${escapeHTML(formattedModifier)}'); window.AutoFlow.showToast('📋 Copied effect modifier!','success');">
              Copy
            </button>
          </div>
        </div>
      `;
    }).join("");
  },

  formatModifierWithIntensity: function(baseModifier) {
    if (this.intensity >= 90) {
      return `ultra-intense ${baseModifier}, heavily pronounced style, masterpiece focus`;
    } else if (this.intensity >= 60) {
      return `${baseModifier}, rich dynamic aesthetic`;
    } else if (this.intensity >= 30) {
      return `subtle touch of ${baseModifier}, gentle atmospheric blend`;
    } else {
      return `faint hint of ${baseModifier}`;
    }
  },

  applyEffect: function(fxId) {
    const fx = this.effects.find(item => item.id === fxId);
    if (!fx) return;

    const modifier = this.formatModifierWithIntensity(fx.promptModifier);
    const textarea = document.getElementById("batch-raw-prompts");
    if (textarea) {
      if (textarea.value.trim()) {
        textarea.value = textarea.value.trim() + `, ${modifier}`;
      } else {
        textarea.value = `Cinematic portrait, ${modifier} --ar 16:9`;
      }
      window.AutoFlow.showToast(`✨ Appended "${fx.name}" to active batch prompts!`, "success");
    }
  }
};
