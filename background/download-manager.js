/**
 * AutoFlow Download Manager
 * Handles automated file downloading, custom filename templates, subfolder routing,
 * and resolution naming for generated images and videos.
 */

class DownloadManager {
  constructor() {
    this.defaultSettings = {
      autoDownload: true,
      filenameTemplate: "[Date]_[Project]_[Provider]_[Prompt]_[Index]",
      defaultSubfolder: "AutoFlow",
      organizeByProject: true,
      organizeByProvider: true,
      resolution: "4K", // 1K, 2K, 4K for images / 720p, 1080p, 4K for video
      imageFormat: "png",
      videoFormat: "mp4"
    };
    this.downloadHistory = [];
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['downloadSettings'], (result) => {
        resolve({ ...this.defaultSettings, ...(result.downloadSettings || {}) });
      });
    });
  }

  sanitizeString(str, maxLength = 40) {
    if (!str) return "untitled";
    // Replace invalid filename chars
    let cleaned = str.replace(/[\\/:*?"<>|\r\n\t]+/g, "_").trim();
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength).trim();
    }
    return cleaned;
  }

  formatFilename(template, params) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");
    
    let promptShort = this.sanitizeString(params.prompt || "generation", 35);
    let project = this.sanitizeString(params.project || "Default", 25);
    let provider = this.sanitizeString(params.provider || "Flow", 15);
    let index = String(params.index || 1).padStart(3, "0");
    let resolution = params.resolution || "4K";
    let type = params.type || (params.url && params.url.includes(".mp4") ? "video" : "image");
    let ext = params.extension || (type === "video" ? "mp4" : "png");

    let filename = template
      .replace(/\[Date\]/gi, dateStr)
      .replace(/\[Time\]/gi, timeStr)
      .replace(/\[Project\]/gi, project)
      .replace(/\[Provider\]/gi, provider)
      .replace(/\[Prompt\]/gi, promptShort)
      .replace(/\[Index\]/gi, index)
      .replace(/\[Resolution\]/gi, resolution)
      .replace(/\[Type\]/gi, type);

    // Clean up double underscores
    filename = filename.replace(/_+/g, "_").replace(/^_|_$/g, "");
    return `${filename}.${ext}`;
  }

  async triggerDownload(item) {
    const settings = await this.getSettings();
    if (!settings.autoDownload && !item.force) {
      return { success: false, reason: "Auto-download disabled" };
    }

    const filename = this.formatFilename(settings.filenameTemplate, item);
    
    // Construct subfolder path
    let folderParts = [settings.defaultSubfolder];
    if (settings.organizeByProject && item.project) {
      folderParts.push(this.sanitizeString(item.project, 30));
    }
    if (settings.organizeByProvider && item.provider) {
      folderParts.push(this.sanitizeString(item.provider, 20));
    }
    
    const fullPath = `${folderParts.join("/")}/${filename}`;

    return new Promise((resolve, reject) => {
      try {
        chrome.downloads.download({
          url: item.url,
          filename: fullPath,
          saveAs: false,
          conflictAction: "uniquify"
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error("AutoFlow Download error:", chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            const logEntry = {
              id: downloadId,
              path: fullPath,
              url: item.url,
              provider: item.provider,
              timestamp: Date.now()
            };
            this.downloadHistory.unshift(logEntry);
            if (this.downloadHistory.length > 100) this.downloadHistory.pop();
            
            resolve({ success: true, downloadId, filename: fullPath });
          }
        });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  }
}

// Export for background service worker
if (typeof self !== "undefined") {
  self.downloadManager = new DownloadManager();
}
