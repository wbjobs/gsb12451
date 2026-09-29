// 渲染器：三种使用方式 + 自动降级链 + 渲染后校验（误判修正）。
//
// 方式：
//  - symbol   ：<svg><use href="#id"/></svg>，引用文档内 <symbol>（sprite 注入后可用）
//  - external ：<svg><use href="assets/sprite.svg#id"/></svg>，外部文件引用
//  - inline   ：直接内联完整 <svg> 标记
//
// 降级链：external → symbol → inline；symbol → inline。
import { SPRITE_URL } from './loader.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const METHOD_LABELS = {
  auto: '自动选择',
  symbol: 'symbol 引用（use → 文档内 #id）',
  external: '外部引用（use → sprite.svg#id）',
  inline: '直接内联',
};

function makeSvg(cls) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

function renderExternal(iconId, sim) {
  const svg = makeSvg('icon icon--external');
  const use = document.createElementNS(SVG_NS, 'use');
  // 模拟“外部引用被禁”：指向不存在的文件，渲染结果为空，等价于浏览器禁用外部引用
  const url = sim.disableExternal ? 'assets/sprite-blocked.svg' : SPRITE_URL;
  use.setAttribute('href', `${url}#${iconId}`);
  svg.appendChild(use);
  return svg;
}

function renderSymbol(iconId) {
  const svg = makeSvg('icon icon--symbol');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${iconId}`);
  svg.appendChild(use);
  return svg;
}

function renderInline(iconId, symbols) {
  const sym = symbols.get(iconId);
  const svg = makeSvg('icon icon--inline');
  svg.setAttribute('viewBox', sym.viewBox);
  svg.innerHTML = sym.inner;
  return svg;
}

// 渲染后校验：真实测量包围盒。模拟开关代表“该浏览器本就不支持此方式”，
// 因此命中模拟时判定为渲染失败，用于演示检测误判的修正流程。
export function verifyRender(svgEl, method, sim) {
  if (method === 'external' && sim.disableExternal) return false;
  if (method === 'symbol' && sim.disableSymbol) return false;
  try {
    const box = svgEl.getBBox();
    return box.width > 0 && box.height > 0;
  } catch {
    return false;
  }
}

// 判定某方式在当前支持度/模拟环境下是否可用
function methodUsable(method, support, sim, spriteReady) {
  switch (method) {
    case 'external':
      return support.externalUse && support.useHref && !sim.disableExternal;
    case 'symbol':
      return support.symbol && support.useHref && !sim.disableSymbol && spriteReady;
    case 'inline':
      return true;
    default:
      return false;
  }
}

const CHAINS = {
  external: ['external', 'symbol', 'inline'],
  symbol: ['symbol', 'inline'],
  inline: ['inline'],
};

const FALLBACK_REASONS = {
  external: '外部引用不受支持或被禁用',
  symbol: 'symbol/use 引用不受支持或 sprite 未就绪',
};

/**
 * 渲染一个图标。
 * @returns {{node: Element, actual: string|null, chain: Array, missing: boolean, renderMs: number}}
 */
export function renderIcon({ iconId, method, support, sim, symbols, spriteReady }) {
  const started = performance.now();
  const chain = [];

  if (!symbols.get(iconId)) {
    const node = document.createElement('span');
    node.className = 'icon-missing';
    node.textContent = '⚠';
    node.title = `图标缺失：${iconId}`;
    return { node, actual: null, chain: [], missing: true, renderMs: performance.now() - started };
  }

  const wanted = method === 'auto' ? ['symbol', 'inline'] : (CHAINS[method] || CHAINS.inline);
  let node = null;
  let actual = null;

  for (const m of wanted) {
    if (!methodUsable(m, support, sim, spriteReady)) {
      chain.push({ tried: m, ok: false, reason: FALLBACK_REASONS[m] || '不可用' });
      continue;
    }
    if (m === 'external') node = renderExternal(iconId, sim);
    else if (m === 'symbol') node = renderSymbol(iconId);
    else node = renderInline(iconId, symbols);
    actual = m;
    chain.push({ tried: m, ok: true });
    break;
  }

  return { node, actual, chain, missing: false, renderMs: performance.now() - started };
}
