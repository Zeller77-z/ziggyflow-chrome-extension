/**
 * ZiggyFlow Content Script for Google Flow (labs.google/fx/*, labs.google/flow, aitestkitchen.withgoogle.com)
 * 
 * ADVANCED PIERCING ENGINE:
 * - Shadow DOM Piercing (findAllDeep)
 * - True React/Angular Trigger (execCommand + composed events)
 * - Deep Click Propagation
 */

(() => {
  if (window.__ziggyflow_google_flow_driver_loaded) return;
  window.__ziggyflow_google_flow_driver_loaded = true;
  console.log("ZiggyFlow: Google Flow driver active on", window.location.href);

  let isTaskAborted = false;

  const MODEL_NAME_MAP = {
    "nano banana 2": ["imagen 3", "imagen", "imagen3", "nano banana"],
    "nano banana pro": ["imagen 3", "imagen", "imagen3", "nano banana pro"],
    "gpt image 2": ["gpt image", "gpt-image", "dall-e"],
    "grok imagine": ["grok", "aurora"],
    "omni flash": ["veo", "veo 2", "omni", "flash"],
    "veo 3.1 quality": ["veo 3", "veo 3.1", "quality", "veo3"],
    "veo 3.1 fast": ["veo 3", "veo 3.1", "fast"],
    "veo 3.1 lite": ["veo 3", "veo 3.1", "lite"],
    "grok aurora video": ["grok", "aurora"]
  };

  injectHeaderButton();
  startProjectObserver();

  // =============================================
  // MESSAGE ROUTER
  // =============================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.action === "GENERATE_PROMPT" && (!request.task.provider || request.task.provider === "flow")) {
        isTaskAborted = false;
        executeFlowTask(request.task)
          .then(result => sendResponse({ success: true, result }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
      }

      if (request.action === "ABORT_GENERATION") {
        isTaskAborted = true;
        showLiveToast("🛑 Generation Stopped by User", true);
        sendResponse({ success: true });
        return true;
      }

      if (request.action === "START_VISUAL_ELEMENT_MAPPER" || request.action === "START_ELEMENT_PICKER") {
        startVisualElementMapper(request.slotName || request.targetType || "generateButton", request.friendlyLabel, request.templateId);
        sendResponse({ success: true });
        return true;
      }

      if (request.action === "TEST_DOM_ELEMENT_ACTION") {
        const slotData = request.template?.[request.slotName];
        const el = resolveTemplateElement(slotData);
        if (el) {
          if (request.actionType === "highlight") {
            highlightElement(el, "#38bdf8");
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          } else if (request.actionType === "click") {
            highlightElement(el, "#a3e635");
            clickButtonCleanly(el);
          }
          const rect = el.getBoundingClientRect();
          sendResponse({
            found: true,
            tag: el.tagName,
            rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`
          });
        } else {
          sendResponse({ found: false });
        }
        return true;
      }

      if (request.action === "PING_DRIVER") {
        const projects = scanFlowProjects();
        sendResponse({
          status: "ready",
          provider: "flow",
          url: window.location.href,
          title: document.title,
          detectedProjects: projects
        });
        return true;
      }
    } catch (err) {
      console.warn("ZiggyFlow onMessage error:", err);
      sendResponse({ success: false, error: err.message });
    }
  });

  // =============================================
  // 0. SHADOW DOM PIERCING UTILITY
  // =============================================
  function findAllDeep(selector) {
    const results = [];
    const seen = new Set();
    
    function scan(root) {
      if (!root) return;
      try {
        const elements = root.querySelectorAll(selector);
        for (const el of elements) {
          if (!seen.has(el)) {
            seen.add(el);
            results.push(el);
          }
        }
      } catch (e) {}
      
      const children = root.querySelectorAll('*');
      for (const child of children) {
        if (child.shadowRoot) {
          scan(child.shadowRoot);
        }
      }
    }
    
    scan(document);
    return results;
  }

  // =============================================
  // 1. INJECTED HEADER BUTTON
  // =============================================
  function injectHeaderButton() {
    try {
      if (document.getElementById("ziggyflow-injected-header-btn")) return;

      const candidates = findAllDeep('header, nav, [role="banner"], div');
      let targetHeader = document.body;
      for (const el of candidates) {
        const text = (el.textContent || "").trim();
        if (text.includes("Google Flow") && el.children.length > 1) {
          targetHeader = el;
          break;
        }
      }

      const btn = document.createElement("button");
      btn.id = "ziggyflow-injected-header-btn";
      btn.style.cssText = `
        background: linear-gradient(135deg, #18191d 0%, #202227 100%);
        color: #ffffff; border: 1.5px solid #a3e635;
        padding: 6px 14px; border-radius: 9999px;
        font-size: 13px; font-weight: 700; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
        margin-left: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4), 0 0 12px rgba(163,230,53,0.3);
        transition: all 0.2s ease; vertical-align: middle;
        white-space: nowrap; user-select: none; z-index: 99999;
      `;
      btn.innerHTML = `<span style="font-size:15px;">+</span> Open ZiggyFlow <span style="font-size:9px;background:#a3e635;color:#121316;border-radius:5px;padding:1px 5px;font-weight:800;letter-spacing:0.5px;line-height:1;">PRO</span>`;

      btn.onclick = (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: "OPEN_SIDEPANEL" });
      };
      targetHeader.appendChild(btn);
    } catch (e) {}
  }
  setInterval(injectHeaderButton, 3000);

  // =============================================
  // 2. VISUAL ELEMENT MAPPER & TEMPLATE RESOLVER
  // =============================================
  function startVisualElementMapper(slotName, friendlyLabel, templateId) {
    const existing = document.getElementById("ziggyflow-element-picker-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "ziggyflow-element-picker-overlay";
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 2147483640; cursor: crosshair; pointer-events: auto;
      background: rgba(0, 0, 0, 0.2);
    `;

    const banner = document.createElement("div");
    banner.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: #141519; color: #fff; border: 1.5px solid #38bdf8;
      padding: 10px 24px; border-radius: 9999px; font-weight: 700; font-size: 13px;
      z-index: 2147483645; pointer-events: none;
      box-shadow: 0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(56,189,248,0.4);
      display: flex; align-items: center; gap: 8px; font-family: sans-serif;
    `;
    banner.innerHTML = `<span>📍</span> <span><b>Visual Mapper</b>: Click on <b>${friendlyLabel || slotName}</b> • Press <b>ESC</b> to cancel</span>`;
    document.body.appendChild(banner);

    // Hover tooltip pill
    const tooltip = document.createElement("div");
    tooltip.style.cssText = `
      position: fixed; display: none; z-index: 2147483646; pointer-events: none;
      background: #0f172a; color: #38bdf8; border: 1px solid #38bdf8;
      padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;
      box-shadow: 0 8px 20px rgba(0,0,0,0.7); font-family: monospace;
    `;
    document.body.appendChild(tooltip);

    let lastHovered = null;
    const handleMouseMove = (e) => {
      overlay.style.pointerEvents = "none";
      const el = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = "auto";

      if (el && el !== overlay && el !== banner && el !== tooltip && !isExtensionElement(el)) {
        if (lastHovered && lastHovered !== el) {
          lastHovered.style.outline = "";
          lastHovered.style.boxShadow = "";
        }
        lastHovered = el;
        el.style.outline = "3px solid #38bdf8";
        el.style.boxShadow = "0 0 25px rgba(56,189,248,0.8)";

        // Update tooltip position & label
        const rect = el.getBoundingClientRect();
        tooltip.style.display = "block";
        tooltip.style.left = `${Math.min(window.innerWidth - 180, Math.max(10, e.clientX + 15))}px`;
        tooltip.style.top = `${Math.min(window.innerHeight - 40, Math.max(10, e.clientY + 15))}px`;
        const pctX = Math.round((rect.left / window.innerWidth) * 100);
        const pctY = Math.round((rect.top / window.innerHeight) * 100);
        tooltip.innerText = `<${el.tagName.toLowerCase()}> (${pctX}% X, ${pctY}% Y)`;
      }
    };

    const handleClick = (e) => {
      e.preventDefault(); e.stopPropagation();
      overlay.style.pointerEvents = "none";
      let targetEl = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = "auto";

      if (targetEl && targetEl !== overlay && targetEl !== banner && !isExtensionElement(targetEl)) {
        // Smart-snap to input or button
        if (slotName.toLowerCase().includes("prompt")) {
          const innerInput = targetEl.querySelector('textarea, input[type="text"], [contenteditable="true"]') ||
                             targetEl.closest('form, div')?.querySelector('textarea, input[type="text"], [contenteditable="true"]');
          if (innerInput) targetEl = innerInput;
        } else if (slotName.toLowerCase().includes("generate") || slotName.toLowerCase().includes("button")) {
          const parentBtn = targetEl.closest('button, [role="button"]');
          if (parentBtn) targetEl = parentBtn;
        }

        const rect = targetEl.getBoundingClientRect();
        const selector = generateUniqueSelector(targetEl);
        const xpath = generateXPath(targetEl);
        const coords = {
          pctX: Math.round((rect.left / window.innerWidth) * 1000) / 1000,
          pctY: Math.round((rect.top / window.innerHeight) * 1000) / 1000,
          clientX: Math.round(rect.left),
          clientY: Math.round(rect.top)
        };

        const tagLabel = targetEl.tagName.toUpperCase() + (targetEl.id ? `#${targetEl.id}` : (targetEl.className ? `.${targetEl.className.split(' ')[0]}` : ''));
        const mappedData = {
          selector: selector,
          xpath: xpath,
          tag: targetEl.tagName,
          label: `${tagLabel} (${Math.round(coords.pctX * 100)}% X, ${Math.round(coords.pctY * 100)}% Y)`,
          coords: coords
        };

        console.log(`ZiggyFlow: Mapped ${slotName} ->`, mappedData);
        highlightElement(targetEl, "#a3e635");
        showLiveToast(`✅ Mapped ${friendlyLabel || slotName}!`);

        // Send to ZiggyFlow UI to save in active template
        chrome.runtime.sendMessage({
          action: "ELEMENT_MAPPED_SUCCESS",
          payload: {
            slotName: slotName,
            data: mappedData,
            templateId: templateId || "default"
          }
        }).catch(() => {});
      }
      cleanup();
    };

    const handleKeyDown = (e) => { if (e.key === "Escape") cleanup(); };

    function cleanup() {
      if (lastHovered) { lastHovered.style.outline = ""; lastHovered.style.boxShadow = ""; }
      overlay.remove(); banner.remove(); tooltip.remove();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", handleKeyDown);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKeyDown);
    document.body.appendChild(overlay);
  }

  function generateUniqueSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const aria = el.getAttribute("aria-label");
    if (aria) return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(aria)}"]`;
    const role = el.getAttribute("role");
    if (role) return `${el.tagName.toLowerCase()}[role="${CSS.escape(role)}"]`;
    if (el.className && typeof el.className === "string") {
      const validClasses = el.className.split(/\s+/).filter(c => c && !c.includes(":") && !c.includes("[") && c.length < 30);
      if (validClasses.length > 0) return `${el.tagName.toLowerCase()}.${validClasses.slice(0, 2).map(c => CSS.escape(c)).join(".")}`;
    }
    const path = [];
    let current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.id) { path.unshift(`#${CSS.escape(current.id)}`); break; }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      path.unshift(selector);
      current = parent;
      if (path.length >= 4) break;
    }
    return path.join(" > ");
  }

  function generateXPath(el) {
    if (el.id) return `//*[@id='${el.id}']`;
    if (el === document.body) return '/html/body';
    let ix = 0;
    const siblings = el.parentNode ? el.parentNode.childNodes : [];
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === el) {
        return `${generateXPath(el.parentNode)}/${el.tagName.toLowerCase()}[${ix + 1}]`;
      }
      if (sibling.nodeType === 1 && sibling.tagName === el.tagName) {
        ix++;
      }
    }
    return el.tagName.toLowerCase();
  }

  /** Resolves element from a mapped template slot using multi-tier fallback */
  function resolveTemplateElement(slotData) {
    if (!slotData) return null;

    // 1. Try CSS Selector
    if (slotData.selector) {
      try {
        const els = findAllDeep(slotData.selector).filter(e => !isExtensionElement(e) && e.offsetParent !== null);
        if (els.length > 0) return els[0];
      } catch (e) {}
    }

    // 2. Try XPath
    if (slotData.xpath) {
      try {
        const result = document.evaluate(slotData.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue && !isExtensionElement(result.singleNodeValue)) {
          return result.singleNodeValue;
        }
      } catch (e) {}
    }

    // 3. Try Physical Viewport Coordinate lookup (elementFromPoint)
    if (slotData.coords && slotData.coords.pctX !== undefined) {
      const clientX = Math.round(slotData.coords.pctX * window.innerWidth);
      const clientY = Math.round(slotData.coords.pctY * window.innerHeight);
      const coordEl = document.elementFromPoint(clientX, clientY);
      if (coordEl && !isExtensionElement(coordEl)) {
        if (slotData.tag && coordEl.tagName === slotData.tag) return coordEl;
        const inner = coordEl.querySelector(slotData.tag?.toLowerCase() || 'button, textarea, input');
        if (inner) return inner;
        return coordEl;
      }
    }

    return null;
  }

  async function getActiveTemplateConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['domTemplates', 'activeDomTemplateId'], (res) => {
        if (!res.domTemplates) {
          resolve(null);
          return;
        }
        const activeId = res.activeDomTemplateId || 'default';
        resolve(res.domTemplates[activeId] || res.domTemplates['default'] || null);
      });
    });
  }

  async function getCustomSelector(key) {
    const tpl = await getActiveTemplateConfig();
    if (!tpl) return null;
    return tpl[key]?.selector || null;
  }

  // =============================================
  // 3. PROJECT OBSERVER
  // =============================================
  function scanFlowProjects() {
    const projectCards = [];
    const seen = new Set();
    try {
      const elements = findAllDeep('div, a, button, section, p, span');
      elements.forEach(el => {
        const text = (el.textContent || "").trim();
        if (text.length > 90 || text.length < 3 || seen.has(text)) return;
        if (/\d{4}-\d{2}-\d{2}/.test(text) || /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i.test(text)) {
          seen.add(text);
          projectCards.push({ name: text, isCurrent: el.classList.contains("active") || el.getAttribute("aria-selected") === "true" });
        }
      });
    } catch (e) {}
    return projectCards;
  }

  function startProjectObserver() {
    setInterval(() => {
      const projects = scanFlowProjects();
      if (projects.length > 0) chrome.runtime.sendMessage({ action: "SYNC_FLOW_PROJECTS", payload: { projects } }).catch(() => {});
    }, 4000);
  }

  // =============================================
  // 4. GOOGLE FLOW SETTINGS POPOVER CONTROLLER
  // =============================================
  async function configureGoogleFlowSettings(task) {
    try {
      let popover = findSettingsPopover();
      if (!popover) {
        const settingsPill = findSettingsPillButton();
        if (settingsPill) {
          console.log("ZiggyFlow: Opening settings popover via pill button:", settingsPill);
          safeClick(settingsPill);
          await sleep(500);
          popover = findSettingsPopover();
        }
      }

      if (!popover) {
        console.log("ZiggyFlow: Settings popover not found, proceeding with defaults.");
        return;
      }

      console.log("ZiggyFlow: Settings popover found:", popover);

      // 1. Media Type: Image vs Video
      if (task.type) {
        const targetTypeLabel = task.type.toLowerCase() === "video" ? "video" : "image";
        const typeChips = Array.from(popover.querySelectorAll('button, [role="button"], [role="radio"], [role="tab"], span, div'));
        const typeBtn = typeChips.find(el => {
          if (el.offsetParent === null) return false;
          const t = (el.textContent || "").trim().toLowerCase();
          return t === targetTypeLabel;
        });
        if (typeBtn) {
          const btn = typeBtn.closest('button, [role="button"], [role="radio"], [role="tab"]') || typeBtn;
          safeClick(btn);
          await sleep(200);
        }
      }

      // 2. Aspect Ratio: e.g. "16:9", "9:16", "1:1", "4:3", "3:4"
      if (task.aspectRatio) {
        const targetRatio = task.aspectRatio.trim();
        const allItems = Array.from(popover.querySelectorAll('button, [role="button"], [role="radio"], [role="tab"], div, span'));
        const ratioEl = allItems.find(el => {
          if (el.offsetParent === null) return false;
          const t = (el.textContent || "").trim();
          const aria = (el.getAttribute("aria-label") || "").trim();
          const title = (el.getAttribute("title") || "").trim();
          return t === targetRatio || aria === targetRatio || title === targetRatio ||
                 t.replace(/\s/g, "") === targetRatio ||
                 (t.includes(targetRatio) && t.length < 15);
        });

        if (ratioEl) {
          const targetBtn = ratioEl.closest('button, [role="button"], [role="radio"], [role="tab"]') || ratioEl;
          console.log("ZiggyFlow: Clicking Aspect Ratio button:", targetRatio, targetBtn);
          highlightElement(targetBtn, "#38bdf8");
          safeClick(targetBtn);
          await sleep(250);
        } else {
          console.warn("ZiggyFlow: Could not find ratio button for:", targetRatio);
        }
      }

      // 3. Quantity: e.g. "x1", "x2", "x3", "x4"
      if (task.quantity) {
        const qtyCount = task.quantity;
        const targetQtyStr = "x" + qtyCount;
        const allItems = Array.from(popover.querySelectorAll('button, [role="button"], [role="radio"], [role="tab"], div, span'));
        const qtyEl = allItems.find(el => {
          if (el.offsetParent === null) return false;
          const t = (el.textContent || "").trim().toLowerCase();
          const aria = (el.getAttribute("aria-label") || "").trim().toLowerCase();
          return !t.includes(":") && (t === targetQtyStr || t === String(qtyCount) || aria === targetQtyStr || (t.startsWith(targetQtyStr) && t.length < 6));
        });

        if (qtyEl) {
          const targetBtn = qtyEl.closest('button, [role="button"], [role="radio"], [role="tab"]') || qtyEl;
          console.log("ZiggyFlow: Clicking Quantity button:", targetQtyStr, targetBtn);
          highlightElement(targetBtn, "#38bdf8");
          safeClick(targetBtn);
          await sleep(250);
        }
      }

      // Close popover cleanly
      const backdrop = findAllDeep('.cdk-overlay-backdrop, .backdrop, [class*="backdrop"]')[0];
      if (backdrop && backdrop.offsetParent !== null) {
        safeClick(backdrop);
      } else {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
      }
      await sleep(350);

    } catch (err) {
      console.warn("ZiggyFlow: Settings error:", err);
    }
  }

  function findSettingsPillButton() {
    const candidates = findAllDeep('button, div[role="button"]');
    return candidates.find(el => {
      if (el.offsetParent === null) return false;
      const t = (el.textContent || "").toLowerCase();
      const rect = el.getBoundingClientRect();
      return rect.top > window.innerHeight * 0.4 &&
        (t.includes("banana") || t.includes("veo") || t.includes("imagen") || t.includes("x1") || t.includes("x2") || t.includes("x3") || t.includes("x4") || t.includes("16:9") || t.includes("9:16") || t.includes("1:1")) && t.length < 60;
    });
  }

  function findSettingsPopover() {
    const candidates = findAllDeep('div, section, dialog, [role="dialog"], [role="menu"]');
    const matched = candidates.filter(el => {
      if (el.offsetParent === null) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 120 || rect.width > 650 || rect.height < 80 || rect.height > 650) return false;
      const t = (el.textContent || "").toLowerCase();
      return t.includes("16:9") && (t.includes("1:1") || t.includes("4:3") || t.includes("9:16") || t.includes("3:4"));
    });

    if (matched.length > 0) {
      // Pick smallest matching container (innermost dialog card)
      matched.sort((a, b) => {
        const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
        const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
        return areaA - areaB;
      });
      return matched[0];
    }
    return null;
  }

  // =============================================
  // 5. MAIN TASK EXECUTION ENGINE
  // =============================================
  // =============================================
  // 5. TASK ORCHESTRATOR & GENERATION OBSERVER
  // =============================================
  async function executeFlowTask(task) {
    if (isTaskAborted) throw new Error("Task was aborted");
    showLiveToast(`⚡ ZiggyFlow: Automating Google Flow...`);

    // Reset and notify overlay mini-window of the active task
    try {
      window.dispatchEvent(new CustomEvent("ZF_TASK_STARTED", { detail: task }));
      if (typeof window.__zf_onTaskStarted === "function") window.__zf_onTaskStarted(task);
    } catch(e) {}

    // 1. Settings Popover (Aspect Ratio & Quantity)
    await configureGoogleFlowSettings(task);
    await sleep(300);

    // 2. Find the exact prompt input
    const promptInput = await findExactPromptInput(10000);
    if (!promptInput) throw new Error("Could not find Google Flow prompt box.");
    
    console.log("ZiggyFlow: Found prompt element:", promptInput.tagName, promptInput.className, 
      "rect:", promptInput.getBoundingClientRect());
    highlightElement(promptInput, "#c4f82a");

    // 3. Inject prompt text cleanly with native typing simulation
    await safeReactType(promptInput, task.prompt);
    await sleep(300);

    // 4. Find the Generate button
    const generateBtn = await findGenerateButton(promptInput, 8000);
    window.getSelection()?.removeAllRanges();

    if (generateBtn) {
      console.log("ZiggyFlow: Found generate button:", generateBtn.tagName, 
        generateBtn.getBoundingClientRect());
      highlightElement(generateBtn, "#facc15");

      // Mark elements for Main World script execution
      promptInput.setAttribute("data-ziggy-prompt", "true");
      generateBtn.setAttribute("data-ziggy-generate", "true");

      await sleep(200);

      const isManualSubmit = (task.submitMode || "auto") === "manual";

      if (isManualSubmit) {
        // ==========================================
        // MANUAL SUBMIT WORKFLOW (TobyFlow Pattern)
        // ==========================================
        console.log("ZiggyFlow: Manual Submit Mode active — attaching listeners.");
        showLiveToast("⏱ Manual Submit: Press Enter or Click Submit on page", false);
        
        // Sync React state so the button is illuminated
        triggerGenerationInMainWorld(task.prompt);

        // Wait for user manual trigger (Enter key, Generate click, or badge click)
        await showManualSubmitPromptBadge(promptInput, generateBtn, 120000);
        showLiveToast("🚀 Generation submitted! Tracking progress...");
      } else {
        // ==========================================
        // AUTO SUBMIT WORKFLOW (Clean, Human-like & Safe)
        // ==========================================
        console.log("ZiggyFlow: Executing clean Auto-Submit...");

        // 1. Sync React 18 internal value tracker safely in Main World
        syncReactStateInMainWorld(task.prompt);
        await sleep(150);

        // 2. Focus prompt input
        promptInput.focus();
        await sleep(50);

        // 3. Ensure generate button is enabled
        try {
          generateBtn.disabled = false;
          generateBtn.removeAttribute("disabled");
          generateBtn.removeAttribute("aria-disabled");
          generateBtn.classList.remove("disabled");
          generateBtn.style.pointerEvents = "auto";
        } catch (e) {}

        // 4. Execute click strategy based on active template
        const activeTpl = await getActiveTemplateConfig();
        const strat = activeTpl?.clickStrategy || "standard";
        console.log(`ZiggyFlow: Executing button click strategy: ${strat}`);

        if (strat === "coords" && activeTpl?.generateButton?.coords) {
          const clientX = Math.round(activeTpl.generateButton.coords.pctX * window.innerWidth);
          const clientY = Math.round(activeTpl.generateButton.coords.pctY * window.innerHeight);
          const coordTarget = document.elementFromPoint(clientX, clientY) || generateBtn;
          clickButtonCleanly(coordTarget);
        } else if (strat === "enter") {
          promptInput.focus();
          const enterEvt = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            charCode: 13,
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window
          });
          promptInput.dispatchEvent(enterEvt);
        } else if (strat === "double") {
          clickButtonCleanly(generateBtn);
          await sleep(60);
          clickButtonCleanly(generateBtn);
        } else {
          // Standard Mouse Click Chain (default)
          clickButtonCleanly(generateBtn);
          await sleep(80);
          const enterEvt = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            which: 13,
            charCode: 13,
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window
          });
          promptInput.dispatchEvent(enterEvt);
        }

        console.log("ZiggyFlow: Auto-Submit dispatched cleanly.");
      }
    } else {
      showLiveToast("⚠️ Generate button not found. Please press Enter on page.", true);
    }

    // 5. Track live generation smoothly with throttled progress monitor
    const mediaResult = await trackGenerationProgress(240000);
    
    const mediaPayload = {
      provider: "Google Flow",
      prompt: task.prompt,
      mediaUrl: mediaResult.url,
      type: mediaResult.type,
      duration: task.duration,
      aspectRatio: task.aspectRatio
    };

    try {
      window.dispatchEvent(new CustomEvent("ZF_MEDIA_READY", { detail: mediaPayload }));
      if (typeof window.__zf_onTaskCompleted === "function") window.__zf_onTaskCompleted(mediaPayload);
    } catch(e) {}

    chrome.runtime.sendMessage({
      action: "MEDIA_GENERATED_NOTIFICATION",
      payload: mediaPayload
    });

    return mediaResult;
  }

  /** Clean single mouse click simulator */
  function clickButtonCleanly(btn) {
    if (!btn) return;
    try {
      btn.focus();
      btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
      btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
      btn.click();
    } catch (e) {}
  }

  /** High-performance throttled generation monitor — zero CPU lockup, zero recursion */
  async function trackGenerationProgress(maxWaitMs = 240000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let isResolved = false;
      let lastReportedProgress = "";

      const check = () => {
        if (isResolved) return;

        // 1. Check for newly finished media result
        const media = getLatestRenderedMedia();
        if (media) {
          isResolved = true;
          clearInterval(timer);
          console.log("ZiggyFlow: Generation complete & extracted:", media);
          resolve(media);
          return;
        }

        // 2. Throttled lightweight progress percentage query
        let liveProgress = null;
        const progressNodes = document.querySelectorAll('[aria-busy="true"], div.progress, [role="progressbar"], span, div');
        for (const node of progressNodes) {
          if (node.offsetParent === null || isExtensionElement(node)) continue;
          const match = (node.textContent || "").match(/(\d{1,3})%/);
          if (match && Number(match[1]) > 0 && Number(match[1]) <= 100) {
            liveProgress = match[0];
            break;
          }
        }

        if (liveProgress && liveProgress !== lastReportedProgress) {
          lastReportedProgress = liveProgress;
          try {
            window.dispatchEvent(new CustomEvent("ZF_PROGRESS_UPDATE", { detail: liveProgress }));
            if (typeof window.__zf_onProgress === "function") window.__zf_onProgress(liveProgress);
          } catch(e) {}
          chrome.runtime.sendMessage({ action: "LIVE_RENDER_PROGRESS", progress: liveProgress }).catch(() => {});
        }

        if (Date.now() - startTime > maxWaitMs) {
          isResolved = true;
          clearInterval(timer);
          const fallback = getLatestRenderedMedia();
          if (fallback) resolve(fallback);
          else reject(new Error("Generation timed out on Google Flow."));
        }
      };

      const timer = setInterval(() => {
        if (isTaskAborted) {
          isResolved = true;
          clearInterval(timer);
          reject(new Error("Generation stopped by user"));
          return;
        }
        check();
      }, 1200);

      // Initial check after short delay
      setTimeout(check, 1800);
    });
  }

  /** Safely synchronizes React 18 state in Main World context without destructive ancestor traversal */
  function syncReactStateInMainWorld(promptText) {
    try {
      const sanitizedText = JSON.stringify(promptText || "");
      const code = `
        try {
          const input = document.querySelector('[data-ziggy-prompt="true"]');
          const btn = document.querySelector('[data-ziggy-generate="true"]');
          const text = ${sanitizedText};
          
          if (input && text) {
            if (input._valueTracker) {
              input._valueTracker.setValue('');
            }
            
            const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(input, text);
            else input.value = text;

            input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
          }

          if (btn) {
            btn.disabled = false;
            btn.removeAttribute('disabled');
            btn.removeAttribute('aria-disabled');
            btn.classList.remove('disabled');
          }
        } catch(err) {}
      `;

      const script = document.createElement("script");
      script.textContent = `(() => { ${code} })();`;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  /** Shows the on-page floating green helper badge under the prompt box for manual submission (Matching TobyFlow) */
  async function showManualSubmitPromptBadge(promptInput, generateBtn, timeoutMs = 90000) {
    return new Promise((resolve) => {
      const existing = document.getElementById("zf-manual-submit-badge");
      if (existing) existing.remove();

      const inputRect = promptInput.getBoundingClientRect();
      const badge = document.createElement("div");
      badge.id = "zf-manual-submit-badge";
      badge.style.cssText = `
        position: fixed;
        left: ${Math.max(20, inputRect.left + (inputRect.width / 2) - 130)}px;
        top: ${Math.min(window.innerHeight - 60, inputRect.bottom + 8)}px;
        background: #064e3b;
        color: #ecfdf5;
        border: 1.5px solid #10b981;
        border-radius: 9999px;
        padding: 6px 12px 6px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(16, 185, 129, 0.4);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        user-select: none;
        animation: zfBadgeBounce 0.3s ease-out;
      `;

      badge.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;" id="zf-badge-action-trigger" title="Click to auto-submit now">
          <span style="font-size:15px;color:#34d399;">↩</span>
          <span>Press Enter / click Submit</span>
        </div>
        <button id="zf-badge-skip-btn" style="
          background: #047857;
          color: #ffffff;
          border: 1px solid #10b981;
          border-radius: 9999px;
          padding: 2px 10px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        ">Skip</button>
      `;

      document.body.appendChild(badge);

      let isFinished = false;
      const cleanup = () => {
        if (isFinished) return;
        isFinished = true;
        document.removeEventListener("keydown", keyHandler, true);
        if (generateBtn) generateBtn.removeEventListener("click", clickHandler, true);
        badge.style.opacity = "0";
        badge.style.transform = "scale(0.9)";
        badge.style.transition = "all 0.2s ease";
        setTimeout(() => badge.remove(), 250);
        resolve(true);
      };

      const keyHandler = (e) => {
        if (e.key === "Enter") {
          cleanup();
        }
      };

      const clickHandler = () => {
        cleanup();
      };

      document.addEventListener("keydown", keyHandler, true);
      if (generateBtn) generateBtn.addEventListener("click", clickHandler, true);

      badge.querySelector("#zf-badge-action-trigger")?.addEventListener("click", () => {
        promptInput.focus();
        promptInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        if (generateBtn) forceClickElement(generateBtn);
        cleanup();
      });

      badge.querySelector("#zf-badge-skip-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        cleanup();
      });

      setTimeout(cleanup, timeoutMs);
    });
  }

  async function waitForButtonEnabled(btn, maxWaitMs = 2500) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const isDisabled = btn.disabled || 
                         btn.getAttribute("aria-disabled") === "true" || 
                         btn.classList.contains("disabled") ||
                         btn.hasAttribute("disabled");
      if (!isDisabled) return true;
      await sleep(100);
    }
    return false;
  }

  // =============================================
  // 6. PROMPT BOX LOCATOR
  // =============================================
  async function findExactPromptInput(timeout = 10000) {
    // Strategy 0: Active Custom DOM Template
    const tpl = await getActiveTemplateConfig();
    if (tpl?.promptInput) {
      let templateEl = resolveTemplateElement(tpl.promptInput);
      if (templateEl && templateEl.offsetParent !== null) {
        templateEl = drillToLeafInput(templateEl) || templateEl;
        console.log("ZiggyFlow: Resolved prompt input from active template:", tpl.name, templateEl);
        return templateEl;
      }
    }

    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (isTaskAborted) return null;

      // Strategy 1: Standard Flow Prompt Selectors
      const standardSelectors = [
        'textarea[data-testid="prompt-input"]',
        'textarea[aria-label*="prompt" i]',
        'textarea[aria-label*="describe" i]',
        'textarea[placeholder*="describe" i]',
        'textarea[placeholder*="prompt" i]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea'
      ];

      for (const sel of standardSelectors) {
        const found = findAllDeep(sel).filter(el => {
          if (el.offsetParent === null || el.disabled || el.readOnly) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 80 && rect.height > 10 && rect.top > window.innerHeight * 0.4;
        });

        if (found.length > 0) {
          // Lowest on screen is the prompt bar
          found.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
          return found[0];
        }
      }

      // Strategy 2: Contenteditable elements in bottom half
      const editables = findAllDeep('[contenteditable="true"]').filter(ed => {
        if (ed.offsetParent === null) return false;
        const rect = ed.getBoundingClientRect();
        return rect.width > 80 && rect.height > 10 && rect.top > window.innerHeight * 0.4;
      });

      if (editables.length > 0) {
        editables.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
        return editables[0];
      }

      await sleep(300);
    }
    return null;
  }

  function drillToLeafInput(el) {
    if (!el) return null;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el;
    if (el.isContentEditable && el.querySelectorAll('[contenteditable="true"], textarea, input').length === 0) return el;
    const inner = el.querySelector('textarea') || 
                  el.querySelector('input[type="text"]') ||
                  el.querySelector('[contenteditable="true"]');
    if (inner) return drillToLeafInput(inner);
    if (el.isContentEditable) return el;
    return null;
  }

  // =============================================
  // 7. PROVEN REACT DOM VALUE SETTER & INJECTOR
  // =============================================
  function setReactInputValue(element, value) {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const nativeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (nativeDescriptor && nativeDescriptor.set) {
      nativeDescriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    const tracker = element._valueTracker;
    if (tracker) {
      tracker.setValue("");
    }

    const inputEvent = new Event("input", { bubbles: true, cancelable: true, composed: true });
    element.dispatchEvent(inputEvent);

    const changeEvent = new Event("change", { bubbles: true, cancelable: true, composed: true });
    element.dispatchEvent(changeEvent);
  }

  async function safeReactType(el, text) {
    try {
      if (!el) return;
      el = drillToLeafInput(el) || el;

      console.log("ZiggyFlow: Injecting prompt into:", el.tagName, el.getBoundingClientRect());

      // Focus and click the element
      el.scrollIntoView({ behavior: "instant", block: "center" });
      el.focus();
      await sleep(100);

      safeClick(el);
      await sleep(80);

      // 1. Try execCommand selectAll + insertText (native browser typing)
      document.execCommand("selectAll", false, undefined);
      const execSuccess = document.execCommand("insertText", false, text);

      // 2. If it's a textarea/input, ensure value is set via native setter
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        if (!execSuccess || el.value !== text) {
          setReactInputValue(el, text);
        }
      }

      // 3. Dispatch full event chain for React/Angular/Lit state synchronization
      el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, inputType: "insertText", data: text }));
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, composed: true, inputType: "insertText", data: text }));
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true, composed: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true, composed: true }));

      // 4. Dispatch a space and backspace keystroke sequence to force React state update
      const spaceKey = { key: " ", code: "Space", keyCode: 32, which: 32, bubbles: true, cancelable: true, composed: true };
      el.dispatchEvent(new KeyboardEvent("keydown", spaceKey));
      el.dispatchEvent(new KeyboardEvent("keypress", spaceKey));
      el.dispatchEvent(new KeyboardEvent("keyup", spaceKey));

      await sleep(50);
      el.focus();

      console.log("ZiggyFlow: Prompt injection complete. Element value length:", (el.value || el.textContent || "").length);

    } catch (err) {
      console.warn("ZiggyFlow safeReactType error:", err);
    }
  }

  // =============================================
  // 8. GENERATE BUTTON LOCATOR
  // =============================================
  const NEGATIVE_TERMS = [
    "back", "quay", "trở", "close", "đóng", "dismiss", "cancel", "hủy",
    "menu", "sidebar", "nav", "panel", "expand", "collapse",
    "undo", "redo", "history", "lịch sử",
    "clear", "xóa", "delete",
    "agent", "trợ lý",
    "settings", "cài đặt", "gear", "config",
    "help", "trợ giúp", "info",
    "more", "thêm", "overflow",
    "fullscreen", "zoom", "share", "chia sẻ",
    "search", "tìm", "filter", "lọc",
    "upload", "tải lên", "attach", "đính kèm",
    "bookmark", "save", "lưu",
    "copy", "sao chép", "download", "tải xuống",
    "all media", "characters", "scenes", "tools",
    "trash", "thùng rác"
  ];

  function isExtensionElement(el) {
    if (!el) return false;
    if (el.id === "ziggyflow-floating-hud" || (el.id && el.id.startsWith("zf-"))) return true;
    if (typeof el.closest === "function") {
      if (el.closest("#ziggyflow-floating-hud") || el.closest('[id^="zf-"]')) return true;
    }
    if (el.classList && (el.classList.contains("zf-icon-btn") || el.classList.contains("zf-meta-tag"))) return true;
    if (el.hasAttribute && el.hasAttribute("data-ziggy-internal")) return true;
    return false;
  }

  function isNegativeButton(btn) {
    if (isExtensionElement(btn)) return true;
    const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
    const text = (btn.textContent || "").trim().toLowerCase();
    const title = (btn.getAttribute("title") || "").toLowerCase();
    const combined = aria + " " + text + " " + title;
    
    for (const term of NEGATIVE_TERMS) {
      if (combined.includes(term)) return true;
    }
    if (text.length > 20) return true;
    return false;
  }

  async function findGenerateButton(promptInput, timeout = 8000) {
    // Strategy 0: Active Custom DOM Template
    const tpl = await getActiveTemplateConfig();
    if (tpl?.generateButton) {
      const templateEl = resolveTemplateElement(tpl.generateButton);
      if (templateEl && templateEl.offsetParent !== null && !isExtensionElement(templateEl)) {
        console.log("ZiggyFlow: Resolved generate button from active template:", tpl.name, templateEl);
        return templateEl;
      }
    }

    const promptRect = promptInput ? promptInput.getBoundingClientRect() : null;
    const promptY = promptRect ? promptRect.top : window.innerHeight * 0.8;
    const minY = Math.max(promptY - 120, window.innerHeight * 0.4);
    const maxY = window.innerHeight;

    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (isTaskAborted) return null;

      // First check within the prompt container / form
      if (promptInput) {
        const promptContainer = promptInput.closest("form") || 
                                promptInput.closest('[role="region"]') || 
                                promptInput.parentElement?.parentElement || 
                                promptInput.parentElement;
        if (promptContainer) {
          const containerButtons = Array.from(promptContainer.querySelectorAll('button, div[role="button"], a[role="button"]'))
            .filter(btn => !isExtensionElement(btn) && !isNegativeButton(btn) && btn.offsetParent !== null);
          
          for (const btn of containerButtons) {
            const rect = btn.getBoundingClientRect();
            if (rect.width >= 16 && rect.height >= 16) {
              const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
              const hasSvg = !!btn.querySelector("svg");
              if (aria.includes("generate") || aria.includes("submit") || aria.includes("send") || hasSvg || rect.left > promptRect.left) {
                console.log("ZiggyFlow: Found prompt container generate button:", btn);
                return btn;
              }
            }
          }
        }
      }

      // Fallback search across bottom area
      const allButtons = findAllDeep('button, div[role="button"], a[role="button"]');
      const scored = [];

      for (const btn of allButtons) {
        if (btn.offsetParent === null) continue;
        if (isExtensionElement(btn)) continue; // STRICTLY IGNORE EXTENSION OVERLAY!
        const rect = btn.getBoundingClientRect();

        // Must be in bottom area
        if (rect.top < minY || rect.top > maxY) continue;
        if (rect.width < 10 || rect.height < 10) continue;
        if (isNegativeButton(btn)) continue;

        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        const text = (btn.textContent || "").trim().toLowerCase();
        const hasSvg = !!btn.querySelector('svg');
        const isCircular = Math.abs(rect.width - rect.height) < 15 && rect.width < 80;

        let score = 0;

        if (aria === "submit" || aria === "send" || aria === "generate" || aria === "gửi" || aria === "tạo") score += 100;
        if (text === "generate" || text === "tạo" || text === "submit" || text === "send" || text === "gửi") score += 100;
        if (text === "→" || text === "➔" || text === "▶") score += 80;
        if (hasSvg && isCircular) score += 50;
        if (hasSvg && rect.width <= 60) score += 20;

        if (promptRect) {
          const dx = rect.left - promptRect.right;
          if (dx > -50 && dx < 300) score += 30;
          const dy = Math.abs(rect.top - promptRect.top);
          if (dy < 40) score += 20;
        }

        if (score > 0) {
          scored.push({ btn, score, rect });
        }
      }

      if (scored.length > 0) {
        scored.sort((a, b) => b.score - a.score);
        console.log(`ZiggyFlow: Selected generate button (score=${scored[0].score}):`, scored[0].btn);
        return scored[0].btn;
      }

      await sleep(300);
    }
    
    return null;
  }

  // =============================================
  // 10. REAL-COORDINATE SINGLE CLICK ENGINE
  // =============================================
  function dispatchFullClickChain(target) {
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    const baseDownInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      screenX: clientX + (window.screenX || 0),
      screenY: clientY + (window.screenY || 0),
      button: 0,
      buttons: 1,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
      pressure: 0.5
    };

    const baseUpInit = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      screenX: clientX + (window.screenX || 0),
      screenY: clientY + (window.screenY || 0),
      button: 0,
      buttons: 0,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
      pressure: 0
    };

    try { target.dispatchEvent(new PointerEvent("pointerover", baseDownInit)); } catch(e){}
    try { target.dispatchEvent(new MouseEvent("mouseover", baseDownInit)); } catch(e){}
    try { target.dispatchEvent(new PointerEvent("pointerdown", baseDownInit)); } catch(e){}
    try { target.dispatchEvent(new MouseEvent("mousedown", baseDownInit)); } catch(e){}

    if (typeof target.focus === "function") {
      try { target.focus(); } catch(e){}
    }

    try { target.dispatchEvent(new PointerEvent("pointerup", baseUpInit)); } catch(e){}
    try { target.dispatchEvent(new MouseEvent("mouseup", baseUpInit)); } catch(e){}
    try { target.dispatchEvent(new MouseEvent("click", baseUpInit)); } catch(e){}
    try { target.click(); } catch(e){}
  }

  function forceClickElement(el) {
    try {
      if (!el) return;
      el.scrollIntoView({ behavior: "instant", block: "center" });

      const rect = el.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;

      const downInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX,
        clientY,
        screenX: clientX + (window.screenX || 0),
        screenY: clientY + (window.screenY || 0),
        button: 0,
        buttons: 1,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse"
      };

      const upInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX,
        clientY,
        screenX: clientX + (window.screenX || 0),
        screenY: clientY + (window.screenY || 0),
        button: 0,
        buttons: 0,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse"
      };

      try { el.dispatchEvent(new PointerEvent("pointerover", downInit)); } catch(e){}
      try { el.dispatchEvent(new MouseEvent("mouseover", downInit)); } catch(e){}
      try { el.dispatchEvent(new PointerEvent("pointerdown", downInit)); } catch(e){}
      try { el.dispatchEvent(new MouseEvent("mousedown", downInit)); } catch(e){}

      if (typeof el.focus === "function") try { el.focus(); } catch(e){}

      try { el.dispatchEvent(new PointerEvent("pointerup", upInit)); } catch(e){}
      try { el.dispatchEvent(new MouseEvent("mouseup", upInit)); } catch(e){}
      try { el.dispatchEvent(new MouseEvent("click", upInit)); } catch(e){}

      try { if (typeof el.click === "function") el.click(); } catch(e){}

      if (el.shadowRoot) {
        const innerBtn = el.shadowRoot.querySelector('button, [role="button"], svg');
        if (innerBtn) {
          try { innerBtn.dispatchEvent(new MouseEvent("click", upInit)); } catch(e){}
          try { if (typeof innerBtn.click === "function") innerBtn.click(); } catch(e){}
        }
      }
    } catch (e) {}
  }

  function safeClick(el) {
    try {
      if (!el) return;
      const target = el.closest('button, [role="button"], [role="radio"], [role="tab"], a') || el;
      target.scrollIntoView({ behavior: "instant", block: "center" });
      if (typeof target.focus === "function") {
        target.focus();
      }
      dispatchFullClickChain(target);
    } catch (e) {}
  }

  // =============================================
  // 9. MODEL SELECTION
  // =============================================
  async function applyModel(modelName) {
    try {
      const key = modelName.toLowerCase();
      const aliases = MODEL_NAME_MAP[key] || [modelName.toLowerCase()];
      const searchTerms = [modelName.toLowerCase(), ...aliases];

      const buttons = findAllDeep('button, div[role="button"], div[role="tab"], mat-button-toggle, span, p');
      for (const btn of buttons) {
        if (btn.offsetParent === null) continue;
        const t = (btn.textContent || "").trim().toLowerCase();
        if (t.length > 40) continue;

        if (searchTerms.some(term => t.includes(term) || t === term)) {
          safeClick(btn);
          if (btn.parentElement) safeClick(btn.parentElement);
          await sleep(200);
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // =============================================
  // 10. REFERENCE IMAGES & KEYFRAMES
  // =============================================
  async function injectReferenceImage(dataUrl) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "reference_asset.png", { type: "image/png" });

      const customSel = await getCustomSelector("reference");
      let fileInput = customSel ? findAllDeep(customSel)[0] : null;
      if (!fileInput || fileInput.tagName !== "INPUT") {
        fileInput = findAllDeep('input[type="file"][accept*="image"], input[type="file"]')[0];
      }

      if (fileInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        await sleep(600);
      }
    } catch (e) {}
  }

  async function injectKeyframe(dataUrl, slotType = "start") {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${slotType}_keyframe.png`, { type: "image/png" });
      const fileInputs = findAllDeep('input[type="file"]');
      const targetInput = slotType === "end" ? (fileInputs[1] || fileInputs[0]) : fileInputs[0];
      if (targetInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        targetInput.files = dt.files;
        targetInput.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        await sleep(600);
      }
    } catch (e) {}
  }

  function countMediaElements() {
    return document.querySelectorAll('video, img[src*="blob:"], img[src*="googleusercontent"]').length;
  }

  function getLatestRenderedMedia() {
    // 1. Check for video elements
    for (const video of document.querySelectorAll("video")) {
      if (video.src && !isExtensionElement(video)) {
        if (video.readyState >= 2 || video.duration > 0 || video.src.includes(".mp4")) {
          return { url: video.src, type: "video" };
        }
      }
    }

    // 2. Check for newly loaded canvas/tile images (matching Google Flow canvas tiles)
    const validImgs = Array.from(document.querySelectorAll("img")).filter(img => {
      if (!img.src || isExtensionElement(img)) return false;
      const rect = img.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 50) return false;
      const src = img.src.toLowerCase();
      if (src.includes("avatar") || src.includes("profile") || src.includes("icon") || src.includes("logo") || src.includes("placeholder")) return false;
      return img.complete && (img.naturalWidth > 60 || src.startsWith("blob:") || src.includes("googleusercontent") || src.startsWith("data:image"));
    });

    if (validImgs.length > 0) {
      // Return the top/first rendered canvas image (newest generation on Google Flow)
      return { url: validImgs[0].src, type: "image" };
    }

    return null;
  }

  async function waitForMediaResult(initialCount, maxWaitMs = 240000) {
    const start = Date.now();
    let poll = 0;

    // Small delay before polling to let generation spin up
    await sleep(2000);

    while (Date.now() - start < maxWaitMs) {
      if (isTaskAborted) throw new Error("Generation was stopped by user");
      await sleep(1500);
      poll++;

      let liveProgress = null;
      const progressNodes = findAllDeep('[aria-busy="true"], div.progress, span, p, div');
      for (const node of progressNodes) {
        if (node.offsetParent === null) continue;
        const match = (node.textContent || "").match(/(\d{1,3})%/);
        if (match && Number(match[1]) > 0 && Number(match[1]) <= 100) {
          liveProgress = match[0];
          break;
        }
      }

      const isGeneratingOnDOM = findAllDeep('[aria-busy="true"], .generating, .skeleton, mat-progress-spinner, svg.animate-spin').length > 0;

      if (liveProgress) {
        try {
          window.dispatchEvent(new CustomEvent("ZF_PROGRESS_UPDATE", { detail: liveProgress }));
          if (typeof window.__zf_onProgress === "function") window.__zf_onProgress(liveProgress);
        } catch(e) {}
        chrome.runtime.sendMessage({ action: "LIVE_RENDER_PROGRESS", progress: liveProgress }).catch(() => {});
        showLiveToast(`⏳ Google Flow Rendering: ${liveProgress}`);
      } else if (isGeneratingOnDOM) {
        try {
          window.dispatchEvent(new CustomEvent("ZF_PROGRESS_UPDATE", { detail: "Rendering..." }));
          if (typeof window.__zf_onProgress === "function") window.__zf_onProgress("Rendering...");
        } catch(e) {}
        chrome.runtime.sendMessage({ action: "LIVE_RENDER_PROGRESS", progress: null }).catch(() => {});
      }

      // Check if newly generated media is ready
      const currentMediaCount = countMediaElements();
      const media = getLatestRenderedMedia();

      if (media) {
        // If image count increased OR if we have a valid complete image tile and progress finished / high
        if (currentMediaCount > initialCount || poll > 4) {
          console.log("ZiggyFlow: Captured rendered media result:", media);
          return media;
        }
      }
    }

    // Fallback: check one last time before throwing
    const fallbackMedia = getLatestRenderedMedia();
    if (fallbackMedia) return fallbackMedia;

    throw new Error("Generation timed out on Google Flow.");
  }

  // =============================================
  // 10. MULTI-EVENT SAFE CLICK ENGINE
  // =============================================
  function dispatchFullClickChain(target) {
    if (!target) return;
    const opts = { bubbles: true, cancelable: true, composed: true, view: window, isPrimary: true, pointerId: 1, pointerType: "mouse" };
    try { target.dispatchEvent(new PointerEvent("pointerover", opts)); } catch(e){}
    try { target.dispatchEvent(new PointerEvent("pointerenter", opts)); } catch(e){}
    try { target.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch(e){}
    try { target.dispatchEvent(new MouseEvent("mousedown", opts)); } catch(e){}
    try { target.dispatchEvent(new PointerEvent("pointerup", opts)); } catch(e){}
    try { target.dispatchEvent(new MouseEvent("mouseup", opts)); } catch(e){}
    try { target.dispatchEvent(new MouseEvent("click", opts)); } catch(e){}
    try { target.click(); } catch(e){}
  }

  function safeClick(el) {
    try {
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();

      dispatchFullClickChain(el);

      const parentBtn = el.closest('button, [role="button"], [role="radio"], [role="tab"], a');
      if (parentBtn && parentBtn !== el) {
        dispatchFullClickChain(parentBtn);
      }

      const form = el.closest("form");
      if (form && el.type === "submit") {
        try { form.requestSubmit(el); } catch (e) {}
      }
    } catch (e) {}
  }

  function highlightElement(el, color = "#c4f82a") {
    try {
      if (!el) return;
      const prev = el.style.outline;
      el.style.outline = `3px solid ${color}`;
      el.style.boxShadow = `0 0 25px ${color}`;
      setTimeout(() => {
        try { el.style.outline = prev; el.style.boxShadow = ""; } catch (e) {}
      }, 2500);
    } catch (e) {}
  }

  function showLiveToast(text, isError = false) {
    try {
      let c = document.getElementById("ziggyflow-live-toast");
      if (!c) {
        c = document.createElement("div");
        c.id = "ziggyflow-live-toast";
        c.style.cssText = `position:fixed;top:20px;right:20px;z-index:2147483647;padding:12px 20px;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:13.5px;font-weight:700;box-shadow:0 15px 35px rgba(0,0,0,0.6);pointer-events:none;transition:opacity 0.3s,transform 0.3s;`;
        document.body.appendChild(c);
      }
      c.style.background = isError ? "#ef4444" : "linear-gradient(135deg, #a3e635, #facc15)";
      c.style.color = isError ? "#fff" : "#121316";
      c.style.opacity = "1";
      c.innerText = text;
      clearTimeout(window.__zf_toast_timer);
      window.__zf_toast_timer = setTimeout(() => { try { if (c) c.style.opacity = "0"; } catch (e) {} }, 4000);
    } catch (e) {}
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
})();
