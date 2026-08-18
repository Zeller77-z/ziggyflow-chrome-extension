/**
 * AutoFlow Settings & Preferences Manager
 */

window.SettingsManager = {
  init: async function() {
    await this.loadAllSettings();
    this.setupEvents();
  },

  async loadAllSettings() {
    const data = await chrome.storage.local.get(['downloadSettings', 'apiSettings', 'generalSettings']);

    // Download settings
    const ds = data.downloadSettings || {};
    const autoDl = document.getElementById("set-auto-download");
    const fnTpl = document.getElementById("set-filename-template");
    const subfolder = document.getElementById("set-subfolder");
    const res = document.getElementById("set-resolution");

    if (autoDl) autoDl.checked = ds.autoDownload !== false;
    if (fnTpl) fnTpl.value = ds.filenameTemplate || "[Date]_[Project]_[Provider]_[Prompt]_[Index]";
    if (subfolder) subfolder.value = ds.defaultSubfolder || "AutoFlow";
    if (res) res.value = ds.resolution || "4K";

    // API settings
    const as = data.apiSettings || {};
    const oai = document.getElementById("set-api-openai");
    const gem = document.getElementById("set-api-gemini");
    const grok = document.getElementById("set-api-grok");

    if (oai) oai.value = as.openaiApiKey || "";
    if (gem) gem.value = as.geminiApiKey || "";
    if (grok) grok.value = as.grokApiKey || "";
  },

  setupEvents: function() {
    document.getElementById("set-btn-save-downloads")?.addEventListener("click", () => this.saveDownloadSettings());
    document.getElementById("set-btn-save-api")?.addEventListener("click", () => this.saveApiSettings());
    document.getElementById("set-btn-backup-export")?.addEventListener("click", () => this.exportBackup());
    document.getElementById("set-btn-backup-import")?.addEventListener("click", () => this.importBackup());
  },

  async saveDownloadSettings() {
    const settings = {
      autoDownload: document.getElementById("set-auto-download")?.checked,
      filenameTemplate: document.getElementById("set-filename-template")?.value.trim(),
      defaultSubfolder: document.getElementById("set-subfolder")?.value.trim(),
      resolution: document.getElementById("set-resolution")?.value,
      organizeByProject: true,
      organizeByProvider: true
    };

    await chrome.storage.local.set({ downloadSettings: settings });
    window.AutoFlow.showToast("✅ Download preferences saved!", "success");
  },

  async saveApiSettings() {
    const settings = {
      openaiApiKey: document.getElementById("set-api-openai")?.value.trim(),
      geminiApiKey: document.getElementById("set-api-gemini")?.value.trim(),
      grokApiKey: document.getElementById("set-api-grok")?.value.trim()
    };

    await chrome.storage.local.set({ apiSettings: settings });
    window.AutoFlow.showToast("✅ API keys safely stored locally!", "success");
  },

  async exportBackup() {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autoflow_full_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.AutoFlow.showToast("📦 Full backup downloaded!", "success");
  },

  importBackup() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          await chrome.storage.local.set(data);
          window.AutoFlow.showToast("✅ Backup restored! Reloading...", "success");
          setTimeout(() => location.reload(), 1000);
        } catch (err) {
          window.AutoFlow.showToast("❌ Invalid backup file.", "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
};
