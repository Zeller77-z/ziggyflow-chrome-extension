/**
 * ZiggyFlow Settings & Preferences Manager
 * 1:1 Parity with TobyFlow v1.2.21 Configuration Architecture
 */

window.SettingsManager = {
  DEFAULTS: {
    inputTimeout: 1200,
    blobMaxAgeDays: 7,
    randomDelayMin: 3,
    randomDelayMax: 10,
    queueEnabled: false,
    manualSubmitMode: false,
    autoDownload: false,
    autoRemoveWatermark: false,
    autoRemoveWatermarkVideo: false,
    autoRemoveWatermarkInput: false,
    downloadFolder: "ziggyflow_output",
    fileNameProject: "",
    fileNameTemplate: "[Date]_[Project]_[Prompt]_[Index]",
    downloadResolution: "4k",
    videoDownloadResolution: "1080p",
    theme: "dark",
    language: "en",
    notifyOnComplete: true,
    notifyTelegram: false,
    telegramAutoDownload: true,
    telegramDownloadFolder: "ziggyflow_bot",
    telegramDownloadResolution: "4k",
    telegramVideoDownloadResolution: "1080p",
    telegramDefaultProvider: "flow",
    telegramFlowRatio: "16:9",
    telegramFlowModel: "Nano Banana 2",
    telegramFlowVideoModel: "Veo 3.1 - Fast",
    telegramFlowVideoDuration: "6s",
    telegramFlowVideoInputType: "Ingredients",
    telegramChatgptRatio: "square",
    telegramGrokRatio: "widescreen",
    telegramGrokDuration: "6s",
    telegramGrokResolution: "720p",
    telegramGrokImageQuality: "speed",
    notifySound: false,
    humanizedMode: false,
    humanizedSpeed: 0.5,
    defaultGenType: "Image",
    defaultRatio: "16:9",
    defaultImageRatio: "16:9",
    defaultVideoRatio: "16:9",
    defaultImageModel: "Nano Banana 2",
    defaultVideoModel: "Veo 3.1 - Fast",
    defaultVideoDuration: "6s",
    defaultProvider: "flow",
    chatgptDefaultRatio: "story",
    chatgptModel: "Instant",
    chatgptFallbackPrefix: "Generate an image of: ",
    chatgptAutoClose: false,
    chatgptDeleteAfterGen: false,
    grokDefaultMode: "image",
    grokDefaultRatio: "widescreen",
    grokDefaultDuration: "6s",
    grokDefaultResolution: "720p",
    grokDefaultImageQuality: "speed",
    grokAutoClose: false
  },

  settings: {},

  init: async function () {
    await this.loadAllSettings();
    this.setupEvents();
    console.log("ZiggyFlow SettingsManager initialized.");
  },

  async loadAllSettings() {
    const data = await chrome.storage.local.get(["af_settings", "downloadSettings", "apiSettings", "generalSettings"]);
    this.settings = { ...this.DEFAULTS, ...(data.af_settings || {}) };

    // 1. Queue & Execution Settings
    const inputTimeout = document.getElementById("set-input-timeout");
    const delayMin = document.getElementById("set-delay-min");
    const delayMax = document.getElementById("set-delay-max");
    const manualMode = document.getElementById("set-manual-submit-mode");

    if (inputTimeout) inputTimeout.value = this.settings.inputTimeout;
    if (delayMin) delayMin.value = this.settings.randomDelayMin;
    if (delayMax) delayMax.value = this.settings.randomDelayMax;
    if (manualMode) manualMode.checked = !!this.settings.manualSubmitMode;

    // 2. Download Preferences
    const autoDl = document.getElementById("set-auto-download");
    const wmClean = document.getElementById("set-remove-watermark");
    const fnTpl = document.getElementById("set-filename-template");
    const subfolder = document.getElementById("set-subfolder");
    const resImg = document.getElementById("set-resolution");
    const resVid = document.getElementById("set-video-resolution");

    if (autoDl) autoDl.checked = !!this.settings.autoDownload;
    if (wmClean) wmClean.checked = !!this.settings.autoRemoveWatermark;
    if (fnTpl) fnTpl.value = this.settings.fileNameTemplate;
    if (subfolder) subfolder.value = this.settings.downloadFolder;
    if (resImg) resImg.value = this.settings.downloadResolution;
    if (resVid) resVid.value = this.settings.videoDownloadResolution;

    // 3. Provider Defaults
    const defProv = document.getElementById("set-default-provider");
    const defImgModel = document.getElementById("set-default-image-model");
    const defVidModel = document.getElementById("set-default-video-model");
    const defImgRatio = document.getElementById("set-default-image-ratio");
    const defVidRatio = document.getElementById("set-default-video-ratio");
    const defVidDur = document.getElementById("set-default-video-duration");

    if (defProv) defProv.value = this.settings.defaultProvider;
    if (defImgModel) defImgModel.value = this.settings.defaultImageModel;
    if (defVidModel) defVidModel.value = this.settings.defaultVideoModel;
    if (defImgRatio) defImgRatio.value = this.settings.defaultImageRatio;
    if (defVidRatio) defVidRatio.value = this.settings.defaultVideoRatio;
    if (defVidDur) defVidDur.value = this.settings.defaultVideoDuration;

    // 4. API Settings
    const as = data.apiSettings || {};
    const oai = document.getElementById("set-api-openai");
    const gem = document.getElementById("set-api-gemini");
    const grok = document.getElementById("set-api-grok");

    if (oai) oai.value = as.openaiApiKey || "";
    if (gem) gem.value = as.geminiApiKey || "";
    if (grok) grok.value = as.grokApiKey || "";
  },

  setupEvents: function () {
    document.getElementById("set-btn-save-downloads")?.addEventListener("click", () => this.saveAllSettings());
    document.getElementById("set-btn-save-all")?.addEventListener("click", () => this.saveAllSettings());
    document.getElementById("set-btn-save-api")?.addEventListener("click", () => this.saveApiSettings());
    document.getElementById("set-btn-backup-export")?.addEventListener("click", () => this.exportBackup());
    document.getElementById("set-btn-backup-import")?.addEventListener("click", () => this.importBackup());

    // Live sync for Manual Mode checkbox
    document.getElementById("set-manual-submit-mode")?.addEventListener("change", (e) => {
      this.settings.manualSubmitMode = e.target.checked;
      chrome.storage.local.set({ af_settings: this.settings });
      if (window.AutoFlow?.showToast) {
        window.AutoFlow.showToast(e.target.checked ? "⏱ Manual Submit Mode: Enabled" : "⚡ Auto Submit Mode: Enabled", "info");
      }
    });

    // Live sync for Auto Download checkbox
    document.getElementById("set-auto-download")?.addEventListener("change", (e) => {
      this.settings.autoDownload = e.target.checked;
      chrome.storage.local.set({ af_settings: this.settings });
    });
  },

  async saveAllSettings() {
    this.settings = {
      ...this.settings,
      inputTimeout: parseInt(document.getElementById("set-input-timeout")?.value) || 1200,
      randomDelayMin: parseInt(document.getElementById("set-delay-min")?.value) || 3,
      randomDelayMax: parseInt(document.getElementById("set-delay-max")?.value) || 10,
      manualSubmitMode: !!document.getElementById("set-manual-submit-mode")?.checked,
      autoDownload: !!document.getElementById("set-auto-download")?.checked,
      autoRemoveWatermark: !!document.getElementById("set-remove-watermark")?.checked,
      downloadFolder: document.getElementById("set-subfolder")?.value.trim() || "ziggyflow_output",
      fileNameTemplate: document.getElementById("set-filename-template")?.value.trim() || "[Date]_[Project]_[Prompt]_[Index]",
      downloadResolution: document.getElementById("set-resolution")?.value || "4k",
      videoDownloadResolution: document.getElementById("set-video-resolution")?.value || "1080p",
      defaultProvider: document.getElementById("set-default-provider")?.value || "flow",
      defaultImageModel: document.getElementById("set-default-image-model")?.value || "Nano Banana 2",
      defaultVideoModel: document.getElementById("set-default-video-model")?.value || "Veo 3.1 - Fast",
      defaultImageRatio: document.getElementById("set-default-image-ratio")?.value || "16:9",
      defaultVideoRatio: document.getElementById("set-default-video-ratio")?.value || "16:9",
      defaultVideoDuration: document.getElementById("set-default-video-duration")?.value || "6s"
    };

    // Save legacy downloadSettings for backwards compatibility
    const legacyDownloadSettings = {
      autoDownload: this.settings.autoDownload,
      filenameTemplate: this.settings.fileNameTemplate,
      defaultSubfolder: this.settings.downloadFolder,
      resolution: this.settings.downloadResolution,
      removeWatermark: this.settings.autoRemoveWatermark
    };

    await chrome.storage.local.set({
      af_settings: this.settings,
      downloadSettings: legacyDownloadSettings
    });

    if (window.AutoFlow?.showToast) {
      window.AutoFlow.showToast("✅ All preferences saved & synchronized!", "success");
    }
  },

  async saveApiSettings() {
    const settings = {
      openaiApiKey: document.getElementById("set-api-openai")?.value.trim(),
      geminiApiKey: document.getElementById("set-api-gemini")?.value.trim(),
      grokApiKey: document.getElementById("set-api-grok")?.value.trim()
    };

    await chrome.storage.local.set({ apiSettings: settings });
    if (window.AutoFlow?.showToast) {
      window.AutoFlow.showToast("✅ API keys safely stored locally!", "success");
    }
  },

  async exportBackup() {
    const data = await chrome.storage.local.get(null);
    const exportData = {
      version: "2.1.0",
      type: "ziggyflow_settings_backup",
      exportedAt: new Date().toISOString(),
      data: data
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ziggyflow_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (window.AutoFlow?.showToast) {
      window.AutoFlow.showToast("📦 Settings backup downloaded!", "success");
    }
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
          const parsed = JSON.parse(event.target.result);
          const restoreData = parsed.data || parsed;
          await chrome.storage.local.set(restoreData);
          if (window.AutoFlow?.showToast) {
            window.AutoFlow.showToast("✅ Settings restored! Reloading...", "success");
          }
          setTimeout(() => location.reload(), 1000);
        } catch (err) {
          if (window.AutoFlow?.showToast) {
            window.AutoFlow.showToast("❌ Invalid backup file format.", "error");
          }
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
};
