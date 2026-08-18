/**
 * AutoFlow Album & Reference Image Manager
 * Organizes reference images into albums, generates @mention syntax tags,
 * and provides cross-project reference image injection.
 */

window.AlbumManager = {
  albums: {},
  activeAlbum: "Default",

  init: async function() {
    await this.loadAlbums();
    this.setupEvents();
    this.renderAlbumTabs();
    this.renderGallery();
  },

  async loadAlbums() {
    const data = await chrome.storage.local.get(['referenceAlbums']);
    this.albums = data.referenceAlbums || {
      "Default": [],
      "Characters": [],
      "Environments": [],
      "Styles": []
    };
  },

  async saveAlbums() {
    await chrome.storage.local.set({ referenceAlbums: this.albums });
    this.renderGallery();
  },

  setupEvents: function() {
    document.getElementById("album-btn-upload")?.addEventListener("click", () => {
      document.getElementById("album-file-input")?.click();
    });

    document.getElementById("album-file-input")?.addEventListener("change", (e) => this.handleImageUpload(e));
    document.getElementById("album-btn-snip")?.addEventListener("click", () => this.triggerSnip());
    document.getElementById("album-btn-new-album")?.addEventListener("click", () => this.createNewAlbum());
  },

  renderAlbumTabs: function() {
    const container = document.getElementById("album-tabs-nav");
    if (!container) return;

    const albumNames = Object.keys(this.albums);
    container.innerHTML = albumNames.map(name => `
      <button class="btn btn-sm ${name === this.activeAlbum ? 'btn-primary' : 'btn-secondary'}" onclick="window.AlbumManager.switchAlbum('${name}')">
        📁 ${name} (${(this.albums[name] || []).length})
      </button>
    `).join("");
  },

  switchAlbum: function(name) {
    this.activeAlbum = name;
    this.renderAlbumTabs();
    this.renderGallery();
  },

  renderGallery: function() {
    const grid = document.getElementById("album-gallery-grid");
    if (!grid) return;

    const items = this.albums[this.activeAlbum] || [];
    if (items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;color:#64748b;padding:48px;border:2px dashed #334155;border-radius:12px;">
          <div style="font-size:32px;margin-bottom:8px;">🖼️</div>
          <div>No reference images in "${this.activeAlbum}".</div>
          <div style="font-size:12px;margin-top:6px;color:#94a3b8;">Upload a file or click "Snip Reference from Web" to add images.</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map(img => `
      <div class="card" style="padding:10px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden;margin-bottom:0;">
        <div style="height:140px;background:#0f172a;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <img src="${img.dataUrl}" style="max-height:100%;max-width:100%;object-fit:cover;" />
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:12px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            @${img.tag || img.name}
          </div>
          <button class="btn btn-sm btn-secondary" onclick="window.AlbumManager.deleteImage('${img.id}')" style="padding:2px 6px;font-size:10px;">🗑️</button>
        </div>
        <button class="btn btn-sm btn-primary" onclick="navigator.clipboard.writeText('@${img.tag || img.name}'); window.AutoFlow.showToast('📋 Copied @${img.tag || img.name} to clipboard!','success');">
          📋 Copy @mention
        </button>
      </div>
    `).join("");
  },

  handleImageUpload: function(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_").toLowerCase();
        if (!this.albums[this.activeAlbum]) this.albums[this.activeAlbum] = [];

        this.albums[this.activeAlbum].unshift({
          id: "img_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
          name: rawName,
          tag: rawName,
          dataUrl: event.target.result,
          createdAt: Date.now()
        });

        await this.saveAlbums();
        this.renderAlbumTabs();
      };
      reader.readAsDataURL(file);
    });

    window.AutoFlow.showToast(`✅ Uploaded ${files.length} images to "${this.activeAlbum}"!`, "success");
  },

  triggerSnip: function() {
    chrome.runtime.sendMessage({ action: "TRIGGER_SCREEN_CAPTURE_ACTIVE_TAB" }, (res) => {
      window.AutoFlow.showToast("📸 Snip overlay activated on active browser tab!", "info");
    });
  },

  createNewAlbum: async function() {
    const name = prompt("Enter new album name:", "Creatures");
    if (!name) return;
    if (this.albums[name]) {
      alert("Album already exists.");
      return;
    }

    this.albums[name] = [];
    this.activeAlbum = name;
    await this.saveAlbums();
    this.renderAlbumTabs();
    window.AutoFlow.showToast(`📁 Created album "${name}"!`, "success");
  },

  deleteImage: async function(id) {
    if (this.albums[this.activeAlbum]) {
      this.albums[this.activeAlbum] = this.albums[this.activeAlbum].filter(img => img.id !== id);
      await this.saveAlbums();
      this.renderAlbumTabs();
    }
  }
};
