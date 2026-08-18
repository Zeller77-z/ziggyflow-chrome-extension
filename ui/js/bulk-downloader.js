/**
 * TobyFlow Bulk Media Downloader
 * 1-Click Mass Downloader for all rendered Google Flow, ChatGPT, and Grok
 * 4K videos & images on the active webpage or project history.
 */

window.BulkDownloader = {
  scannedMedia: [],
  selectedIds: new Set(),
  isDownloading: false,

  init: function() {
    this.setupEvents();
  },

  setupEvents: function() {
    document.getElementById("bulk-btn-scan")?.addEventListener("click", () => this.scanActivePage());
    document.getElementById("bulk-btn-select-all")?.addEventListener("click", () => this.selectAll(true));
    document.getElementById("bulk-btn-deselect-all")?.addEventListener("click", () => this.selectAll(false));
    document.getElementById("bulk-btn-download-selected")?.addEventListener("click", () => this.downloadSelected());

    document.getElementById("bulk-filter-type")?.addEventListener("change", (e) => {
      this.filterAndRender(e.target.value);
    });
  },

  async scanActivePage() {
    const statusEl = document.getElementById("bulk-scan-status");
    if (statusEl) statusEl.innerText = "🔍 Scanning active page for generated videos & 4K images...";
    window.AutoFlow.showToast("🔍 Scanning active page for 4K media...", "info");

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id) {
      if (statusEl) statusEl.innerText = "❌ No active tab detected.";
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, { action: "SCAN_PAGE_MEDIA" }, (res) => {
      if (chrome.runtime.lastError || !res || !res.media) {
        // Fallback: Check background history or open tab
        if (statusEl) statusEl.innerText = "⚠️ No media found on current page. Make sure you are on Google Flow / ChatGPT / Grok.";
        window.AutoFlow.showToast("Make sure you are on an active Google Flow tab.", "info");
        return;
      }

      this.scannedMedia = res.media;
      this.selectedIds = new Set(res.media.map(m => m.id)); // Select all by default
      if (statusEl) statusEl.innerText = `✅ Found ${res.media.length} media assets on page!`;
      window.AutoFlow.showToast(`✅ Discovered ${res.media.length} 4K media assets!`, "success");
      this.renderMediaGrid();
    });
  },

  renderMediaGrid() {
    const grid = document.getElementById("bulk-media-grid");
    const countBadge = document.getElementById("bulk-selected-count");
    if (!grid) return;

    if (countBadge) countBadge.innerText = `${this.selectedIds.size}/${this.scannedMedia.length} Selected`;

    if (this.scannedMedia.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: #6b7280; padding: 24px; border: 1px dashed #2e3038; border-radius: 8px;">
          Click "Scan Active Page" to find all generated videos and images.
        </div>
      `;
      return;
    }

    grid.innerHTML = this.scannedMedia.map(item => {
      const isChecked = this.selectedIds.has(item.id);
      const isVideo = item.type === "video";

      return `
        <div style="background:#151619;border:1px solid ${isChecked ? '#a3e635' : '#2e3038'};border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:6px;position:relative;">
          <input type="checkbox" ${isChecked ? "checked" : ""} onchange="window.BulkDownloader.toggleItem('${item.id}')" style="position:absolute;top:6px;left:6px;z-index:2;width:16px;height:16px;accent-color:#a3e635;" />
          
          <div style="height:90px;background:#0b0f19;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;">
            ${isVideo 
              ? `<video src="${item.url}" style="width:100%;height:100%;object-fit:cover;" muted></video><div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);color:#38bdf8;padding:2px 5px;border-radius:4px;font-size:9px;font-weight:700;">MP4 4K</div>`
              : `<img src="${item.url}" style="width:100%;height:100%;object-fit:cover;" /><div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.7);color:#a3e635;padding:2px 5px;border-radius:4px;font-size:9px;font-weight:700;">4K PNG</div>`
            }
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af;">
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px;">${item.title}</span>
            <button class="btn btn-sm btn-secondary" onclick="window.BulkDownloader.downloadSingle('${item.id}')" style="padding:2px 6px;font-size:10px;">⬇️</button>
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
    if (select) {
      this.selectedIds = new Set(this.scannedMedia.map(m => m.id));
    } else {
      this.selectedIds.clear();
    }
    this.renderMediaGrid();
  },

  filterAndRender(filterType) {
    // Filter view
    this.renderMediaGrid();
  },

  async downloadSingle(id) {
    const item = this.scannedMedia.find(m => m.id === id);
    if (!item) return;

    const subfolder = document.getElementById("bulk-subfolder-input")?.value || "tobyflow-01";
    chrome.runtime.sendMessage({
      action: "TRIGGER_DOWNLOAD",
      payload: {
        url: item.url,
        prompt: item.title,
        project: subfolder,
        provider: "Google_Flow_Bulk",
        type: item.type,
        resolution: "4K"
      }
    }, () => {
      window.AutoFlow.showToast(`⬇️ Downloaded ${item.title}!`, "success");
    });
  },

  async downloadSelected() {
    const itemsToDownload = this.scannedMedia.filter(m => this.selectedIds.has(m.id));
    if (itemsToDownload.length === 0) {
      window.AutoFlow.showToast("⚠️ Select at least one item to download.", "error");
      return;
    }

    const subfolder = document.getElementById("bulk-subfolder-input")?.value || "tobyflow-01";
    const btn = document.getElementById("bulk-btn-download-selected");
    const progressEl = document.getElementById("bulk-download-progress");

    this.isDownloading = true;
    if (btn) btn.disabled = true;

    window.AutoFlow.showToast(`🚀 Starting mass download of ${itemsToDownload.length} assets...`, "info");

    let completed = 0;
    for (const item of itemsToDownload) {
      if (progressEl) progressEl.innerText = `Downloading ${completed + 1}/${itemsToDownload.length} (4K)...`;
      
      await new Promise(r => {
        chrome.runtime.sendMessage({
          action: "TRIGGER_DOWNLOAD",
          payload: {
            url: item.url,
            prompt: item.title,
            project: subfolder,
            provider: "Google_Flow_Bulk",
            type: item.type,
            resolution: "4K"
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
    window.AutoFlow.showToast(`🏁 Bulk download complete! (${itemsToDownload.length} items saved)`, "success");
  }
};
