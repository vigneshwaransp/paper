import fs from 'fs';
import path from 'path';

const filesToCopy = [
  'index.html',
  'settings.html',
  'chat.html',
  'style.css',
  'common.js',
  'app.js',
  'settings.js',
  'chat.js',
  'favicon.png'
];

const destDir = 'public';

// Ensure public directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy static assets
filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(destDir, file));
    console.log(`Copied ${file} to public/`);
  } else {
    console.warn(`Warning: File ${file} not found.`);
  }
});

// Generate public/config.js from environment variables
const apiKey = process.env.FRIDAY_API_KEY || '';
const nvidiaApiKey = process.env.FRIDAY_NVIDIA_API_KEY || '';
const dbKey = process.env.FRIDAY_DB_KEY || '';
const mistralApiKey = process.env.FRIDAY_MISTRAL_API_KEY || '';

const configContent = `window.FRIDAY_API_KEY = "${apiKey}";
window.FRIDAY_NVIDIA_API_KEY = "${nvidiaApiKey}";
window.FRIDAY_DB_KEY = "${dbKey}";
window.FRIDAY_MISTRAL_API_KEY = "${mistralApiKey}";
`;

fs.writeFileSync(path.join(destDir, 'config.js'), configContent);
console.log('Successfully generated public/config.js');
console.log('Build completed successfully!');
