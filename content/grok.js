/**
 * TobyFlow Content Script for Grok (grok.com, x.ai, x.com/i/grok)
 * Handles Grok Imagine (Image) and Aurora (Video) generation automation.
 */

(() => {
  if (window.__tobyflow_grok_driver_loaded) return;
  window.__tobyflow_grok_driver_loaded = true;
  console.log("TobyFlow: Grok driver active on", window.location.href);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GENERATE_PROMPT" && request.task.provider === "grok") {
      executeGrokTask(request.task)
        .then(result => sendResponse({ success: true, result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === "PING_DRIVER") {
      sendResponse({ status: "ready", provider: "grok", url: window.location.href, title: document.title });
      return true;
    }
  });

  async function executeGrokTask(task) {
    console.log("TobyFlow [Grok]: Starting task:", task);
    showLiveToast(`⚡ TobyFlow: Automating Grok...`);

    const promptInput = await findGrokInput(15000);
    if (!promptInput) {
      showLiveToast(`❌ Could not locate Grok input box.`, true);
      throw new Error("Could not find Grok prompt input field. Please ensure you are logged in.");
    }

    highlightElement(promptInput, "#f59e0b");

    if (task.type === "video" || task.model?.toLowerCase().includes("aurora")) {
      await switchGrokMode("video");
    } else {
      await switchGrokMode("image");
    }

    let finalPrompt = task.prompt;
    if (!finalPrompt.toLowerCase().startsWith("/imagine") && !finalPrompt.toLowerCase().startsWith("generate") && !finalPrompt.toLowerCase().startsWith("create")) {
      finalPrompt = task.type === "video" ? `Create an animated video: ${task.prompt}` : `Generate an image: ${task.prompt}`;
    }

    showLiveToast(`✍️ Typing prompt into Grok...`);
    await safeTypeIntoInput(promptInput, finalPrompt);

    const initialVideos = document.querySelectorAll('video').length;
    const initialImages = countExistingImages();

    await sleep(400);
    const submitBtn = await findSubmitButton();
    if (submitBtn && !submitBtn.disabled) {
      highlightElement(submitBtn, "#f59e0b");
      submitBtn.click();
    } else {
      promptInput.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        bubbles: true
      }));
    }

    showLiveToast(`🚀 Prompt submitted! Waiting for render...`);

    const mediaResult = await waitForGrokMedia(task.type === "video", initialVideos, initialImages, 200000);
    showLiveToast(`✨ Grok media ready! Downloading...`);

    chrome.runtime.sendMessage({
      action: "MEDIA_GENERATED_NOTIFICATION",
      payload: {
        provider: "Grok",
        prompt: task.prompt,
        project: task.project || "tobyflow-01",
        mediaUrl: mediaResult.url,
        type: mediaResult.type,
        resolution: task.resolution || "4K",
        telegramChatId: task.telegramChatId,
        nodeId: task.nodeId
      }
    });

    return mediaResult;
  }

  async function findGrokInput(timeout = 15000) {
    const selectors = [
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="Grok" i]',
      'textarea[placeholder*="image" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea[placeholder*="message" i]',
      'div[contenteditable="true"]',
      'textarea'
    ];

    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) return el;
      }
      await sleep(400);
    }
    return null;
  }

  async function safeTypeIntoInput(el, text) {
    el.focus();
    await sleep(200);

    if (el.tagName === "DIV" || el.isContentEditable) {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      document.execCommand("insertText", false, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.select();
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      const inserted = document.execCommand("insertText", false, text);
      if (!inserted || el.value !== text) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        if (nativeSetter) nativeSetter.call(el, text);
        else el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(400);
  }

  async function switchGrokMode(mode) {
    try {
      const modeButtons = Array.from(document.querySelectorAll('button, div[role="tab"], div[role="button"], span'));
      const targetBtn = modeButtons.find(b => {
        const txt = (b.textContent || "").toLowerCase();
        return mode === "video"
          ? (txt.includes("video") || txt.includes("aurora") || txt.includes("animate"))
          : (txt.includes("image") || txt.includes("imagine") || txt.includes("picture"));
      });
      if (targetBtn) {
        targetBtn.click();
        await sleep(400);
      }
    } catch (e) {}
  }

  async function findSubmitButton() {
    const selectors = [
      'button[aria-label*="Send" i]',
      'button[aria-label*="Submit" i]',
      'button[aria-label*="Generate" i]',
      'button[type="submit"]',
      'button.submit-btn'
    ];

    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled) return btn;
    }
    return null;
  }

  function countExistingImages() {
    return document.querySelectorAll('img[src*="pbs.twimg.com"], img[src*="x.ai"], img[src*="blob:"], img[src*="grok"]').length;
  }

  async function waitForGrokMedia(isVideo, initialVideos, initialImages, maxWaitMs = 200000) {
    const start = Date.now();
    await sleep(4000);

    while (Date.now() - start < maxWaitMs) {
      await sleep(2500);

      if (isVideo) {
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length > initialVideos) {
          const lastVideo = videos[videos.length - 1];
          if (lastVideo.src && (lastVideo.readyState >= 2 || lastVideo.src.includes(".mp4") || lastVideo.src.startsWith("blob:"))) {
            return { url: lastVideo.src, type: "video" };
          }
        }
      }

      const images = Array.from(document.querySelectorAll('img[src*="pbs.twimg.com"], img[src*="x.ai"], img[src*="blob:"], img[src*="grok"]'));
      if (images.length > initialImages) {
        const lastImg = images[images.length - 1];
        if (lastImg && lastImg.src && !lastImg.src.includes("avatar")) {
          return { url: lastImg.src, type: "image" };
        }
      }
    }

    throw new Error("Grok generation timed out.");
  }

  function highlightElement(el, color = "#f59e0b") {
    if (!el) return;
    const prev = el.style.outline;
    el.style.outline = `3px solid ${color}`;
    el.style.boxShadow = `0 0 25px ${color}`;
    setTimeout(() => {
      el.style.outline = prev;
      el.style.boxShadow = "";
    }, 2800);
  }

  function showLiveToast(text, isError = false) {
    let container = document.getElementById("tobyflow-live-toast");
    if (!container) {
      container = document.createElement("div");
      container.id = "tobyflow-live-toast";
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        padding: 12px 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13.5px;
        font-weight: 700;
        box-shadow: 0 15px 35px rgba(0,0,0,0.6);
        color: #fff;
        pointer-events: none;
        transition: opacity 0.3s;
      `;
      document.body.appendChild(container);
    }

    container.style.background = isError ? "#ef4444" : "linear-gradient(135deg, #d97706, #f59e0b)";
    container.style.color = isError ? "#fff" : "#121316";
    container.style.opacity = "1";
    container.innerText = text;

    clearTimeout(window.__tf_toast_timer);
    window.__tf_toast_timer = setTimeout(() => {
      if (container) container.style.opacity = "0";
    }, 4500);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
})();
