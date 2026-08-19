/**
 * ZiggyFlow Bulk Media Downloader
 * 1-Click Mass Downloader for all rendered Google Flow, Gemini, ChatGPT, and Grok
 * 4K videos & images on the active webpage or project history.
 */

window.BulkDownloader = {
  scannedMedia: [],
  selectedIds: new Set(),
  activeFilter: "all",
  isDownloading: false,

  init: function () {
    this.setupEvents();
  },

  setupEvents: function () {
    document.getElementById("bulk-btn-scan")?.addEventListener("click", () => this.scanActivePage());
    document.getElementById("bulk-btn-select-all")?.addEventListener("click", () => this.selectAll(true));
    document.getElementById("bulk-btn-deselect-all")?.addEventListener("click", () => this.selectAll(false));
    document.getElementById("bulk-btn-download-selected")?.addEventListener("click", () => this.downloadSelected());

    document.getElementById("bulk-filter-type")?.addEventListener("change", (e) => {
      this.activeFilter = e.target.value;
      this.renderMediaGrid();
    });
  },

  async scanActivePage() {
    const statusEl = document.getElementById("bulk-scan-status");
    if (statusEl) statusEl.innerText = "🔍 Scanning active page for generated videos & 4K images...";
    if (window.AutoFlow?.showToast) window.AutoFlow.showToast("🔍 Scanning active page for media...", "info");

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      if (statusEl) statusEl.innerText = "❌ No active tab detected.";
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, { action: "SCAN_PAGE_MEDIA" }, (res) => {
      if (chrome.runtime.lastError || !res || !res.media || res.media.length === 0) {
        if (statusEl) statusEl.innerText = "⚠️ No generated media found on active tab. Make sure you are on Google Flow / Gemini / ChatGPT / Grok.";
        if (window.AutoFlow?.showToast) window.AutoFlow.showToast("No media found on active tab.", "info");
        return;
      }

      this.scannedMedia = res.media;
      this.selectedIds = new Set(res.media.map(m => m.id)); // Select all by default
      if (statusEl) statusEl.innerText = `✅ Found ${res.media.length} media assets on page!`;
      if (window.AutoFlow?.showToast) window.AutoFlow.showToast(`✅ Discovered ${res.media.length} media assets!`, "success");
      this.renderMediaGrid();
    });
  },

  getFilteredMedia() {
    if (this.activeFilter === "image") {
      return this.scannedMedia.filter(m => m.type === "image");
    }
    if (this.activeFilter === "video") {
      return this.scannedMedia.filter(m => m.type === "video");
    }
    return this.scannedMedia;
  },

  renderMediaGrid() {
    const grid = document.getElementById("bulk-media-grid");
    const countBadge = document.getElementById("bulk-selected-count");
    if (!grid) return;

    const filtered = this.getFilteredMedia();
    const selectedInFiltered = filtered.filter(m => this.selectedIds.has(m.id));

    if (countBadge) countBadge.innerText = `${selectedInFiltered.length}/${filtered.length} Selected`;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 24px; border: 1px dashed #2e3038; border-radius: 8px; font-size: 11.5px;">
          ${this.scannedMedia.length === 0 ? 'Click "Scan Active Page" to find all generated media.' : 'No media matches the current filter.'}
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const isChecked = this.selectedIds.has(item.id);
      const isVideo = item.type === "video";

      return `
        <div style="background:#151619;border:1.5px solid ${isChecked ? '#a3e635' : '#2e3038'};border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;position:relative;transition:all 0.15s ease;">
          <input type="checkbox" ${isChecked ? "checked" : ""} onchange="window.BulkDownloader.toggleItem('${item.id}')" style="position:absolute;top:6px;left:6px;z-index:3;width:16px;height:16px;accent-color:#a3e635;cursor:pointer;" />
          
          <div style="height:95px;background:#0b0f19;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;cursor:pointer;" onclick="window.BulkDownloader.previewItem('${item.id}')">
            ${isVideo 
              ? `<video src="${item.url}" style="width:100%;height:100%;object-fit:cover;" muted></video><div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.75);color:#38bdf8;padding:2px 6px;border-radius:4px;font-size:9.5px;font-weight:800;">🎬 VIDEO</div>`
              : `<img src="${item.url}" style="width:100%;height:100%;object-fit:cover;" /><div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.75);color:#a3e635;padding:2px 6px;border-radius:4px;font-size:9.5px;font-weight:800;">🖼 4K</div>`
            }
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#9ca3af;gap:4px;">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px;font-weight:600;" title="${item.title}">${item.title}</span>
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();window.BulkDownloader.downloadSingle('${item.id}')" style="padding:2px 6px;font-size:10px;font-weight:700;" title="Download this item">⬇</button>
          </div>
        </div>
      `;
    }).join("");
  },

  toggleItem(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.renderMediaGrid();
  },

  selectAll(select) {
    const filtered = this.getFilteredMedia();
    if (select) {
      filtered.forEach(m => this.selectedIds.add(m.id));
    } else {
      filtered.forEach(m => this.selectedIds.delete(m.id));
    }
    this.renderMediaGrid();
  },

  previewItem(id) {
    const item = this.scannedMedia.find(m => m.id === id);
    if (!item) return;
    window.open(item.url, "_blank");
  },

  async downloadSingle(id) {
    const item = this.scannedMedia.find(m => m.id === id);
    if (!item) return;

    const subfolder = document.getElementById("bulk-subfolder-input")?.value.trim() || "ziggyflow_output";
    const res = document.getElementById("bulk-resolution-select")?.value || "4K";

    chrome.runtime.sendMessage({
      action: "TRIGGER_DOWNLOAD",
      payload: {
        url: item.url,
        prompt: item.title,
        project: subfolder,
        provider: "Google_Flow_Bulk",
        type: item.type,
        resolution: res
      }
    }, () => {
      if (window.AutoFlow?.showToast) window.AutoFlow.showToast(`⬇️ Downloaded ${item.title}!`, "success");
    });
  },

  async downloadSelected() {
    const itemsToDownload = this.scannedMedia.filter(m => this.selectedIds.has(m.id));
    if (itemsToDownload.length === 0) {
      if (window.AutoFlow?.showToast) window.AutoFlow.showToast("⚠️ Select at least one item to download.", "error");
      return;
    }

    const subfolder = document.getElementById("bulk-subfolder-input")?.value.trim() || "ziggyflow_output";
    const res = document.getElementById("bulk-resolution-select")?.value || "4K";
    const btn = document.getElementById("bulk-btn-download-selected");
    const progressEl = document.getElementById("bulk-download-progress");

    this.isDownloading = true;
    if (btn) btn.disabled = true;

    if (window.AutoFlow?.showToast) window.AutoFlow.showToast(`🚀 Starting mass download of ${itemsToDownload.length} assets...`, "info");

    let completed = 0;
    for (const item of itemsToDownload) {
      if (progressEl) progressEl.innerText = `Downloading ${completed + 1}/${itemsToDownload.length} (${res})...`;

      await new Promise(r => {
        chrome.runtime.sendMessage({
          action: "TRIGGER_DOWNLOAD",
          payload: {
            url: item.url,
            prompt: item.title,
            project: subfolder,
            provider: "Google_Flow_Bulk",
            type: item.type,
            resolution: res
          }
        }, () => {
          completed++;
          r();
        });
      });

      // Throttle to prevent browser download lock
      await new Promise(r => setTimeout(r, 600));
    }

    this.isDownloading = false;
    if (btn) btn.disabled = false;
    if (progressEl) progressEl.innerText = `✅ All ${itemsToDownload.length} assets downloaded to /${subfolder}!`;
    if (window.AutoFlow?.showToast) window.AutoFlow.showToast(`🏁 Bulk download complete! (${itemsToDownload.length} items saved)`, "success");
  }
};
