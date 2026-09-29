// 由 js/icons-data.js 生成 assets/sprite.svg，保证内联数据与外部文件内容一致。
import { writeFileSync, mkdirSync } from 'node:fs';
import { ICONS, VIEW_BOX } from '../js/icons-data.js';

const symbols = ICONS
  .filter((i) => i.body)
  .map((i) => `  <symbol id="${i.id}" viewBox="${VIEW_BOX}">${i.body}</symbol>`)
  .join('\n');

// __probe__ 用于外部引用支持性探测。
const probe = `  <symbol id="__probe__" viewBox="${VIEW_BOX}"><rect width="24" height="24"/></symbol>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols}\n${probe}\n</svg>\n`;

mkdirSync(new URL('../assets/', import.meta.url), { recursive: true });
writeFileSync(new URL('../assets/sprite.svg', import.meta.url), svg);
console.log('assets/sprite.svg written,', ICONS.filter((i) => i.body).length, 'symbols');
