/**
 * AutoFlow Smart Tasks & Project Groups
 * Create, organize, and batch-execute reusable tasks across projects.
 */

window.SmartTasks = {
  projects: [],

  init: async function() {
    await this.loadProjects();
    this.setupEvents();
    this.renderProjectsList();
  },

  setupEvents: function() {
    document.getElementById("task-btn-new-project")?.addEventListener("click", () => this.createNewProject());
    document.getElementById("task-btn-new-task")?.addEventListener("click", () => this.createNewTask());
    document.getElementById("task-btn-run-all")?.addEventListener("click", () => this.runAllSmartTasks());
  },

  async loadProjects() {
    const data = await chrome.storage.local.get(['smartProjects']);
    this.projects = data.smartProjects || [
      {
        id: "proj_default",
        name: "Sci-Fi Cinematic Series",
        tasks: [
          {
            id: "task_1",
            title: "Cyberpunk Alley Concept",
            provider: "chatgpt",
            prompt: "Cinematic establishing shot of cyberpunk neon alley with volumetric steam and reflections",
            type: "image",
            aspectRatio: "16:9",
            subfolder: "Concepts"
          },
          {
            id: "task_2",
            title: "Veo 3.1 Flying Drone Scene",
            provider: "flow",
            model: "Veo 3.1 Quality",
            prompt: "Camera fly-through of glowing futuristic megalopolis with flying spinners",
            type: "video",
            aspectRatio: "16:9",
            subfolder: "Videos"
          }
        ]
      }
    ];
  },

  async saveProjects() {
    await chrome.storage.local.set({ smartProjects: this.projects });
    this.renderProjectsList();
  },

  renderProjectsList: function() {
    const container = document.getElementById("smart-tasks-container");
    if (!container) return;

    if (this.projects.length === 0) {
      container.innerHTML = `<div style="text-align:center;color:#64748b;padding:32px;">No projects created yet. Click "+ New Project" above.</div>`;
      return;
    }

    container.innerHTML = this.projects.map(proj => {
      const taskCards = (proj.tasks || []).map(task => `
        <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:600;font-size:14px;color:#fff;display:flex;align-items:center;gap:8px;">
              <span>${task.title}</span>
              <span class="badge badge-${task.provider}">${task.provider}</span>
              <span class="badge" style="background:#334155;color:#cbd5e1;">${task.type}</span>
            </div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHTML(task.prompt)}
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">
              Subfolder: <code>${task.subfolder || "Default"}</code> • Ratio: ${task.aspectRatio || "16:9"}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-primary" onclick="window.SmartTasks.runSingleTask('${proj.id}', '${task.id}')">⚡ Run</button>
            <button class="btn btn-sm btn-secondary" onclick="window.SmartTasks.deleteTask('${proj.id}', '${task.id}')">Delete</button>
          </div>
        </div>
      `).join("");

      return `
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header">
            <div class="card-title">
              <span>📁 ${proj.name}</span>
              <span style="font-size:12px;color:#94a3b8;font-weight:normal;">(${proj.tasks.length} tasks)</span>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-sm btn-success" onclick="window.SmartTasks.runProject('${proj.id}')">▶ Run Project</button>
              <button class="btn btn-sm btn-secondary" onclick="window.SmartTasks.deleteProject('${proj.id}')">Delete</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${taskCards || `<div style="font-size:12px;color:#64748b;padding:8px;">No tasks in this project yet.</div>`}
          </div>
        </div>
      `;
    }).join("");
  },

  createNewProject: async function() {
    const name = prompt("Enter project name:", "New Project");
    if (!name) return;

    this.projects.push({
      id: "proj_" + Date.now(),
      name,
      tasks: []
    });
    await this.saveProjects();
    window.AutoFlow.showToast(`✅ Created project "${name}"!`, "success");
  },

  createNewTask: async function() {
    if (this.projects.length === 0) {
      alert("Please create a project first.");
      return;
    }

    const title = prompt("Task Title:", "Character Generation");
    if (!title) return;
    const promptText = prompt("Prompt:", "Cinematic portrait of cybernetic warrior in rain");
    if (!promptText) return;

    this.projects[0].tasks.push({
      id: "task_" + Date.now(),
      title,
      prompt: promptText,
      provider: "flow",
      type: "video",
      aspectRatio: "16:9",
      subfolder: "Main_Renders"
    });

    await this.saveProjects();
    window.AutoFlow.showToast("✅ Added new smart task!", "success");
  },

  runSingleTask: function(projId, taskId) {
    const proj = this.projects.find(p => p.id === projId);
    if (!proj) return;
    const task = proj.tasks.find(t => t.id === taskId);
    if (!task) return;

    chrome.runtime.sendMessage({
      action: "ENQUEUE_BATCH",
      payload: {
        tasks: [{
          id: "task_exec_" + Date.now(),
          provider: task.provider,
          prompt: task.prompt,
          type: task.type,
          model: task.model,
          aspectRatio: task.aspectRatio || "16:9",
          project: `${proj.name}/${task.subfolder || "Default"}`
        }]
      }
    }, () => {
      window.AutoFlow.showToast(`🚀 Dispatched task "${task.title}" to background!`, "success");
    });
  },

  runProject: function(projId) {
    const proj = this.projects.find(p => p.id === projId);
    if (!proj || !proj.tasks.length) return;

    const taskPayloads = proj.tasks.map(t => ({
      id: "task_exec_" + t.id + "_" + Date.now(),
      provider: t.provider,
      prompt: t.prompt,
      type: t.type,
      model: t.model,
      aspectRatio: t.aspectRatio || "16:9",
      project: `${proj.name}/${t.subfolder || "Default"}`
    }));

    chrome.runtime.sendMessage({
      action: "ENQUEUE_BATCH",
      payload: { tasks: taskPayloads }
    }, () => {
      window.AutoFlow.showToast(`🚀 Queued all ${taskPayloads.length} tasks in project "${proj.name}"!`, "success");
    });
  },

  runAllSmartTasks: function() {
    let allTasks = [];
    this.projects.forEach(p => {
      p.tasks.forEach(t => {
        allTasks.push({
          id: "task_exec_" + t.id + "_" + Date.now(),
          provider: t.provider,
          prompt: t.prompt,
          type: t.type,
          model: t.model,
          aspectRatio: t.aspectRatio || "16:9",
          project: `${p.name}/${t.subfolder || "Default"}`
        });
      });
    });

    if (allTasks.length === 0) {
      window.AutoFlow.showToast("⚠️ No tasks available to run.", "error");
      return;
    }

    chrome.runtime.sendMessage({
      action: "ENQUEUE_BATCH",
      payload: { tasks: allTasks }
    }, () => {
      window.AutoFlow.showToast(`🚀 Dispatched ${allTasks.length} tasks across all projects!`, "success");
    });
  },

  deleteTask: async function(projId, taskId) {
    const proj = this.projects.find(p => p.id === projId);
    if (proj) {
      proj.tasks = proj.tasks.filter(t => t.id !== taskId);
      await this.saveProjects();
    }
  },

  deleteProject: async function(projId) {
    if (confirm("Delete this project and all its tasks?")) {
      this.projects = this.projects.filter(p => p.id !== projId);
      await this.saveProjects();
    }
  }
};
