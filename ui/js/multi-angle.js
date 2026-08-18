/**
 * ZiggyFlow Multi-Angle Camera (Angles)
 * 3D Orbit camera visualizer, camera lens modifiers, and 8-angle batch turnaround generator.
 */

window.MultiAngleCamera = {
  yaw: 45,
  pitch: 15,
  distance: 50,
  fov: "35mm",
  canvas: null,
  ctx: null,

  presets: [
    { name: "Eye Level Front", yaw: 0, pitch: 0, modifier: "straight eye-level front camera angle, direct frontal view, symmetrical composition" },
    { name: "3/4 Isometric Perspective", yaw: 45, pitch: 25, modifier: "three-quarter isometric perspective angle, high depth of field, 45-degree angled view" },
    { name: "Low Angle Hero Shot", yaw: 0, pitch: -35, modifier: "dramatic low angle hero shot looking up, imposing and towering perspective, worm's eye view" },
    { name: "Bird's Eye Top-Down", yaw: 0, pitch: 85, modifier: "straight top-down bird's eye view, overhead aerial camera angle, 90-degree downward angle" },
    { name: "Dutch Angle (Tilted)", yaw: 20, pitch: 10, modifier: "dynamic dutch angle, tilted camera roll 15 degrees, cinematic tension framing" },
    { name: "Extreme Close-Up Macro", yaw: 0, pitch: 0, modifier: "extreme close-up macro portrait, hyper-detailed facial focus, razor-thin depth of field" },
    { name: "Over-the-Shoulder", yaw: 160, pitch: 5, modifier: "cinematic over-the-shoulder perspective, foreground shoulder framing, atmospheric focus" },
    { name: "Wide Panoramic", yaw: 0, pitch: 0, modifier: "ultra-wide cinematic panoramic framing, sweeping expansive field of view, 16mm lens" }
  ],

  init: function() {
    this.canvas = document.getElementById("angle-compass-canvas");
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.draw3DCompass();
    }
    this.setupEvents();
  },

  setupEvents: function() {
    const yawSlider = document.getElementById("angle-slider-yaw");
    const pitchSlider = document.getElementById("angle-slider-pitch");

    yawSlider?.addEventListener("input", (e) => {
      this.yaw = parseInt(e.target.value, 10);
      const valEl = document.getElementById("angle-val-yaw");
      if (valEl) valEl.innerText = `${this.yaw}°`;
      this.draw3DCompass();
    });

    pitchSlider?.addEventListener("input", (e) => {
      this.pitch = parseInt(e.target.value, 10);
      const valEl = document.getElementById("angle-val-pitch");
      if (valEl) valEl.innerText = `${this.pitch}°`;
      this.draw3DCompass();
    });

    document.getElementById("angle-btn-generate-batch")?.addEventListener("click", () => this.generate8AngleTurnaround());
  },

  draw3DCompass: function() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Orbit grid rings
    ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 65, 30, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Subject Box in center
    ctx.strokeStyle = "#a3e635";
    ctx.fillStyle = "rgba(163, 230, 53, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(cx - 18, cy - 22, 36, 44);
    ctx.fill();
    ctx.stroke();

    // Camera ray vector
    const radYaw = (this.yaw * Math.PI) / 180;
    const camX = cx + Math.sin(radYaw) * 60;
    const camY = cy - (this.pitch * 0.35) + Math.cos(radYaw) * 26;

    // Line from subject to camera
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(camX, camY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Camera Icon dot
    ctx.fillStyle = "#facc15";
    ctx.shadowColor = "#facc15";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(camX, camY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Angle text badge
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`CAM (${this.yaw}°, ${this.pitch}°)`, camX, camY - 10);
  },

  generate8AngleTurnaround: function() {
    const promptInput = document.getElementById("gen-prompt-input");
    const subject = promptInput?.value.trim() || "Cyberpunk hero operative in high-tech carbon armor";
    
    const angles = [
      { name: "Front View", mod: "straight front view, eye-level angle, 0-degree angle" },
      { name: "Front 3/4 Right", mod: "front three-quarter right perspective, 45-degree angle" },
      { name: "Right Profile", mod: "direct right side profile view, 90-degree angle" },
      { name: "Back 3/4 Right", mod: "back three-quarter right perspective, 135-degree angle" },
      { name: "Back View", mod: "straight back view, from behind camera angle, 180-degree angle" },
      { name: "Back 3/4 Left", mod: "back three-quarter left perspective, 225-degree angle" },
      { name: "Left Profile", mod: "direct left side profile view, 270-degree angle" },
      { name: "Top Down View", mod: "top-down overhead camera angle, bird's eye view" }
    ];

    const generatedPrompts = angles.map(a => `${subject}, ${a.mod}, 8k cinematic studio lighting, full subject turnaround series`);
    
    if (promptInput) {
      promptInput.value = generatedPrompts.join("\n");
      if (window.FlowConnector) window.FlowConnector.updatePromptCount();
    }

    // Switch to Gen tab
    document.querySelector('[data-tab="gen"]')?.click();
    window.AutoFlow.showToast("🚀 Generated 8-Angle Turnaround prompts & sent to Prompt Box!", "success");
  }
};
