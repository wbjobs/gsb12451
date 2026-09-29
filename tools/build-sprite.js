/* 由 js/icons-data.js 生成 assets/sprite.svg，保证两处内容一致。 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js', 'icons-data.js'), 'utf8');
const { ICONS } = new Function(`${src}; return { ICONS };`)();

const symbols = ICONS.map((icon) =>
  `  <symbol id="i-${icon.id}" viewBox="${icon.viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon.content}</symbol>`
).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols}\n</svg>\n`;
fs.writeFileSync(path.join(root, 'assets', 'sprite.svg'), svg);
console.log(`sprite.svg generated: ${ICONS.length} symbols`);
