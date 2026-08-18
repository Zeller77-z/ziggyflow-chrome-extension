/**
 * AutoFlow AI Prompt Enhancer
 * Upgrades simple ideas into rich, production-grade prompts using
 * intelligent expansion heuristics and optional external LLM APIs (OpenAI, Gemini, Grok).
 */

window.PromptEnhancer = {
  styles: {
    cinematic: {
      name: "Cinematic Movie",
      prefix: "Cinematic film still, 35mm photography,",
      suffix: "anamorphic lens flare, Arri Alexa Mini, volumetric lighting, atmospheric haze, color graded, photorealistic 8k, masterpiece --ar 16:9",
      expansions: ["dramatic rim lighting", "shallow depth of field", "cinematic composition", "subtle film grain", "hyper-detailed textures"]
    },
    photorealistic: {
      name: "Ultra-Photorealistic",
      prefix: "Award-winning National Geographic photograph of",
      suffix: "shot on Sony A1 with 85mm f/1.2 GM lens, razor-sharp focus, subsurface scattering, authentic natural skin and fabric textures, raw 8k --ar 4:5",
      expansions: ["natural golden hour illumination", "extreme micro-detail", "crisp specular highlights", "uncompressed raw format"]
    },
    anime: {
      name: "Studio Ghibli Anime",
      prefix: "Hand-drawn animation background in the style of Hayao Miyazaki,",
      suffix: "vibrant lush meadows, painterly clouds, whimsical magical atmosphere, watercolor wash, Makoto Shinkai lighting, masterpiece --ar 16:9",
      expansions: ["ethereal glowing particles", "vivid cerulean and emerald palette", "nostalgic emotional feeling"]
    },
    dark_fantasy: {
      name: "Dark Fantasy Epic",
      prefix: "Eldritch dark fantasy illustration of",
      suffix: "intricate gothic architecture, glowing occult runes, eerie volumetric mist, Bloodborne and Elden Ring aesthetic, chiaroscuro lighting, masterpiece --ar 16:9",
      expansions: ["weathered armor textures", "swirling dark ether", "menacing moonlit shadows"]
    },
    scifi: {
      name: "Sci-Fi Cyberpunk",
      prefix: "Futuristic dystopian concept art of",
      suffix: "dense neo-Tokyo metropolis, neon magenta and cyan reflections on rain-slicked asphalt, holographic billboards, Unreal Engine 5 render, Octane 8k --ar 21:9",
      expansions: ["volumetric steam rising from vents", "cybernetic mechanical details", "glowing LED conduits"]
    }
  },

  init: function() {
    this.setupEvents();
  },

  setupEvents: function() {
    document.getElementById("enhancer-btn-run")?.addEventListener("click", () => this.enhancePrompt());
    document.getElementById("enhancer-btn-copy")?.addEventListener("click", () => {
      const output = document.getElementById("enhancer-output")?.value;
      if (output) {
        navigator.clipboard.writeText(output);
        window.AutoFlow.showToast("📋 Copied enhanced prompt!", "success");
      }
    });
    document.getElementById("enhancer-btn-send-batch")?.addEventListener("click", () => {
      const output = document.getElementById("enhancer-output")?.value;
      if (output) {
        const batchTextarea = document.getElementById("batch-raw-prompts");
        if (batchTextarea) {
          batchTextarea.value = (batchTextarea.value ? batchTextarea.value + "\n" : "") + output;
        }
        window.AutoFlow.showToast("➕ Sent to Batch Generator!", "success");
      }
    });
  },

  async enhancePrompt() {
    const input = document.getElementById("enhancer-input")?.value.trim();
    if (!input) {
      window.AutoFlow.showToast("⚠️ Enter an initial prompt to enhance.", "error");
      return;
    }

    const styleKey = document.getElementById("enhancer-style-select")?.value || "cinematic";
    const styleObj = this.styles[styleKey] || this.styles.cinematic;

    // Check if API key is set for OpenAI / Gemini
    const data = await chrome.storage.local.get(['apiSettings']);
    const apiSettings = data.apiSettings || {};

    let enhancedResult = "";

    if (apiSettings.openaiApiKey) {
      enhancedResult = await this.callOpenAIEnhance(input, styleObj.name, apiSettings.openaiApiKey);
    } else if (apiSettings.geminiApiKey) {
      enhancedResult = await this.callGeminiEnhance(input, styleObj.name, apiSettings.geminiApiKey);
    } else {
      // Use built-in intelligent heuristic expansion
      enhancedResult = this.heuristicEnhance(input, styleObj);
    }

    const outputEl = document.getElementById("enhancer-output");
    if (outputEl) {
      outputEl.value = enhancedResult;
      window.AutoFlow.showToast("✨ Prompt enhanced with " + styleObj.name + " style!", "success");
    }
  },

  heuristicEnhance: function(input, style) {
    const randomExpansions = style.expansions.sort(() => 0.5 - Math.random()).slice(0, 3).join(", ");
    return `${style.prefix} ${input}, ${randomExpansions}, ${style.suffix}`;
  },

  async callOpenAIEnhance(prompt, style, apiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are an expert AI prompt engineer for Google Flow, Veo 3.1, and Midjourney. Upgrade the user prompt into a rich, detailed, visually stunning prompt in ${style} style. Return ONLY the final prompt text, no chat or quotes.`
            },
            { role: "user", content: prompt }
          ]
        })
      });
      const data = await res.json();
      return data.choices[0].message.content.trim();
    } catch (e) {
      console.warn("OpenAI API enhance error, using fallback:", e);
      return this.heuristicEnhance(prompt, this.styles.cinematic);
    }
  },

  async callGeminiEnhance(prompt, style, apiKey) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Upgrade this simple AI generation prompt into an ultra-detailed, photorealistic ${style} prompt for Google Flow / Veo 3.1 / Grok: "${prompt}". Return ONLY the upgraded prompt.`
            }]
          }]
        })
      });
      const data = await res.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (e) {
      return this.heuristicEnhance(prompt, this.styles.cinematic);
    }
  }
};
