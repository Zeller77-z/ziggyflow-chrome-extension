/**
 * TobyFlow Content Script for ChatGPT (chatgpt.com, chat.openai.com)
 * Handles GPT Image 2 native image generation automation.
 */

(() => {
  if (window.__tobyflow_chatgpt_driver_loaded) return;
  window.__tobyflow_chatgpt_driver_loaded = true;
  console.log("TobyFlow: ChatGPT driver active on", window.location.href);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GENERATE_PROMPT" && request.task.provider === "chatgpt") {
      executeChatGPTTask(request.task)
        .then(result => sendResponse({ success: true, result }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (request.action === "PING_DRIVER") {
      sendResponse({ status: "ready", provider: "chatgpt", url: window.location.href, title: document.title });
      return true;
    }
  });

  async function executeChatGPTTask(task) {
    console.log("TobyFlow [ChatGPT]: Starting task:", task);
    showLiveToast(`⚡ TobyFlow: Automating ChatGPT...`);

    const promptInput = await findChatGPTInput(15000);
    if (!promptInput) {
      showLiveToast(`❌ Could not find ChatGPT input box.`, true);
      throw new Error("Could not locate ChatGPT prompt input field. Please ensure you are logged in.");
    }

    highlightElement(promptInput, "#10b981");

    if (task.referenceImage) {
      showLiveToast(`🖼️ Attaching reference image...`);
      await attachImageToChatGPT(task.referenceImage);
    }

    let finalPrompt = task.prompt;
    if (!finalPrompt.toLowerCase().includes("image") && !finalPrompt.toLowerCase().includes("picture") && !finalPrompt.toLowerCase().includes("photo")) {
      finalPrompt = `Generate a high-detail image of: ${task.prompt}`;
    }

    showLiveToast(`✍️ Typing prompt into ChatGPT...`);
    await safeTypeIntoInput(promptInput, finalPrompt);

    const initialImages = countExistingImages();

    await sleep(400);
    const sendBtn = await findSendButton();
    if (sendBtn && !sendBtn.disabled) {
      highlightElement(sendBtn, "#10b981");
      sendBtn.click();
    } else {
      promptInput.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
    }

    showLiveToast(`🚀 Prompt submitted! Waiting for render...`);

    const mediaResult = await waitForChatGPTImage(initialImages, 180000);
    showLiveToast(`✨ ChatGPT image ready! Downloading...`);

    chrome.runtime.sendMessage({
      action: "MEDIA_GENERATED_NOTIFICATION",
      payload: {
        provider: "ChatGPT",
        prompt: task.prompt,
        project: task.project || "tobyflow-01",
        mediaUrl: mediaResult.url,
        type: "image",
        resolution: task.resolution || "4K",
        telegramChatId: task.telegramChatId,
        nodeId: task.nodeId
      }
    });

    return mediaResult;
  }

  async function findChatGPTInput(timeout = 15000) {
    const selectors = [
      '#prompt-textarea',
      'div[contenteditable="true"][data-placeholder]',
      'div[contenteditable="true"]',
      'textarea[tabindex="0"]',
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

  async function attachImageToChatGPT(dataUrl) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "reference.png", { type: "image/png" });

      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(1500);
        return;
      }

      const dropzone = document.querySelector('form, #prompt-textarea');
      if (dropzone) {
        const dt = new DataTransfer();
        dt.items.add(file);
        dropzone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
        await sleep(1500);
      }
    } catch (e) {
      console.warn("ChatGPT attach note:", e);
    }
  }

  async function findSendButton() {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send message"]',
      'button.mb-1.mr-1'
    ];

    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && !btn.disabled) return btn;
    }
    return null;
  }

  function countExistingImages() {
    return document.querySelectorAll('img[alt*="Generated" i], img[src*="backend-api" i], img[src*="files.oaiusercontent.com"], img[src*="dalle"]').length;
  }

  async function waitForChatGPTImage(initialCount, maxWaitMs = 180000) {
    const start = Date.now();
    await sleep(4000);

    while (Date.now() - start < maxWaitMs) {
      await sleep(2500);
      const stopBtn = document.querySelector('button[data-testid="stop-button"], button[aria-label="Stop generating"]');
      const currentImages = Array.from(document.querySelectorAll('img[alt*="Generated" i], img[src*="files.oaiusercontent.com"], img[src*="dalle"], img[src*="blob:"]'));

      if (currentImages.length > initialCount && !stopBtn) {
        const lastImg = currentImages[currentImages.length - 1];
        if (lastImg && lastImg.src && !lastImg.src.includes("placeholder")) {
          return { url: lastImg.src, type: "image" };
        }
      }
    }

    throw new Error("ChatGPT image generation timed out.");
  }

  function highlightElement(el, color = "#10b981") {
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

    container.style.background = isError ? "#ef4444" : "linear-gradient(135deg, #059669, #10b981)";
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
