/**
 * TobyFlow Background Service Worker (Manifest V3)
 * Full automation engine with dynamic programmatic script injection,
 * cross-tab pipeline coordination, 2K/4K downloads, and live logging.
 */

importScripts("download-manager.js", "telegram-bot.js");

class BackgroundController {
  constructor() {
    this.taskQueue = [];
    this.isRunning = false;
    this.isPaused = false;
    this.currentTask = null;
    this.stats = {
      completed: 0,
      failed: 0,
      total: 0
    };
    this.workflowContext = {};
    this.init();
  }

  async init() {
    console.log("TobyFlow: Service Worker initialized.");

    if (self.telegramBot) {
      await self.telegramBot.init();
    }

    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
    }

    chrome.runtime.onInstalled.addListener(() => {
      try {
        chrome.contextMenus.create({
          id: "tobyflow-snip",
          title: "📸 Snip Reference Image with TobyFlow",
          contexts: ["all"]
        });
      } catch (e) {}
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === "tobyflow-snip" && tab?.id) {
        this.injectAndSendMessage(tab.id, "content/screen-capture.js", { action: "TRIGGER_SCREEN_CAPTURE" });
      }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(request, sender, sendResponse) {
    const { action, payload } = request;

    switch (action) {
      case "GET_STATE":
        sendResponse({
          isRunning: this.isRunning,
          isPaused: this.isPaused,
          currentTask: this.currentTask,
          queueLength: this.taskQueue.length,
          stats: this.stats
        });
        break;

      case "ENQUEUE_BATCH":
        if (Array.isArray(payload.tasks)) {
          if (!this.isRunning) {
            this.taskQueue = [];
            this.stats = { completed: 0, failed: 0, total: 0 };
          }
          this.taskQueue.push(...payload.tasks);
          this.stats.total += payload.tasks.length;
          this.updateBadge();
          this.broadcast({ action: "BATCH_ENQUEUED", tasks: payload.tasks });
          this.log(`[QUEUE] Enqueued ${payload.tasks.length} task(s). Total in queue: ${this.taskQueue.length}`);
          if (!this.isRunning && !this.isPaused) {
            this.startQueueProcessing();
          }
          sendResponse({ success: true, queueLength: this.taskQueue.length });
        }
        break;

      case "START_QUEUE":
        this.isPaused = false;
        if (!this.isRunning) {
          this.startQueueProcessing();
        }
        sendResponse({ success: true });
        break;

      case "PAUSE_QUEUE":
        this.isPaused = true;
        this.isRunning = false;
        this.updateBadge();
        this.log("[QUEUE] Processing paused.");
        sendResponse({ success: true });
        break;

      case "STOP_QUEUE":
        this.stopAllTasks();
        sendResponse({ success: true });
        break;

      case "EXECUTE_IMMEDIATE_TASK":
        this.executeImmediateTask(payload).then(res => sendResponse(res));
        break;

      case "OPEN_DETACHED_WINDOW":
        chrome.windows.create({
          url: chrome.runtime.getURL("ui/index.html?mode=detached"),
          type: "popup",
          width: 440,
          height: 680,
          focused: true
        });
        sendResponse({ success: true });
        break;

      case "TRIGGER_DOWNLOAD":
        if (self.downloadManager) {
          self.downloadManager.triggerDownload(payload).then(res => sendResponse(res));
        } else {
          sendResponse({ success: false, error: "Download manager unavailable" });
        }
        break;

      case "TRIGGER_SCREEN_CAPTURE_ACTIVE_TAB":
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (tabs[0]?.id) {
            await this.injectScriptIfNeeded(tabs[0].id, "content/screen-capture.js");
            chrome.tabs.sendMessage(tabs[0].id, { action: "TRIGGER_SCREEN_CAPTURE" }, (res) => {
              sendResponse(res || { success: true });
            });
          } else {
            sendResponse({ success: false, error: "No active tab" });
          }
        });
        break;

      case "TRIGGER_ELEMENT_PICKER":
      case "START_VISUAL_ELEMENT_MAPPER":
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          let targetTab = tabs[0];
          if (!targetTab) {
            const allTabs = await chrome.tabs.query({});
            targetTab = allTabs.find(t => t.url && (t.url.includes("google") || t.url.includes("flow") || t.url.includes("aitestkitchen")));
          }
          if (targetTab?.id) {
            await this.injectScriptIfNeeded(targetTab.id, "content/google-flow.js");
            chrome.tabs.sendMessage(targetTab.id, {
              action: "START_VISUAL_ELEMENT_MAPPER",
              slotName: payload?.slotName || request.slotName || "generateButton",
              friendlyLabel: payload?.friendlyLabel || request.friendlyLabel || "Generate Button",
              templateId: payload?.templateId || request.templateId || "default"
            }, (res) => {
              sendResponse(res || { success: true });
            });
          } else {
            sendResponse({ success: false, error: "No active Google Flow tab" });
          }
        });
        break;

      case "TEST_DOM_ELEMENT_ACTION":
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          let targetTab = tabs[0];
          if (!targetTab) {
            const allTabs = await chrome.tabs.query({});
            targetTab = allTabs.find(t => t.url && (t.url.includes("google") || t.url.includes("flow") || t.url.includes("aitestkitchen")));
          }
          if (targetTab?.id) {
            chrome.tabs.sendMessage(targetTab.id, request, (res) => {
              sendResponse(res || { success: false });
            });
          } else {
            sendResponse({ success: false, error: "No active tab" });
          }
        });
        break;

      case "CAPTURE_VISIBLE_TAB_SCREENSHOT":
        const targetWindowId = sender?.tab?.windowId || null;
        chrome.tabs.captureVisibleTab(targetWindowId, { format: "png" }, (dataUrl) => {
          if (!chrome.runtime.lastError && dataUrl) {
            sendResponse({ success: true, dataUrl });
          } else {
            // Fallback without windowId
            chrome.tabs.captureVisibleTab(null, { format: "png" }, (fallbackUrl) => {
              if (!chrome.runtime.lastError && fallbackUrl) {
                sendResponse({ success: true, dataUrl: fallbackUrl });
              } else {
                sendResponse({ success: false, error: chrome.runtime.lastError?.message || "Capture failed" });
              }
            });
          }
        });
        break;

      case "SAVED_SNIP_IMAGE":
        chrome.storage.local.set({
          latestSnippedReference: payload.dataUrl,
          latestSnippedName: payload.name || "Web Snip",
          latestSnippedTime: Date.now()
        });
        this.saveReferenceImage(payload).then(res => {
          // Broadcast to UI so dropzones auto-update with snipped image
          chrome.runtime.sendMessage({
            action: "SNIPPED_REFERENCE_READY",
            payload: payload
          }).catch(() => {});
          sendResponse(res);
        });
        break;

      case "MEDIA_GENERATED_NOTIFICATION":
        this.handleMediaGenerated(payload);
        sendResponse({ success: true });
        break;

      case "UPDATE_TELEGRAM_SETTINGS":
        if (self.telegramBot) {
          self.telegramBot.enabled = !!payload?.enabled;
          self.telegramBot.botToken = payload?.token || "";
          self.telegramBot.chatId = payload?.chatId || "";
        }
        sendResponse({ success: true });
        break;

      case "OPEN_SIDEPANEL":
        if (chrome.sidePanel && chrome.sidePanel.open) {
          const tabId = sender?.tab?.id;
          const windowId = sender?.tab?.windowId;
          if (tabId) {
            chrome.sidePanel.open({ tabId }).then(() => {
              sendResponse({ success: true });
            }).catch(() => {
              if (windowId) {
                chrome.sidePanel.open({ windowId }).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
              } else {
                sendResponse({ success: false });
              }
            });
          } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]?.id) {
                chrome.sidePanel.open({ tabId: tabs[0].id }).then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));
              } else {
                sendResponse({ success: false });
              }
            });
          }
        } else {
          chrome.windows.create({
            url: chrome.runtime.getURL("ui/index.html"),
            type: "popup",
            width: 420,
            height: 720
          });
          sendResponse({ success: true });
        }
        break;

      case "PING_DRIVERS":
        this.pingAllDrivers().then(res => sendResponse(res));
        break;

      case "CONNECT_ACTIVE_TAB":
        this.connectActiveTab().then(res => sendResponse(res));
        break;

      case "SIMULATE_TASK":
        this.simulateTaskExecution(payload).then(res => sendResponse(res));
        break;

      default:
        sendResponse({ success: false, error: "Unknown action" });
    }
  }

  async connectActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0] || !tabs[0].url) return { success: false, message: "No active tab." };

    const tab = tabs[0];
    const url = tab.url.toLowerCase();
    let provider = null;
    let scriptFile = null;

    if (url.includes("labs.google") || url.includes("aitestkitchen")) {
      provider = "Google Flow";
      scriptFile = "content/google-flow.js";
    } else if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
      provider = "ChatGPT";
      scriptFile = "content/chatgpt.js";
    } else if (url.includes("grok.com") || url.includes("x.ai") || url.includes("x.com/i/grok")) {
      provider = "Grok";
      scriptFile = "content/grok.js";
    } else {
      return { success: false, message: `Active tab is not a supported AI platform (${tab.url})` };
    }

    await this.injectScriptIfNeeded(tab.id, scriptFile);
    await this.injectScriptIfNeeded(tab.id, "content/injected-overlay.js");

    this.log(`[CONNECT] Successfully injected & connected driver to ${provider} on Tab #${tab.id}!`);
    return { success: true, provider, tabId: tab.id, title: tab.title };
  }

  async pingAllDrivers() {
    const tabs = await chrome.tabs.query({});
    const results = {
      flow: { connected: false, tabId: null },
      chatgpt: { connected: false, tabId: null },
      grok: { connected: false, tabId: null }
    };

    for (const tab of tabs) {
      if (!tab.url) continue;
      const url = tab.url.toLowerCase();
      let provider = null;
      let scriptFile = null;

      if (url.includes("labs.google") || url.includes("aitestkitchen")) {
        provider = "flow";
        scriptFile = "content/google-flow.js";
      } else if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
        provider = "chatgpt";
        scriptFile = "content/chatgpt.js";
      } else if (url.includes("grok.com") || url.includes("x.ai") || url.includes("x.com/i/grok")) {
        provider = "grok";
        scriptFile = "content/grok.js";
      }

      if (provider) {
        try {
          await this.injectScriptIfNeeded(tab.id, scriptFile);
          const response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: "PING_DRIVER" }, (res) => {
              if (chrome.runtime.lastError) resolve(null);
              else resolve(res);
            });
          });

          if (response && response.status === "ready") {
            results[provider] = { connected: true, tabId: tab.id, url: tab.url, title: tab.title };
          }
        } catch (e) {}
      }
    }

    return results;
  }

  async injectScriptIfNeeded(tabId, scriptPath) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId, allFrames: false },
        files: [scriptPath]
      });
    } catch (e) {
      // Script may already be loaded or page does not allow injection
    }
  }

  async injectAndSendMessage(tabId, scriptPath, message) {
    await this.injectScriptIfNeeded(tabId, scriptPath);
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    });
  }

  async executeImmediateTask(task) {
    this.log(`[EXECUTE] Executing immediate generation on ${task.provider?.toUpperCase()}...`);
    try {
      const res = await this.executeTask(task);
      this.stats.completed += 1;
      return { success: true, result: res };
    } catch (err) {
      this.stats.failed += 1;
      this.log(`[ERROR] Task execution error: ${err.message}`, "error");
      return { success: false, error: err.message };
    }
  }

  async startQueueProcessing() {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.taskQueue.length > 0 && !this.isPaused) {
      const task = this.taskQueue.shift();
      this.currentTask = task;
      this.updateBadge();
      this.broadcast({ action: "TASK_STARTED", task });
      this.log(`[QUEUE] Starting task: "${task.prompt.substring(0, 35)}..." on ${task.provider?.toUpperCase()}`);

      try {
        if (task.upstreamNodeId && this.workflowContext[task.upstreamNodeId]) {
          task.referenceImage = this.workflowContext[task.upstreamNodeId];
          this.log(`[PIPELINE] Chained reference image from Node #${task.upstreamNodeId}`);
        }

        await this.executeTask(task);
        this.stats.completed += 1;
        this.log(`[SUCCESS] Completed task on ${task.provider?.toUpperCase()}!`);
      } catch (err) {
        this.log(`[ERROR] Generation failed on ${task.provider?.toUpperCase()}: ${err.message}`, "error");
        this.stats.failed += 1;
        if (task.retriesLeft && task.retriesLeft > 0) {
          task.retriesLeft -= 1;
          this.log(`[RETRY] Retrying task (${task.retriesLeft} retries left)...`);
          this.taskQueue.push(task);
        }
      }

      // Calculate dynamic random delay based on TobyFlow af_settings
      const settingsData = await chrome.storage.local.get(["af_settings"]);
      const afSettings = settingsData.af_settings || {};
      const minDelay = Number(afSettings.randomDelayMin) || 3;
      const maxDelay = Math.max(minDelay, Number(afSettings.randomDelayMax) || 10);
      const randomWaitSec = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

      if (this.taskQueue.length > 0) {
        this.log(`[DELAY] Waiting ${randomWaitSec}s before next prompt...`);
        await new Promise(r => setTimeout(r, randomWaitSec * 1000));
      }
    }

    this.isRunning = false;
    this.currentTask = null;
    this.updateBadge();
    this.broadcast({ action: "QUEUE_FINISHED", stats: this.stats });
    this.log(`[DONE] Batch finished! Total: ${this.stats.completed} succeeded, ${this.stats.failed} failed.`);

    if (self.telegramBot && self.telegramBot.enabled && this.stats.total > 0) {
      const doneMsg = `🏁 *ZiggyFlow Batch Finished!*\n✅ Completed: ${this.stats.completed}\n❌ Failed: ${this.stats.failed}`;
      self.telegramBot.sendMessage(null, doneMsg, "Markdown");
    }
  }

  async executeTask(task) {
    const provider = task.provider || "flow";
    const scriptMap = {
      flow: "content/google-flow.js",
      chatgpt: "content/chatgpt.js",
      grok: "content/grok.js"
    };

    const tab = await this.ensureProviderTab(provider);
    if (!tab) throw new Error(`Could not locate or open browser tab for provider: ${provider}`);

    this.log(`[DISPATCH] Sending prompt to Tab #${tab.id} (${tab.title})...`);

    // Ensure content script is injected into the target tab
    const scriptFile = scriptMap[provider] || "content/google-flow.js";
    await this.injectScriptIfNeeded(tab.id, scriptFile);
    await this.injectScriptIfNeeded(tab.id, "content/injected-overlay.js");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Generation timed out after 300 seconds"));
      }, 300000);

      chrome.tabs.sendMessage(tab.id, {
        action: "GENERATE_PROMPT",
        task: task
      }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.result);
        } else {
          reject(new Error(response?.error || "Generation failed on target site"));
        }
      });
    });
  }

  async ensureProviderTab(provider) {
    const urls = {
      flow: "https://labs.google/fx",
      chatgpt: "https://chatgpt.com",
      grok: "https://grok.com"
    };
    const targetUrl = urls[provider] || urls.flow;

    const tabs = await chrome.tabs.query({});
    let matchingTab = tabs.find(t => t.url && (t.url.includes(new URL(targetUrl).hostname) || (provider === "flow" && t.url.includes("aitestkitchen"))));

    if (matchingTab) {
      await chrome.tabs.update(matchingTab.id, { active: true });
      return matchingTab;
    } else {
      this.log(`[BROWSER] Opening new tab for ${provider.toUpperCase()}: ${targetUrl}`);
      matchingTab = await chrome.tabs.create({ url: targetUrl, active: true });
      await new Promise(r => setTimeout(r, 6000));
      return matchingTab;
    }
  }

  async handleMediaGenerated(data) {
    this.log(`[MEDIA] Captured generated media from ${data.provider} (${data.type || "image"})!`);

    if (data.nodeId) {
      this.workflowContext[data.nodeId] = data.mediaUrl;
    }

    if (self.downloadManager) {
      await self.downloadManager.triggerDownload({
        url: data.mediaUrl,
        prompt: data.prompt,
        project: data.project || "ziggyflow-01",
        provider: data.provider,
        resolution: data.resolution || "4K",
        type: data.type || "image"
      });
      this.log(`[DOWNLOAD] Auto-downloaded asset to subfolder: ${data.project || "ziggyflow-01"}`);
    }

    if (self.telegramBot && self.telegramBot.enabled) {
      const caption = `✨ *Generated with ${data.provider}*\nPrompt: ${data.prompt}`;
      await self.telegramBot.sendMedia(data.telegramChatId, data.mediaUrl, caption, data.type || "image");
    }

    // NOTE: Do NOT re-broadcast MEDIA_GENERATED_NOTIFICATION or TASK_COMPLETED back to tabs.
    // The content script (google-flow.js trackGenerationProgress) already dispatched the
    // ZF_MEDIA_READY event directly to the in-page overlay. Re-broadcasting here would cause
    // the overlay to process the same completion event twice, creating duplicate entries
    // and potentially triggering duplicate downloads.
  }

  async saveReferenceImage(imageObj) {
    const data = await chrome.storage.local.get(['referenceAlbums']);
    let albums = data.referenceAlbums || {
      "Default": [],
      "Characters": [],
      "Environments": [],
      "Styles": []
    };

    const targetAlbum = imageObj.album || "Default";
    if (!albums[targetAlbum]) albums[targetAlbum] = [];

    const newEntry = {
      id: "ref_" + Date.now(),
      name: imageObj.name || ("snip_" + Date.now().toString().slice(-4)),
      tag: imageObj.tag || imageObj.name || ("snip_" + Date.now().toString().slice(-4)),
      dataUrl: imageObj.dataUrl,
      album: targetAlbum,
      createdAt: Date.now()
    };

    albums[targetAlbum].unshift(newEntry);
    await chrome.storage.local.set({ referenceAlbums: albums });
    this.log(`[REF] Saved reference image @${newEntry.tag} in album "${targetAlbum}"`);
    return { success: true, item: newEntry };
  }

  async simulateTaskExecution(task) {
    this.log(`[SIMULATION] Simulating 4K generation on ${task.provider}...`);
    await new Promise(r => setTimeout(r, 1800));

    const dummyUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#141416"/>
            <stop offset="100%" stop-color="#2a2a35"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <circle cx="400" cy="225" r="110" fill="#a3e635" opacity="0.25"/>
        <text x="50%" y="42%" fill="#a3e635" font-size="28" font-family="sans-serif" text-anchor="middle" font-weight="bold">✨ TobyFlow 4K Generated Asset</text>
        <text x="50%" y="54%" fill="#ffffff" font-size="16" font-family="sans-serif" text-anchor="middle">"${task.prompt || "Cinematic Masterpiece"}"</text>
        <text x="50%" y="65%" fill="#9ca3af" font-size="13" font-family="sans-serif" text-anchor="middle">Provider: ${task.provider || "Google Flow"} • 4K Resolution • No Watermark</text>
      </svg>
    `);

    await this.handleMediaGenerated({
      provider: task.provider || "Google Flow",
      prompt: task.prompt || "Simulated Generation",
      project: task.project || "tobyflow-01",
      mediaUrl: dummyUrl,
      type: task.type || "image",
      resolution: "4K"
    });

    return { success: true, mediaUrl: dummyUrl };
  }

  stopAllTasks() {
    this.taskQueue = [];
    this.isRunning = false;
    this.isPaused = false;
    this.currentTask = null;
    this.updateBadge();
    this.log("[QUEUE] All tasks stopped and queue cleared.");

    // Tell all content scripts to immediately abort waiting/rendering
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: "ABORT_GENERATION" }).catch(() => {});
        }
      });
    });

    this.broadcast({ action: "QUEUE_STOPPED" });
  }

  updateBadge() {
    const count = this.taskQueue.length + (this.currentTask ? 1 : 0);
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: "#a3e635" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  }

  log(msg, type = "info") {
    console.log(`[TobyFlow] ${msg}`);
    this.broadcast({ action: "LOG_MESSAGE", message: msg, logType: type, timestamp: new Date().toLocaleTimeString() });
  }

  broadcast(message) {
    // Send to extension sidepanel and popup
    chrome.runtime.sendMessage(message).catch(() => {});
    // Send to all open tabs so in-page mini overlay receives every live event
    chrome.tabs.query({}, (tabs) => {
      if (Array.isArray(tabs)) {
        tabs.forEach(tab => {
          if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => {});
          }
        });
      }
    });
  }
}

if (typeof self !== "undefined") {
  self.backgroundController = new BackgroundController();
}
