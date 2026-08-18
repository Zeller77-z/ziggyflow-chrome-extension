/**
 * AutoFlow (TobyFlow) Main UI Controller & State Manager
 */

document.addEventListener("DOMContentLoaded", async () => {
  window.AutoFlow = {
    activeTab: "gen",
    init: async function() {
      this.setupNavigation();
      this.setupHeaderActions();
      this.setupBackgroundListener();

      // Initialize all sub-modules
      if (window.BulkDownloader) window.BulkDownloader.init();
      if (window.FlowConnector) window.FlowConnector.init();
      if (window.WorkflowBuilder) window.WorkflowBuilder.init();
      if (window.BatchGenerator) window.BatchGenerator.init();
      if (window.SmartTasks) window.SmartTasks.init();
      if (window.PromptTemplates) window.PromptTemplates.init();
      if (window.AlbumManager) window.AlbumManager.init();
      if (window.MultiAngleCamera) window.MultiAngleCamera.init();
      if (window.ImageEffects) window.ImageEffects.init();
      if (window.PromptEnhancer) window.PromptEnhancer.init();
      if (window.TelegramSettings) window.TelegramSettings.init();
      if (window.DiagnosticsManager) window.DiagnosticsManager.init();
      if (window.SettingsManager) window.SettingsManager.init();
      if (window.DomTemplatesManager) window.DomTemplatesManager.init();

      console.log("TobyFlow Studio UI Initialized.");
    },

    setupNavigation: function() {
      const navItems = document.querySelectorAll(".nav-tab-btn");
      navItems.forEach(item => {
        item.addEventListener("click", () => {
          const tabName = item.getAttribute("data-tab");
          if (!tabName) return;

          navItems.forEach(n => n.classList.remove("active"));
          item.classList.add("active");

          document.querySelectorAll(".tab-pane").forEach(pane => {
            pane.classList.remove("active");
          });

          const targetPane = document.getElementById(`tab-${tabName}`);
          if (targetPane) {
            targetPane.classList.add("active");
          }

          this.activeTab = tabName;
        });
      });
    },

    setupHeaderActions: function() {
      document.getElementById("hdr-btn-toggle")?.addEventListener("click", () => {
        window.AutoFlow.showToast("🟢 TobyFlow Extension is Active and monitoring Flow/ChatGPT/Grok tabs.", "info");
      });

      document.getElementById("hdr-btn-docs")?.addEventListener("click", () => {
        // Switch to Prompts tab
        document.querySelector('[data-tab="prompts"]')?.click();
      });

      document.getElementById("hdr-btn-web")?.addEventListener("click", () => {
        chrome.tabs.create({ url: "https://labs.google/fx" });
      });

      document.getElementById("hdr-btn-settings")?.addEventListener("click", () => {
        document.querySelector('[data-tab="diagnostics"]')?.click();
      });

      document.getElementById("hdr-btn-bell")?.addEventListener("click", () => {
        window.AutoFlow.showToast("🔔 0 unread alerts. Auto-download is active.", "info");
      });

      document.getElementById("hdr-btn-profile")?.addEventListener("click", () => {
        window.AutoFlow.showToast("👤 Pro Session Active. Unlimited generations & 4K download unlocked.", "success");
      });

      document.getElementById("btn-register")?.addEventListener("click", () => {
        window.AutoFlow.showToast("✨ Lifetime Pro Access Unlocked!", "success");
      });
    },

    setupBackgroundListener: function() {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "TASK_STARTED") {
          AutoFlow.showToast(`🚀 Generating on ${message.task.provider?.toUpperCase()}...`, "info");
        } else if (message.action === "TASK_COMPLETED") {
          AutoFlow.showToast(`✅ Generated & Auto-Downloaded from ${message.data.provider}!`, "success");
          const genCount = document.getElementById("footer-gen-count");
          if (genCount) {
            const current = parseInt(genCount.innerText.match(/\d+/)?.[0] || "0", 10) + 1;
            genCount.innerText = `🎯 ${current}/20`;
          }
        } else if (message.action === "QUEUE_FINISHED") {
          AutoFlow.showToast(`🏁 Generation queue completed!`, "success");
        }
      });
    },

    showToast: function(text, type = "info") {
      const container = document.getElementById("toast-container") || document.body;
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.style.borderLeft = type === "success" ? "4px solid #a3e635" : (type === "error" ? "4px solid #ef4444" : "4px solid #facc15");
      toast.innerHTML = `<span>${type === "success" ? "✨" : (type === "error" ? "❌" : "ℹ️")}</span> <span>${text}</span>`;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }
  };

  window.AutoFlow.init();
});
