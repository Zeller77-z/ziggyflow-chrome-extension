/**
 * ZiggyFlow Custom DOM Mapping & Template Management Studio
 * Inspired by open-source browser automation (Automa, Selenium IDE, UI.Vision)
 * Allows users to visually point-and-click to map any element on screen,
 * save multiple named UI templates, configure click strategies, and export/import presets.
 */

window.DomTemplatesManager = {
  activeTemplateId: 'default',
  templates: {},

  init: async function() {
    await this.loadTemplates();
    this.renderTemplateSelector();
    this.renderActiveTemplateDetails();
    this.bindEvents();
    console.log('DomTemplatesManager initialized.');
  },

  async loadTemplates() {
    const data = await chrome.storage.local.get(['domTemplates', 'activeDomTemplateId']);
    
    if (data.domTemplates && Object.keys(data.domTemplates).length > 0) {
      this.templates = data.domTemplates;
    } else {
      // Default initial templates
      this.templates = {
        'default': {
          id: 'default',
          name: 'Google Flow (Auto-Detect Heuristic)',
          isDefault: true,
          clickStrategy: 'standard', // standard | coords | enter | double
          promptInput: null,
          generateButton: null,
          aspectRatio: null,
          modelSelector: null
        },
        'flow_2026': {
          id: 'flow_2026',
          name: 'Google Flow (2026 Layout)',
          isDefault: false,
          clickStrategy: 'standard',
          promptInput: {
            selector: "textarea, div[role='textbox']",
            xpath: "//textarea | //div[@role='textbox']",
            tag: 'TEXTAREA',
            label: 'Bottom Prompt Container',
            coords: { pctX: 0.35, pctY: 0.88 }
          },
          generateButton: {
            selector: "button[aria-label*='generate'], button[aria-label*='submit'], button svg",
            xpath: "//button[contains(@aria-label, 'generate') or contains(@aria-label, 'submit')]",
            tag: 'BUTTON',
            label: 'Circular Generate Arrow Button',
            coords: { pctX: 0.51, pctY: 0.91 }
          },
          aspectRatio: null,
          modelSelector: null
        }
      };
      await chrome.storage.local.set({ domTemplates: this.templates });
    }

    if (data.activeDomTemplateId && this.templates[data.activeDomTemplateId]) {
      this.activeTemplateId = data.activeDomTemplateId;
    } else {
      this.activeTemplateId = 'default';
    }
  },

  async saveTemplates() {
    await chrome.storage.local.set({
      domTemplates: this.templates,
      activeDomTemplateId: this.activeTemplateId
    });
  },

  getActiveTemplate() {
    return this.templates[this.activeTemplateId] || this.templates['default'];
  },

  renderTemplateSelector() {
    const select = document.getElementById('select-dom-template');
    if (!select) return;

    select.innerHTML = '';
    Object.values(this.templates).forEach(tpl => {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.innerText = tpl.name + (tpl.id === this.activeTemplateId ? ' (Active)' : '');
      if (tpl.id === this.activeTemplateId) opt.selected = true;
      select.appendChild(opt);
    });
  },

  renderActiveTemplateDetails() {
    const tpl = this.getActiveTemplate();
    if (!tpl) return;

    const labelPrompt = document.getElementById('label-mapped-prompt');
    const labelGenerate = document.getElementById('label-mapped-generate');
    const labelRatio = document.getElementById('label-mapped-ratio');
    const stratSelect = document.getElementById('select-click-strategy');

    if (labelPrompt) {
      labelPrompt.innerText = tpl.promptInput ? (tpl.promptInput.label || 'Mapped ✓') : 'Map Prompt Box';
      labelPrompt.style.color = tpl.promptInput ? '#a3e635' : '#cbd5e1';
    }

    if (labelGenerate) {
      labelGenerate.innerText = tpl.generateButton ? (tpl.generateButton.label || 'Mapped ✓') : 'Map Generate Btn';
      labelGenerate.style.color = tpl.generateButton ? '#a3e635' : '#cbd5e1';
    }

    if (labelRatio) {
      labelRatio.innerText = tpl.aspectRatio ? (tpl.aspectRatio.label || 'Mapped ✓') : 'Map Ratio Area';
      labelRatio.style.color = tpl.aspectRatio ? '#a3e635' : '#cbd5e1';
    }

    if (stratSelect) {
      stratSelect.value = tpl.clickStrategy || 'standard';
    }

    const tplNameInput = document.getElementById('input-template-name');
    if (tplNameInput) {
      tplNameInput.value = tpl.name;
    }
  },

  bindEvents() {
    // Switch active template
    document.getElementById('select-dom-template')?.addEventListener('change', async (e) => {
      this.activeTemplateId = e.target.value;
      await this.saveTemplates();
      this.renderTemplateSelector();
      this.renderActiveTemplateDetails();
      window.AutoFlow.showToast(`🎯 Switched to DOM Template: ${this.getActiveTemplate().name}`, 'success');
    });

    // Create new template
    document.getElementById('btn-new-template')?.addEventListener('click', async () => {
      const name = prompt('Enter a name for the new DOM Template:', 'Google Flow Custom ' + (Object.keys(this.templates).length + 1));
      if (!name || !name.trim()) return;

      const newId = 'tpl_' + Date.now();
      this.templates[newId] = {
        id: newId,
        name: name.trim(),
        isDefault: false,
        clickStrategy: 'standard',
        promptInput: null,
        generateButton: null,
        aspectRatio: null,
        modelSelector: null
      };

      this.activeTemplateId = newId;
      await this.saveTemplates();
      this.renderTemplateSelector();
      this.renderActiveTemplateDetails();
      window.AutoFlow.showToast(`✨ Created New Template: ${name}`, 'success');
    });

    // Rename template
    document.getElementById('btn-rename-template')?.addEventListener('click', async () => {
      const tpl = this.getActiveTemplate();
      if (tpl.isDefault) {
        window.AutoFlow.showToast('⚠️ Default template cannot be renamed.', 'info');
        return;
      }
      const newName = prompt('Rename template:', tpl.name);
      if (newName && newName.trim()) {
        tpl.name = newName.trim();
        await this.saveTemplates();
        this.renderTemplateSelector();
        this.renderActiveTemplateDetails();
        window.AutoFlow.showToast(`✏️ Renamed template to: ${tpl.name}`, 'success');
      }
    });

    // Delete template
    document.getElementById('btn-delete-template')?.addEventListener('click', async () => {
      const tpl = this.getActiveTemplate();
      if (tpl.isDefault) {
        window.AutoFlow.showToast('⚠️ Cannot delete the Default template.', 'error');
        return;
      }
      if (confirm(`Are you sure you want to delete template "${tpl.name}"?`)) {
        delete this.templates[tpl.id];
        this.activeTemplateId = 'default';
        await this.saveTemplates();
        this.renderTemplateSelector();
        this.renderActiveTemplateDetails();
        window.AutoFlow.showToast('🗑️ Deleted template.', 'info');
      }
    });

    // Click strategy change
    document.getElementById('select-click-strategy')?.addEventListener('change', async (e) => {
      const tpl = this.getActiveTemplate();
      tpl.clickStrategy = e.target.value;
      await this.saveTemplates();
      window.AutoFlow.showToast(`⚡ Click strategy set to: ${e.target.value.toUpperCase()}`, 'info');
    });

    // Visual Mapper Buttons
    document.getElementById('btn-pick-prompt')?.addEventListener('click', () => {
      this.triggerVisualElementMapper('promptInput', '✍️ Prompt Input Box');
    });

    document.getElementById('btn-pick-generate')?.addEventListener('click', () => {
      this.triggerVisualElementMapper('generateButton', '🚀 Generate Button');
    });

    document.getElementById('btn-pick-ratio')?.addEventListener('click', () => {
      this.triggerVisualElementMapper('aspectRatio', '📐 Aspect Ratio Control');
    });

    // Test element highlight
    document.getElementById('btn-test-highlight-prompt')?.addEventListener('click', () => {
      this.testElementAction('promptInput', 'highlight');
    });

    document.getElementById('btn-test-highlight-gen')?.addEventListener('click', () => {
      this.testElementAction('generateButton', 'highlight');
    });

    // Test click button
    document.getElementById('btn-test-click-gen')?.addEventListener('click', () => {
      this.testElementAction('generateButton', 'click');
    });

    // Export Templates JSON
    document.getElementById('btn-export-templates')?.addEventListener('click', () => {
      const json = JSON.stringify(this.templates, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ziggyflow-dom-templates-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      window.AutoFlow.showToast('💾 Exported DOM Templates JSON!', 'success');
    });

    // Import Templates JSON
    document.getElementById('btn-import-templates')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') {
            this.templates = { ...this.templates, ...parsed };
            await this.saveTemplates();
            this.renderTemplateSelector();
            this.renderActiveTemplateDetails();
            window.AutoFlow.showToast('📥 Successfully imported templates!', 'success');
          }
        } catch(err) {
          window.AutoFlow.showToast('❌ Invalid JSON template file.', 'error');
        }
      };
      input.click();
    });

    // Toggle Manual Mapping Panel visibility
    const toggle = document.getElementById('toggle-manual-mapping');
    const controls = document.getElementById('manual-mapping-controls');
    toggle?.addEventListener('click', () => {
      toggle.classList.toggle('active');
      const isAct = toggle.classList.contains('active');
      if (controls) controls.style.display = isAct ? 'flex' : 'none';
      window.AutoFlow.showToast(isAct ? '🎯 Manual DOM Mapping Studio Enabled' : '🔄 Auto-Detect Mode Active', 'info');
    });
  },

  async triggerVisualElementMapper(slotName, friendlyLabel) {
    let targetTab = null;
    try {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabs[0]?.url && (activeTabs[0].url.includes("google") || activeTabs[0].url.includes("flow") || activeTabs[0].url.includes("aitestkitchen"))) {
        targetTab = activeTabs[0];
      }
    } catch(e) {}

    if (!targetTab) {
      const allTabs = await chrome.tabs.query({});
      targetTab = allTabs.find(t => t.url && (t.url.includes("labs.google") || t.url.includes("aitestkitchen") || t.url.includes("google.com")));
    }

    if (!targetTab) {
      window.AutoFlow.showToast('⚠️ Please open a Google Flow tab first to visually map elements.', 'error');
      return;
    }

    // Switch focus to target Google Flow tab
    try {
      if (targetTab.id) {
        chrome.tabs.update(targetTab.id, { active: true });
      }
    } catch(e) {}

    window.AutoFlow.showToast(`📍 Switched to Google Flow! Hover and click on: ${friendlyLabel}`, 'info');

    // Send to tab directly
    chrome.tabs.sendMessage(targetTab.id, {
      action: 'START_VISUAL_ELEMENT_MAPPER',
      slotName: slotName,
      friendlyLabel: friendlyLabel,
      templateId: this.activeTemplateId
    }, (res) => {
      if (chrome.runtime.lastError) {
        // Fallback to background routing
        chrome.runtime.sendMessage({
          action: 'START_VISUAL_ELEMENT_MAPPER',
          slotName: slotName,
          friendlyLabel: friendlyLabel,
          templateId: this.activeTemplateId
        });
      }
    });
  },

  async testElementAction(slotName, actionType) {
    let targetTab = null;
    try {
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabs[0]?.url && (activeTabs[0].url.includes("google") || activeTabs[0].url.includes("flow") || activeTabs[0].url.includes("aitestkitchen"))) {
        targetTab = activeTabs[0];
      }
    } catch(e) {}

    if (!targetTab) {
      const allTabs = await chrome.tabs.query({});
      targetTab = allTabs.find(t => t.url && (t.url.includes("labs.google") || t.url.includes("aitestkitchen") || t.url.includes("google.com")));
    }

    if (!targetTab) {
      window.AutoFlow.showToast('⚠️ Please open Google Flow to test.', 'error');
      return;
    }

    const tpl = this.getActiveTemplate();
    chrome.tabs.sendMessage(targetTab.id, {
      action: 'TEST_DOM_ELEMENT_ACTION',
      slotName: slotName,
      actionType: actionType,
      template: tpl
    }, (res) => {
      if (chrome.runtime.lastError) {
        window.AutoFlow.showToast('⚠️ Could not connect to Google Flow tab. Please refresh the page.', 'error');
        return;
      }
      if (res?.found) {
        window.AutoFlow.showToast(`✅ Element found! (${res.tag} - ${res.rect})`, 'success');
      } else {
        window.AutoFlow.showToast("⚠️ Element not found using this template's selector. Try re-mapping.", 'error');
      }
    });
  }
};

// Listen for mapped element confirmation from content script
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.action === 'ELEMENT_MAPPED_SUCCESS' && msg.payload) {
    const { slotName, data, templateId } = msg.payload;
    if (window.DomTemplatesManager.templates[templateId]) {
      window.DomTemplatesManager.templates[templateId][slotName] = data;
      await window.DomTemplatesManager.saveTemplates();
      window.DomTemplatesManager.renderActiveTemplateDetails();
      window.AutoFlow.showToast(`✅ Successfully mapped: ${data.label || slotName}!`, 'success');
    }
  }
});
