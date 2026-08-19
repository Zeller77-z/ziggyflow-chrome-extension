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
      // Default initial templates matching TobyFlow providers
      this.templates = {
        'default': {
          id: 'default',
          name: 'Google Flow (Auto-Detect + TobyFlow Bypass)',
          isDefault: true,
          clickStrategy: 'enter',
          strategyConfig: JSON.parse(JSON.stringify(this.defaultStrategyConfig)),
          promptInput: null,
          generateButton: null,
          aspectRatio: null,
          modelSelector: null
        },
        'google_gemini': {
          id: 'google_gemini',
          name: 'Google Gemini (gemini.google.com)',
          isDefault: false,
          clickStrategy: 'react_fiber',
          strategyConfig: JSON.parse(JSON.stringify(this.defaultStrategyConfig)),
          promptInput: {
            selector: "div[contenteditable='true'][role='textbox'], rich-textarea, textarea",
            xpath: "//div[@contenteditable='true' and @role='textbox'] | //rich-textarea | //textarea",
            tag: 'DIV',
            label: 'Gemini Composer Input',
            coords: { pctX: 0.5, pctY: 0.88 }
          },
          generateButton: {
            selector: "button[aria-label*='Send'], button[aria-label*='Gửi'], button:has(svg path[d*='M2.01'])",
            xpath: "//button[contains(@aria-label, 'Send') or contains(@aria-label, 'Gửi') or .//svg]",
            tag: 'BUTTON',
            label: 'Gemini Send / Submit Button',
            coords: { pctX: 0.82, pctY: 0.89 }
          },
          aspectRatio: null,
          modelSelector: null
        },
        'flow_2026': {
          id: 'flow_2026',
          name: 'Google Flow (Labs FX / Studio)',
          isDefault: false,
          clickStrategy: 'enter',
          strategyConfig: JSON.parse(JSON.stringify(this.defaultStrategyConfig)),
          promptInput: {
            selector: "[data-slate-editor='true'], textarea, div[role='textbox']",
            xpath: "//*[@data-slate-editor='true'] | //textarea | //div[@role='textbox']",
            tag: 'DIV',
            label: 'Flow Slate Prompt Container',
            coords: { pctX: 0.35, pctY: 0.88 }
          },
          generateButton: {
            selector: "button[aria-label*='generate'], button[aria-label*='submit'], button:has(i.google-symbols)",
            xpath: "//button[contains(@aria-label, 'generate') or contains(@aria-label, 'submit') or .//i[contains(text(), 'arrow_forward')]]",
            tag: 'BUTTON',
            label: 'Flow Arrow / Generate Button',
            coords: { pctX: 0.51, pctY: 0.91 }
          },
          aspectRatio: null,
          modelSelector: null
        }
      };
    }

    // Auto-migrate schema for any missing fields
    Object.values(this.templates).forEach(tpl => {
      if (!tpl.clickStrategy) tpl.clickStrategy = 'enter';
      if (!tpl.strategyConfig) tpl.strategyConfig = {};
      Object.keys(this.defaultStrategyConfig).forEach(strat => {
        if (!tpl.strategyConfig[strat]) {
          tpl.strategyConfig[strat] = { ...this.defaultStrategyConfig[strat] };
        }
      });
    });

    await chrome.storage.local.set({ domTemplates: this.templates });

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

    const currentStrat = tpl.clickStrategy || 'enter';

    if (stratSelect) {
      stratSelect.value = currentStrat;
    }

    document.querySelectorAll('#strategy-tool-chips .strategy-chip-btn').forEach(b => {
      const isAct = b.getAttribute('data-strat') === currentStrat;
      b.classList.toggle('active', isAct);
      b.style.background = isAct ? '#202619' : '#141519';
      b.style.borderColor = isAct ? '#a3e635' : '#2e3038';
      b.style.color = isAct ? '#a3e635' : '#cbd5e1';
      b.style.fontWeight = isAct ? '700' : '600';
    });

    const tplNameInput = document.getElementById('input-template-name');
    if (tplNameInput) {
      tplNameInput.value = tpl.name;
    }

    this.renderStrategyDynamicSettings(currentStrat);
  },

  defaultStrategyConfig: {
    enter: { preDelay: 100, modifier: 'none', preventNewline: true, requestSubmit: true, reactDispatch: true },
    standard: { hoverDelay: 80, holdDuration: 50, pointerEvents: true, forceFocus: true },
    coords: { pctX: 0.88, pctY: 0.91, offsetX: 0, offsetY: 0 },
    double: { clickCount: 2, burstInterval: 60, dispatchEnterAfter: true },
    react_fiber: { resetValueTracker: true, traverseFiber: true, simulateBeforeInput: true, invokeSubmit: true },
    automa_pipeline: { step1Focus: true, step2Type: true, step3Enter: true, step4BackupClick: true, timeoutMs: 3000, scrollBehavior: 'center' },
    xpath_cascade: { customXPath: "//button[contains(@aria-label, 'generate') or contains(@aria-label, 'submit')]", pierceShadow: true, filterNegatives: true }
  },

  renderStrategyDynamicSettings(strat) {
    const card = document.getElementById('strategy-dynamic-settings-card');
    if (!card) return;

    const tpl = this.getActiveTemplate();
    if (!tpl.strategyConfig) tpl.strategyConfig = {};
    if (!tpl.strategyConfig[strat]) {
      tpl.strategyConfig[strat] = { ...(this.defaultStrategyConfig[strat] || {}) };
    }
    const cfg = tpl.strategyConfig[strat];

    let html = '';

    if (strat === 'enter') {
      html = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1f222b;padding-bottom:5px;">
          <span style="font-size:11px;font-weight:700;color:#a3e635;">⚡ Direct Enter Keystroke Settings</span>
          <span style="font-size:9.5px;color:#94a3b8;background:#18191f;padding:1px 5px;border-radius:3px;">Fastest • Zero-Mapping</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Pre-Keystroke Delay:</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="range" id="strat-enter-predelay" min="0" max="800" step="50" value="${cfg.preDelay || 100}" style="width:70px;accent-color:#a3e635;" />
            <span id="strat-enter-predelay-val" style="font-size:10.5px;color:#a3e635;font-weight:700;min-width:38px;text-align:right;">${cfg.preDelay || 100}ms</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Key Modifier:</span>
          <select id="strat-enter-modifier" style="background:#18191f;border:1px solid #2e3038;color:#fff;font-size:10.5px;padding:2px 5px;border-radius:4px;">
            <option value="none" ${cfg.modifier === 'none' ? 'selected' : ''}>None (Standard Enter)</option>
            <option value="ctrl" ${cfg.modifier === 'ctrl' ? 'selected' : ''}>Ctrl + Enter</option>
            <option value="shift" ${cfg.modifier === 'shift' ? 'selected' : ''}>Shift + Enter</option>
          </select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Form requestSubmit() Fallback:</span>
          <input type="checkbox" id="strat-enter-submit" ${cfg.requestSubmit !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">React 18 State Sync:</span>
          <input type="checkbox" id="strat-enter-react" ${cfg.reactDispatch !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
      `;
    } else if (strat === 'standard') {
      html = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1f222b;padding-bottom:5px;">
          <span style="font-size:11px;font-weight:700;color:#a3e635;">🖱️ Mouse Click Chain Settings</span>
          <span style="font-size:9.5px;color:#94a3b8;background:#18191f;padding:1px 5px;border-radius:3px;">Human Simulation</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Pre-click Hover Pause:</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="range" id="strat-std-hover" min="0" max="500" step="20" value="${cfg.hoverDelay || 80}" style="width:70px;accent-color:#a3e635;" />
            <span id="strat-std-hover-val" style="font-size:10.5px;color:#a3e635;font-weight:700;min-width:38px;text-align:right;">${cfg.hoverDelay || 80}ms</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Click Hold Duration:</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="range" id="strat-std-hold" min="10" max="400" step="20" value="${cfg.holdDuration || 50}" style="width:70px;accent-color:#a3e635;" />
            <span id="strat-std-hold-val" style="font-size:10.5px;color:#a3e635;font-weight:700;min-width:38px;text-align:right;">${cfg.holdDuration || 50}ms</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Full Pointer Events (pointerdown/up):</span>
          <input type="checkbox" id="strat-std-pointer" ${cfg.pointerEvents !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Force Element Focus before Click:</span>
          <input type="checkbox" id="strat-std-focus" ${cfg.forceFocus !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
      `;
    } else if (strat === 'coords') {
      html = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1f222b;padding-bottom:5px;">
          <span style="font-size:11px;font-weight:700;color:#a3e635;">📍 Viewport Coordinates Settings</span>
          <span style="font-size:9.5px;color:#94a3b8;background:#18191f;padding:1px 5px;border-radius:3px;">Physical Coordinate Target</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Viewport X Percentage:</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="range" id="strat-coords-x" min="0" max="100" step="1" value="${Math.round((cfg.pctX || 0.88) * 100)}" style="width:70px;accent-color:#a3e635;" />
            <span id="strat-coords-x-val" style="font-size:10.5px;color:#a3e635;font-weight:700;min-width:32px;text-align:right;">${Math.round((cfg.pctX || 0.88) * 100)}%</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Viewport Y Percentage:</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="range" id="strat-coords-y" min="0" max="100" step="1" value="${Math.round((cfg.pctY || 0.91) * 100)}" style="width:70px;accent-color:#a3e635;" />
            <span id="strat-coords-y-val" style="font-size:10.5px;color:#a3e635;font-weight:700;min-width:32px;text-align:right;">${Math.round((cfg.pctY || 0.91) * 100)}%</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Pixel Offset (ΔX, ΔY):</span>
          <div style="display:flex;gap:4px;">
            <input type="number" id="strat-coords-offx" value="${cfg.offsetX || 0}" placeholder="ΔX" style="width:40px;background:#18191f;border:1px solid #2e3038;color:#fff;font-size:10px;padding:2px 4px;border-radius:4px;" />
            <input type="number" id="strat-coords-offy" value="${cfg.offsetY || 0}" placeholder="ΔY" style="width:40px;background:#18191f;border:1px solid #2e3038;color:#fff;font-size:10px;padding:2px 4px;border-radius:4px;" />
          </div>
        </div>
      `;
    } else if (strat === 'double') {
      html = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1f222b;padding-bottom:5px;">
          <span style="font-size:11px;font-weight:700;color:#a3e635;">⚡ Multi-Click Burst Settings</span>
          <span style="font-size:9.5px;color:#94a3b8;background:#18191f;padding:1px 5px;border-radius:3px;">Burst Sequence</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Burst Click Count:</span>
          <select id="strat-double-count" style="background:#18191f;border:1px solid #2e3038;color:#fff;font-size:10.5px;padding:2px 5px;border-radius:4px;">
            <option value="2" ${cfg.clickCount === 2 ? 'selected' : ''}>2x (Double Click)</option>
            <option value="3" ${cfg.clickCount === 3 ? 'selected' : ''}>3x (Triple Burst)</option>
            <option value="4" ${cfg.clickCount === 4 ? 'selected' : ''}>4x (Quad Burst)</option>
          </select>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Burst Interval (ms):</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="range" id="strat-double-interval" min="20" max="250" step="10" value="${cfg.burstInterval || 60}" style="width:70px;accent-color:#a3e635;" />
            <span id="strat-double-interval-val" style="font-size:10.5px;color:#a3e635;font-weight:700;min-width:38px;text-align:right;">${cfg.burstInterval || 60}ms</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Dispatch Enter After Burst:</span>
          <input type="checkbox" id="strat-double-enter" ${cfg.dispatchEnterAfter !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
      `;
    } else if (strat === 'react_fiber') {
      html = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1f222b;padding-bottom:5px;">
          <span style="font-size:11px;font-weight:700;color:#a3e635;">⚛️ React 18 Fiber Engine Settings</span>
          <span style="font-size:9.5px;color:#94a3b8;background:#18191f;padding:1px 5px;border-radius:3px;">Direct Fiber Invocation</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Reset _valueTracker instance:</span>
          <input type="checkbox" id="strat-rf-tracker" ${cfg.resetValueTracker !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Traverse Fiber for __reactProps$.onClick:</span>
          <input type="checkbox" id="strat-rf-fiber" ${cfg.traverseFiber !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Dispatch beforeinput event:</span>
          <input type="checkbox" id="strat-rf-beforeinput" ${cfg.simulateBeforeInput !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
      `;
    } else if (strat === 'automa_pipeline') {
      html = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1f222b;padding-bottom:5px;">
          <span style="font-size:11px;font-weight:700;color:#a3e635;">🤖 Automa / Playwright Pipeline</span>
          <span style="font-size:9.5px;color:#94a3b8;background:#18191f;padding:1px 5px;border-radius:3px;">Multi-Step Chain</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">1. Focus & Clear Input:</span>
          <input type="checkbox" id="strat-ap-step1" ${cfg.step1Focus !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">2. Native ExecCommand Typing:</span>
          <input type="checkbox" id="strat-ap-step2" ${cfg.step2Type !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">3. Dispatch Enter Keystroke:</span>
          <input type="checkbox" id="strat-ap-step3" ${cfg.step3Enter !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">4. Backup Button Click Trigger:</span>
          <input type="checkbox" id="strat-ap-step4" ${cfg.step4BackupClick !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
      `;
    } else if (strat === 'xpath_cascade') {
      html = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #1f222b;padding-bottom:5px;">
          <span style="font-size:11px;font-weight:700;color:#a3e635;">🧭 XPath & Shadow-DOM Settings</span>
          <span style="font-size:9.5px;color:#94a3b8;background:#18191f;padding:1px 5px;border-radius:3px;">Deep DOM Evaluator</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <span style="font-size:10.5px;color:#cbd5e1;">Custom XPath Expression:</span>
          <input type="text" id="strat-xp-custom" value="${cfg.customXPath || "//button[contains(@aria-label, 'generate')]"}" style="background:#18191f;border:1px solid #2e3038;color:#a3e635;font-size:10px;font-family:monospace;padding:4px 6px;border-radius:4px;width:100%;box-sizing:border-box;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Pierce Shadow Roots (findAllDeep):</span>
          <input type="checkbox" id="strat-xp-pierce" ${cfg.pierceShadow !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10.5px;color:#cbd5e1;">Strict Back/Header Button Filter:</span>
          <input type="checkbox" id="strat-xp-filter" ${cfg.filterNegatives !== false ? 'checked' : ''} style="accent-color:#a3e635;cursor:pointer;" />
        </div>
      `;
    }

    card.innerHTML = html;

    // Attach reactive listeners to update cfg
    const saveCfg = async () => {
      await this.saveTemplates();
    };

    if (strat === 'enter') {
      const slider = document.getElementById('strat-enter-predelay');
      const valText = document.getElementById('strat-enter-predelay-val');
      slider?.addEventListener('input', (e) => {
        cfg.preDelay = parseInt(e.target.value, 10);
        if (valText) valText.innerText = `${cfg.preDelay}ms`;
        saveCfg();
      });
      document.getElementById('strat-enter-modifier')?.addEventListener('change', (e) => {
        cfg.modifier = e.target.value;
        saveCfg();
      });
      document.getElementById('strat-enter-submit')?.addEventListener('change', (e) => {
        cfg.requestSubmit = e.target.checked;
        saveCfg();
      });
      document.getElementById('strat-enter-react')?.addEventListener('change', (e) => {
        cfg.reactDispatch = e.target.checked;
        saveCfg();
      });
    } else if (strat === 'standard') {
      const hoverSlider = document.getElementById('strat-std-hover');
      const hoverVal = document.getElementById('strat-std-hover-val');
      hoverSlider?.addEventListener('input', (e) => {
        cfg.hoverDelay = parseInt(e.target.value, 10);
        if (hoverVal) hoverVal.innerText = `${cfg.hoverDelay}ms`;
        saveCfg();
      });
      const holdSlider = document.getElementById('strat-std-hold');
      const holdVal = document.getElementById('strat-std-hold-val');
      holdSlider?.addEventListener('input', (e) => {
        cfg.holdDuration = parseInt(e.target.value, 10);
        if (holdVal) holdVal.innerText = `${cfg.holdDuration}ms`;
        saveCfg();
      });
      document.getElementById('strat-std-pointer')?.addEventListener('change', (e) => {
        cfg.pointerEvents = e.target.checked;
        saveCfg();
      });
      document.getElementById('strat-std-focus')?.addEventListener('change', (e) => {
        cfg.forceFocus = e.target.checked;
        saveCfg();
      });
    } else if (strat === 'coords') {
      const xSlider = document.getElementById('strat-coords-x');
      const xVal = document.getElementById('strat-coords-x-val');
      xSlider?.addEventListener('input', (e) => {
        cfg.pctX = parseInt(e.target.value, 10) / 100;
        if (xVal) xVal.innerText = `${e.target.value}%`;
        saveCfg();
      });
      const ySlider = document.getElementById('strat-coords-y');
      const yVal = document.getElementById('strat-coords-y-val');
      ySlider?.addEventListener('input', (e) => {
        cfg.pctY = parseInt(e.target.value, 10) / 100;
        if (yVal) yVal.innerText = `${e.target.value}%`;
        saveCfg();
      });
      document.getElementById('strat-coords-offx')?.addEventListener('input', (e) => {
        cfg.offsetX = parseInt(e.target.value, 10) || 0;
        saveCfg();
      });
      document.getElementById('strat-coords-offy')?.addEventListener('input', (e) => {
        cfg.offsetY = parseInt(e.target.value, 10) || 0;
        saveCfg();
      });
    } else if (strat === 'double') {
      document.getElementById('strat-double-count')?.addEventListener('change', (e) => {
        cfg.clickCount = parseInt(e.target.value, 10);
        saveCfg();
      });
      const intSlider = document.getElementById('strat-double-interval');
      const intVal = document.getElementById('strat-double-interval-val');
      intSlider?.addEventListener('input', (e) => {
        cfg.burstInterval = parseInt(e.target.value, 10);
        if (intVal) intVal.innerText = `${cfg.burstInterval}ms`;
        saveCfg();
      });
      document.getElementById('strat-double-enter')?.addEventListener('change', (e) => {
        cfg.dispatchEnterAfter = e.target.checked;
        saveCfg();
      });
    } else if (strat === 'react_fiber') {
      document.getElementById('strat-rf-tracker')?.addEventListener('change', (e) => {
        cfg.resetValueTracker = e.target.checked;
        saveCfg();
      });
      document.getElementById('strat-rf-fiber')?.addEventListener('change', (e) => {
        cfg.traverseFiber = e.target.checked;
        saveCfg();
      });
      document.getElementById('strat-rf-beforeinput')?.addEventListener('change', (e) => {
        cfg.simulateBeforeInput = e.target.checked;
        saveCfg();
      });
    } else if (strat === 'automa_pipeline') {
      document.getElementById('strat-ap-step1')?.addEventListener('change', (e) => {
        cfg.step1Focus = e.target.checked;
        saveCfg();
      });
      document.getElementById('strat-ap-step2')?.addEventListener('change', (e) => {
        cfg.step2Type = e.target.checked;
        saveCfg();
      });
      document.getElementById('strat-ap-step3')?.addEventListener('change', (e) => {
        cfg.step3Enter = e.target.checked;
        saveCfg();
      });
      document.getElementById('strat-ap-step4')?.addEventListener('change', (e) => {
        cfg.step4BackupClick = e.target.checked;
        saveCfg();
      });
    } else if (strat === 'xpath_cascade') {
      document.getElementById('strat-xp-custom')?.addEventListener('input', (e) => {
        cfg.customXPath = e.target.value;
        saveCfg();
      });
      document.getElementById('strat-xp-pierce')?.addEventListener('change', (e) => {
        cfg.pierceShadow = e.target.checked;
        saveCfg();
      });
      document.getElementById('strat-xp-filter')?.addEventListener('change', (e) => {
        cfg.filterNegatives = e.target.checked;
        saveCfg();
      });
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
        clickStrategy: 'enter',
        strategyConfig: JSON.parse(JSON.stringify(this.defaultStrategyConfig)),
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

    // Click strategy change -> update chips and re-render dynamic settings card!
    document.getElementById('select-click-strategy')?.addEventListener('change', async (e) => {
      const strat = e.target.value;
      const tpl = this.getActiveTemplate();
      tpl.clickStrategy = strat;
      await this.saveTemplates();

      document.querySelectorAll('#strategy-tool-chips .strategy-chip-btn').forEach(b => {
        const isAct = b.getAttribute('data-strat') === strat;
        b.classList.toggle('active', isAct);
        b.style.background = isAct ? '#202619' : '#141519';
        b.style.borderColor = isAct ? '#a3e635' : '#2e3038';
        b.style.color = isAct ? '#a3e635' : '#cbd5e1';
        b.style.fontWeight = isAct ? '700' : '600';
      });

      this.renderStrategyDynamicSettings(strat);
      window.AutoFlow.showToast(`⚡ Engine set to: ${strat.toUpperCase()}`, 'info');
    });

    // Tool Chips Click
    document.querySelectorAll('#strategy-tool-chips .strategy-chip-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const strat = btn.getAttribute('data-strat');
        const tpl = this.getActiveTemplate();
        tpl.clickStrategy = strat;
        await this.saveTemplates();

        const stratSelect = document.getElementById('select-click-strategy');
        if (stratSelect) stratSelect.value = strat;

        document.querySelectorAll('#strategy-tool-chips .strategy-chip-btn').forEach(b => {
          const isAct = b.getAttribute('data-strat') === strat;
          b.classList.toggle('active', isAct);
          b.style.background = isAct ? '#202619' : '#141519';
          b.style.borderColor = isAct ? '#a3e635' : '#2e3038';
          b.style.color = isAct ? '#a3e635' : '#cbd5e1';
          b.style.fontWeight = isAct ? '700' : '600';
        });

        this.renderStrategyDynamicSettings(strat);
        window.AutoFlow.showToast(`⚡ Engine set to: ${strat.toUpperCase()}`, 'info');
      });
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
