/**
 * ZiggyFlow Floating In-Page Overlay & Live Generation Mini-Window (HUD)
 * Ultra-compact, draggable, professional mini-window with per-item remove/retry,
 * live timers, 2x2 grid preview, quick regeneration, and 4K downloads.
 */

(() => {
  if (window.__ziggyflow_injected_overlay_loaded) return;
  window.__ziggyflow_injected_overlay_loaded = true;

  let currentBatchTasks = [];
  let galleryHistoryTasks = [];
  let batchStartTime = null;
  let batchTimerInterval = null;
  let isSoundEnabled = true;

  // Load previous gallery tasks from storage and populate initial HUD
  chrome.storage.local.get(['recentGeneratedTasks'], (res) => {
    if (res?.recentGeneratedTasks && Array.isArray(res.recentGeneratedTasks) && res.recentGeneratedTasks.length > 0) {
      galleryHistoryTasks = res.recentGeneratedTasks.slice(-30);
      if (currentBatchTasks.length === 0) {
        currentBatchTasks = [galleryHistoryTasks[0]];
        updateMiniSummary();
        renderTaskList();
      }
      renderExpandedGallery();
    }
  });

  // =============================================
  // 1. INITIALIZE FLOATING HUD & MINI-WINDOW
  // =============================================
  function initOverlay() {
    try {
      const existing = document.getElementById("ziggyflow-floating-hud");
      if (existing) existing.remove();

      const host = document.createElement("div");
      host.id = "ziggyflow-floating-hud";
      host.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
        z-index: 2147483640;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        user-select: none;
        pointer-events: none;
      `;

      // Restore saved position or default to bottom-right (matching TobyFlow in Screenshot 2)
      let savedPos = { bottom: 20, right: 380 };
      try {
        const stored = localStorage.getItem("zf_mini_window_pos");
        if (stored) {
          savedPos = JSON.parse(stored);
        }
      } catch(e) {}

      let posStyle = "";
      if (savedPos.left !== undefined && savedPos.top !== undefined) {
        posStyle = `top: ${savedPos.top}px; left: ${savedPos.left}px;`;
      } else if (savedPos.bottom !== undefined) {
        posStyle = `bottom: ${savedPos.bottom}px; right: ${savedPos.right}px;`;
      } else {
        posStyle = `bottom: 20px; right: 380px;`;
      }

      host.innerHTML = `
        <style>
          @keyframes zfSpin {
            100% { transform: rotate(360deg); }
          }
          .zf-icon-btn {
            background: #23252b;
            border: 1px solid #33363f;
            color: #9ca3af;
            border-radius: 5px;
            padding: 3px 6px;
            font-size: 11px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
          }
          .zf-icon-btn:hover {
            background: #2c3038;
            color: #ffffff;
            border-color: #4b5563;
          }
          .zf-icon-btn-lime {
            background: #202619;
            border: 1px solid #384523;
            color: #a3e635;
          }
          .zf-icon-btn-lime:hover {
            background: #28321e;
            color: #bef264;
            border-color: #a3e635;
          }
          .zf-icon-btn-danger {
            background: #27181c;
            border: 1px solid #4d252a;
            color: #ef4444;
          }
          .zf-icon-btn-danger:hover {
            background: #3b1c22;
            color: #f87171;
            border-color: #ef4444;
          }
          .zf-meta-tag {
            background: #181a1f;
            border: 1px solid #2a2d36;
            color: #94a3b8;
            font-size: 10px;
            font-weight: 600;
            padding: 1px 5px;
            border-radius: 3px;
          }
        </style>

        <!-- Floating Pill Trigger (when minimized with _) -->
        <div id="zf-pill-btn" data-ziggy-internal="true" style="
          pointer-events: auto;
          position: fixed;
          bottom: 24px;
          right: 380px;
          background: #141518;
          color: #ffffff;
          border: 1.5px solid #a3e635;
          padding: 5px 12px;
          border-radius: 9999px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.7), 0 0 16px rgba(163,230,53,0.4);
          cursor: pointer;
          display: none;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 700;
          transition: all 0.2s ease;
          letter-spacing: 0.2px;
        ">
          <span style="font-size:12px;color:#a3e635;">✦</span>
          <span>TobyFlow</span>
          <span id="zf-pill-status" style="background:#a3e635;color:#121316;padding:1px 5px;border-radius:6px;font-size:9.5px;font-weight:800;">Open</span>
        </div>

        <!-- Exact TobyFlow Mini HUD Window (Matching Screenshot 1 & 2) -->
        <div id="zf-mini-window" data-ziggy-internal="true" style="
          pointer-events: auto;
          display: flex;
          position: fixed;
          ${posStyle}
          width: 320px;
          max-width: calc(100vw - 32px);
          background: #121316;
          border: 1.5px solid #282a32;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.95), 0 0 25px rgba(0,0,0,0.6);
          overflow: hidden;
          flex-direction: column;
          z-index: 2147483645;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <!-- 1. Header Bar (Matching Image 1) -->
          <div id="zf-drag-header" style="
            background: #18191e;
            padding: 7px 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: grab;
            user-select: none;
          " title="Drag to move">
            <div style="display:flex;align-items:center;gap:6px;">
              <!-- Glowing Lime Star Icon -->
              <div style="
                width: 19px;
                height: 19px;
                border-radius: 50%;
                background: linear-gradient(135deg, #bef264 0%, #84cc16 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 8px rgba(190,242,100,0.5);
              ">
                <span style="color:#121316;font-size:11px;font-weight:900;">✦</span>
              </div>
              <span style="font-weight:800;font-size:12.5px;color:#ffffff;letter-spacing:0.2px;">TobyFlow</span>
              <button id="zf-btn-expand-gallery" style="
                background: #22252e;
                border: 1px solid #374151;
                border-radius: 5px;
                padding: 1px 4px;
                font-size: 10px;
                color: #cbd5e1;
                cursor: pointer;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
              " title="Expand Gallery">⤢</button>
            </div>

            <div style="display:flex;align-items:center;gap:5px;">
              <span id="zf-mini-header-progress" style="font-size:11px;font-weight:600;color:#cbd5e1;">0/0 done</span>
              <button id="zf-btn-download-all" style="
                background: #202619;
                border: 1px solid #384523;
                color: #a3e635;
                border-radius: 5px;
                padding: 2px 6px;
                font-size: 11px;
                cursor: pointer;
                font-weight: 700;
                display: flex;
                align-items: center;
              " title="Download all completed">⬇</button>
              <button id="zf-btn-close-mini" style="
                background: #1e2026;
                border: 1px solid #374151;
                color: #94a3b8;
                border-radius: 5px;
                padding: 2px 6px;
                font-size: 11px;
                cursor: pointer;
                display: flex;
                align-items: center;
              " title="Close">✕</button>
            </div>
          </div>

          <!-- 2. Solid Lime Divider Line -->
          <div style="height: 2px; width: 100%; background: #a3e635;"></div>

          <!-- 3. Status Bar (Matching Image 1) -->
          <div style="
            background: #141519;
            padding: 6px 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="color:#38bdf8;font-size:9px;">●</span>
              <span id="zf-active-status-text" style="font-size:11.5px;font-weight:700;color:#ffffff;">Auto Gen</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="background:#1e2026;border:1px solid #374151;color:#94a3b8;font-size:9.5px;padding:1px 5px;border-radius:3px;font-weight:700;">WEB</span>
              <span id="zf-badge-status-pill" style="background:#064e3b;color:#34d399;font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;">Done</span>
              <span id="zf-live-render-time" style="font-size:11px;color:#94a3b8;font-family:monospace;">00:00</span>
              <span id="zf-live-render-pct" style="font-size:11px;font-weight:700;color:#e2e8f0;">100%</span>
              <button id="zf-btn-collapse-list" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:11px;padding:0 2px;">^</button>
            </div>
          </div>

          <!-- 4. Thin Blue Divider Line -->
          <div style="height: 1px; width: 100%; background: #2563eb; opacity: 0.6;"></div>

          <!-- 5. Live Task Items List (Matching Image 1) -->
          <div id="zf-mini-task-list" style="
            max-height: 130px;
            overflow-y: auto;
            padding: 6px 8px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            background: #111215;
          ">
            <div style="color:#64748b;font-size:11px;text-align:center;padding:10px 0;">✨ Ready. Waiting for generation...</div>
          </div>
        </div>

        <!-- 5. EXPANDED STUDIO GALLERY OVERLAY (Matching Screenshot 2) -->
        <div id="zf-expanded-gallery-overlay" style="
          pointer-events: auto;
          display: none;
          position: fixed;
          top: 24px;
          left: 24px;
          width: 400px;
          max-width: calc(100vw - 48px);
          max-height: calc(100vh - 48px);
          background: #141519;
          border: 1.5px solid #2a2d36;
          border-radius: 16px;
          box-shadow: 0 30px 90px rgba(0,0,0,0.95), 0 0 30px rgba(0,0,0,0.8);
          overflow: hidden;
          flex-direction: column;
          z-index: 2147483646;
        ">
          <!-- Expanded Header -->
          <div style="
            background: #18191e;
            border-bottom: 1px solid #24262e;
            padding: 10px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          ">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #bef264;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <span style="color:#121316;font-size:11px;font-weight:900;">✦</span>
              </div>
              <span style="font-weight:800;font-size:13px;color:#ffffff;">TobyFlow</span>
              <span style="color:#94a3af;font-size:11.5px;">Results</span>
              <span id="zf-gallery-total-count" style="color:#94a3af;font-size:11.5px;">0</span>
            </div>

            <div style="display:flex;align-items:center;gap:6px;">
              <button id="zf-btn-gallery-dl-all" style="
                background: #bef264;
                color: #121316;
                border: none;
                border-radius: 5px;
                padding: 5px 12px;
                font-size: 11px;
                font-weight: 800;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                box-shadow: 0 4px 12px rgba(190, 242, 100, 0.35);
              ">
                <span>⬇</span> Download all
              </button>
              <button id="zf-btn-close-gallery" class="zf-icon-btn">✕</button>
            </div>
          </div>

          <!-- Expanded Cards Container -->
          <div id="zf-gallery-cards-container" style="
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: calc(100vh - 110px);
          ">
            <!-- Populated with result cards -->
          </div>
        </div>
      `;

      if (document.body) {
        document.body.appendChild(host);
      } else {
        document.addEventListener("DOMContentLoaded", () => document.body.appendChild(host));
      }

      setupMiniWindowEvents(host);
      setupDraggableWindow(host);
      attachManualPageListener();

    } catch (err) {
      console.warn("ZiggyFlow overlay init note:", err);
    }
  }

  // =============================================
  // 2. DRAG AND DROP MOVEMENT CONTROLLER
  // =============================================
  function setupDraggableWindow(host) {
    const mini = host.querySelector("#zf-mini-window");
    const dragHeader = host.querySelector("#zf-drag-header");
    if (!mini || !dragHeader) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    dragHeader.addEventListener("mousedown", (e) => {
      // Don't drag if clicking buttons on header
      if (e.target.closest("button") || e.target.closest(".zf-icon-btn")) return;

      isDragging = true;
      dragHeader.style.cursor = "grabbing";
      const rect = mini.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;

      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newLeft = Math.max(10, Math.min(window.innerWidth - mini.offsetWidth - 10, initialLeft + deltaX));
      let newTop = Math.max(10, Math.min(window.innerHeight - mini.offsetHeight - 10, initialTop + deltaY));

      mini.style.left = `${newLeft}px`;
      mini.style.top = `${newTop}px`;
      mini.style.right = "auto";
      mini.style.bottom = "auto";
    });

    window.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      dragHeader.style.cursor = "grab";

      // Save position to localStorage
      try {
        const rect = mini.getBoundingClientRect();
        localStorage.setItem("zf_mini_window_pos", JSON.stringify({
          top: Math.round(rect.top),
          left: Math.round(rect.left)
        }));
      } catch(e) {}
    });
  }

  // =============================================
  // 3. MINI-WINDOW & GALLERY EVENT HANDLERS
  // =============================================
  function setupMiniWindowEvents(host) {
    const pill = host.querySelector("#zf-pill-btn");
    const mini = host.querySelector("#zf-mini-window");
    const gallery = host.querySelector("#zf-expanded-gallery-overlay");
    const btnMinimize = host.querySelector("#zf-btn-minimize-mini");
    const btnClose = host.querySelector("#zf-btn-close-mini");
    const btnExpand = host.querySelector("#zf-btn-expand-gallery");
    const btnCloseGallery = host.querySelector("#zf-btn-close-gallery");
    const btnSound = host.querySelector("#zf-btn-toggle-sound");
    const btnDownloadAll = host.querySelector("#zf-btn-download-all");
    const btnClearAll = host.querySelector("#zf-btn-clear-all");
    const btnGalleryDlAll = host.querySelector("#zf-btn-gallery-dl-all");
    pill?.addEventListener("click", () => {
      mini.style.display = "flex";
      pill.style.display = "none";
    });

    // Close (✕) -> completely hides window & shows pill
    btnClose?.addEventListener("click", () => {
      mini.style.display = "none";
      pill.style.display = "flex";
    });

    // Expand (⤢) -> opens expanded studio gallery
    btnExpand?.addEventListener("click", () => {
      renderExpandedGallery();
      gallery.style.display = "flex";
    });

    // Close Gallery modal (✕)
    btnCloseGallery?.addEventListener("click", () => {
      gallery.style.display = "none";
    });

    // Collapse caret (^)
    btnCollapse?.addEventListener("click", () => {
      if (taskList.style.display === "none") {
        taskList.style.display = "flex";
        btnCollapse.innerText = "^";
      } else {
        taskList.style.display = "none";
        btnCollapse.innerText = "v";
      }
    });

    const triggerDownloadAll = () => {
      const doneTasks = currentBatchTasks.filter(t => t.status === "done" && t.mediaUrl);
      if (doneTasks.length === 0) {
        alert("No completed generations to download yet.");
        return;
      }
      doneTasks.forEach(t => {
        chrome.runtime.sendMessage({
          action: "TRIGGER_DOWNLOAD",
          payload: { url: t.mediaUrl, prompt: t.prompt, provider: "Google Flow", resolution: "4K" }
        });
      });
    };

    btnDownloadAll?.addEventListener("click", triggerDownloadAll);
    btnGalleryDlAll?.addEventListener("click", triggerDownloadAll);

    // Direct Window Custom Events from content script
    window.addEventListener("ZF_TASK_STARTED", (e) => {
      if (e.detail) onTaskStarted(e.detail);
    });

    window.addEventListener("ZF_PROGRESS_UPDATE", (e) => {
      if (e.detail) onLiveRenderProgress(e.detail);
    });

    window.addEventListener("ZF_MEDIA_READY", (e) => {
      if (e.detail) onTaskCompleted(e.detail);
    });

    // Background runtime messages
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "TASK_STARTED" && msg.task) {
        onTaskStarted(msg.task);
      }
      if (msg.action === "LIVE_RENDER_PROGRESS") {
        onLiveRenderProgress(msg.progress);
      }
      if (msg.action === "MEDIA_GENERATED_NOTIFICATION" && msg.payload) {
        onTaskCompleted(msg.payload);
      }
      if (msg.action === "QUEUE_FINISHED") {
        onQueueFinished();
      }
    });
  }

  let initialMediaSnapshot = new Set();

  // =============================================
  // 4. LIVE PROGRESS & REAL-TIME STOPWATCH TIMER
  // =============================================
  function onTaskStarted(task) {
    const mini = document.getElementById("zf-mini-window");
    const pill = document.getElementById("zf-pill-btn");
    if (mini) mini.style.display = "flex";
    if (pill) pill.style.display = "none";

    // Snapshot existing media so any newly added image/video is instantly identified
    initialMediaSnapshot = new Set(
      Array.from(document.querySelectorAll("img, video")).map(el => el.src).filter(Boolean)
    );

    // If all previous tasks were already done or failed, start fresh batch
    const hasActiveTasks = currentBatchTasks.some(t => t.status === "generating" || t.status === "waiting");
    if (!hasActiveTasks) {
      currentBatchTasks = [];
      batchStartTime = Date.now();
    }

    const modeBadge = document.getElementById("zf-mini-mode-badge");
    if (modeBadge) {
      const isManual = (task.submitMode || "auto") === "manual";
      modeBadge.style.display = isManual ? "inline-block" : "none";
    }

    const statusPill = document.getElementById("zf-badge-status-pill");
    if (statusPill) {
      statusPill.innerText = "Generating";
      statusPill.style.background = "#1e3a8a";
      statusPill.style.color = "#60a5fa";
    }

    const livePct = document.getElementById("zf-live-render-pct");
    if (livePct) livePct.innerText = "1%";

    let existing = currentBatchTasks.find(t => t.id === task.id || t.prompt === task.prompt);
    if (!existing) {
      task.status = "generating";
      task.startTime = Date.now();
      currentBatchTasks.push(task);
    } else {
      existing.status = "generating";
      existing.startTime = Date.now();
    }

    startBatchTimer();
    updateMiniSummary();
    renderTaskList();
    startCanvasObserver();
  }

  function onLiveRenderProgress(progressStr) {
    const livePct = document.getElementById("zf-live-render-pct");
    const liveTime = document.getElementById("zf-live-render-time");
    if (batchStartTime) {
      const elapsed = formatTime(Math.floor((Date.now() - batchStartTime) / 1000));
      if (liveTime) liveTime.innerText = elapsed;
    }
    if (livePct && progressStr) {
      livePct.innerText = progressStr;
    }
  }

  function onTaskCompleted(data) {
    const task = currentBatchTasks.find(t => t.prompt === data.prompt && t.status === "generating") || 
                 currentBatchTasks.find(t => t.status === "generating") ||
                 currentBatchTasks[currentBatchTasks.length - 1];
    
    if (task) {
      task.status = "done";
      task.mediaUrl = data.mediaUrl;
      task.durationSec = Math.max(1, Math.floor((Date.now() - (task.startTime || (Date.now() - 10000))) / 1000));
      
      if (!galleryHistoryTasks.some(g => g.mediaUrl === data.mediaUrl)) {
        galleryHistoryTasks.unshift(task);
        saveTasksState();
      }
    }

    const statusPill = document.getElementById("zf-badge-status-pill");
    const livePct = document.getElementById("zf-live-render-pct");
    if (statusPill) {
      statusPill.innerText = "Done";
      statusPill.style.background = "#064e3b";
      statusPill.style.color = "#34d399";
    }
    if (livePct) livePct.innerText = "100%";

    if (isSoundEnabled) {
      playCompletionTone();
    }

    // Stop timer if all tasks are done
    const anyStillGenerating = currentBatchTasks.some(t => t.status === "generating");
    if (!anyStillGenerating) {
      stopBatchTimer();
    }

    updateMiniSummary();
    renderTaskList();
    renderExpandedGallery();
  }

  // Actively inspects Google Flow's DOM canvas for real percentage and rendered media
  let canvasObserverInterval = null;
  function startCanvasObserver() {
    if (canvasObserverInterval) clearInterval(canvasObserverInterval);
    canvasObserverInterval = setInterval(() => {
      const activeGenTask = currentBatchTasks.find(t => t.status === "generating");
      if (!activeGenTask) {
        clearInterval(canvasObserverInterval);
        return;
      }

      // 1. Scan for real percentage on Google Flow canvas tiles (e.g. 70%)
      const pctNodes = Array.from(document.querySelectorAll('div, span, p, [role="progressbar"], [aria-busy="true"]'))
        .filter(el => !el.closest("#ziggyflow-floating-hud") && el.offsetParent !== null);
      for (const node of pctNodes) {
        const text = node.textContent?.trim() || "";
        const match = text.match(/\b(\d{1,3})%/);
        if (match && Number(match[1]) > 0 && Number(match[1]) <= 100) {
          onLiveRenderProgress(match[0]);
          break;
        }
      }

      // 2. Scan for video elements first
      for (const video of document.querySelectorAll("video")) {
        if (video.src && !video.closest("#ziggyflow-floating-hud")) {
          if (!initialMediaSnapshot.has(video.src) || video.duration > 0 || video.readyState >= 2) {
            console.log("ZiggyFlow: Live observer captured completed video:", video.src);
            onTaskCompleted({
              provider: "Google Flow",
              prompt: activeGenTask.prompt,
              mediaUrl: video.src,
              type: "video"
            });
            clearInterval(canvasObserverInterval);
            return;
          }
        }
      }

      // 3. Scan for completed canvas tile images (including top/newest tiles)
      const allImgs = Array.from(document.querySelectorAll("img")).filter(img => {
        if (!img.src || img.closest("#ziggyflow-floating-hud")) return false;
        const rect = img.getBoundingClientRect();
        if (rect.width < 60 || rect.height < 50) return false;
        const src = img.src.toLowerCase();
        if (src.includes("avatar") || src.includes("profile") || src.includes("icon") || src.includes("logo") || src.includes("placeholder")) return false;
        return true;
      });

      // Prefer newly appeared images (not in initialMediaSnapshot)
      const newlyAppeared = allImgs.find(img => !initialMediaSnapshot.has(img.src) && img.complete);
      if (newlyAppeared && !activeGenTask.mediaUrl) {
        console.log("ZiggyFlow: Live observer captured newly rendered image:", newlyAppeared.src);
        onTaskCompleted({
          provider: "Google Flow",
          prompt: activeGenTask.prompt,
          mediaUrl: newlyAppeared.src,
          type: "image"
        });
        clearInterval(canvasObserverInterval);
        return;
      }

      // Fallback: check all valid completed canvas images
      const validCompleted = allImgs.filter(img => img.complete && (img.naturalWidth > 100 || img.src.startsWith("blob:") || img.src.includes("googleusercontent")));
      if (validCompleted.length > 0) {
        // First/top or last image that is rendered
        const targetImg = validCompleted[0];
        if (targetImg && targetImg.src && !activeGenTask.mediaUrl) {
          // If we have been generating for > 4s, accept the completed tile
          const elapsed = Date.now() - (activeGenTask.startTime || Date.now());
          if (elapsed > 4000) {
            console.log("ZiggyFlow: Live observer captured top canvas image:", targetImg.src);
            onTaskCompleted({
              provider: "Google Flow",
              prompt: activeGenTask.prompt,
              mediaUrl: targetImg.src,
              type: "image"
            });
            clearInterval(canvasObserverInterval);
            return;
          }
        }
      }
    }, 800);
  }

  // Listens to manual on-page submission on Google Flow (Enter key or Submit click)
  function attachManualPageListener() {
    let lastSubmitTime = 0;

    const handleSubmission = (promptText) => {
      const now = Date.now();
      if (now - lastSubmitTime < 2500) return; // debounce duplicate events
      lastSubmitTime = now;

      console.log("ZiggyFlow: On-Page Manual Generation Detected -> Starting live HUD tracking:", promptText);
      onTaskStarted({
        id: "manual_" + now,
        prompt: promptText || "Google Flow Generation",
        provider: "Google Flow",
        submitMode: "manual",
        startTime: now,
        status: "generating"
      });
    };

    // 1. Enter key listener on prompt input
    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const target = e.target;
        if (target && (target.tagName === "TEXTAREA" || target.getAttribute("role") === "textbox" || target.tagName === "INPUT")) {
          const val = (target.value || target.textContent || "").trim();
          if (val.length > 0 && !target.closest("#ziggyflow-floating-hud")) {
            handleSubmission(val);
          }
        }
      }
    }, true);

    // 2. Click listener on Google Flow Generate button
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('button, div[role="button"], a[role="button"]');
      if (btn && !btn.closest("#ziggyflow-floating-hud")) {
        const rect = btn.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.4) {
          const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
          const hasSvg = !!btn.querySelector("svg");
          if (aria.includes("generate") || aria.includes("submit") || aria.includes("send") || hasSvg) {
            const input = document.querySelector('textarea, div[role="textbox"], input[type="text"]');
            const val = input ? (input.value || input.textContent || "").trim() : "";
            if (val.length > 0) {
              handleSubmission(val);
            }
          }
        }
      }
    }, true);
  }

  function onQueueFinished() {
    stopBatchTimer();
    const livePct = document.getElementById("zf-live-render-pct");
    const statusPill = document.getElementById("zf-badge-status-pill");
    if (livePct) livePct.innerText = "100%";
    if (statusPill) {
      statusPill.innerText = "Done";
      statusPill.style.background = "#064e3b";
      statusPill.style.color = "#34d399";
    }
    updateMiniSummary();
    renderTaskList();
    renderExpandedGallery();
  }

  function updateMiniSummary() {
    const total = currentBatchTasks.length;
    const done = currentBatchTasks.filter(t => t.status === "done").length;
    const generating = currentBatchTasks.filter(t => t.status === "generating").length;
    const waiting = currentBatchTasks.filter(t => t.status === "waiting").length;
    const failed = currentBatchTasks.filter(t => t.status === "failed").length;

    const statSent = document.getElementById("zf-stat-sent");
    const statGen = document.getElementById("zf-stat-generating");
    const statWait = document.getElementById("zf-stat-waiting");
    const statDone = document.getElementById("zf-stat-done");
    const statFailed = document.getElementById("zf-stat-failed");

    if (statSent) statSent.innerText = `▶ ${total} sent`;
    if (statGen) statGen.innerText = `${generating} gen`;
    if (statWait) statWait.innerText = `${waiting} wait`;
    if (statDone) statDone.innerText = `${done} done`;
    if (statFailed) statFailed.innerText = `${failed} fail`;

    const headerProg = document.getElementById("zf-mini-header-progress");
    if (headerProg) {
      headerProg.innerText = `${done}/${total} done`;
    }

    const pillStatus = document.getElementById("zf-pill-status");
    if (pillStatus) {
      pillStatus.innerText = `${done}/${total} Done`;
    }
  }

  function renderTaskList() {
    const list = document.getElementById("zf-mini-task-list");
    if (!list) return;

    if (currentBatchTasks.length === 0) {
      list.innerHTML = `<div style="color:#64748b;font-size:11px;text-align:center;padding:10px 0;">✨ Ready. Enter prompt and click Generate.</div>`;
      return;
    }

    list.innerHTML = "";

    currentBatchTasks.forEach((t, idx) => {
      const isDone = t.status === "done";
      const isGen = t.status === "generating";
      const isFail = t.status === "failed";

      const row = document.createElement("div");
      row.style.cssText = `
        background: #18191e;
        border: 1px solid ${isDone ? "#252832" : (isGen ? "#1e3a5f" : (isFail ? "#4d1e24" : "#24262e"))};
        border-radius: 8px;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.15s ease;
      `;

      // 1. Thumbnail Image or Placeholder (38px square)
      const thumb = document.createElement("div");
      thumb.style.cssText = `
        width: 38px;
        height: 38px;
        border-radius: 6px;
        background: #0e0f12;
        border: 1px solid #2d3039;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        cursor: pointer;
        position: relative;
      `;

      if (t.mediaUrl) {
        thumb.innerHTML = `<img src="${t.mediaUrl}" style="width:100%;height:100%;object-fit:cover;" />`;
        thumb.addEventListener("click", () => {
          window.open(t.mediaUrl, "_blank");
        });
      } else if (isGen) {
        thumb.innerHTML = `<span style="font-size:14px;animation:zfSpin 1s linear infinite;">⏳</span>`;
      } else if (isFail) {
        thumb.innerHTML = `<span style="font-size:12px;color:#ef4444;font-weight:700;">✕</span>`;
      } else {
        thumb.innerHTML = `<span style="font-size:11px;color:#64748b;font-weight:700;">#${idx + 1}</span>`;
      }
      row.appendChild(thumb);

      // 2. Prompt Text & Status Details
      const info = document.createElement("div");
      info.style.cssText = `flex:1;overflow:hidden;`;
      const promptText = String(t.prompt || "Untitled Prompt");
      const promptTruncated = promptText.length > 28 ? promptText.substring(0, 28) + "..." : promptText;
      
      let elapsedStr = "00:00";
      if (t.durationSec) {
        elapsedStr = formatTime(t.durationSec);
      } else if (t.startTime) {
        const liveSec = Math.max(0, Math.floor((Date.now() - t.startTime) / 1000));
        elapsedStr = formatTime(liveSec);
      } else if (batchStartTime) {
        const liveSec = Math.max(0, Math.floor((Date.now() - batchStartTime) / 1000));
        elapsedStr = formatTime(liveSec);
      }
      
      const safeTitle = promptText.replace(/"/g, "&quot;");

      info.innerHTML = `
        <div style="font-size:11px;font-weight:600;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${safeTitle}">
          #${idx + 1} ${promptTruncated}
        </div>
        <div style="display:flex;align-items:center;gap:4px;margin-top:2px;">
          <span style="font-size:10px;color:#94a3b8;">${elapsedStr}</span>
          <span style="
            font-size:9.5px;
            font-weight:700;
            padding:1px 5px;
            border-radius:3px;
            background:${isDone ? "#064e3b" : (isGen ? "#1e3a8a" : (isFail ? "#450a0a" : "#27272a"))};
            color:${isDone ? "#34d399" : (isGen ? "#60a5fa" : (isFail ? "#f87171" : "#a1a1aa"))};
          ">${isDone ? "Done" : (isGen ? "Generating" : (isFail ? "Failed" : "Waiting"))}</span>
        </div>
      `;
      row.appendChild(info);

      // 3. Action Buttons (Regenerate, Download, Remove)
      const actions = document.createElement("div");
      actions.style.cssText = `display:flex;align-items:center;gap:4px;flex-shrink:0;`;

      // Regenerate / Retry Button
      const btnRegen = document.createElement("button");
      btnRegen.title = isFail ? "Retry Task" : "Regenerate prompt";
      btnRegen.className = "zf-icon-btn";
      btnRegen.style.padding = "2px 5px";
      btnRegen.innerHTML = "🔄";
      btnRegen.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          action: "ENQUEUE_BATCH",
          payload: { tasks: [{ ...t, id: "regen_" + Date.now(), createdAt: Date.now() }] }
        });
      });
      actions.appendChild(btnRegen);

      // Download Button
      if (isDone && t.mediaUrl) {
        const btnDl = document.createElement("button");
        btnDl.title = "Download 4K";
        btnDl.className = "zf-icon-btn zf-icon-btn-lime";
        btnDl.style.padding = "2px 5px";
        btnDl.innerHTML = "⬇";
        btnDl.addEventListener("click", () => {
          chrome.runtime.sendMessage({
            action: "TRIGGER_DOWNLOAD",
            payload: { url: t.mediaUrl, prompt: t.prompt, provider: "Google Flow", resolution: "4K" }
          });
        });
        actions.appendChild(btnDl);
      }

      // Remove / Delete Item Button
      const btnRemove = document.createElement("button");
      btnRemove.title = "Remove from list";
      btnRemove.className = "zf-icon-btn zf-icon-btn-danger";
      btnRemove.style.padding = "2px 5px";
      btnRemove.innerHTML = "✕";
      btnRemove.addEventListener("click", () => {
        const removeIdx = currentBatchTasks.indexOf(t);
        if (removeIdx !== -1) {
          currentBatchTasks.splice(removeIdx, 1);
        }
        updateMiniSummary();
        renderTaskList();
      });
      actions.appendChild(btnRemove);

      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  // =============================================
  // 5. EXPANDED STUDIO GALLERY RENDERING (⤢)
  // =============================================
  function renderExpandedGallery() {
    const container = document.getElementById("zf-gallery-cards-container");
    if (!container) return;

    const allDoneMap = new Map();
    [...currentBatchTasks, ...galleryHistoryTasks].forEach(t => {
      if (t.status === "done" && t.mediaUrl && !allDoneMap.has(t.mediaUrl)) {
        allDoneMap.set(t.mediaUrl, t);
      }
    });

    const doneTasks = Array.from(allDoneMap.values());

    const galCount = document.getElementById("zf-gallery-total-count");
    if (galCount) galCount.innerText = doneTasks.length;

    if (doneTasks.length === 0) {
      container.innerHTML = `<div style="color:#64748b;font-size:12px;text-align:center;padding:24px 0;">No completed generation results yet. Start generating in TobyFlow!</div>`;
      return;
    }

    container.innerHTML = "";

    doneTasks.forEach((t, idx) => {
      const card = document.createElement("div");
      card.style.cssText = `
        background: #18191e;
        border: 1px solid #282a32;
        border-radius: 12px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      `;

      card.innerHTML = `
        <div style="position:relative;width:100%;height:190px;border-radius:8px;overflow:hidden;background:#0c0d10;border:1px solid #24262d;">
          <img src="${t.mediaUrl}" style="width:100%;height:100%;object-fit:cover;" />
          <div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.75);color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:3px;border:1px solid rgba(255,255,255,0.1);">#${idx + 1}</div>
        </div>

        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
          <span class="zf-meta-tag">${t.type === "video" ? "Video" : "Image"}</span>
          <span class="zf-meta-tag" style="color:#a3e635;">${t.model || "Nano Banana Pro"}</span>
          <span class="zf-meta-tag" style="color:#38bdf8;">${t.aspectRatio || "4:3"}</span>
          <span class="zf-meta-tag">x${t.quantity || 2}</span>
        </div>

        <div style="background:#0f1013;border:1px solid #202227;border-radius:5px;padding:6px 8px;font-size:11px;color:#cbd5e1;line-height:1.35;max-height:65px;overflow-y:auto;white-space:pre-wrap;">
          ${t.prompt}
        </div>

        <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
          <button class="zf-card-btn-view zf-icon-btn" title="View Fullscreen">👁</button>
          <button class="zf-card-btn-regen" style="
            background: #23252b;
            border: 1px solid #33363f;
            color: #ffffff;
            border-radius: 5px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>🔄</span> Regenerate
          </button>
          <button class="zf-card-btn-dl zf-icon-btn zf-icon-btn-lime" style="padding: 4px 8px;" title="Download 4K">
            ⬇
          </button>
          <button class="zf-card-btn-del zf-icon-btn zf-icon-btn-danger" style="padding: 4px 8px;" title="Delete from Gallery">
            🗑
          </button>
        </div>
      `;

      card.querySelector(".zf-card-btn-view")?.addEventListener("click", () => {
        window.open(t.mediaUrl, "_blank");
      });

      card.querySelector(".zf-card-btn-regen")?.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          action: "ENQUEUE_BATCH",
          payload: { tasks: [{ ...t, id: "regen_" + Date.now(), createdAt: Date.now() }] }
        });
      });

      card.querySelector(".zf-card-btn-dl")?.addEventListener("click", () => {
        chrome.runtime.sendMessage({
          action: "TRIGGER_DOWNLOAD",
          payload: { url: t.mediaUrl, prompt: t.prompt, provider: "Google Flow", resolution: "4K" }
        });
      });

      card.querySelector(".zf-card-btn-del")?.addEventListener("click", () => {
        galleryHistoryTasks = galleryHistoryTasks.filter(g => g.mediaUrl !== t.mediaUrl);
        saveTasksState();
        renderExpandedGallery();
      });

      container.appendChild(card);
    });
  }

  function saveTasksState() {
    chrome.storage.local.set({ recentGeneratedTasks: galleryHistoryTasks.slice(-30) });
  }

  function startBatchTimer() {
    if (batchTimerInterval) clearInterval(batchTimerInterval);
    batchTimerInterval = setInterval(() => {
      if (batchStartTime) {
        const elapsed = formatTime(Math.floor((Date.now() - batchStartTime) / 1000));
        const liveTime = document.getElementById("zf-live-render-time");
        if (liveTime) liveTime.innerText = elapsed;
      }
      updateMiniSummary();
      renderTaskList();
    }, 1000);
  }

  function stopBatchTimer() {
    if (batchTimerInterval) clearInterval(batchTimerInterval);
  }

  function formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  function playCompletionTone() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch(e) {}
  }

  // Direct hooks on window
  window.__zf_onTaskStarted = onTaskStarted;
  window.__zf_onProgress = onLiveRenderProgress;
  window.__zf_onTaskCompleted = onTaskCompleted;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOverlay);
  } else {
    initOverlay();
  }

  // Ensure mini HUD remains attached across Google Flow SPA route changes
  setInterval(() => {
    if (!document.getElementById("ziggyflow-floating-hud") && document.body) {
      initOverlay();
    }
  }, 2500);
})();


