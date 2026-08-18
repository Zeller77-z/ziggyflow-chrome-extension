/**
 * AutoFlow Telegram Bot UI Settings & Integration Manager
 */

window.TelegramSettings = {
  init: async function() {
    await this.loadSettings();
    this.setupEvents();
  },

  async loadSettings() {
    const data = await chrome.storage.local.get(['telegramSettings']);
    if (data.telegramSettings) {
      const s = data.telegramSettings;
      const tokenInput = document.getElementById("tg-bot-token");
      const chatInput = document.getElementById("tg-chat-id");
      const enabledToggle = document.getElementById("tg-enabled-toggle");

      if (tokenInput) tokenInput.value = s.botToken || "";
      if (chatInput) chatInput.value = s.chatId || "";
      if (enabledToggle) enabledToggle.checked = s.enabled || false;
    }
  },

  setupEvents: function() {
    document.getElementById("tg-btn-save")?.addEventListener("click", () => this.saveSettings());
    document.getElementById("tg-btn-test")?.addEventListener("click", () => this.testConnection());
  },

  async saveSettings() {
    const token = document.getElementById("tg-bot-token")?.value.trim() || "";
    const chatId = document.getElementById("tg-chat-id")?.value.trim() || "";
    const enabled = document.getElementById("tg-enabled-toggle")?.checked || false;

    chrome.runtime.sendMessage({
      action: "UPDATE_TELEGRAM_SETTINGS",
      payload: {
        botToken: token,
        chatId: chatId,
        enabled: enabled
      }
    }, () => {
      window.AutoFlow.showToast("✅ Telegram settings saved & updated!", "success");
    });
  },

  async testConnection() {
    const token = document.getElementById("tg-bot-token")?.value.trim();
    const chatId = document.getElementById("tg-chat-id")?.value.trim();

    if (!token) {
      window.AutoFlow.showToast("⚠️ Enter your Telegram Bot Token first.", "error");
      return;
    }

    try {
      window.AutoFlow.showToast("Testing connection with Telegram API...", "info");
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();

      if (data.ok) {
        const botName = data.result.username;
        if (chatId) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `⚡ *AutoFlow Pro Bot Connected!*\nReady to receive commands:\n• \`/image <prompt>\`\n• \`/video <prompt>\`\n• \`/status\``,
              parse_mode: "Markdown"
            })
          });
        }
        window.AutoFlow.showToast(`✅ Connected successfully to @${botName}!`, "success");
      } else {
        window.AutoFlow.showToast(`❌ Telegram error: ${data.description}`, "error");
      }
    } catch (err) {
      window.AutoFlow.showToast(`❌ Connection failed: ${err.message}`, "error");
    }
  }
};
