const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Testing ZiggyFlow Chrome Extension files...');

// 1. Check JSON files
const jsonFiles = ['manifest.json', 'assets/demo-presets.json'];
jsonFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  JSON.parse(content);
  console.log(`[PASS] JSON: ${file}`);
});

// 2. Check JS files
const jsFiles = [
  'background/background.js',
  'background/download-manager.js',
  'background/telegram-bot.js',
  'content/google-flow.js',
  'content/chatgpt.js',
  'content/grok.js',
  'content/screen-capture.js',
  'content/injected-overlay.js',
  'ui/js/bulk-downloader.js',
  'ui/js/flow-connector.js',
  'ui/js/app.js',
  'ui/js/workflow-builder.js',
  'ui/js/batch-generator.js',
  'ui/js/smart-tasks.js',
  'ui/js/prompt-templates.js',
  'ui/js/album-manager.js',
  'ui/js/multi-angle.js',
  'ui/js/image-effects.js',
  'ui/js/prompt-enhancer.js',
  'ui/js/telegram-settings.js',
  'ui/js/diagnostics.js',
  'ui/js/settings.js'
];

jsFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  execSync(`node -c "${fullPath}"`);
  console.log(`[PASS] Syntax JS: ${file}`);
});

// 3. Check Icons
const iconFiles = ['icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png'];
iconFiles.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
    console.log(`[PASS] Icon Exists: ${file} (${fs.statSync(fullPath).size} bytes)`);
  } else {
    throw new Error(`Missing icon: ${file}`);
  }
});

console.log('\n🌟 ALL 28 ZIGGYFLOW EXTENSION FILES VERIFIED PERFECTLY! 🌟');
