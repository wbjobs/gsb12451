// 特性检测：symbol / use href / 外部 use 引用 / currentColor 继承。
// 检测结果会写入 IndexedDB；渲染后的真实校验可修正误判（见 renderer.verifyRender）。
import { dbGet, dbSet } from './db.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DETECT_KEY = 'detection-v1';
const DETECT_TTL = 60 * 60 * 1000; // 1 小时内复用缓存的检测结果

function detectSymbol() {
  try {
    const el = document.createElementNS(SVG_NS, 'symbol');
    return typeof SVGSymbolElement !== 'undefined' && el instanceof SVGSymbolElement;
  } catch {
    return false;
  }
}

function detectUseHref() {
  try {
    const use = document.createElementNS(SVG_NS, 'use');
    return typeof SVGUseElement !== 'undefined' && ('href' in use || 'href' in SVGUseElement.prototype);
  } catch {
    return false;
  }
}

// 外部引用探测：真实渲染一个 <use href="sprite.svg#__probe__">，
// 在加载完成或超时后测量包围盒。部分浏览器（旧 IE、禁用外部引用的环境）不会渲染。
function probeExternalUse(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    const use = document.createElementNS(SVG_NS, 'use');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;width:24px;height:24px;left:-9999px;top:0;overflow:hidden;');
    use.setAttribute('href', `${url}#__probe__`);
    svg.appendChild(use);
    document.body.appendChild(svg);

    let done = false;
    const finish = (ok, reason) => {
      if (done) return;
      done = true;
      svg.remove();
      resolve({ ok, reason });
    };
    const timer = setTimeout(() => finish(false, '探测超时（外部引用可能被禁用）'), timeoutMs);

    svg.addEventListener('load', () => {
      requestAnimationFrame(() => {
        clearTimeout(timer);
        try {
          const box = use.getBBox();
          finish(box.width > 0 && box.height > 0, box.width > 0 ? '' : '外部引用未渲染出内容');
        } catch {
          finish(false, 'getBBox 异常，外部引用不可用');
        }
      });
    });
    // 某些浏览器对 svg 不触发 load，这里兜底轮询一次
    setTimeout(() => {
      if (done) return;
      try {
        const box = use.getBBox();
        if (box.width > 0) { clearTimeout(timer); finish(true, ''); }
      } catch { /* 等超时分支处理 */ }
    }, Math.min(600, timeoutMs - 100));
  });
}

function detectCurrentColor() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('style', 'position:absolute;left:-9999px;color:rgb(1, 2, 3);');
  svg.innerHTML = '<path d="M0 0h10v10H0z" fill="currentColor"/>';
  document.body.appendChild(svg);
  const fill = getComputedStyle(svg.querySelector('path')).fill;
  svg.remove();
  return fill === 'rgb(1, 2, 3)';
}

export async function detectSupport({ force = false, spriteUrl } = {}) {
  if (!force) {
    const cached = await dbGet('meta', DETECT_KEY);
    if (cached && Date.now() - cached.time < DETECT_TTL) {
      return { ...cached.result, fromCache: true };
    }
  }
  const externalProbe = await probeExternalUse(spriteUrl);
  const result = {
    symbol: detectSymbol(),
    useHref: detectUseHref(),
    externalUse: externalProbe.ok,
    externalUseReason: externalProbe.reason,
    currentColor: detectCurrentColor(),
    fromCache: false,
  };
  await dbSet('meta', DETECT_KEY, { time: Date.now(), result });
  return result;
}

// 误判修正：渲染校验失败时调用，覆盖检测结论并持久化。
export async function correctDetection(key, value, note) {
  const cached = await dbGet('meta', DETECT_KEY);
  if (cached && cached.result) {
    cached.result[key] = value;
    await dbSet('meta', DETECT_KEY, cached);
  }
  const log = (await dbGet('meta', 'corrections')) || [];
  log.push({ time: Date.now(), key, value, note });
  await dbSet('meta', 'corrections', log.slice(-50));
  return log;
}

export async function getCorrections() {
  return (await dbGet('meta', 'corrections')) || [];
}
