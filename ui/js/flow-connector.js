/**
 * ZiggyFlow Google Flow Connector & UI Mode Manager
 * Handles dynamic switching between Image & Video Generation,
 * 2-way Google Flow project controller, live prompt counting, and downloads.
 */

window.FlowConnector = {
  activeProvider: "flow",
  mediaType: "image",
  quantity: 1,
  isMultiPrompt: false,
  autoDownload: true,
  noWatermark: true,
  selectedReferenceImage: null,
  startFrameDataUrl: null,
  endFrameDataUrl: null,
  duration: "6s",
  framingMode: "Frames",
  voice: "random",
  detectedProjects: [],
  activeProjectName: "Aug 02, 02:05 PM",

  init: async function() {
    this.setupEvents();
    this.checkFlowTabsAndProjects();
    this.loadSavedSettings();
    this.updatePromptCount();

    // Listen for project sync and snip messages
    chrome.runtime.onMessage.addListener((req) => {
      if (req.action === "SYNC_FLOW_PROJECTS" && req.payload?.projects) {
        this.detectedProjects = req.payload.projects;
        this.renderProjectMenu();
      }

      if (req.action === "SNIPPED_REFERENCE_READY" && req.payload?.dataUrl) {
        this.selectedReferenceImage = req.payload.dataUrl;
        const name = req.payload.name || "Snipped Reference";
        this.displayReferencePreview(req.payload.dataUrl, name);
        window.AutoFlow.showToast(`🖼️ Attached snipped reference: @${name}`, "success");
      }

      if (req.action === "TASK_STARTED") {
        const stopBtn = document.getElementById("btn-stop-main");
        const btnText = document.getElementById("btn-generate-text");
        if (stopBtn) stopBtn.style.display = "flex";
        if (btnText) btnText.innerText = "Generating...";
      }

      if (req.action === "LIVE_RENDER_PROGRESS") {
        const btnText = document.getElementById("btn-generate-text");
        if (btnText) {
          btnText.innerText = req.progress ? `⏳ Rendering ${req.progress}...` : `⏳ Flow Rendering...`;
        }
      }

      if (req.action === "QUEUE_STOPPED" || req.action === "QUEUE_FINISHED") {
        const stopBtn = document.getElementById("btn-stop-main");
        const btn = document.getElementById("btn-generate-main");
        const btnText = document.getElementById("btn-generate-text");
        if (stopBtn) stopBtn.style.display = "none";
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = "1";
        }
        if (btnText) btnText.innerText = "Generate";
      }
    });

    // Storage listener to guarantee instant snip ingestion and element map sync
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.latestSnippedReference?.newValue) {
          const dataUrl = changes.latestSnippedReference.newValue;
          const name = changes.latestSnippedName?.newValue || "Snipped Reference";
          this.selectedReferenceImage = dataUrl;
          this.displayReferencePreview(dataUrl, name);
          window.AutoFlow.showToast(`🖼️ Attached snipped reference: @${name}`, "success");
        }

        if (changes.customElementMap) {
          this.updateMappedLabels(changes.customElementMap.newValue || {});
        }
      }
    });

    this.loadElementMap();
    setInterval(() => this.checkFlowTabsAndProjects(), 3000);
  },

  setupEvents: function() {
    // 1. Provider Pills
    document.querySelectorAll(".provider-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".provider-pill").forEach(p => {
          p.classList.remove("active", "active-flow");
        });
        pill.classList.add("active");
        if (pill.getAttribute("data-provider") === "flow") {
          pill.classList.add("active-flow");
        }
        this.activeProvider = pill.getAttribute("data-provider") || "flow";
        this.updateModelOptions();
        this.log(`[PROVIDER] Switched active provider to: ${this.activeProvider.toUpperCase()}`);
      });
    });

    // 2. Dynamic Image vs Video Mode Switchers
    const imgControls = document.getElementById("image-mode-controls");
    const vidControls = document.getElementById("video-mode-controls");

    const switchToImage = () => {
      this.mediaType = "image";
      if (imgControls) imgControls.style.display = "flex";
      if (vidControls) vidControls.style.display = "none";
      this.updateModelOptions();
      this.log("[MODE] Switched to Image Generation Mode (Nano Banana / GPT Image)");
    };

    const switchToVideo = () => {
      this.mediaType = "video";
      if (imgControls) imgControls.style.display = "none";
      if (vidControls) vidControls.style.display = "flex";
      this.updateModelOptions();
      this.log("[MODE] Switched to Video Generation Mode (Omni Flash / Veo 3.1)");
    };

    document.getElementById("btn-type-image")?.addEventListener("click", switchToImage);
    document.getElementById("btn-type-image-trigger")?.addEventListener("click", switchToImage);
    document.getElementById("btn-type-video")?.addEventListener("click", switchToVideo);
    document.getElementById("btn-type-video-trigger")?.addEventListener("click", switchToVideo);

    // 3. Live Prompt Counter & Multi-Prompt Toggle
    const promptInput = document.getElementById("gen-prompt-input");
    promptInput?.addEventListener("input", () => {
      this.updatePromptCount();
      chrome.storage.local.set({ ziggyPrompt: promptInput.value });
    });

    // Sync from storage
    chrome.storage.local.get(["ziggyPrompt"], (res) => {
      if (res?.ziggyPrompt && promptInput) {
        promptInput.value = res.ziggyPrompt;
        this.updatePromptCount();
      }
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.ziggyPrompt && promptInput && promptInput.value !== changes.ziggyPrompt.newValue) {
        promptInput.value = changes.ziggyPrompt.newValue || "";
        this.updatePromptCount();
      }
    });

    document.getElementById("multi-prompt-toggle-wrap")?.addEventListener("click", () => {
      const toggle = document.getElementById("toggle-multi-prompt");
      this.isMultiPrompt = !this.isMultiPrompt;
      if (toggle) toggle.classList.toggle("active", this.isMultiPrompt);
      window.AutoFlow.showToast(this.isMultiPrompt ? "⚡ Multi-Prompt mode ON" : "Single Prompt mode active", "info");
    });

    // 4. Steppers (Image & Video)
    this.setupStepper("stepper-minus-img", "stepper-plus-img", "stepper-value-img");
    this.setupStepper("stepper-minus-vid", "stepper-plus-vid", "stepper-value-vid");

    // 5. Video Mode: Framing, Duration, Voice
    document.getElementById("select-framing-mode")?.addEventListener("change", (e) => {
      this.framingMode = e.target.value;
    });

    document.getElementById("select-duration")?.addEventListener("change", (e) => {
      this.duration = e.target.value;
    });

    document.getElementById("select-voice-video")?.addEventListener("change", (e) => {
      this.voice = e.target.value;
      const voiceNames = {
        random: "Random voice",
        male_narrator: "Male Narrator",
        female_cinematic: "Female Cinematic",
        deep_voice: "Deep Dramatic"
      };
      this.appendPromptModifier(`voiceover in ${voiceNames[this.voice] || this.voice}`);
    });

    // 6. Character & Style Dropdowns
    this.setupModifierDropdown("select-character-image");
    this.setupModifierDropdown("select-character-video");
    this.setupModifierDropdown("select-style-image");
    this.setupModifierDropdown("select-style-video");

    // 7. START & END Keyframe Uploads
    this.setupKeyframeSlot("slot-start-frame", "input-start-frame", "start");
    this.setupKeyframeSlot("slot-end-frame", "input-end-frame", "end");

    // 8. Reference Dropzones
    this.setupDropzone("dropzone-upload-img", "dropzone-file-input-img", "dropzone-label-img");
    this.setupDropzone("dropzone-upload-vid", "dropzone-file-input-vid", "dropzone-label-vid", "ref-image-count-vid");

    // 9. Prompt Assistant & Import chips
    document.getElementById("chip-btn-assistant")?.addEventListener("click", () => {
      if (promptInput && promptInput.value.trim()) {
        const enhanced = window.PromptEnhancer ? window.PromptEnhancer.heuristicEnhance(promptInput.value.trim(), window.PromptEnhancer.styles.cinematic) : promptInput.value;
        promptInput.value = enhanced;
        this.updatePromptCount();
        window.AutoFlow.showToast("✨ Upgraded prompt with AI Assistant!", "success");
      } else {
        window.AutoFlow.showToast("⚠️ Type an initial idea first to enhance it.", "info");
      }
    });

    document.getElementById("chip-btn-import")?.addEventListener("click", () => {
      document.getElementById("gen-file-import")?.click();
    });

    document.getElementById("gen-file-import")?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (promptInput) {
          promptInput.value = lines.join("\n");
          this.updatePromptCount();
        }
        window.AutoFlow.showToast(`📥 Imported ${lines.length} prompts from ${file.name}!`, "success");
      };
      reader.readAsText(file);
    });

    document.getElementById("chip-btn-snip")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "TRIGGER_SCREEN_CAPTURE_ACTIVE_TAB" });
    });
    document.getElementById("dropzone-snip-btn-img")?.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: "TRIGGER_SCREEN_CAPTURE_ACTIVE_TAB" });
    });
    document.getElementById("dropzone-snip-btn-vid")?.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ action: "TRIGGER_SCREEN_CAPTURE_ACTIVE_TAB" });
    });

    // 10. Toggles
    this.setupToggle("toggle-watermark-img", "noWatermark");
    this.setupToggle("toggle-watermark-vid", "noWatermark");
    
    document.getElementById("toggle-auto-download-wrap")?.addEventListener("click", () => {
      const toggle = document.getElementById("toggle-auto-download");
      this.autoDownload = !this.autoDownload;
      if (toggle) toggle.classList.toggle("active", this.autoDownload);
      chrome.storage.local.set({ autoDownload: this.autoDownload });
      window.AutoFlow.showToast(this.autoDownload ? "✅ Auto-download active" : "Auto-download paused", "info");
    });

    // 11. Subfolder Settings Drawer
    const drawer = document.getElementById("subfolder-settings-drawer");
    document.getElementById("btn-folder-settings")?.addEventListener("click", () => {
      if (drawer) {
        drawer.style.display = drawer.style.display === "none" ? "flex" : "none";
      }
    });

    document.getElementById("btn-close-drawer")?.addEventListener("click", () => {
      if (drawer) drawer.style.display = "none";
    });

    document.getElementById("btn-save-drawer-settings")?.addEventListener("click", () => {
      const tpl = document.getElementById("input-naming-template")?.value.trim();
      const folder = document.getElementById("input-subfolder")?.value.trim();
      chrome.storage.local.set({
        downloadSettings: { filenameTemplate: tpl, defaultSubfolder: folder }
      });
      if (drawer) drawer.style.display = "none";
      window.AutoFlow.showToast("✅ Download preferences saved!", "success");
    });

    // 12. 2-Way Project Dropdown Menu & Controller
    const projectMenu = document.getElementById("project-dropdown-menu");
    document.getElementById("btn-project-dropdown")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (projectMenu) {
        const isHidden = projectMenu.style.display === "none";
        projectMenu.style.display = isHidden ? "flex" : "none";
        if (isHidden) this.renderProjectMenu();
      }
    });

    document.addEventListener("click", () => {
      if (projectMenu) projectMenu.style.display = "none";
    });

    // Create New Project on Google Flow Site
    document.getElementById("btn-create-project")?.addEventListener("click", () => {
      this.createNewFlowProjectOnSite();
    });

    // 13. Close duplicate tabs banner
    document.getElementById("btn-close-duplicate-tabs")?.addEventListener("click", () => {
      this.closeDuplicateFlowTabs();
    });
    document.getElementById("btn-dismiss-tab-alert")?.addEventListener("click", () => {
      document.getElementById("flow-tab-alert").style.display = "none";
    });

    // 14. Main Generate & Stop Buttons
    document.getElementById("btn-generate-main")?.addEventListener("click", () => {
      this.executeMainGeneration();
    });

    document.getElementById("btn-stop-main")?.addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "STOP_QUEUE" }, () => {
        const btn = document.getElementById("btn-generate-main");
        const btnText = document.getElementById("btn-generate-text");
        const stopBtn = document.getElementById("btn-stop-main");
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = "1";
        }
        if (btnText) btnText.innerText = "Generate";
        if (stopBtn) stopBtn.style.display = "none";
        window.AutoFlow.showToast("🛑 Stopped generation and cleared queue!", "info");
      });
    });

    // 15. Trigger Snip Buttons
    const triggerSnip = (e) => {
      e?.stopPropagation();
      chrome.runtime.sendMessage({ action: "TRIGGER_SCREEN_CAPTURE_ACTIVE_TAB" });
    };

    document.getElementById("btn-snip-reference-img")?.addEventListener("click", triggerSnip);
    document.getElementById("btn-snip-reference-vid")?.addEventListener("click", triggerSnip);
    document.getElementById("dropzone-snip-btn-img")?.addEventListener("click", triggerSnip);
    document.getElementById("dropzone-snip-btn-vid")?.addEventListener("click", triggerSnip);
    document.getElementById("chip-btn-snip")?.addEventListener("click", triggerSnip);

    // 16. Manual Element Mapper Buttons & Toggle
    const toggleMap = document.getElementById("toggle-manual-mapping");
    const controlsMap = document.getElementById("manual-mapping-controls");

    toggleMap?.addEventListener("click", () => {
      const isNowActive = !toggleMap.classList.contains("active");
      toggleMap.classList.toggle("active", isNowActive);
      if (controlsMap) controlsMap.style.display = isNowActive ? "grid" : "none";
      chrome.storage.local.set({ manualMappingEnabled: isNowActive }, () => {
        window.AutoFlow.showToast(isNowActive ? "🎯 Manual DOM Mapping Enabled!" : "⚡ Switched to 100% Smart Auto-Detect!", "info");
      });
    });

    const triggerPicker = (targetType) => {
      chrome.runtime.sendMessage({
        action: "TRIGGER_ELEMENT_PICKER",
        payload: { targetType }
      }, () => {
        window.AutoFlow.showToast(`🎯 Click on the ${targetType.toUpperCase()} element on Google Flow to map it!`, "info");
      });
    };

    document.getElementById("btn-pick-prompt")?.addEventListener("click", () => triggerPicker("prompt"));
    document.getElementById("btn-pick-generate")?.addEventListener("click", () => triggerPicker("generate"));
    document.getElementById("btn-pick-ratio")?.addEventListener("click", () => triggerPicker("ratio"));
    document.getElementById("btn-pick-reference")?.addEventListener("click", () => triggerPicker("reference"));

    document.getElementById("btn-reset-element-map")?.addEventListener("click", () => {
      chrome.storage.local.remove(['customElementMap'], () => {
        this.updateMappedLabels({});
        window.AutoFlow.showToast("🔄 Reset all elements to Auto-Detect!", "info");
      });
    });

    // 17. Confirm Run Modal Interactive Handlers
    this.setupConfirmRunModal();
  },

  setupConfirmRunModal: function() {
    const modal = document.getElementById("modal-confirm-run");
    const btnClose = document.getElementById("btn-confirm-run-close");
    const btnCancel = document.getElementById("btn-confirm-run-cancel");
    const btnExecute = document.getElementById("btn-confirm-run-execute");

    const btnAuto = document.getElementById("btn-mode-auto");
    const btnManual = document.getElementById("btn-mode-manual");

    const stepperMinus = document.getElementById("confirm-stepper-minus");
    const stepperPlus = document.getElementById("confirm-stepper-plus");
    const stepperVal = document.getElementById("confirm-stepper-val");

    this.submitMode = "auto";

    btnClose?.addEventListener("click", () => { if (modal) modal.style.display = "none"; });
    btnCancel?.addEventListener("click", () => { if (modal) modal.style.display = "none"; });

    btnAuto?.addEventListener("click", () => {
      this.submitMode = "auto";
      btnAuto.classList.add("active");
      btnManual?.classList.remove("active");
    });

    btnManual?.addEventListener("click", () => {
      this.submitMode = "manual";
      btnManual.classList.add("active");
      btnAuto?.classList.remove("active");
    });

    stepperMinus?.addEventListener("click", () => {
      this.quantity = Math.max(1, this.quantity - 1);
      if (stepperVal) stepperVal.innerText = this.quantity;
      const imgVal = document.getElementById("stepper-value-img");
      const vidVal = document.getElementById("stepper-value-vid");
      if (imgVal) imgVal.innerText = this.quantity;
      if (vidVal) vidVal.innerText = this.quantity;
    });

    stepperPlus?.addEventListener("click", () => {
      this.quantity = Math.min(20, this.quantity + 1);
      if (stepperVal) stepperVal.innerText = this.quantity;
      const imgVal = document.getElementById("stepper-value-img");
      const vidVal = document.getElementById("stepper-value-vid");
      if (imgVal) imgVal.innerText = this.quantity;
      if (vidVal) vidVal.innerText = this.quantity;
    });

    btnExecute?.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
      this.dispatchConfirmedBatch();
    });
  },

  loadElementMap: function() {
    chrome.storage.local.get(['customElementMap', 'manualMappingEnabled'], (res) => {
      const isEnabled = !!res.manualMappingEnabled;
      const toggleMap = document.getElementById("toggle-manual-mapping");
      const controlsMap = document.getElementById("manual-mapping-controls");
      if (toggleMap) toggleMap.classList.toggle("active", isEnabled);
      if (controlsMap) controlsMap.style.display = isEnabled ? "grid" : "none";
      this.updateMappedLabels(res.customElementMap || {});
    });
  },

  updateMappedLabels: function(map) {
    const pLbl = document.getElementById("label-mapped-prompt");
    const gLbl = document.getElementById("label-mapped-generate");
    const rLbl = document.getElementById("label-mapped-ratio");
    const refLbl = document.getElementById("label-mapped-reference");

    const pBtn = document.getElementById("btn-pick-prompt");
    const gBtn = document.getElementById("btn-pick-generate");
    const rBtn = document.getElementById("btn-pick-ratio");
    const refBtn = document.getElementById("btn-pick-reference");

    if (pLbl) pLbl.innerText = map.prompt ? "Prompt ✅" : "Map Prompt Box";
    if (gLbl) gLbl.innerText = map.generate ? "Generate ✅" : "Map Generate Btn";
    if (rLbl) rLbl.innerText = map.ratio ? "Ratio ✅" : "Map Ratio Area";
    if (refLbl) refLbl.innerText = map.reference ? "Ref ✅" : "Map Ref Upload";

    if (pBtn) pBtn.style.borderColor = map.prompt ? "#a3e635" : "#374151";
    if (gBtn) gBtn.style.borderColor = map.generate ? "#a3e635" : "#374151";
    if (rBtn) rBtn.style.borderColor = map.ratio ? "#a3e635" : "#374151";
    if (refBtn) refBtn.style.borderColor = map.reference ? "#a3e635" : "#374151";
  },

  renderProjectMenu: function() {
    const menu = document.getElementById("project-dropdown-menu");
    if (!menu) return;

    menu.innerHTML = "";
    const header = document.createElement("div");
    header.style.cssText = "font-size:10px;font-weight:700;color:#94a3b8;padding:4px 8px;text-transform:uppercase;";
    header.textContent = "Connected Flow Projects";
    menu.appendChild(header);

    const projects = this.detectedProjects.length > 0
      ? this.detectedProjects
      : [{ name: this.activeProjectName, isCurrent: true }];

    projects.forEach(p => {
      const isActive = p.name.includes(this.activeProjectName) || p.isCurrent;
      const item = document.createElement("div");
      item.className = "project-menu-item" + (isActive ? " active" : "");
      item.style.cursor = "pointer";

      const nameSpan = document.createElement("span");
      nameSpan.textContent = "✦ " + p.name;
      item.appendChild(nameSpan);

      if (isActive) {
        const badge = document.createElement("span");
        badge.style.cssText = "font-size:10px;color:#a3e635;";
        badge.textContent = "Active";
        item.appendChild(badge);
      }

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectProject(p.name);
      });

      menu.appendChild(item);
    });

    const newItem = document.createElement("div");
    newItem.className = "project-menu-item new-project-item";
    newItem.style.cursor = "pointer";
    const newSpan = document.createElement("span");
    newSpan.textContent = "➕ + Create New Project on Flow";
    newItem.appendChild(newSpan);
    newItem.addEventListener("click", (e) => {
      e.stopPropagation();
      this.createNewFlowProjectOnSite();
    });
    menu.appendChild(newItem);
  },

  async selectProject(projectName) {
    this.activeProjectName = projectName;
    const label = document.getElementById("active-project-label");
    if (label) label.innerText = `✦ ${projectName}`;

    const menu = document.getElementById("project-dropdown-menu");
    if (menu) menu.style.display = "none";

    try {
      const tabs = await chrome.tabs.query({});
      const flowTab = tabs.find(t => t.url && (t.url.includes("labs.google") || t.url.includes("aitestkitchen")));

      if (flowTab) {
        chrome.tabs.sendMessage(flowTab.id, {
          action: "SWITCH_TO_PROJECT",
          projectName: projectName
        }, (res) => {
          if (chrome.runtime.lastError) {
            window.AutoFlow.showToast(`Selected project: ${projectName}`, "info");
            return;
          }
          if (res?.success) {
            window.AutoFlow.showToast(`📂 Switched Google Flow to: ${projectName}`, "success");
          } else {
            window.AutoFlow.showToast(`Selected project: ${projectName}`, "info");
          }
        });
      } else {
        window.AutoFlow.showToast(`Selected project: ${projectName} (Open Google Flow to sync)`, "info");
      }
    } catch (e) {
      window.AutoFlow.showToast(`Selected project: ${projectName}`, "info");
    }

    this.renderProjectMenu();
  },

  async createNewFlowProjectOnSite() {
    const menu = document.getElementById("project-dropdown-menu");
    if (menu) menu.style.display = "none";

    try {
      const tabs = await chrome.tabs.query({});
      const flowTab = tabs.find(t => t.url && (t.url.includes("labs.google") || t.url.includes("aitestkitchen")));

      if (flowTab) {
        chrome.tabs.sendMessage(flowTab.id, { action: "TRIGGER_NEW_PROJECT_ON_PAGE" }, (res) => {
          if (chrome.runtime.lastError) {
            window.AutoFlow.showToast("⚠️ Could not communicate with Google Flow tab.", "error");
            return;
          }
          if (res?.success) {
            window.AutoFlow.showToast("✨ Created New Project on Google Flow!", "success");
          } else {
            window.AutoFlow.showToast("⚠️ New project action sent but may not have completed.", "info");
          }
        });
      } else {
        chrome.tabs.create({ url: "https://labs.google/fx", active: true });
        window.AutoFlow.showToast("🚀 Opened Google Flow creation workspace!", "success");
      }
    } catch (e) {
      chrome.tabs.create({ url: "https://labs.google/fx", active: true });
      window.AutoFlow.showToast("🚀 Opened Google Flow!", "success");
    }
  },

  updatePromptCount: function() {
    const input = document.getElementById("gen-prompt-input");
    const label = document.getElementById("prompt-count-label");
    if (!input || !label) return;

    const val = input.value.trim();
    if (!val) {
      label.innerText = "0 prompt(s)";
      return;
    }

    const count = val.split(/\r?\n/).filter(l => l.trim().length > 0).length;
    label.innerText = `${count} prompt(s)`;
  },

  setupStepper: function(minusId, plusId, valueId) {
    const valEl = document.getElementById(valueId);
    document.getElementById(minusId)?.addEventListener("click", () => {
      this.quantity = Math.max(1, this.quantity - 1);
      if (valEl) valEl.innerText = this.quantity;
      const otherVal = document.getElementById(valueId.includes("img") ? "stepper-value-vid" : "stepper-value-img");
      if (otherVal) otherVal.innerText = this.quantity;
    });

    document.getElementById(plusId)?.addEventListener("click", () => {
      this.quantity = Math.min(20, this.quantity + 1);
      if (valEl) valEl.innerText = this.quantity;
      const otherVal = document.getElementById(valueId.includes("img") ? "stepper-value-vid" : "stepper-value-img");
      if (otherVal) otherVal.innerText = this.quantity;
    });
  },

  setupToggle: function(elementId, stateProperty) {
    const el = document.getElementById(elementId);
    el?.addEventListener("click", (e) => {
      e.stopPropagation();
      this[stateProperty] = !this[stateProperty];
      el.classList.toggle("active", this[stateProperty]);
    });
  },

  setupModifierDropdown: function(elementId) {
    document.getElementById(elementId)?.addEventListener("change", (e) => {
      const val = e.target.value;
      if (!val) return;
      const map = {
        elder_isaac: "Elder Isaac, distinguished elderly man with white beard and glasses",
        cyberpunk_girl: "cyberpunk female operative with glowing holographic visor and high-tech carbon armor",
        samurai: "weathered ronin samurai in ornate battle armor, holding glowing katana",
        astronaut: "futuristic deep space astronaut in high-tech exploration suit with reflective visor",
        cinematic: "cinematic 35mm film still, warm golden hour lighting, volumetric haze, 8k raw color grade",
        neon_cyberpunk: "vibrant cyberpunk neon lighting, magenta and cyan reflections on rain-slicked asphalt",
        ghibli: "Studio Ghibli painterly aesthetic, lush emerald meadows, fluffy cumulus clouds, whimsical mood",
        photorealistic: "award-winning National Geographic 8k photograph, sharp 85mm f/1.2 portrait bokeh",
        dark_fantasy: "dark fantasy gothic illustration, glowing occult runes, eerie atmospheric mist"
      };
      this.appendPromptModifier(map[val] || val);
    });
  },

  setupKeyframeSlot: function(slotId, inputId, type) {
    const slot = document.getElementById(slotId);
    const input = document.getElementById(inputId);

    slot?.addEventListener("click", (e) => {
      if (!e.target.classList.contains("btn-keyframe-remove")) {
        input?.click();
      }
    });

    input?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (type === "start") this.startFrameDataUrl = ev.target.result;
        if (type === "end") this.endFrameDataUrl = ev.target.result;

        if (slot) {
          slot.innerHTML = `
            <img src="${ev.target.result}" class="keyframe-preview-img" />
            <button class="btn-keyframe-remove" onclick="window.FlowConnector.clearKeyframe('${slotId}', '${type}')">×</button>
          `;
        }
        window.AutoFlow.showToast(`✅ Loaded ${type.toUpperCase()} Keyframe!`, "success");
      };
      reader.readAsDataURL(file);
    });
  },

  clearKeyframe: function(slotId, type) {
    if (type === "start") this.startFrameDataUrl = null;
    if (type === "end") this.endFrameDataUrl = null;

    const slot = document.getElementById(slotId);
    if (slot) {
      slot.innerHTML = `
        <span style="font-size:14px;">➕</span>
        <span>Add</span>
        <input type="file" id="input-${type}-frame" accept="image/*" style="display:none;" />
      `;
      this.setupKeyframeSlot(slotId, `input-${type}-frame`, type);
    }
    window.AutoFlow.showToast(`Cleared ${type.toUpperCase()} frame.`, "info");
  },

  setupDropzone: function(dropzoneId, fileInputId, labelId, countId) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);

    dropzone?.addEventListener("click", (e) => {
      if (e.target.closest(".dropzone-snip-btn") || e.target.closest(".btn-ref-remove")) return;
      fileInput?.click();
    });

    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.selectedReferenceImage = ev.target.result;
        this.displayReferencePreview(ev.target.result, file.name);
        window.AutoFlow.showToast(`🖼️ Attached reference image: ${file.name}`, "success");
      };
      reader.readAsDataURL(file);
    });
  },

  displayReferencePreview: function(dataUrl, name = "Reference Image") {
    ["dropzone-upload-img", "dropzone-upload-vid"].forEach(dzId => {
      const dropzone = document.getElementById(dzId);
      if (!dropzone) return;

      dropzone.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;width:100%;">
          <img src="${dataUrl}" style="width:42px;height:42px;border-radius:6px;object-fit:cover;border:1px solid #374151;" />
          <div style="flex:1;overflow:hidden;">
            <div style="font-weight:700;font-size:12px;color:#a3e635;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${name}</div>
            <div style="font-size:10px;color:#9ca3af;">Reference active for generation</div>
          </div>
          <button class="btn-ref-remove" onclick="window.FlowConnector.clearReferenceImage()" style="background:#202227;border:1px solid #374151;color:#fff;border-radius:50%;width:24px;height:24px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;" title="Remove Reference">×</button>
        </div>
      `;
    });

    const countVid = document.getElementById("ref-image-count-vid");
    if (countVid) countVid.innerText = "1";
  },

  clearReferenceImage: function() {
    this.selectedReferenceImage = null;

    const imgDz = document.getElementById("dropzone-upload-img");
    if (imgDz) {
      imgDz.innerHTML = `
        <div class="dropzone-text" id="dropzone-content-img">
          <span>📁</span>
          <span id="dropzone-label-img">Upload image / Drag here or Snip from Web</span>
          <input type="file" id="dropzone-file-input-img" accept="image/*" style="display:none;" />
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <div class="dropzone-snip-btn" id="dropzone-snip-btn-img" title="Snip from Web Page">✂️</div>
        </div>
      `;
      this.setupDropzone("dropzone-upload-img", "dropzone-file-input-img", "dropzone-label-img");
      document.getElementById("dropzone-snip-btn-img")?.addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: "TRIGGER_SCREEN_CAPTURE_ACTIVE_TAB" });
      });
    }

    const vidDz = document.getElementById("dropzone-upload-vid");
    if (vidDz) {
      vidDz.innerHTML = `
        <div class="dropzone-text" id="dropzone-content-vid">
          <span>📁</span>
          <span id="dropzone-label-vid">Upload reference / Drag here or Snip from Web</span>
          <input type="file" id="dropzone-file-input-vid" accept="image/*" style="display:none;" />
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <div class="dropzone-snip-btn" id="dropzone-snip-btn-vid" title="Snip from Web Page">✂️</div>
        </div>
      `;
      this.setupDropzone("dropzone-upload-vid", "dropzone-file-input-vid", "dropzone-label-vid", "ref-image-count-vid");
      document.getElementById("dropzone-snip-btn-vid")?.addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: "TRIGGER_SCREEN_CAPTURE_ACTIVE_TAB" });
      });
    }

    const countVid = document.getElementById("ref-image-count-vid");
    if (countVid) countVid.innerText = "0";

    window.AutoFlow.showToast("Cleared reference image.", "info");
  },

  appendPromptModifier: function(text) {
    const input = document.getElementById("gen-prompt-input");
    if (!input) return;
    if (input.value.trim()) {
      input.value = input.value.trim() + `, ${text}`;
    } else {
      input.value = text;
    }
    this.updatePromptCount();
  },

  updateModelOptions: function() {
    const selectImg = document.getElementById("select-model-image");
    const selectVid = document.getElementById("select-model-video");

    if (this.activeProvider === "flow") {
      if (selectImg) selectImg.innerHTML = `<option value="Nano Banana Pro" selected>🍌 Nano Banana Pro</option><option value="Nano Banana 2">🍌 Nano Banana 2</option><option value="Imagen 3">✨ Imagen 3</option>`;
      if (selectVid) selectVid.innerHTML = `<option value="Omni Flash">Omni Flash</option><option value="Veo 3.1 Quality">Veo 3.1 Quality</option><option value="Veo 3.1 Fast">Veo 3.1 Fast</option><option value="Veo 3.1 Lite">Veo 3.1 Lite</option>`;
    } else if (this.activeProvider === "chatgpt") {
      if (selectImg) selectImg.innerHTML = `<option value="GPT Image 2">🤖 GPT Image 2</option>`;
    } else if (this.activeProvider === "grok") {
      if (selectImg) selectImg.innerHTML = `<option value="Grok Imagine">⚡ Grok Imagine</option>`;
      if (selectVid) selectVid.innerHTML = `<option value="Grok Aurora Video">⚡ Grok Aurora Video</option>`;
    }
  },

  async checkFlowTabsAndProjects() {
    const tabs = await chrome.tabs.query({});
    const flowTabs = tabs.filter(t => t.url && (t.url.includes("labs.google") || t.url.includes("aitestkitchen")));

    const alertBox = document.getElementById("flow-tab-alert");
    const alertText = document.getElementById("flow-tab-alert-text");

    if (flowTabs.length > 1) {
      if (alertBox) {
        alertText.innerText = `Detected ${flowTabs.length} Flow tabs. Extension only works correctly with 1 tab.`;
        alertBox.style.display = "flex";
      }
    } else {
      if (alertBox) alertBox.style.display = "none";
    }

    if (flowTabs.length > 0) {
      const activeFlowTab = flowTabs[0];
      const title = activeFlowTab.title.replace("Google", "").replace("Flow", "").replace("–", "").replace("-", "").trim();
      if (title && title.length > 2 && title !== "Google Flow") {
        this.activeProjectName = title;
        const projectLabel = document.getElementById("active-project-label");
        if (projectLabel) {
          projectLabel.innerText = `✦ ${title}`;
        }
      }

      chrome.tabs.sendMessage(activeFlowTab.id, { action: "PING_DRIVER" }, (res) => {
        if (res?.detectedProjects && res.detectedProjects.length > 0) {
          this.detectedProjects = res.detectedProjects;
        }
      });
    }
  },

  async closeDuplicateFlowTabs() {
    const tabs = await chrome.tabs.query({});
    const flowTabs = tabs.filter(t => t.url && (t.url.includes("labs.google") || t.url.includes("aitestkitchen")));
    if (flowTabs.length > 1) {
      const tabsToClose = flowTabs.slice(1).map(t => t.id);
      await chrome.tabs.remove(tabsToClose);
      document.getElementById("flow-tab-alert").style.display = "none";
      window.AutoFlow.showToast(`✅ Closed ${tabsToClose.length} duplicate Flow tabs!`, "success");
    }
  },

  loadSavedSettings: async function() {
    const data = await chrome.storage.local.get(['downloadSettings', 'autoDownload']);
    if (data.downloadSettings?.defaultSubfolder) {
      const input = document.getElementById("input-subfolder");
      if (input) input.value = data.downloadSettings.defaultSubfolder;
    }
  },

  /** Opens the TobyFlow-style Confirm Run modal before execution */
  async executeMainGeneration() {
    const rawPrompt = document.getElementById("gen-prompt-input")?.value.trim();
    if (!rawPrompt && !this.startFrameDataUrl && !this.selectedReferenceImage) {
      window.AutoFlow.showToast("⚠️ Please enter a prompt or attach reference/keyframe.", "error");
      return;
    }

    const prompts = (rawPrompt || "Cinematic scene").split(/\r?\n/).filter(p => p.trim().length > 0);
    const modal = document.getElementById("modal-confirm-run");
    if (!modal) {
      // Direct fallback
      this.dispatchConfirmedBatch();
      return;
    }

    // Populate modal fields
    const countBadge = document.getElementById("confirm-prompts-count");
    if (countBadge) countBadge.innerText = prompts.length;

    const provName = document.getElementById("confirm-provider-name");
    if (provName) provName.innerText = this.activeProvider === "flow" ? "Google Flow" : (this.activeProvider === "chatgpt" ? "ChatGPT" : "Grok");

    const mediaTag = document.getElementById("confirm-media-type");
    if (mediaTag) mediaTag.innerText = this.mediaType === "video" ? "Video" : "Image";

    const currentRatio = this.mediaType === "video" 
      ? (document.getElementById("select-aspect-ratio-video")?.value || "16:9")
      : (document.getElementById("select-aspect-ratio-image")?.value || "16:9");
    const ratioSelect = document.getElementById("confirm-select-ratio");
    if (ratioSelect) ratioSelect.value = currentRatio;

    const stepperVal = document.getElementById("confirm-stepper-val");
    if (stepperVal) stepperVal.innerText = this.quantity;

    // Show modal
    modal.style.display = "flex";
  },

  /** Dispatches batch to background worker after user confirms options */
  async dispatchConfirmedBatch() {
    const rawPrompt = document.getElementById("gen-prompt-input")?.value.trim();
    const isVideo = this.mediaType === "video";
    const model = isVideo 
      ? (document.getElementById("select-model-video")?.value || "Omni Flash")
      : (document.getElementById("select-model-image")?.value || "Nano Banana Pro");
    
    const ratioSelect = document.getElementById("confirm-select-ratio");
    const ratio = ratioSelect?.value || (isVideo
      ? (document.getElementById("select-aspect-ratio-video")?.value || "16:9")
      : (document.getElementById("select-aspect-ratio-image")?.value || "16:9"));

    const res = isVideo
      ? (document.getElementById("select-resolution-vid")?.value || "720p")
      : (document.getElementById("select-resolution-img")?.value || "4K");

    const downloadSelect = document.getElementById("confirm-select-download")?.value || "Auto 4K";
    const subfolder = document.getElementById("input-subfolder")?.value || "ziggyflow-01";
    const btn = document.getElementById("btn-generate-main");
    const btnText = document.getElementById("btn-generate-text");

    const prompts = (rawPrompt || "Cinematic scene").split(/\r?\n/).filter(p => p.trim().length > 0);
    const tasks = [];

    for (let q = 0; q < this.quantity; q++) {
      for (const p of prompts) {
        tasks.push({
          id: "gen_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          prompt: p,
          provider: this.activeProvider,
          type: this.mediaType,
          model: model,
          duration: this.duration,
          framingMode: this.framingMode,
          voice: this.voice,
          aspectRatio: ratio,
          quantity: this.quantity,
          referenceImage: this.selectedReferenceImage,
          startFrame: this.startFrameDataUrl,
          endFrame: this.endFrameDataUrl,
          project: subfolder,
          resolution: res,
          submitMode: this.submitMode || "auto",
          downloadMode: downloadSelect,
          createdAt: Date.now()
        });
      }
    }

    this.log(`[EXECUTE] Dispatching ${tasks.length} task(s) (${this.submitMode.toUpperCase()} submit, ${model}, ${ratio})...`);

    if (btn) btn.disabled = true;
    if (btn) btn.style.opacity = "0.6";
    if (btnText) btnText.innerText = `Sending ${tasks.length} task(s)...`;

    chrome.runtime.sendMessage({
      action: "ENQUEUE_BATCH",
      payload: { tasks }
    }, (response) => {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
      }

      if (response?.success) {
        const stopBtn = document.getElementById("btn-stop-main");
        if (stopBtn) stopBtn.style.display = "flex";

        if (btnText) btnText.innerText = `✅ ${tasks.length} task(s) queued!`;
        window.AutoFlow.showToast(
          `🚀 Running ${tasks.length} task(s) on ${this.activeProvider.toUpperCase()} (${this.submitMode.toUpperCase()} Mode)!`, 
          "success"
        );

        setTimeout(() => {
          if (btnText) btnText.innerText = "Generate";
        }, 2500);
      } else {
        if (btnText) btnText.innerText = "Generate";
        window.AutoFlow.showToast("⚠️ Failed to enqueue tasks. Check connection.", "error");
      }
    });
  },

  log: function(msg) {
    const logEl = document.getElementById("diag-test-log");
    if (logEl) {
      const time = new Date().toLocaleTimeString();
      logEl.innerHTML = `<div style="color:#a3e635;font-size:11px;">[${time}] ${msg}</div>` + logEl.innerHTML;
    }
  }
};
