/*
 * 浏览器能力检测 + 误判修正。
 * 每项能力记录: { supported, time, source: 'auto'|'verify'|'manual', override: null|true|false }
 * effective(cap) 返回考虑人工覆盖后的最终结论。
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const SPRITE_URL = 'assets/sprite.svg';

function setUseHref(useEl, ref) {
  useEl.setAttribute('href', ref);
  useEl.setAttributeNS(XLINK_NS, 'xlink:href', ref);
}

function makeProbeHost() {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-9999px;top:0;width:64px;height:64px;' +
    'visibility:hidden;pointer-events:none;';
  document.body.appendChild(host);
  return host;
}

function useBBox(useEl) {
  try {
    const box = useEl.getBBox();
    return box && box.width > 0 && box.height > 0;
  } catch (err) {
    return false;
  }
}

const caps = {};

function defineCap(key, label) {
  caps[key] = { key, label, supported: null, time: null, source: 'auto', override: null, note: '' };
}

function effective(key) {
  const cap = caps[key];
  if (!cap) return false;
  return cap.override !== null ? cap.override : !!cap.supported;
}

defineCap('externalUse', '外部 <use> 引用 (sprite.svg#id)');
defineCap('symbolUse', '<symbol> + 本地 <use> 引用');
defineCap('fetchApi', 'Fetch API（sprite 加载）');
defineCap('worker', 'Web Worker');
defineCap('idb', 'IndexedDB 缓存');
defineCap('colorInherit', '颜色继承 (currentColor)');
defineCap('sizeInherit', '尺寸继承 (1em)');

/* 外部 use 引用：真实渲染探针，轮询等待外部资源生效 */
function detectExternalUse(timeout = 2500) {
  return new Promise((resolve) => {
    const start = performance.now();
    const host = makeProbeHost();
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '48');
    svg.setAttribute('height', '48');
    const use = document.createElementNS(SVG_NS, 'use');
    setUseHref(use, `${SPRITE_URL}#i-check`);
    svg.appendChild(use);
    host.appendChild(svg);

    const timer = setInterval(() => {
      if (useBBox(use)) {
        finish(true);
      } else if (performance.now() - start > timeout) {
        finish(false);
      }
    }, 60);

    function finish(ok) {
      clearInterval(timer);
      host.remove();
      resolve({ supported: ok, time: performance.now() - start });
    }
  });
}

/* symbol + 本地 use：同步渲染探针 */
function detectSymbolUse() {
  const start = performance.now();
  const apiOk = 'SVGSymbolElement' in window && 'SVGUseElement' in window;
  const host = makeProbeHost();
  const defs = document.createElementNS(SVG_NS, 'svg');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  const symbol = document.createElementNS(SVG_NS, 'symbol');
  symbol.id = 'probe-symbol';
  symbol.setAttribute('viewBox', '0 0 24 24');
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '2');
  rect.setAttribute('y', '2');
  rect.setAttribute('width', '20');
  rect.setAttribute('height', '20');
  symbol.appendChild(rect);
  defs.appendChild(symbol);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '48');
  svg.setAttribute('height', '48');
  const use = document.createElementNS(SVG_NS, 'use');
  setUseHref(use, '#probe-symbol');
  svg.appendChild(use);

  host.appendChild(defs);
  host.appendChild(svg);
  const renderOk = useBBox(use);
  host.remove();
  return { supported: apiOk && renderOk, time: performance.now() - start, apiOk, renderOk };
}

/* currentColor 继承：渲染内联探针，读取计算样式 */
function detectColorInherit() {
  const start = performance.now();
  const host = makeProbeHost();
  host.style.color = 'rgb(19, 132, 204)';
  host.style.visibility = 'hidden';
  host.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">' +
    '<path class="probe-stroke" d="M4 4h16"/>' +
    '<path class="probe-fill" fill="currentColor" stroke="none" d="M4 12h16v4H4z"/></svg>';
  const strokeOk = getComputedStyle(host.querySelector('.probe-stroke')).stroke === 'rgb(19, 132, 204)';
  const fillOk = getComputedStyle(host.querySelector('.probe-fill')).fill === 'rgb(19, 132, 204)';
  host.remove();
  return { supported: strokeOk && fillOk, time: performance.now() - start };
}

/* 尺寸继承：font-size 驱动 1em 图标尺寸 */
function detectSizeInherit() {
  const start = performance.now();
  const host = makeProbeHost();
  host.style.fontSize = '40px';
  host.style.visibility = 'hidden';
  host.innerHTML = '<svg class="icon-size-probe" viewBox="0 0 24 24" style="width:1em;height:1em"><path d="M0 0h24v24H0z"/></svg>';
  const rect = host.querySelector('.icon-size-probe').getBoundingClientRect();
  host.remove();
  const ok = Math.abs(rect.width - 40) < 0.6 && Math.abs(rect.height - 40) < 0.6;
  return { supported: ok, time: performance.now() - start };
}

function detectFetchApi() {
  const start = performance.now();
  return { supported: typeof fetch === 'function', time: performance.now() - start };
}

function detectWorker() {
  const start = performance.now();
  return { supported: typeof Worker === 'function', time: performance.now() - start };
}

function detectIdb() {
  const start = performance.now();
  return { supported: typeof indexedDB !== 'undefined', time: performance.now() - start };
}

async function runAllDetection() {
  const results = await Promise.all([
    detectExternalUse().then((r) => ['externalUse', r]),
    Promise.resolve().then(() => ['symbolUse', detectSymbolUse()]),
    Promise.resolve().then(() => ['colorInherit', detectColorInherit()]),
    Promise.resolve().then(() => ['sizeInherit', detectSizeInherit()]),
    Promise.resolve().then(() => ['fetchApi', detectFetchApi()]),
    Promise.resolve().then(() => ['worker', detectWorker()]),
    Promise.resolve().then(() => ['idb', detectIdb()]),
  ]);
  for (const [key, r] of results) {
    caps[key].supported = r.supported;
    caps[key].time = r.time;
    caps[key].source = 'auto';
  }
  return caps;
}

/*
 * 误判修正：检测结论与“真实渲染验证”不一致时，以渲染结果为准并记录日志。
 * 返回修正记录数组。
 */
async function verifyAndCorrect() {
  const corrections = [];
  const checks = [
    ['externalUse', () => detectExternalUse(2500)],
    ['symbolUse', () => Promise.resolve(detectSymbolUse())],
    ['colorInherit', () => Promise.resolve(detectColorInherit())],
    ['sizeInherit', () => Promise.resolve(detectSizeInherit())],
  ];
  for (const [key, fn] of checks) {
    const cap = caps[key];
    if (cap.override !== null) continue; // 人工覆盖优先，不修正
    const verify = await fn();
    if (cap.supported !== null && verify.supported !== cap.supported) {
      corrections.push({
        key,
        label: cap.label,
        before: cap.supported,
        after: verify.supported,
        time: verify.time,
      });
      cap.supported = verify.supported;
      cap.time = verify.time;
      cap.source = 'verify';
      cap.note = `检测误判已修正：${cap.supported ? '不支持' : '支持'} → ${verify.supported ? '支持' : '不支持'}`;
    }
  }
  return corrections;
}
