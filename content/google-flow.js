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
  injectSlateBridge();

  // =============================================
  // 0.5 SLATE & REACT FIBER MAIN WORLD BRIDGE INJECTOR
  // =============================================
  function injectSlateBridge() {
    if (document.getElementById("ziggyflow-slate-bridge-script")) return;
    try {
      const s = document.createElement("script");
      s.id = "ziggyflow-slate-bridge-script";
      s.src = chrome.runtime.getURL("content/slate-bridge.js");
      (document.head || document.documentElement).appendChild(s);
      console.log("ZiggyFlow: slate-bridge.js script tag appended to document.");
    } catch(e) {}
  }

  function _slateBridgeCall(action, payload = {}) {
    return new Promise((resolve) => {
      injectSlateBridge();
      const rid = "zf_bridge_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      
      const onMsg = (e) => {
        if (e.source !== window || !e.data || e.data.source !== "ziggyflow-bridge-response" || e.data.requestId !== rid) return;
        window.removeEventListener("message", onMsg);
        resolve(e.data);
      };
      
      window.addEventListener("message", onMsg);
      window.postMessage({ source: "ziggyflow-bridge-request", action, ...payload, requestId: rid }, window.location.origin);
      
      setTimeout(() => {
        window.removeEventListener("message", onMsg);
        resolve({ success: false, timeout: true });
      }, 4000);
    });
  }

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

      if (request.action === "pq:trackerUpdate" && request.data) {
        if (typeof self.FloatingTracker !== "undefined") {
          self.FloatingTracker.update(request.data);
        }
        sendResponse({ success: true });
        return true;
      }

      if (request.action === "pq:trackerHide") {
        if (typeof self.FloatingTracker !== "undefined") {
          self.FloatingTracker.hide();
        }
        sendResponse({ success: true });
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
        (async () => {
          const slotData = request.template?.[request.slotName];
          let el = resolveTemplateElement(slotData);
          if (!el && request.slotName === "promptInput") el = await findExactPromptInput(2000);
          if (!el && request.slotName === "generateButton") el = await findGenerateButton(null, 2000);

          if (el) {
            if (request.actionType === "highlight") {
              highlightElement(el, "#38bdf8");
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              showLiveToast(`👁 Testing Highlight: <${el.tagName.toLowerCase()}>`);
            } else if (request.actionType === "click") {
              highlightElement(el, "#a3e635");
              showLiveToast(`▶ Testing Strategy [${(request.template?.clickStrategy || 'standard').toUpperCase()}] on <${el.tagName.toLowerCase()}>`);
              await executeConfiguredStrategy(el, request.template);
            }
            const rect = el.getBoundingClientRect();
            sendResponse({
              found: true,
              tag: el.tagName,
              rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`
            });
          } else {
            showLiveToast(`⚠️ Element not found for ${request.slotName}`, true);
            sendResponse({ found: false });
          }
        })();
        return true;
      }

      if (request.action === "SCAN_PAGE_MEDIA") {
        const mediaList = [];
        const seenUrls = new Set();

        // 1. Scan images
        const imgs = findAllDeep("img");
        imgs.forEach((img, idx) => {
          if (isExtensionElement(img)) return;
          const src = img.currentSrc || img.src;
          if (!src || src.startsWith("data:image/svg") || seenUrls.has(src)) return;
          const rect = img.getBoundingClientRect();
          if (rect.width < 80 || rect.height < 80) return;
          const s = src.toLowerCase();
          if (s.includes("avatar") || s.includes("profile") || s.includes("icon") || s.includes("logo") || s.includes("placeholder")) return;

          seenUrls.add(src);
          const parentCard = img.closest('div[role="group"], div[role="article"], div[class*="tile"], div[class*="card"], div[class*="item"]') || img.parentElement;
          const title = img.alt || parentCard?.getAttribute?.("aria-label") || parentCard?.querySelector?.('p, span, div[class*="title"], div[class*="prompt"]')?.textContent?.trim() || `Flow Image #${mediaList.length + 1}`;

          mediaList.push({
            id: "img_" + Date.now() + "_" + idx,
            url: src,
            title: title.substring(0, 70),
            type: "image",
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        });

        // 2. Scan videos
        const vids = findAllDeep("video");
        vids.forEach((vid, idx) => {
          if (isExtensionElement(vid)) return;
          const src = vid.currentSrc || vid.src || vid.querySelector("source")?.src;
          if (!src || seenUrls.has(src)) return;
          const rect = vid.getBoundingClientRect();
          if (rect.width < 80 || rect.height < 80) return;

          seenUrls.add(src);
          const parentCard = vid.closest('div[role="group"], div[role="article"], div[class*="tile"], div[class*="card"]') || vid.parentElement;
          const title = parentCard?.getAttribute?.("aria-label") || parentCard?.querySelector?.('p, span, div[class*="title"], div[class*="prompt"]')?.textContent?.trim() || `Flow Video #${mediaList.length + 1}`;

          mediaList.push({
            id: "vid_" + Date.now() + "_" + idx,
            url: src,
            title: title.substring(0, 70),
            type: "video",
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        });

        sendResponse({ success: true, media: mediaList });
        return true;
      }

      if (request.action === "SWITCH_TO_PROJECT") {
        const targetName = request.projectName || "";
        const allClickable = findAllDeep('a, button, div[role="button"], span, p');
        let matched = null;
        for (const el of allClickable) {
          const t = (el.textContent || "").trim();
          if (t && (t === targetName || (targetName.length > 5 && t.includes(targetName)))) {
            matched = el;
            break;
          }
        }
        if (matched) {
          matched.scrollIntoView({ behavior: "smooth", block: "center" });
          highlightElement(matched, "#a3e635");
          safeClick(matched);
          showLiveToast(`✦ Switched to project: ${targetName}`);
          sendResponse({ success: true, projectName: targetName });
        } else {
          sendResponse({ success: false, error: "Project not found on page" });
        }
        return true;
      }

      if (request.action === "TRIGGER_NEW_PROJECT_ON_PAGE") {
        const buttons = findAllDeep('button, a[role="button"], div[role="button"], a');
        let newBtn = buttons.find(b => {
          const t = (b.textContent || "").trim().toLowerCase();
          const aria = (b.getAttribute("aria-label") || "").toLowerCase();
          return t.includes("new project") || t.includes("tạo dự án") || t.includes("create project") || aria.includes("new project") || aria.includes("create project");
        });
        if (!newBtn) {
          newBtn = buttons.find(b => {
            const icon = b.querySelector('i.google-symbols, i[class*="symbol"], svg');
            const iconText = icon ? (icon.textContent || "").trim() : "";
            return iconText === "add" || iconText === "add_circle" || iconText === "create_new_folder";
          });
        }
        if (newBtn) {
          highlightElement(newBtn, "#ccff00");
          safeClick(newBtn);
          showLiveToast("➕ Creating new project on Google Flow...");
          sendResponse({ success: true });
        } else {
          showLiveToast("⚠️ 'New Project' button not found on page", true);
          sendResponse({ success: false, error: "New Project button not found" });
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
  // 0. EXTENSION ELEMENT EXCLUSION & DOM PIERCING
  // =============================================
  function isExtensionElement(el) {
    if (!el) return false;
    try {
      if (el.id === "ziggyflow-floating-hud" || el.id === "zf-mini-window" || el.id === "zf-pill-btn" || el.id === "ziggyflow-injected-header-btn") return true;
      if (el.id === "ziggyflow-element-picker-overlay" || el.id === "ziggyflow-live-toast" || (typeof el.id === "string" && el.id.startsWith("zf-"))) return true;
      if (el.getAttribute?.("data-ziggy-internal") === "true") return true;
      if (el.closest?.("#ziggyflow-floating-hud, #zf-mini-window, #zf-pill-btn, [data-ziggy-internal='true'], #ziggyflow-element-picker-overlay, #zf-expanded-gallery-overlay")) return true;
    } catch(e) {}
    return false;
  }

  function findAllDeep(selector) {
    const results = [];
    const seen = new Set();
    
    function scan(root) {
      if (!root) return;
      try {
        const elements = root.querySelectorAll(selector);
        for (const el of elements) {
          if (!seen.has(el) && !isExtensionElement(el)) {
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
      btn.setAttribute("data-ziggy-internal", "true");
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
    // Hide mini HUD during mapping so it never interferes or captures clicks
    const hud = document.getElementById("ziggyflow-floating-hud");
    const wasHudDisplay = hud ? hud.style.display : "none";
    if (hud) hud.style.display = "none";

    const existing = document.getElementById("ziggyflow-element-picker-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "ziggyflow-element-picker-overlay";
    overlay.setAttribute("data-ziggy-internal", "true");
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 2147483640; cursor: crosshair; pointer-events: none;
      background: rgba(0, 0, 0, 0.15);
    `;

    const banner = document.createElement("div");
    banner.setAttribute("data-ziggy-internal", "true");
    banner.style.cssText = `
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%);
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
    tooltip.setAttribute("data-ziggy-internal", "true");
    tooltip.style.cssText = `
      position: fixed; display: none; z-index: 2147483646; pointer-events: none;
      background: #0f172a; color: #38bdf8; border: 1px solid #38bdf8;
      padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;
      box-shadow: 0 8px 20px rgba(0,0,0,0.7); font-family: monospace;
    `;
    document.body.appendChild(tooltip);

    let lastHovered = null;
    const handleMouseMove = (e) => {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const el = elements.find(item => item && !isExtensionElement(item) && item !== overlay && item !== banner && item !== tooltip);
      if (el) {
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
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let targetEl = elements.find(item => item && !isExtensionElement(item) && item !== banner && item !== overlay && item !== tooltip);
      
      if (!targetEl) return;
      e.preventDefault();
      e.stopPropagation();

      if (targetEl && !isExtensionElement(targetEl)) {
        // Smart-snap to input or button
        if (slotName.toLowerCase().includes("prompt")) {
          const innerInput = targetEl.querySelector('textarea, input[type="text"], [contenteditable="true"]') ||
                             targetEl.closest('form, div')?.querySelector('textarea, input[type="text"], [contenteditable="true"]');
          if (innerInput) targetEl = innerInput;
        } else if (slotName.toLowerCase().includes("generate") || slotName.toLowerCase().includes("button")) {
          const parentBtn = targetEl.closest('button, [role="button"]');
          if (parentBtn) targetEl = parentBtn;
          
          const rect = targetEl.getBoundingClientRect();
          // Reject Back button or any header button in the top 40%
          if (rect.top < window.innerHeight * 0.38 || isNegativeButton(targetEl)) {
            console.warn("ZiggyFlow: Rejected top/back button during generate mapping:", targetEl);
            highlightElement(targetEl, "#ef4444");
            showLiveToast("⚠️ Back/Header button ignored — please click the Generate button near the bottom prompt box", true);
            return;
          }
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

        const tagLabel = targetEl.tagName.toUpperCase() + (targetEl.id ? `#${targetEl.id}` : (targetEl.className ? `.${String(targetEl.className).split(' ')[0]}` : ''));
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

        // Save directly to storage
        chrome.storage.local.get(['domTemplates', 'activeDomTemplateId'], (res) => {
          const tpls = res.domTemplates || {};
          const actId = res.activeDomTemplateId || templateId || 'default';
          if (tpls[actId]) {
            tpls[actId][slotName] = mappedData;
            chrome.storage.local.set({ domTemplates: tpls });
          }
        });

        // Send to ZiggyFlow UI to update active template display
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
      if (hud && wasHudDisplay && wasHudDisplay !== "none") {
        hud.style.display = wasHudDisplay;
      } else if (hud) {
        hud.style.display = "block";
      }
      if (lastHovered) { lastHovered.style.outline = ""; lastHovered.style.boxShadow = ""; }
      overlay.remove(); banner.remove(); tooltip.remove();
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    }

    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKeyDown, true);
    document.body.appendChild(overlay);
  }

  window.__zf_startMapper = startVisualElementMapper;

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
  // 4. GOOGLE FLOW SETTINGS POPOVER CONTROLLER (TobyFlow Parity)
  // =============================================
  function ratioToIconName(ratio) {
    const r = String(ratio || "").toLowerCase().trim();
    if (r.includes("16:9") || r === "ngang" || r === "widescreen" || r === "16_9" || r === "landscape") return "crop_16_9";
    if (r.includes("4:3") || r === "4_3" || r === "ngang 4:3" || r === "landscape 4:3") return "crop_landscape";
    if (r.includes("1:1") || r === "vuông" || r === "square" || r === "1_1") return "crop_square";
    if (r.includes("3:4") || r === "3_4" || r === "dọc 3:4" || r === "portrait 3:4" || r === "portrait") return "crop_portrait";
    if (r.includes("9:16") || r === "dọc" || r === "story" || r === "9_16") return "crop_9_16";
    if (r.includes("21:9") || r === "cinema" || r === "ultrawide") return "crop_16_9";
    return null;
  }

  function ratioToIdSuffix(ratio) {
    const r = String(ratio || "").toLowerCase().trim();
    if (r.includes("9:16") || r === "dọc" || r === "story" || r === "9_16") return "PORTRAIT";
    if (r.includes("16:9") || r === "ngang" || r === "widescreen" || r === "16_9" || r.includes("21:9")) return "LANDSCAPE";
    if (r.includes("1:1") || r === "vuông" || r === "square" || r === "1_1") return "SQUARE";
    if (r.includes("4:3") || r === "landscape 4:3" || r === "4_3") return "LANDSCAPE_4_3";
    if (r.includes("3:4") || r === "portrait 3:4" || r === "3_4") return "PORTRAIT_3_4";
    return null;
  }

  
  let _lastConfiguredSettings = null;

  async function waitForFlowConcurrencySlot(maxConcurrent = 4) {
    let waitCount = 0;
    while (waitCount < 60) {
      if (isTaskAborted) break;
      const tiles = Array.from(document.querySelectorAll('[data-tile-id]'));
      let activeGeneratingCount = 0;
      for (const t of tiles) {
        if (detectTileStatus(t) === "processing") activeGeneratingCount++;
      }
      if (activeGeneratingCount < maxConcurrent) break;
      console.log('ZIG Flow: ' + activeGeneratingCount + ' tiles currently generating (limit ' + maxConcurrent + '). Waiting for slot...');
      await sleep(1500);
      waitCount++;
    }
  }

  async function configureGoogleFlowSettings(task, force = false) {
    try {
      const currentKey = (task.type || 'image') + '|' + (task.aspectRatio || '16:9') + '|' + (task.model || 'default') + '|' + (task.quantity || 1) + '|' + (task.duration || '5s') + '|' + (task.framingMode || 'default');
      if (!force && _lastConfiguredSettings === currentKey) {
        console.log('ZIG Flow: Settings already configured (' + currentKey + '), skipping popover reopen for fast continuous generation.');
        return;
      }

      let popover = findSettingsPopover();
      if (!popover) {
        const settingsPill = findSettingsPillButton();
        if (settingsPill) {
          console.log("ZIG Flow: Opening settings popover via button:", settingsPill);
          safeClick(settingsPill);
          await sleep(500);
          popover = findSettingsPopover();
        }
      }

      if (!popover) {
        console.log("ZIG Flow: Settings popover not found on page, continuing with active preset.");
        return;
      }

      console.log("ZIG Flow: Settings popover active:", popover);

      const isVideo = (task.type || "").toLowerCase() === "video";

      // 1. Mode Tab: IMAGE vs VIDEO
      const typeSuffix = isVideo ? "VIDEO" : "IMAGE";
      let typeBtn = popover.querySelector('button[id$="-trigger-' + typeSuffix + '"], [id*="-trigger-' + typeSuffix + '"]');
      if (typeBtn) {
        safeClick(typeBtn);
        await sleep(300);
      } else {
        const tabs = Array.from(popover.querySelectorAll('button, [role="tab"], [role="radio"]'));
        const matchTab = tabs.find(t => {
          const txt = (t.textContent || "").trim().toLowerCase();
          return isVideo ? txt.includes("video") : (txt.includes("image") || txt.includes("ảnh"));
        });
        if (matchTab) {
          safeClick(matchTab);
          await sleep(300);
        }
      }

      // Re-acquire popover after tab switch
      popover = findSettingsPopover() || popover;

      // 2. Video Framing Mode (Frames vs Ingredients / References)
      if (isVideo) {
        const isFrames = task.framingMode === "Frames" || !!task.startFrame || !!task.endFrame || task.isFrames === true;
        const frameSuffix = isFrames ? "VIDEO_FRAMES" : "VIDEO_REFERENCES";
        const frameBtn = popover.querySelector('button[id$="-trigger-' + frameSuffix + '"], [id*="-trigger-' + frameSuffix + '"], button[aria-controls*="' + frameSuffix + '"]');
        if (frameBtn) {
          console.log("ZIG Flow: Selected Video Framing [" + frameSuffix + "]:", frameBtn);
          safeClick(frameBtn);
          await sleep(250);
        } else {
          const frameTabs = Array.from(popover.querySelectorAll('button, [role="tab"]'));
          const matchFrame = frameTabs.find(t => {
            const txt = (t.textContent || "").trim().toLowerCase();
            return isFrames ? (txt.includes("frame") || txt.includes("khung")) : (txt.includes("ingredient") || txt.includes("reference") || txt.includes("tham chiếu"));
          });
          if (matchFrame) {
            safeClick(matchFrame);
            await sleep(250);
          }
        }
      }

      // 3. Video Duration (5s, 6s, 8s)
      if (isVideo && (task.duration || task.flowVideoDuration)) {
        const targetDur = String(task.duration || task.flowVideoDuration).trim().toLowerCase();
        const durButtons = Array.from(popover.querySelectorAll('button, [role="tab"], [role="radio"]'));
        const durBtn = durButtons.find(b => {
          const txt = (b.textContent || "").trim().toLowerCase();
          return txt === targetDur || txt === targetDur.replace("s", " giây") || txt === targetDur.replace("s", "s");
        });
        if (durBtn) {
          console.log("ZIG Flow: Selected Video Duration [" + targetDur + "]:", durBtn);
          safeClick(durBtn);
          await sleep(250);
        }
      }

      // 4. Aspect Ratio (16:9, 9:16, 1:1, 4:3, 3:4)
      if (task.aspectRatio) {
        const targetRatio = String(task.aspectRatio).trim();
        const suffix = ratioToIdSuffix(targetRatio);
        const iconName = ratioToIconName(targetRatio);
        let ratioClicked = false;

        if (suffix) {
          const ratioBtn = popover.querySelector('button[id$="-trigger-' + suffix + '"], [id*="-trigger-' + suffix + '"]');
          if (ratioBtn) {
            safeClick(ratioBtn);
            await sleep(250);
            ratioClicked = true;
          }
        }

        if (!ratioClicked && iconName) {
          const allButtons = Array.from(popover.querySelectorAll('button, [role="tab"], [role="radio"]'));
          for (const btn of allButtons) {
            const icon = btn.querySelector('i.google-symbols, i[class*="symbol"], [data-icon]');
            if (icon && (icon.textContent || "").trim() === iconName) {
              safeClick(btn);
              await sleep(250);
              ratioClicked = true;
              break;
            }
          }
        }

        if (!ratioClicked) {
          const allButtons = Array.from(popover.querySelectorAll('button, [role="tab"], [role="radio"]'));
          for (const btn of allButtons) {
            const txt = (btn.textContent || "").trim().toLowerCase();
            if (txt.includes(targetRatio.toLowerCase())) {
              safeClick(btn);
              await sleep(250);
              ratioClicked = true;
              break;
            }
          }
        }
      }

      // 5. Quantity (x1, x2, x3, x4)
      const qty = parseInt(task.quantity, 10) || 1;
      if (qty >= 1 && qty <= 4) {
        const qtyBtn = popover.querySelector('button[id$="-trigger-' + qty + '"], [id*="-trigger-' + qty + '"]');
        if (qtyBtn) {
          safeClick(qtyBtn);
          await sleep(250);
        } else {
          const qtyButtons = Array.from(popover.querySelectorAll('button, [role="tab"]'));
          const matchQty = qtyButtons.find(b => (b.textContent || "").trim() === ("x" + qty) || (b.textContent || "").trim() === String(qty));
          if (matchQty) {
            safeClick(matchQty);
            await sleep(250);
          }
        }
      }

      // 6. Model Selection (e.g. "Omni Flash", "Veo 2", "Nano Banana Pro")
      if (task.model) {
        const targetModel = String(task.model).trim().toLowerCase();
        const modelBtn = Array.from(popover.querySelectorAll('button[aria-haspopup="menu"], button[aria-haspopup="listbox"], button')).find(b => {
          const txt = (b.textContent || "").trim().toLowerCase();
          return txt.includes("omni") || txt.includes("veo") || txt.includes("banana") || txt.includes("nano") || txt.includes("model");
        });

        if (modelBtn) {
          const cur = (modelBtn.textContent || "").trim().toLowerCase();
          if (!cur.includes(targetModel)) {
            safeClick(modelBtn);
            await sleep(350);
            const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button'));
            const matchItem = menuItems.find(m => (m.textContent || "").trim().toLowerCase().includes(targetModel));
            if (matchItem) {
              safeClick(matchItem);
              await sleep(300);
            }
          }
        }
      }

      // Close settings popover cleanly
      const closeBtn = popover.querySelector('button[aria-label*="close" i], button[aria-label*="Close" i]');
      if (closeBtn) {
        safeClick(closeBtn);
      } else {
        const pill = findSettingsPillButton();
        if (pill) safeClick(pill);
      }
      await sleep(250);

    } catch (err) {
      console.warn("ZIG Flow: configureGoogleFlowSettings notice:", err.message);
    }
  }

  
  /** Convert base64 data URL to File */
  function dataUrlToFile(dataUrl, filename = "keyframe.png") {
    if (!dataUrl) return null;
    if (dataUrl instanceof File) return dataUrl;
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/png";
      const bstr = atob(arr[1] || arr[0]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch(e) {
      console.warn("ZIG Flow: dataUrlToFile error:", e.message);
      return null;
    }
  }

  /** Injects keyframe image file into Google Flow keyframe slots or dropzones */
  async function injectKeyframeOrReferenceToFlow(file, slotName = "start") {
    if (!file) return false;
    console.log("ZIG Flow: Ingesting " + slotName + " keyframe file:", file.name);

    // Strategy A: Find file input elements
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    if (fileInputs.length > 0) {
      for (const input of fileInputs) {
        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new Event("input", { bubbles: true }));
          console.log("ZIG Flow: Injected file via input[type='file'] for " + slotName);
          await sleep(500);
          return true;
        } catch(e) {}
      }
    }

    // Strategy B: Drag & Drop simulation on Tile Container / Drop Targets
    const targets = Array.from(document.querySelectorAll('[data-tile-id], [role="dialog"], main, div[class*="dropzone"], div[class*="canvas"], body'));
    for (const target of targets) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dragOpts = { bubbles: true, cancelable: true, composed: true, dataTransfer: dt, clientX: cx, clientY: cy };

        target.dispatchEvent(new DragEvent("dragenter", dragOpts));
        target.dispatchEvent(new DragEvent("dragover", dragOpts));
        target.dispatchEvent(new DragEvent("drop", dragOpts));
        console.log("ZIG Flow: Injected file via native drop on <" + target.tagName + ">");
        await sleep(500);
        return true;
      } catch(e) {}
    }
    return false;
  }


  async function executeFlowTask(task) {
    if (isTaskAborted) throw new Error("Task was aborted");
    
    // Direct tracker display trigger
    try {
      if (typeof self.FloatingTracker !== "undefined") {
        self.FloatingTracker.update({
          isRunning: true,
          completed: 0,
          total: 1,
          jobs: [{
            id: task.id || ("job_" + Date.now()),
            owner: "Google Flow",
            label: "ZIG Mini Tracker",
            status: "running",
            completed: 0,
            failed: 0,
            total: 1,
            startedAt: Date.now(),
            items: [{
              id: task.id || ("gen_" + Date.now()),
              prompt: task.prompt,
              promptText: task.prompt,
              promptIndex: 0,
              state: "MONITORING",
              model: task.model || (task.type === "video" ? "Omni Flash" : "Nano Banana Pro"),
              ratio: task.aspectRatio || "16:9",
              genType: task.type || "image",
              quantity: task.quantity || 1,
              submittedAt: Date.now(),
              results: []
            }]
          }]
        });
      }
    } catch(e) {}

    showLiveToast(`⚡ ZiggyFlow: Automating Flow generation...`);

    // Flag to prevent setupManualGenerationDetector from self-triggering on synthetic events
    window.__zf_automated_task_active = true;

    // Notify overlay mini-window of the active task (HUD visibility is handled by onTaskStarted in overlay)
    try {
      window.dispatchEvent(new CustomEvent("ZF_TASK_STARTED", { detail: task }));
      if (typeof window.__zf_onTaskStarted === "function") window.__zf_onTaskStarted(task);
    } catch(e) {}

    // 0. Snapshot existing tiles & media BEFORE submitting to prevent grabbing stale images
    
    // 0.5 Ingest Start Frame, End Frame, and Reference Images if provided
    if (task.startFrame) {
      const startFile = dataUrlToFile(task.startFrame, "start_frame.png");
      if (startFile) await injectKeyframeOrReferenceToFlow(startFile, "start");
    }
    if (task.endFrame) {
      const endFile = dataUrlToFile(task.endFrame, "end_frame.png");
      if (endFile) await injectKeyframeOrReferenceToFlow(endFile, "end");
    }
    if (task.referenceImage) {
      const refFile = dataUrlToFile(task.referenceImage, "reference.png");
      if (refFile) await injectKeyframeOrReferenceToFlow(refFile, "reference");
    }

    const preTileIds = getUniqueTileIds();
    const preMediaSrcs = getExistingMediaSrcs();
    console.log(`ZiggyFlow: Pre-submit snapshot: ${preTileIds.size} existing tiles, ${preMediaSrcs.size} existing media sources.`);

    // 1. Settings Popover (Aspect Ratio & Quantity)
    await configureGoogleFlowSettings(task);
    await sleep(250);

    // 2. Find the exact prompt input
    const promptInput = await findExactPromptInput(10000);
    if (!promptInput) throw new Error("Could not find prompt box.");
    
    console.log("ZiggyFlow: Found prompt element:", promptInput.tagName, promptInput.className, 
      "rect:", promptInput.getBoundingClientRect());
    highlightElement(promptInput, "#c4f82a");

    // 3. Inject prompt text via Main World Slate Bridge + Safe React Type
    promptInput.setAttribute("data-ziggy-prompt", "true");
    
    // Tier 1: Main World Slate.js bridge insert
    const bridgeInsertResult = await _slateBridgeCall("insert", { text: task.prompt });
    console.log("ZiggyFlow: Slate bridge insert result:", bridgeInsertResult);

    // Tier 2: Isolated world fallback typing
    await safeReactType(promptInput, task.prompt);
    await sleep(150);

    // Sync React 18 internal value tracker safely in Main World
    syncReactStateInMainWorld(task.prompt);
    await sleep(100);

    const isManualSubmit = (task.submitMode || "auto") === "manual";

    if (isManualSubmit) {
      // ==========================================
      // MANUAL SUBMIT WORKFLOW (TobyFlow Pattern)
      // ==========================================
      console.log("ZiggyFlow: Manual Submit Mode active — showing top manual banner.");
      showLiveToast("⏱ Manual Submit: Press Enter or Click Submit on page", false);
      
      const generateBtn = await findGenerateButton(promptInput, 2000);
      if (generateBtn && !isNegativeButton(generateBtn)) {
        generateBtn.setAttribute("data-ziggy-generate", "true");
      }

      await showManualSubmitPromptBanner(promptInput, generateBtn, 120000);
      showLiveToast("🚀 Generation submitted! Tracking progress...");
    } else {
      // ==========================================
      // AUTO SUBMIT WORKFLOW (Full TobyFlow-Grade Multi-Tier Bypass Engine)
      // ==========================================
      console.log("ZiggyFlow: Auto-Submitting via TobyFlow Main-World Slate Bridge...");
      showLiveToast("🚀 Submitting generation via TobyFlow bypass...", false);

      // Tier A: Main World Bridge insertAndSubmit / submitOnly
      const bridgeSubmit = await _slateBridgeCall("submitOnly");
      console.log("ZiggyFlow: Slate bridge submitOnly result:", bridgeSubmit);

      // Tier B: Focus prompt input and dispatch Full Native Enter Event Sequence
      promptInput.focus();
      await sleep(60);

      const enterOpts = {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        charCode: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window
      };
      promptInput.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
      promptInput.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
      promptInput.dispatchEvent(new KeyboardEvent("keyup", enterOpts));

      // Tier C: Dispatch TobyFlow 4-Method Slate & React Fiber Submit Bypass in Main World
      executeTobyFlowSubmitBypass(task.prompt);
      await sleep(150);

      // Tier D: Complementary click on Generate button
      try {
        const generateBtn = await findGenerateButton(promptInput, 1500);
        if (generateBtn && !isNegativeButton(generateBtn) && !isExtensionElement(generateBtn)) {
          const btnRect = generateBtn.getBoundingClientRect();
          if (btnRect.top >= window.innerHeight * 0.35) {
            console.log("ZiggyFlow: Backup click on Generate button:", generateBtn);
            clickButtonCleanly(generateBtn);
          }
        }
      } catch (e) {}

      console.log("ZiggyFlow: Auto-Submit completed via TobyFlow multi-tier bypass.");
    }

    // 5. Track live generation — trackGenerationProgress is the SINGLE source of truth
    // for dispatching ZF_MEDIA_READY and MEDIA_GENERATED_NOTIFICATION.
    // DO NOT dispatch again here — that causes duplicate auto-downloads.
    let mediaResult;
    try {
      mediaResult = await trackGenerationProgress(240000, preTileIds, preMediaSrcs, task);
    } finally {
      window.__zf_automated_task_active = false;
    }

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

  /** Gets all existing tile IDs currently on page before prompt submission */
  function getUniqueTileIds() {
    const tiles = document.querySelectorAll('[data-tile-id]');
    const ids = new Set();
    tiles.forEach(t => {
      const id = t.dataset.tileId || t.getAttribute('data-tile-id');
      if (id) ids.add(id);
    });
    return ids;
  }

  /** Gets all existing media URLs currently on page before prompt submission */
  function getExistingMediaSrcs() {
    const srcs = new Set();
    document.querySelectorAll('img, video, source').forEach(el => {
      if (isExtensionElement(el)) return;
      const s = el.currentSrc || el.src;
      if (s && !s.startsWith("data:image/svg")) srcs.add(s);
    });
    return srcs;
  }

  /** TobyFlow-grade Tile Status Detector */
  function detectTileStatus(tileEl) {
    if (!tileEl) return "processing";

    // 1. Check for progress percentage (e.g. "27%", "60%", "45%")
    const text = (tileEl.textContent || "").trim();
    if (/\b\d{1,3}%\b/.test(text)) {
      return "processing";
    }

    // 2. Check for aria-busy or generating indicators
    if (tileEl.getAttribute("aria-busy") === "true" || 
        tileEl.querySelector('[aria-busy="true"], [role="progressbar"], .skeleton, .animate-spin, div[class*="loading"], div[class*="spinner"]')) {
      return "processing";
    }

    // 3. Check for generating icons (play_circle, progress_activity, sync, hourglass)
    const genIcon = Array.from(tileEl.querySelectorAll("i, span, svg")).find(el => {
      const t = (el.textContent || "").trim();
      return t === "play_circle" || t === "progress_activity" || t === "hourglass_empty" || t === "hourglass_bottom" || t === "sync";
    });
    if (genIcon && isElementVisible(genIcon)) return "processing";

    // 4. Check for warning/error icon
    const warningIcon = Array.from(tileEl.querySelectorAll("i, span")).find(el => {
      const t = (el.textContent || "").trim();
      return t === "warning" || t === "error" || t === "report" || t === "refresh" || t === "error_outline";
    });
    if (warningIcon && isElementVisible(warningIcon)) return "failed";

    // 5. Check for valid rendered image/video in this tile
    const video = tileEl.querySelector("video");
    const img = tileEl.querySelector("img");
    const media = video || img;

    if (media) {
      const src = media.currentSrc || media.src || "";
      const rawSrc = media.getAttribute("src") || "";
      const isPlaceholder = !src || src.startsWith("data:image/svg") || src.includes("media.html") || rawSrc === "media.html" ||
        (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("blob:") && !rawSrc.startsWith("/fx/"));

      if (!isPlaceholder) {
        if (img && img.complete && img.naturalWidth > 60) {
          return "success";
        }
        if (video && (video.readyState >= 2 || video.duration > 0 || src.startsWith("blob:") || src.includes(".mp4"))) {
          return "success";
        }
      }
    }

    return "processing";
  }

  function isElementVisible(el) {
    if (!el) return false;
    try {
      const c = window.getComputedStyle(el);
      if (c.opacity === "0" || c.visibility === "hidden" || c.display === "none") return false;
      return el.offsetParent !== null;
    } catch(e) {
      return true;
    }
  }

  /** ZIG Flow generation tracking — Strict TobyFlow-grade architecture:
   *  Only monitors newly inserted [data-tile-id] elements created after prompt submission. */
  async function trackGenerationProgress(maxWaitMs = 240000, preTileIds = new Set(), preMediaSrcs = new Set(), task = {}) {
    return new Promise((resolve, reject) => {
      window.__zf_isTrackingGeneration = true;
      const startTime = Date.now();
      const expectedQuantity = Math.max(1, Number(task.quantity) || 1);
      const collectedResults = [];
      const discoveredMediaUrls = new Set();
      let isResolved = false;
      let lastReportedProgress = "";

      const cleanup = () => {
        isResolved = true;
        window.__zf_isTrackingGeneration = false;
        if (pollTimer) clearInterval(pollTimer);
      };

      const check = () => {
        if (isResolved) return;
        const elapsed = Date.now() - startTime;

        // 1. Lightweight progress percentage query
        let liveProgress = null;
        const progressNodes = document.querySelectorAll('[aria-busy="true"], [role="progressbar"], div[class*="progress"], [data-testid*="progress"]');
        for (const node of progressNodes) {
          if (isExtensionElement(node)) continue;
          const match = (node.textContent || "").match(/(\d{1,3})%/);
          if (match && Number(match[1]) > 0 && Number(match[1]) <= 100) {
            liveProgress = match[0];
            break;
          }
        }

        // 2. Query strictly all tiles currently on page with data-tile-id
        const allTileElements = Array.from(document.querySelectorAll('[data-tile-id]'));
        
        // Filter strictly to tiles that were NOT present before generation started
        const newTiles = allTileElements.filter(t => {
          const tid = t.dataset.tileId || t.getAttribute('data-tile-id');
          return tid && !preTileIds.has(tid);
        });

        for (const tile of newTiles) {
          const tileId = tile.dataset.tileId || tile.getAttribute('data-tile-id');
          
          // Check percentage inside this specific new tile
          const tileText = (tile.textContent || "").trim();
          const tilePctMatch = tileText.match(/(\d{1,3})%/);
          if (tilePctMatch && Number(tilePctMatch[1]) > 0 && Number(tilePctMatch[1]) <= 100) {
            liveProgress = tilePctMatch[0];
          }

          const status = detectTileStatus(tile);

          if (status === "success") {
            const video = tile.querySelector("video");
            const img = tile.querySelector("img");
            const media = video || img;
            const mediaUrl = media ? (media.currentSrc || media.src) : null;

            // Must have valid URL and not be pre-existing
            if (!mediaUrl || preMediaSrcs.has(mediaUrl) || discoveredMediaUrls.has(mediaUrl)) continue;

            discoveredMediaUrls.add(mediaUrl);

            const res = {
              url: mediaUrl,
              type: video ? "video" : "image",
              tileId: tileId
            };

            collectedResults.push(res);
            console.log(`ZIG Flow: ✅ Verified NEW generated media [${collectedResults.length}/${expectedQuantity}]:`, res);

            const itemPayload = {
              id: task.id ? `${task.id}_${collectedResults.length}` : ("gen_" + Date.now()),
              taskId: task.id,
              provider: "Google Flow",
              prompt: task.prompt,
              mediaUrl: res.url,
              type: res.type,
              duration: task.duration,
              aspectRatio: task.aspectRatio,
              project: task.project
            };

            try {
              window.dispatchEvent(new CustomEvent("ZF_MEDIA_READY", { detail: itemPayload }));
              if (typeof window.__zf_onTaskCompleted === "function") window.__zf_onTaskCompleted(itemPayload);
            } catch(e) {}

            chrome.runtime.sendMessage({
              action: "MEDIA_GENERATED_NOTIFICATION",
              payload: itemPayload
            }).catch(() => {});

            if (collectedResults.length >= expectedQuantity) {
              cleanup();
              resolve(collectedResults[0]);
              return;
            }
          }
        }

        // Broadcast progress if updated
        if (liveProgress && liveProgress !== lastReportedProgress) {
          lastReportedProgress = liveProgress;
          try {
            window.dispatchEvent(new CustomEvent("ZF_PROGRESS_UPDATE", { detail: liveProgress }));
            if (typeof window.__zf_onProgress === "function") window.__zf_onProgress(liveProgress);
          } catch(e) {}
          chrome.runtime.sendMessage({ action: "LIVE_RENDER_PROGRESS", progress: liveProgress }).catch(() => {});
        }

        if (elapsed > maxWaitMs) {
          cleanup();
          if (collectedResults.length > 0) {
            resolve(collectedResults[0]);
          } else {
            reject(new Error("Generation timed out on Google Flow."));
          }
        }
      };

      const pollTimer = setInterval(() => {
        if (isTaskAborted) {
          cleanup();
          reject(new Error("Generation stopped by user"));
          return;
        }
        check();
      }, 500);

      // Immediate first check
      check();
    });
  }

  /** Safely synchronizes React 18 state & Slate.js in Main World context */
  function syncReactStateInMainWorld(promptText) {
    try {
      const sanitizedText = JSON.stringify(promptText || "");
      const code = `
        try {
          const _slateSelector = '[data-slate-editor="true"], [contenteditable="true"][role="textbox"], textarea';
          const slateEl = document.querySelector(_slateSelector) || document.querySelector('[data-ziggy-prompt="true"]');
          const btn = document.querySelector('[data-ziggy-generate="true"]');
          const text = ${sanitizedText};
          
          if (slateEl && text) {
            // Check for Slate internal editor via React Fiber
            const fiberKey = Object.keys(slateEl).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
            if (fiberKey) {
              let fiber = slateEl[fiberKey];
              while (fiber) {
                if (fiber.dependencies && fiber.dependencies.firstContext) {
                  let ctx = fiber.dependencies.firstContext;
                  while (ctx) {
                    const editor = ctx.memoizedValue;
                    if (editor && typeof editor.insertText === "function" && Array.isArray(editor.children)) {
                      try {
                        if (!editor.selection) {
                          editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
                        }
                        editor.insertText(text);
                        if (typeof editor.onChange === "function") editor.onChange();
                        console.log("ZiggyFlow [Slate]: Injected via Slate.js editor instance \u2705");
                      } catch(e) {}
                      break;
                    }
                    ctx = ctx.next;
                  }
                }
                fiber = fiber.return;
              }
            }

            if (slateEl._valueTracker) {
              slateEl._valueTracker.setValue('');
            }
            
            const proto = slateEl instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(slateEl, text);
            else slateEl.value = text;

            slateEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            slateEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
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

  /** TobyFlow-Grade Multi-Method Submit Bypass Engine in Main World Context */
  function executeTobyFlowSubmitBypass(promptText) {
    try {
      const sanitizedText = JSON.stringify(promptText || "");
      const code = `
        try {
          const _slateSelector = '[data-slate-editor="true"], [contenteditable="true"][role="textbox"], textarea[data-testid="prompt-input"], textarea';
          const slateEl = document.querySelector(_slateSelector) || document.querySelector('[data-ziggy-prompt="true"]');
          
          // 1. Locate Generate / Submit Button
          let submitBtn = document.querySelector('[data-ziggy-generate="true"]');
          if (!submitBtn) {
            const allBtns = Array.from(document.querySelectorAll('button, div[role="button"]'));
            for (const b of allBtns) {
              const rect = b.getBoundingClientRect();
              if (rect.top < window.innerHeight * 0.38) continue; // Skip header/back buttons
              const icon = b.querySelector('i.google-symbols, i[class*="symbol"], svg');
              const iconTxt = icon ? (icon.textContent || "").trim() : "";
              const aria = (b.getAttribute("aria-label") || "").toLowerCase();
              if (iconTxt === "arrow_forward" || iconTxt === "send" || aria.includes("generate") || aria.includes("submit") || aria.includes("send")) {
                submitBtn = b;
                break;
              }
            }
          }

          let submitted = false;

          // ==========================================
          // METHOD 1: React 18 Synthetic __reactProps$ onClick Bypass (TobyFlow Pattern)
          // ==========================================
          if (submitBtn) {
            try {
              const propsKey = Object.keys(submitBtn).find(k => k.startsWith("__reactProps$"));
              if (propsKey && submitBtn[propsKey] && typeof submitBtn[propsKey].onClick === "function") {
                const rect = submitBtn.getBoundingClientRect();
                const fakeEvent = {
                  preventDefault: () => {},
                  stopPropagation: () => {},
                  persist: () => {},
                  nativeEvent: { isTrusted: true },
                  isTrusted: true,
                  target: submitBtn,
                  currentTarget: submitBtn,
                  bubbles: true,
                  cancelable: true,
                  defaultPrevented: false,
                  eventPhase: 3,
                  timeStamp: Date.now(),
                  type: "click",
                  button: 0,
                  buttons: 1,
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                };
                submitBtn[propsKey].onClick(fakeEvent);
                submitted = true;
                console.log("ZiggyFlow [Bypass]: React __reactProps$ synthetic onClick dispatched \u2705");
              }
            } catch(e) {}
          }

          // ==========================================
          // METHOD 2: Fiber Tree onSubmit / handleSubmit Hook (TobyFlow Pattern)
          // ==========================================
          if (!submitted && submitBtn) {
            try {
              const fiberKey = Object.keys(submitBtn).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
              if (fiberKey) {
                let fiber = submitBtn[fiberKey];
                let depth = 0;
                while (fiber && depth < 50) {
                  if (fiber.pendingProps && typeof fiber.pendingProps.onSubmit === "function") {
                    fiber.pendingProps.onSubmit({ preventDefault: () => {}, stopPropagation: () => {} });
                    submitted = true;
                    console.log("ZiggyFlow [Bypass]: React Fiber pendingProps.onSubmit executed \u2705");
                    break;
                  }
                  if (fiber.stateNode && typeof fiber.stateNode.handleSubmit === "function") {
                    fiber.stateNode.handleSubmit();
                    submitted = true;
                    console.log("ZiggyFlow [Bypass]: React Fiber stateNode.handleSubmit executed \u2705");
                    break;
                  }
                  fiber = fiber.return;
                  depth++;
                }
              }
            } catch(e) {}
          }

          // ==========================================
          // METHOD 3: Slate Context & Hook Generator Method
          // ==========================================
          if (!submitted && slateEl) {
            try {
              const edFiberKey = Object.keys(slateEl).find(k => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"));
              if (edFiberKey) {
                let edFiber = slateEl[edFiberKey];
                let depth = 0;
                while (edFiber && depth < 50) {
                  if (edFiber.dependencies && edFiber.dependencies.firstContext) {
                    let ctx = edFiber.dependencies.firstContext;
                    while (ctx) {
                      const val = ctx.memoizedValue;
                      if (val && typeof val === "object") {
                        const fn = val.submit || val.handleSubmit || val.onSubmit || val.sendMessage || val.generate;
                        if (typeof fn === "function") {
                          fn();
                          submitted = true;
                          console.log("ZiggyFlow [Bypass]: Slate Fiber context submit hook executed \u2705");
                          break;
                        }
                      }
                      ctx = ctx.next;
                    }
                  }
                  edFiber = edFiber.return;
                  depth++;
                }
              }
            } catch(e) {}
          }

          // ==========================================
          // METHOD 4: Native Enter & Pointer Event Sequence
          // ==========================================
          if (slateEl) {
            slateEl.focus();
            
            const enterOpts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, charCode: 13, bubbles: true, cancelable: true, composed: true, view: window };
            slateEl.dispatchEvent(new KeyboardEvent("keydown", enterOpts));
            slateEl.dispatchEvent(new KeyboardEvent("keypress", enterOpts));
            slateEl.dispatchEvent(new KeyboardEvent("keyup", enterOpts));

            // Ctrl+Enter fallback
            slateEl.dispatchEvent(new KeyboardEvent("keydown", { ...enterOpts, ctrlKey: true }));

            const form = slateEl.closest("form");
            if (form && typeof form.requestSubmit === "function") {
              try { form.requestSubmit(); } catch(e) {}
            }
          }

          if (submitBtn) {
            submitBtn.focus();
            submitBtn.click();
            const rect = submitBtn.getBoundingClientRect();
            const ptOpts = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, view: window };
            submitBtn.dispatchEvent(new PointerEvent("pointerdown", ptOpts));
            submitBtn.dispatchEvent(new MouseEvent("mousedown", ptOpts));
            submitBtn.dispatchEvent(new PointerEvent("pointerup", ptOpts));
            submitBtn.dispatchEvent(new MouseEvent("mouseup", ptOpts));
            submitBtn.dispatchEvent(new MouseEvent("click", ptOpts));
          }
        } catch(err) {
          console.warn("ZiggyFlow: Main World Submit Bypass error:", err);
        }
      `;

      const script = document.createElement("script");
      script.textContent = `(() => { ${code} })();`;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  /** Shows TobyFlow-grade Top Manual Enter Banner with live prompt tracking & skip button */
  async function showManualSubmitPromptBanner(promptInput, generateBtn, timeoutMs = 120000) {
    return new Promise((resolve) => {
      const existing = document.getElementById("zf-manual-enter-banner");
      if (existing) existing.remove();

      const banner = document.createElement("div");
      banner.id = "zf-manual-enter-banner";
      banner.setAttribute("data-ziggy-internal", "true");
      banner.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(180deg, rgba(18,22,30,0.95), rgba(4,7,12,0.98));
        color: #f1f5f9;
        border: 1.5px solid #a3e635;
        border-radius: 9999px;
        padding: 8px 18px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(163, 230, 53, 0.4);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 700;
        user-select: none;
        animation: zfBadgeBounce 0.3s ease-out;
      `;

      banner.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;" id="zf-manual-action-trigger" style="cursor:pointer;" title="Click to auto-submit">
          <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#a3e635;box-shadow:0 0 8px #a3e635;animation:zfPillPulse 1.5s infinite;"></span>
          <span style="color:#a3e635;">⚡ Ready:</span>
          <span>Press Enter or Click Submit on page to generate</span>
        </div>
        <button id="zf-manual-skip-btn" style="
          background: rgba(239,68,68,0.2);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.4);
          border-radius: 9999px;
          padding: 3px 12px;
          font-size: 11.5px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
        ">Skip</button>
      `;

      document.body.appendChild(banner);

      let isFinished = false;
      const cleanup = () => {
        if (isFinished) return;
        isFinished = true;
        document.removeEventListener("keydown", keyHandler, true);
        if (generateBtn) generateBtn.removeEventListener("click", clickHandler, true);
        banner.style.opacity = "0";
        banner.style.transform = "translateX(-50%) scale(0.9)";
        banner.style.transition = "all 0.2s ease";
        setTimeout(() => banner.remove(), 250);
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

      banner.querySelector("#zf-manual-action-trigger")?.addEventListener("click", () => {
        promptInput.focus();
        promptInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        if (generateBtn) clickButtonCleanly(generateBtn);
        cleanup();
      });

      banner.querySelector("#zf-manual-skip-btn")?.addEventListener("click", (e) => {
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
    const isGemini = window.location.hostname.includes("gemini.google.com");

    while (Date.now() - start < timeout) {
      if (isTaskAborted) return null;

      // Strategy 1: Dedicated Provider Selectors (Google Flow & Google Gemini)
      const standardSelectors = isGemini ? [
        'div[contenteditable="true"][role="textbox"]',
        'rich-textarea div[contenteditable="true"]',
        'rich-textarea',
        '.ql-editor[contenteditable="true"]',
        'div.input-area [contenteditable="true"]',
        'textarea[aria-label*="prompt" i]',
        'textarea'
      ] : [
        '[data-slate-editor="true"]',
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
          return rect.width > 60 && rect.height > 10 && rect.top > window.innerHeight * 0.35;
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
        return rect.width > 60 && rect.height > 10 && rect.top > window.innerHeight * 0.35;
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
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      const execSuccess = document.execCommand("insertText", false, text);

      // 2. If it's a textarea/input, ensure value is set via native setter
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
        if (!execSuccess || el.value !== text) {
          setReactInputValue(el, text);
        }
      } else if (!execSuccess && el.isContentEditable) {
        // Fallback for Gemini / rich editors: create text node / paragraph
        const textNode = document.createTextNode(text);
        el.appendChild(textNode);
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
    "trash", "thùng rác",
    "arrow_back", "arrow-back", "chevron", "home", "header", "navbar", "topbar", "breadcrumb"
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
    if (!btn) return true;
    if (isExtensionElement(btn)) return true;

    // Strict vertical check: Generate button is ALWAYS in the bottom area (top > 35% of viewport)
    try {
      const rect = btn.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.35) {
        return true; // Reject back button, header navbar, breadcrumb, profile
      }
    } catch(e) {}

    const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
    const text = (btn.textContent || "").trim().toLowerCase();
    const title = (btn.getAttribute("title") || "").toLowerCase();
    const className = String(btn.className || "").toLowerCase();
    const combined = aria + " " + text + " " + title + " " + className;
    
    for (const term of NEGATIVE_TERMS) {
      if (combined.includes(term)) return true;
    }
    if (text.length > 25) return true;
    return false;
  }

  async function findGenerateButton(promptInput, timeout = 8000) {
    // Strategy 0: Active Custom DOM Template
    const tpl = await getActiveTemplateConfig();
    if (tpl?.generateButton) {
      const templateEl = resolveTemplateElement(tpl.generateButton);
      if (templateEl && templateEl.offsetParent !== null && !isNegativeButton(templateEl)) {
        console.log("ZiggyFlow: Resolved generate button from active template:", tpl.name, templateEl);
        return templateEl;
      }
    }

    const promptRect = promptInput ? promptInput.getBoundingClientRect() : null;
    const promptY = promptRect ? promptRect.top : window.innerHeight * 0.8;
    const minY = Math.max(promptY - 120, window.innerHeight * 0.35);
    const maxY = window.innerHeight;
    const isGemini = window.location.hostname.includes("gemini.google.com");

    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (isTaskAborted) return null;

      // First check within the prompt container / form
      if (promptInput) {
        const promptContainer = promptInput.closest("form") || 
                                promptInput.closest('[role="region"]') || 
                                promptInput.closest('.input-area') ||
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
              const icon = btn.querySelector("i.google-symbols, i[class*='symbol']");
              const iconTxt = icon ? (icon.textContent || "").trim() : "";
              
              if (iconTxt === "arrow_forward" || iconTxt === "send" || aria.includes("generate") || aria.includes("submit") || aria.includes("send") || aria.includes("gửi") || hasSvg) {
                console.log("ZiggyFlow: Found prompt container generate button:", btn);
                return btn;
              }
            }
          }
        }
      }

      // Gemini & Flow SVG path recognition (M2.01 21L23 12 / M2 21l21-9)
      const allButtons = findAllDeep('button, div[role="button"], a[role="button"]');
      for (const btn of allButtons) {
        if (btn.offsetParent === null || isExtensionElement(btn) || isNegativeButton(btn)) continue;
        const rect = btn.getBoundingClientRect();
        if (rect.top < minY || rect.top > maxY) continue;

        const svgs = btn.querySelectorAll("svg");
        for (const svg of svgs) {
          const paths = svg.querySelectorAll("path");
          for (const path of paths) {
            const d = path.getAttribute("d") || "";
            if (d.includes("M2.01 21L23 12") || d.includes("M2 21l21-9") || d.includes("m4 4 16 8-16 8") || d.match(/M\d+.*L.*\d+.*12/)) {
              console.log("ZiggyFlow: Found submit button by SVG path signature:", btn);
              return btn;
            }
          }
        }
      }

      // Fallback search across bottom area
      const scored = [];

      for (const btn of allButtons) {
        if (btn.offsetParent === null) continue;
        if (isExtensionElement(btn)) continue;
        const rect = btn.getBoundingClientRect();

        if (rect.top < minY || rect.top > maxY) continue;
        if (rect.width < 10 || rect.height < 10) continue;
        if (isNegativeButton(btn)) continue;

        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        const text = (btn.textContent || "").trim().toLowerCase();
        const hasSvg = !!btn.querySelector('svg');
        const icon = btn.querySelector("i.google-symbols, i[class*='symbol']");
        const iconTxt = icon ? (icon.textContent || "").trim() : "";
        const isCircular = Math.abs(rect.width - rect.height) < 15 && rect.width < 80;

        let score = 0;

        if (iconTxt === "arrow_forward" || iconTxt === "send") score += 120;
        if (aria === "submit" || aria === "send" || aria === "generate" || aria === "gửi" || aria === "tạo" || aria.includes("send message") || aria.includes("gửi tin nhắn")) score += 100;
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

  async function executeConfiguredStrategy(targetEl, template) {
    if (!targetEl) return;
    const strat = template?.clickStrategy || "enter";
    const cfg = template?.strategyConfig?.[strat] || {};
    console.log(`ZiggyFlow: Executing configured strategy [${strat}]`, cfg, targetEl);

    if (strat === "enter") {
      if (cfg.preDelay) await sleep(cfg.preDelay);
      targetEl.focus();
      
      const keyInit = {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        charCode: 13,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        shiftKey: cfg.modifier === "shift",
        ctrlKey: cfg.modifier === "ctrl",
        altKey: cfg.modifier === "alt"
      };

      targetEl.dispatchEvent(new KeyboardEvent("keydown", keyInit));
      targetEl.dispatchEvent(new KeyboardEvent("keypress", keyInit));
      targetEl.dispatchEvent(new KeyboardEvent("keyup", keyInit));

      if (cfg.requestSubmit !== false) {
        const form = targetEl.closest("form");
        if (form && typeof form.requestSubmit === "function") {
          try { form.requestSubmit(); } catch(e) {}
        }
      }

      if (cfg.reactDispatch !== false) {
        dispatchEnterInMainWorld();
      }
    } else if (strat === "standard") {
      if (cfg.hoverDelay) await sleep(cfg.hoverDelay);
      if (cfg.forceFocus !== false && typeof targetEl.focus === "function") {
        try { targetEl.focus(); } catch(e) {}
      }
      dispatchFullClickChain(targetEl);
      if (cfg.holdDuration) await sleep(cfg.holdDuration);
    } else if (strat === "coords") {
      const pctX = cfg.pctX !== undefined ? cfg.pctX : 0.88;
      const pctY = cfg.pctY !== undefined ? cfg.pctY : 0.91;
      const clientX = Math.round(pctX * window.innerWidth) + (cfg.offsetX || 0);
      const clientY = Math.round(pctY * window.innerHeight) + (cfg.offsetY || 0);

      showVisualReticleCrosshair(clientX, clientY);

      const coordTarget = document.elementFromPoint(clientX, clientY) || targetEl;
      if (coordTarget && !isExtensionElement(coordTarget)) {
        dispatchFullClickChain(coordTarget);
      }
    } else if (strat === "double") {
      const count = cfg.clickCount || 2;
      const interval = cfg.burstInterval || 60;
      for (let i = 0; i < count; i++) {
        dispatchFullClickChain(targetEl);
        if (i < count - 1) await sleep(interval);
      }
      if (cfg.dispatchEnterAfter !== false) {
        const enterEvt = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true });
        targetEl.dispatchEvent(enterEvt);
      }
    } else if (strat === "react_fiber") {
      syncReactStateInMainWorld();
      dispatchEnterInMainWorld();
      if (cfg.traverseFiber !== false) {
        const code = `
          try {
            const btn = document.querySelector('[data-ziggy-generate="true"]') || document.querySelector('button[aria-label*="generate" i]');
            if (btn) {
              const key = Object.keys(btn).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEvents$'));
              if (key && btn[key]?.onClick) {
                btn[key].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
              } else {
                btn.click();
              }
            }
          } catch(e) {}
        `;
        const script = document.createElement("script");
        script.textContent = `(() => { ${code} })();`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
      }
    } else if (strat === "automa_pipeline") {
      if (cfg.step1Focus !== false) {
        targetEl.focus();
        targetEl.scrollIntoView({ behavior: "instant", block: "center" });
        await sleep(50);
      }
      if (cfg.step2Type !== false) {
        document.execCommand("selectAll", false, undefined);
        await sleep(30);
      }
      if (cfg.step3Enter !== false) {
        targetEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      }
      if (cfg.step4BackupClick !== false) {
        await sleep(100);
        dispatchFullClickChain(targetEl);
      }
    } else if (strat === "xpath_cascade") {
      let target = targetEl;
      if (cfg.customXPath) {
        try {
          const res = document.evaluate(cfg.customXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          if (res.singleNodeValue && !isExtensionElement(res.singleNodeValue)) {
            target = res.singleNodeValue;
          }
        } catch(e) {}
      }
      if (cfg.filterNegatives !== false && isNegativeButton(target)) {
        showLiveToast("⚠️ Action blocked: Target matched negative Back/Header filter", true);
        return;
      }
      dispatchFullClickChain(target);
    } else {
      dispatchFullClickChain(targetEl);
    }
  }

  function showVisualReticleCrosshair(x, y) {
    const reticle = document.createElement("div");
    reticle.style.cssText = `
      position: fixed; left: ${x - 18}px; top: ${y - 18}px; width: 36px; height: 36px;
      border: 2px solid #a3e635; border-radius: 50%; pointer-events: none; z-index: 2147483647;
      box-shadow: 0 0 20px #a3e635, inset 0 0 10px #a3e635; animation: zfSpin 1s linear infinite;
    `;
    reticle.innerHTML = `
      <div style="position:absolute;top:50%;left:0;width:100%;height:1px;background:#a3e635;"></div>
      <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:#a3e635;"></div>
    `;
    document.body.appendChild(reticle);
    setTimeout(() => reticle.remove(), 1200);
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

  const seenMediaUrls = new Set();

  function countMediaElements() {
    return document.querySelectorAll('video, img[src*="blob:"], img[src*="googleusercontent"], img[src*="data:image"]').length;
  }

  function getLatestRenderedMedia() {
    // 1. Check for video elements
    for (const video of document.querySelectorAll("video")) {
      const src = video.currentSrc || video.src;
      if (src && !isExtensionElement(video)) {
        if (!seenMediaUrls.has(src) && (video.readyState >= 2 || video.duration > 0 || src.includes(".mp4") || src.startsWith("blob:"))) {
          seenMediaUrls.add(src);
          return { url: src, type: "video" };
        }
      }
    }

    // 2. Check for newly loaded canvas/tile images (matching Google Flow canvas tiles)
    const validImgs = Array.from(document.querySelectorAll("img")).filter(img => {
      const src = img.currentSrc || img.src;
      if (!src || isExtensionElement(img)) return false;
      const rect = img.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 50) return false;
      const s = src.toLowerCase();
      if (s.includes("avatar") || s.includes("profile") || s.includes("icon") || s.includes("logo") || s.includes("placeholder")) return false;
      return img.complete && (img.naturalWidth > 60 || s.startsWith("blob:") || s.includes("googleusercontent") || s.startsWith("data:image"));
    });

    // Prefer un-seen images first
    const freshImg = validImgs.find(img => !seenMediaUrls.has(img.currentSrc || img.src));
    if (freshImg) {
      const url = freshImg.currentSrc || freshImg.src;
      seenMediaUrls.add(url);
      return { url, type: "image" };
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

  /** Setup TobyFlow-grade on-page manual generation detector.
   *  Only triggers on explicit trusted Enter in prompt box or explicit submit button.
   *  Guards against self-triggering and parallel rogue runs. */
  function setupManualGenerationDetector() {
    let lastSubmitTime = 0;

    const handleManualSubmit = async (promptText) => {
      const now = Date.now();
      if (now - lastSubmitTime < 4000) return;
      if (window.__zf_automated_task_active || window.__zf_isTrackingGeneration) {
        console.log("ZIG Flow: Manual trigger ignored — generation tracking is already active.");
        return;
      }
      lastSubmitTime = now;

      console.log("ZIG Flow: Manual generation detected on page. Taking exclusion snapshot...");
      const preTileIds = getUniqueTileIds();
      const preMediaSrcs = getExistingMediaSrcs();

      const manualTask = {
        id: "manual_" + now,
        prompt: promptText || "Google Flow Generation",
        provider: "Google Flow",
        submitMode: "manual",
        startTime: now,
        status: "generating"
      };

      try {
        window.dispatchEvent(new CustomEvent("ZF_TASK_STARTED", { detail: manualTask }));
        if (typeof window.__zf_onTaskStarted === "function") window.__zf_onTaskStarted(manualTask);
      } catch(e) {}

      try {
        await trackGenerationProgress(240000, preTileIds, preMediaSrcs, manualTask);
      } catch (err) {
        console.warn("ZIG Flow: Manual generation tracking notice:", err.message);
      }
    };

    document.addEventListener("keydown", (e) => {
      // GUARD: Only process real user keystrokes, not synthetic events
      if (!e.isTrusted) return;
      if (window.__zf_automated_task_active || window.__zf_isTrackingGeneration) return;
      if (e.key === "Enter" && !e.shiftKey) {
        const target = e.target;
        if (target && (target.tagName === "TEXTAREA" || target.getAttribute("role") === "textbox" || target.getAttribute("data-slate-editor") === "true" || target.tagName === "INPUT")) {
          if (target.closest("#ziggyflow-floating-hud")) return;
          const val = (target.value || target.textContent || "").trim();
          if (val.length > 0) {
            handleManualSubmit(val);
          }
        }
      }
    }, true);
  }

  
  // Global helpers for FloatingTracker live tile percentage scanning
  window.extractTileProgress = function(tileEl) {
    if (!tileEl) return null;
    var els = tileEl.querySelectorAll("span, div, p");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.children.length > 2) continue;
      var text = el.textContent.trim();
      if (/^\d{1,3}%$/.test(text)) {
        return parseInt(text, 10);
      }
    }
    return null;
  };

  window._getCachedTiles = function() {
    return Array.from(document.querySelectorAll('[data-tile-id]'));
  };

  window.detectTileStatus = function(tileEl) {
    if (!tileEl) return "processing";
    const text = (tileEl.textContent || "").trim();
    if (/\b\d{1,3}%\b/.test(text)) return "processing";
    if (tileEl.getAttribute("aria-busy") === "true" || 
        tileEl.querySelector('[aria-busy="true"], [role="progressbar"], .skeleton, .animate-spin, div[class*="loading"], div[class*="spinner"]')) {
      return "processing";
    }
    const genIcon = Array.from(tileEl.querySelectorAll("i, span, svg")).find(el => {
      const t = (el.textContent || "").trim();
      return t === "play_circle" || t === "progress_activity" || t === "hourglass_empty" || t === "hourglass_bottom" || t === "sync";
    });
    if (genIcon) return "processing";

    const video = tileEl.querySelector("video");
    const img = tileEl.querySelector("img");
    const media = video || img;
    if (media) {
      const src = media.currentSrc || media.src || "";
      if (src && !src.startsWith("data:image/svg") && !src.includes("media.html")) {
        return "success";
      }
    }
    return "processing";
  };

  // Initialize manual generation detector
  setupManualGenerationDetector();
})();
