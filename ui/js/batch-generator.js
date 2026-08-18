/**
 * AutoFlow Batch Prompt Generator
 * Handles queue management, multi-prompt importing (.txt, .csv),
 * @mention reference image resolving, auto-retry, and concurrency scheduling.
 */

window.BatchGenerator = {
  queue: [],
  isRunning: false,

  init: function() {
    this.setupEvents();
    this.renderQueueTable();
  },

  setupEvents: function() {
    document.getElementById("batch-btn-add")?.addEventListener("click", () => this.addPromptsToQueue());
    document.getElementById("batch-file-import")?.addEventListener("change", (e) => this.handleFileImport(e));
    document.getElementById("batch-btn-start")?.addEventListener("click", () => this.startBatch());
    document.getElementById("batch-btn-pause")?.addEventListener("click", () => this.pauseBatch());
    document.getElementById("batch-btn-clear")?.addEventListener("click", () => this.clearQueue());
  },

  handleFileImport: function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      
      const textarea = document.getElementById("batch-raw-prompts");
      if (textarea) {
        textarea.value = (textarea.value ? textarea.value + "\n" : "") + lines.join("\n");
      }
      window.AutoFlow.showToast(`📥 Imported ${lines.length} prompts from ${file.name}!`, "success");
    };
    reader.readAsText(file);
  },

  async addPromptsToQueue() {
    const rawText = document.getElementById("batch-raw-prompts")?.value || "";
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length === 0) {
      window.AutoFlow.showToast("⚠️ Please enter or import at least one prompt.", "error");
      return;
    }

    const provider = document.getElementById("batch-provider-select")?.value || "flow";
    const mediaType = document.getElementById("batch-type-select")?.value || "image";
    const model = document.getElementById("batch-model-select")?.value || "default";
    const aspectRatio = document.getElementById("batch-ratio-select")?.value || "16:9";
    const projectName = document.getElementById("batch-project-name")?.value || "Batch_Project";

    // Resolve @mentions from reference image albums
    const data = await chrome.storage.local.get(['referenceAlbums']);
    const albums = data.referenceAlbums || {};

    let addedCount = 0;
    for (const line of lines) {
      let resolvedPrompt = line;
      let referenceImage = null;

      // Check for @mention (e.g. @samurai or @Characters/samurai)
      const mentionMatch = line.match(/@([\w\-]+)/);
      if (mentionMatch) {
        const tagName = mentionMatch[1].toLowerCase();
        // Search in albums
        for (const albumKey in albums) {
          const match = albums[albumKey].find(img => img.tag?.toLowerCase() === tagName || img.name?.toLowerCase() === tagName);
          if (match) {
            referenceImage = match.dataUrl;
            resolvedPrompt = line.replace(`@${mentionMatch[1]}`, "").trim();
            break;
          }
        }
      }

      const taskItem = {
        id: "batch_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        prompt: resolvedPrompt,
        rawPrompt: line,
        provider: provider,
        type: mediaType,
        model: model,
        aspectRatio: aspectRatio,
        referenceImage: referenceImage,
        project: projectName,
        status: "Pending",
        retriesLeft: 2,
        createdAt: Date.now()
      };

      this.queue.push(taskItem);
      addedCount++;
    }

    // Clear textarea
    document.getElementById("batch-raw-prompts").value = "";
    this.renderQueueTable();
    window.AutoFlow.showToast(`➕ Added ${addedCount} tasks to batch queue!`, "success");
  },

  renderQueueTable: function() {
    const tbody = document.getElementById("batch-queue-tbody");
    if (!tbody) return;

    if (this.queue.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:24px;">No prompts in queue. Enter prompts above or import a .txt file.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.queue.map((item, idx) => {
      let statusBadge = `<span class="badge" style="background:#334155;color:#94a3b8;">Pending</span>`;
      if (item.status === "Running") {
        statusBadge = `<span class="badge" style="background:#f59e0b;color:#fff;">⚡ Running</span>`;
      } else if (item.status === "Completed") {
        statusBadge = `<span class="badge" style="background:#10b981;color:#fff;">✅ Done</span>`;
      } else if (item.status === "Failed") {
        statusBadge = `<span class="badge" style="background:#ef4444;color:#fff;">❌ Failed</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding:10px 14px;color:#94a3b8;font-size:12px;">#${idx + 1}</td>
          <td style="padding:10px 14px;font-size:13px;font-weight:500;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${escapeHTML(item.rawPrompt)}
          </td>
          <td style="padding:10px 14px;"><span class="badge badge-${item.provider}">${item.provider}</span></td>
          <td style="padding:10px 14px;font-size:12px;color:#cbd5e1;">${item.aspectRatio} • ${item.type}</td>
          <td style="padding:10px 14px;">${statusBadge}</td>
          <td style="padding:10px 14px;text-align:right;">
            <button class="btn btn-sm btn-secondary" onclick="window.BatchGenerator.removeQueueItem('${item.id}')" style="padding:2px 6px;font-size:11px;">×</button>
          </td>
        </tr>
      `;
    }).join("");
  },

  removeQueueItem: function(id) {
    this.queue = this.queue.filter(i => i.id !== id);
    this.renderQueueTable();
  },

  startBatch: function() {
    if (this.queue.length === 0) {
      window.AutoFlow.showToast("⚠️ Queue is empty.", "error");
      return;
    }

    const pendingTasks = this.queue.filter(i => i.status === "Pending");
    if (pendingTasks.length === 0) {
      window.AutoFlow.showToast("⚠️ All tasks are already finished or in progress.", "info");
      return;
    }

    chrome.runtime.sendMessage({
      action: "ENQUEUE_BATCH",
      payload: { tasks: pendingTasks }
    }, (res) => {
      window.AutoFlow.showToast(`🚀 Dispatched ${pendingTasks.length} tasks to background worker!`, "success");
    });
  },

  pauseBatch: function() {
    chrome.runtime.sendMessage({ action: "PAUSE_QUEUE" }, () => {
      window.AutoFlow.showToast("⏸ Batch queue paused.", "info");
    });
  },

  clearQueue: function() {
    this.queue = [];
    this.renderQueueTable();
    chrome.runtime.sendMessage({ action: "STOP_QUEUE" });
    window.AutoFlow.showToast("🗑️ Queue cleared.", "info");
  }
};

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
