// 三种图标来源的加载：
//  - inline   ：直接使用 JS 内嵌数据
//  - sprite   ：Fetch 拉取 sprite.svg → Web Worker 解析 → 注入文档隐藏 <svg>
//  - external ：不注入文档，渲染时直接 <use href="sprite.svg#id">
// sprite 文本与解析结果会缓存进 IndexedDB，供加载失败时兜底。
import { dbGet, dbSet } from './db.js';
import { buildInlineSymbols } from './icons-data.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const SPRITE_URL = 'assets/sprite.svg';

let worker = null;
function getWorker() {
  if (!worker) worker = new Worker('js/worker.js');
  return worker;
}

export function parseSpriteInWorker(spriteText) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const onMessage = (e) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      if (e.data.ok) resolve(e.data);
      else reject(new Error(e.data.error));
    };
    const onError = (err) => {
      w.removeEventListener('message', onMessage);
      w.removeEventListener('error', onError);
      reject(new Error('Worker 解析失败'));
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    w.postMessage({ spriteText });
  });
}

// 把 symbols 注入文档（隐藏 svg），供 <use href="#id"> 引用。
export function injectSprite(symbols, containerId) {
  document.getElementById(containerId)?.remove();
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = containerId;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;');
  for (const [id, sym] of symbols) {
    const el = document.createElementNS(SVG_NS, 'symbol');
    el.setAttribute('id', id);
    el.setAttribute('viewBox', sym.viewBox);
    el.innerHTML = sym.inner;
    svg.appendChild(el);
  }
  document.body.prepend(svg);
  return svg;
}

// 来源一：内联数据
export function loadInlineSource() {
  const started = performance.now();
  const symbols = buildInlineSymbols();
  return { symbols, loadMs: performance.now() - started, from: 'inline' };
}

// 来源二：sprite 文件（fetch + worker 解析 + 注入）。simulateFailure 用于演示降级。
export async function loadSpriteSource({ simulateFailure = false } = {}) {
  const started = performance.now();
  let spriteText;
  let fromCache = false;

  if (simulateFailure) {
    // 模拟网络失败：先尝试 IndexedDB 缓存兜底
    const cached = await dbGet('cache', 'spriteText');
    if (cached) {
      spriteText = cached;
      fromCache = true;
    } else {
      throw new Error('sprite 加载失败（模拟），且无 IndexedDB 缓存可兜底');
    }
  } else {
    try {
      const resp = await fetch(SPRITE_URL, { cache: 'no-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      spriteText = await resp.text();
      await dbSet('cache', 'spriteText', spriteText);
    } catch (err) {
      const cached = await dbGet('cache', 'spriteText');
      if (cached) {
        spriteText = cached;
        fromCache = true;
      } else {
        throw new Error(`sprite 加载失败: ${err.message}`);
      }
    }
  }

  const parsed = await parseSpriteInWorker(spriteText);
  const symbols = new Map(Object.entries(parsed.symbols));
  symbols.delete('__probe__');
  return {
    symbols,
    loadMs: performance.now() - started,
    parseMs: parsed.parseMs,
    fromCache,
    from: 'sprite',
  };
}
