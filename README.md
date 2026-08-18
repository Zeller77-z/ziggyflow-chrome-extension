# ⚡ AutoFlow Pro — Multi-AI Image & Video Studio

> **Automate Google Flow (Veo 3.1 & Nano Banana), ChatGPT (GPT Image 2), and Grok (Imagine & Aurora) for AI image/video generation.**
> Batch prompts, visual drag-and-drop workflows, 3D multi-angle camera controls, 28+ image effects, screen snip reference albums with `@mention` syntax, Telegram bot remote control, and automated 2K/4K downloads.

---

## 🌟 Key Features

### ♻️ 1. Visual Workflow Builder (Multi-AI Pipelines)
- **Node-Based Canvas**: Drag-and-drop nodes with smooth bezier connection wires, infinite pan & zoom, and status indicators.
- **Cross-Provider Chaining**: Connect ChatGPT, Google Flow, and Grok in a unified pipeline (e.g. Generate a concept image with ChatGPT -> Enhance prompt with AI -> Pass as reference image to Google Flow for Veo 3.1 4K video -> Animate in Grok).
- **Export, Import & Share**: 1-click export to JSON, import from file, and generate Base64 shareable workflow links.

### 🧩 2. Batch Prompt Generation
- **Multi-Line & File Import**: Submit hundreds of prompts sequentially or in parallel. Import `.txt` or `.csv` files.
- **`@mention` Reference Images**: Type `@character_01` or `@cyberpunk_girl` directly into prompts to automatically inject reference images from your stored albums.
- **Smart Queue & Auto-Retry**: Concurrency controls, adjustable delay intervals, exponential backoff retries, and live queue status tracker.

### ⌛ 3. Smart Tasks & Project Suites
- **Reusable Task Groups**: Save prompt configurations, model settings, and custom target subfolders into organized project groups.
- **1-Click Suite Execution**: Run entire project batches in sequential or parallel modes.

### 🔎 4. Curated Prompt Library (100+ Templates)
- **Categorized Catalogs**: Cinematic, Sci-Fi/Cyberpunk, Photorealism, Studio Ghibli Anime, Dark Fantasy/Mythology, Architecture, Product Photography, 3D CGI, Logo Design.
- **Dynamic Variable Placeholders**: Auto-fill `{subject}`, `{lighting}`, `{style}`, `{camera}` placeholders with 1-click apply.
- **Personal Library**: Create and tag your own custom prompt templates.

### 🖼️ 5. Albums & Reference Asset Management
- **Organized Folders**: Categorize reference images by project, character, environment, or style.
- **Local Privacy**: All reference assets are saved securely in your browser's local storage and IndexedDB.

### 📸 6. Interactive Webpage Screen Snip Tool
- **Snip Reference from Any Webpage**: Crop references from Pinterest, Behance, Artstation, or Google Images with an interactive crosshair selection box.
- **Custom Tagging**: Directly assigns `@tag` names to snipped images and saves them into target albums.

### 🎥 7. 3D Multi-Angle Camera (Angles)
- **Interactive 3D Orbit Compass**: Adjust Azimuth/Yaw (0-360°), Elevation/Pitch (-90° to +90°), and distance with real-time vector visualization.
- **Camera & Lens Modifiers**: 35mm prime, 85mm f/1.2 portrait bokeh, 16mm ultra-wide, 200mm telephoto compression, and Panavision anamorphic lens flares.
- **8-Angle Turnaround Generator**: 1-click generate complete 8-perspective character turnaround prompt batches.

### 📸 8. Image Effects Engine (28+ FX across 5 Categories)
- **5 FX Categories**:
  - **Color**: Cyberpunk Neon, Vintage 90s, Pastel Dream, Warm Golden Hour, Monochromatic Noir, Muted Earthy, Bleach Bypass, Technicolor.
  - **Light**: Volumetric God Rays, Studio Softbox, Dramatic Rim Light, Bioluminescent Glow, Anamorphic Lens Flare, Cyber Neon, Moonlight Shadow.
  - **Weather**: Rainy Cyberpunk, Dense Atmospheric Fog, Blizzard Snowstorm, Lightning Storm, Sunburst Flares, Desert Duststorm.
  - **Artistic**: Studio Ghibli, Impasto Oil Painting, Watercolor Splatter, Unreal Engine 5 Render, Claymation, Comic Book Ink.
  - **Texture**: 35mm Film Grain, Halftone Print, Glitch VHS Tape, Holographic Sheen, Matte Charcoal.
- **Dynamic Intensity Slider (10% - 100%)**: Dynamically adjusts token weighting and modifier strength.

### 🤖 9. AI Prompt Enhancer
- **Creative Styles**: Cinematic Movie, Ultra-Photorealistic 8K, Studio Ghibli Anime, Dark Fantasy Epic, Sci-Fi Cyberpunk.
- **Dual Engines**: Built-in intelligent heuristic engine (instant, offline) + external LLM API support (OpenAI GPT-4o, Google Gemini Flash, Grok).

### ⬇️ 10. Automated 2K/4K Downloads & Organization
- **Custom Filename Templates**: `[Date]_[Project]_[Provider]_[Prompt]_[Index].[ext]`.
- **Organized Subfolders**: Automatically routes downloaded files into project folders (`AutoFlow/<Project>/<Subfolder>`).
- **Resolution Handling**: Supports 1K, 2K, 4K for images and 720p, 1080p, 4K for videos.

### 💬 11. Telegram Bot Remote Controller
- **Remote Commands**:
  - `/image <prompt>` — Generates image and sends photo directly to Telegram chat.
  - `/video <prompt>` — Generates Veo 3.1 or Aurora video and sends MP4 back.
  - `/workflow <name>` — Runs saved visual workflow pipeline.
  - `/status` — Checks queue and provider status.
  - `/stop` — Aborts running jobs.

---

## 🚀 How to Install & Load in Google Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked**.
5. Select the `autoflow-chrome-extension` folder:
   ```
   C:\Users\ZIG ZAG\.gemini\antigravity\scratch\autoflow-chrome-extension
   ```
6. Click the AutoFlow puzzle piece icon in Chrome toolbar and pin it.
7. Click the extension icon to launch the **AutoFlow Quick Launcher**, open the **Chrome Side Panel**, or open the **Full Studio Workspace**.

---

## 🛠️ Supported AI Platforms

| Platform | URL | Supported Capabilities |
| :--- | :--- | :--- |
| **Google Flow** | `https://labs.google/fx` | Veo 3.1 (Lite, Fast, Quality), Nano Banana Pro, Nano Banana 2, Video-to-Video, Image-to-Video |
| **ChatGPT** | `https://chatgpt.com` | GPT Image 2, DALL-E 3, Image drop reference |
| **Grok** | `https://grok.com` | Grok Imagine (Images), Aurora (Video Generation) |

---

## 🔒 Privacy & Security

- **100% Client-Side**: All prompts, workflows, and reference images are stored locally on your device via Chrome Local Storage & IndexedDB.
- **Zero Third-Party Image Uploads**: No image data is transmitted to external servers except direct API communication configured by you.
