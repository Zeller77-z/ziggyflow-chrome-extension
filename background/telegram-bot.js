/**
 * AutoFlow Telegram Bot Integration
 * Provides remote control capabilities:
 * - /image <prompt>
 * - /video <prompt>
 * - /workflow <name>
 * - /status
 * - /stop
 * Automatically sends completed generated images & videos back to Telegram.
 */

class TelegramBotService {
  constructor() {
    this.isPolling = false;
    this.pollTimer = null;
    this.lastUpdateId = 0;
    this.botToken = "";
    this.chatId = "";
    this.enabled = false;
  }

  async init() {
    const data = await chrome.storage.local.get(['telegramSettings']);
    if (data.telegramSettings) {
      this.botToken = data.telegramSettings.botToken || "";
      this.chatId = data.telegramSettings.chatId || "";
      this.enabled = data.telegramSettings.enabled || false;
    }
    if (this.enabled && this.botToken) {
      this.startPolling();
    }
  }

  async updateSettings(settings) {
    this.botToken = settings.botToken || "";
    this.chatId = settings.chatId || "";
    this.enabled = settings.enabled || false;
    
    await chrome.storage.local.set({
      telegramSettings: {
        botToken: this.botToken,
        chatId: this.chatId,
        enabled: this.enabled,
        lastActive: Date.now()
      }
    });

    if (this.enabled && this.botToken) {
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  startPolling() {
    if (this.isPolling) return;
    this.isPolling = true;
    console.log("AutoFlow: Telegram bot long-polling started.");
    this.pollLoop();
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log("AutoFlow: Telegram bot polling stopped.");
  }

  async pollLoop() {
    if (!this.isPolling || !this.botToken) return;

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
            await this.handleUpdate(update);
          }
        }
      }
    } catch (err) {
      console.warn("AutoFlow Telegram poll error:", err.message);
    }

    if (this.isPolling) {
      this.pollTimer = setTimeout(() => this.pollLoop(), 3000);
    }
  }

  async handleUpdate(update) {
    if (!update.message || !update.message.text) return;
    const msg = update.message;
    const text = msg.text.trim();
    const senderChatId = String(msg.chat.id);

    // If chat ID is locked, verify
    if (this.chatId && this.chatId !== senderChatId) {
      await this.sendMessage(senderChatId, "⚠️ Unauthorized user. Configure chat ID in AutoFlow extension settings.");
      return;
    }

    if (text.startsWith("/start") || text.startsWith("/help")) {
      const helpMsg = 
        `⚡ *AutoFlow Pro Bot Controller*\n\n` +
        `Available Commands:\n` +
        `• \`/image <prompt>\` — Generate AI Image\n` +
        `• \`/video <prompt>\` — Generate AI Video (Flow Veo 3.1 / Grok)\n` +
        `• \`/workflow <name>\` — Run saved Multi-AI Pipeline\n` +
        `• \`/status\` — View active tasks and queue status\n` +
        `• \`/stop\` — Abort all running jobs\n\n` +
        `_All generated media will be sent directly to this chat!_`;
      await this.sendMessage(senderChatId, helpMsg, "Markdown");
      return;
    }

    if (text.startsWith("/image")) {
      const prompt = text.replace("/image", "").trim();
      if (!prompt) {
        await this.sendMessage(senderChatId, "❌ Please specify a prompt: `/image Cyberpunk neon samurai in rain`", "Markdown");
        return;
      }
      await this.sendMessage(senderChatId, `🎨 *Image generation queued:*\n"${prompt}"`, "Markdown");
      
      // Dispatch task via background message bus
      if (self.backgroundController) {
        self.backgroundController.queueRemoteTask({
          type: "image",
          prompt,
          source: "telegram",
          chatId: senderChatId
        });
      }
      return;
    }

    if (text.startsWith("/video")) {
      const prompt = text.replace("/video", "").trim();
      if (!prompt) {
        await this.sendMessage(senderChatId, "❌ Please specify a prompt: `/video Drone shot of futuristic floating city at sunrise`", "Markdown");
        return;
      }
      await this.sendMessage(senderChatId, `🎬 *Video generation queued:*\n"${prompt}"`, "Markdown");
      
      if (self.backgroundController) {
        self.backgroundController.queueRemoteTask({
          type: "video",
          prompt,
          source: "telegram",
          chatId: senderChatId
        });
      }
      return;
    }

    if (text.startsWith("/workflow")) {
      const workflowName = text.replace("/workflow", "").trim();
      if (!workflowName) {
        await this.sendMessage(senderChatId, "❌ Please specify workflow name: `/workflow Cyberpunk-Pipeline`", "Markdown");
        return;
      }
      await this.sendMessage(senderChatId, `♻️ *Triggering workflow:* \`${workflowName}\`...`, "Markdown");
      
      if (self.backgroundController) {
        self.backgroundController.queueRemoteWorkflow({
          name: workflowName,
          source: "telegram",
          chatId: senderChatId
        });
      }
      return;
    }

    if (text.startsWith("/status")) {
      const queueCount = self.backgroundController ? self.backgroundController.getQueueLength() : 0;
      const statusText = 
        `📊 *AutoFlow Status*\n\n` +
        `• Pending Tasks in Queue: *${queueCount}*\n` +
        `• Active Providers: Google Flow, ChatGPT, Grok\n` +
        `• Auto-Download: Enabled (2K/4K)`;
      await this.sendMessage(senderChatId, statusText, "Markdown");
      return;
    }

    if (text.startsWith("/stop")) {
      if (self.backgroundController) {
        self.backgroundController.stopAllTasks();
      }
      await this.sendMessage(senderChatId, "🛑 *All running and queued tasks have been stopped.*", "Markdown");
      return;
    }
  }

  async sendMessage(chatId, text, parseMode = null) {
    if (!this.botToken) return;
    try {
      const targetChat = chatId || this.chatId;
      const payload = {
        chat_id: targetChat,
        text: text
      };
      if (parseMode) payload.parse_mode = parseMode;

      await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("AutoFlow: Telegram sendMessage failed:", err);
    }
  }

  async sendMedia(chatId, mediaUrl, caption = "", type = "image") {
    if (!this.botToken) return;
    const targetChat = chatId || this.chatId;
    if (!targetChat) return;

    try {
      const endpoint = type === "video" ? "sendVideo" : "sendPhoto";
      const fieldName = type === "video" ? "video" : "photo";

      // If mediaUrl is remote HTTP(S) URL
      if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
        const payload = {
          chat_id: targetChat,
          [fieldName]: mediaUrl,
          caption: caption.substring(0, 1024)
        };
        await fetch(`https://api.telegram.org/bot${this.botToken}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else if (mediaUrl.startsWith("data:")) {
        // Handle Base64 Data URL via FormData
        const response = await fetch(mediaUrl);
        const blob = await response.blob();
        const formData = new FormData();
        formData.append("chat_id", targetChat);
        formData.append("caption", caption.substring(0, 1024));
        formData.append(fieldName, blob, type === "video" ? "output.mp4" : "output.png");

        await fetch(`https://api.telegram.org/bot${this.botToken}/${endpoint}`, {
          method: "POST",
          body: formData
        });
      }
    } catch (err) {
      console.error("AutoFlow: Telegram sendMedia failed:", err);
    }
  }
}

if (typeof self !== "undefined") {
  self.telegramBot = new TelegramBotService();
}
