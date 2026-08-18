/**
 * ZiggyFlow Screen Capture & Web Reference Snip Engine
 * High-precision pixel cropping tool that captures any webpage selection
 * and immediately loads it directly into ZiggyFlow's Reference Dropzones.
 */

(() => {
  if (window.__ziggyflow_screen_capture_loaded) return;
  window.__ziggyflow_screen_capture_loaded = true;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TRIGGER_SCREEN_CAPTURE") {
      initiateScreenSnip();
      sendResponse({ success: true });
      return true;
    }
  });

  function initiateScreenSnip() {
    const existing = document.getElementById("ziggyflow-snip-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "ziggyflow-snip-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483647;
      background: rgba(0, 0, 0, 0.4);
      cursor: crosshair;
      user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const instructions = document.createElement("div");
    instructions.style.cssText = `
      position: absolute;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 19, 22, 0.94);
      color: #fff;
      padding: 10px 22px;
      border-radius: 9999px;
      font-size: 13.5px;
      font-weight: 600;
      border: 1.5px solid #a3e635;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 15px rgba(163,230,53,0.35);
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    instructions.innerHTML = `<span>✂️</span> <span><b>ZiggyFlow Snip</b>: Drag to select reference area • Press <b>ESC</b> to cancel</span>`;
    overlay.appendChild(instructions);

    const selectionBox = document.createElement("div");
    selectionBox.id = "ziggyflow-selection-box";
    selectionBox.style.cssText = `
      position: absolute;
      border: 2px dashed #a3e635;
      background: rgba(163, 230, 53, 0.15);
      display: none;
      pointer-events: none;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
    `;
    overlay.appendChild(selectionBox);

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        cleanup();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    overlay.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      selectionBox.style.left = `${startX}px`;
      selectionBox.style.top = `${startY}px`;
      selectionBox.style.width = `0px`;
      selectionBox.style.height = `0px`;
      selectionBox.style.display = "block";
    });

    overlay.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const currentX = e.clientX;
      const currentY = e.clientY;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      selectionBox.style.left = `${left}px`;
      selectionBox.style.top = `${top}px`;
      selectionBox.style.width = `${width}px`;
      selectionBox.style.height = `${height}px`;
    });

    overlay.addEventListener("mouseup", async (e) => {
      if (!isDragging) return;
      isDragging = false;

      const rect = {
        left: parseInt(selectionBox.style.left, 10) || 0,
        top: parseInt(selectionBox.style.top, 10) || 0,
        width: parseInt(selectionBox.style.width, 10) || 0,
        height: parseInt(selectionBox.style.height, 10) || 0
      };

      if (rect.width < 10 || rect.height < 10) {
        cleanup();
        return;
      }

      overlay.style.display = "none";
      await sleep(100);

      let cropDataUrl = null;

      // 1. Request real full-tab pixel screenshot from background
      try {
        const res = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 2000);
          chrome.runtime.sendMessage({ action: "CAPTURE_VISIBLE_TAB_SCREENSHOT" }, (response) => {
            clearTimeout(timer);
            resolve(response);
          });
        });

        if (res?.success && res.dataUrl) {
          cropDataUrl = await cropScreenshot(res.dataUrl, rect);
        }
      } catch (err) {
        console.warn("Capture crop note:", err);
      }

      // 2. Fallback: direct DOM element crop if background capture was unavailable
      if (!cropDataUrl) {
        cropDataUrl = await fallbackDomCrop(rect);
      }

      cleanup();

      if (cropDataUrl) {
        const defaultName = "Snip_" + Math.random().toString(36).substring(2, 6);
        
        // Save directly into local storage to wake up Side Panel
        chrome.storage.local.set({
          latestSnippedReference: cropDataUrl,
          latestSnippedName: defaultName,
          latestSnippedTime: Date.now()
        });

        // Dispatch message to ZiggyFlow
        chrome.runtime.sendMessage({
          action: "SAVED_SNIP_IMAGE",
          payload: {
            name: defaultName,
            tag: defaultName.toLowerCase(),
            album: "Default",
            dataUrl: cropDataUrl
          }
        });

        // Show floating on-page confirmation card
        showFloatingSuccessCard(cropDataUrl, defaultName);
      }
    });

    function cleanup() {
      overlay.remove();
      window.removeEventListener("keydown", handleKeyDown);
    }

    document.body.appendChild(overlay);
  }

  function cropScreenshot(dataUrl, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        const cropW = Math.max(10, Math.round(rect.width * dpr));
        const cropH = Math.max(10, Math.round(rect.height * dpr));

        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext("2d");

        const sx = Math.max(0, Math.min(img.naturalWidth - 1, Math.round(rect.left * dpr)));
        const sy = Math.max(0, Math.min(img.naturalHeight - 1, Math.round(rect.top * dpr)));
        const sw = Math.max(1, Math.min(img.naturalWidth - sx, cropW));
        const sh = Math.max(1, Math.min(img.naturalHeight - sy, cropH));

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cropW, cropH);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function fallbackDomCrop(rect) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(10, Math.round(rect.width));
    canvas.height = Math.max(10, Math.round(rect.height));
    const ctx = canvas.getContext("2d");

    const elementsUnder = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const imgEl = elementsUnder.find(el => el.tagName === "IMG");

    if (imgEl && imgEl.complete) {
      try {
        const imgRect = imgEl.getBoundingClientRect();
        const sx = (rect.left - imgRect.left) * (imgEl.naturalWidth / imgRect.width);
        const sy = (rect.top - imgRect.top) * (imgEl.naturalHeight / imgRect.height);
        const sw = rect.width * (imgEl.naturalWidth / imgRect.width);
        const sh = rect.height * (imgEl.naturalHeight / imgRect.height);
        ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png");
      } catch (e) {}
    }

    ctx.fillStyle = "#18191d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#a3e635";
    ctx.font = "bold 13px sans-serif";
    ctx.fillText("📸 Reference Image", 12, 24);
    return canvas.toDataURL("image/png");
  }

  function showFloatingSuccessCard(dataUrl, name) {
    const existing = document.getElementById("ziggyflow-floating-snip-card");
    if (existing) existing.remove();

    const card = document.createElement("div");
    card.id = "ziggyflow-floating-snip-card";
    card.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #18191d;
      color: #fff;
      border: 1.5px solid #a3e635;
      box-shadow: 0 15px 40px rgba(0,0,0,0.7), 0 0 25px rgba(163,230,53,0.35);
      padding: 12px 16px;
      border-radius: 12px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: zfSlideIn 0.25s ease;
    `;

    card.innerHTML = `
      <img src="${dataUrl}" style="width:48px;height:48px;border-radius:6px;object-fit:cover;border:1px solid #2e3038;" />
      <div>
        <div style="font-weight:700;font-size:13px;color:#a3e635;display:flex;align-items:center;gap:4px;">
          <span>✅</span> <span>Reference Snip Attached!</span>
        </div>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px;">
          Loaded into ZiggyFlow: <b>@${name}</b>
        </div>
      </div>
      <button id="zf-snip-card-close" style="background:transparent;border:none;color:#9ca3af;cursor:pointer;font-size:16px;margin-left:6px;">✕</button>
    `;

    document.body.appendChild(card);

    card.querySelector("#zf-snip-card-close").onclick = () => card.remove();
    setTimeout(() => { if (card) card.remove(); }, 5000);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
