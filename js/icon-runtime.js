/*
 * 图标运行时：三种来源的加载 + 三种方式的渲染 + 自动降级。
 * 来源: inline（内置数据注入）/ sprite（运行时加载 sprite.svg，IndexedDB 缓存）/ external（外部文件直接引用）
 * 方式: external-use（<use href="sprite.svg#id">）/ symbol-use（<use href="#id">）/ inline（直接内联）
 */
const SYMBOL_ATTRS =
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const sources = {
  inline:   { status: 'idle', time: null, count: 0, detail: '' },
  sprite:   { status: 'idle', time: null, count: 0, fromCache: false, detail: '' },
  external: { status: 'idle', time: null, detail: '' },
};

const runtimeLogs = [];
function logEvent(type, message) {
  runtimeLogs.push({ type, message, at: new Date() });
  if (typeof onRuntimeLog === 'function') onRuntimeLog({ type, message, at: new Date() });
}

function buildSymbolMarkup(icon, idPrefix) {
  return `<symbol id="${idPrefix}${icon.id}" viewBox="${icon.viewBox}" ${SYMBOL_ATTRS}>${icon.content}</symbol>`;
}

function injectDefs(idPrefix, markupList, tag) {
  document.querySelectorAll(`svg.svg-defs[data-tag="${tag}"]`).forEach((n) => n.remove());
  const holder = document.createElement('div');
  holder.innerHTML =
    `<svg class="svg-defs" data-tag="${tag}" aria-hidden="true" ` +
    `style="position:absolute;width:0;height:0;overflow:hidden">${markupList.join('')}</svg>`;
  document.body.appendChild(holder.firstChild);
}

/* ---------- 来源加载 ---------- */

function loadInlineSource() {
  const start = performance.now();
  injectDefs('i-', ICONS.map((ic) => buildSymbolMarkup(ic, 'i-')), 'inline');
  sources.inline.status = 'ready';
  sources.inline.time = performance.now() - start;
  sources.inline.count = ICONS.length;
  sources.inline.detail = `已注入 ${ICONS.length} 个 <symbol>`;
  logEvent('ok', `内联源加载完成（${ICONS.length} 个图标，${sources.inline.time.toFixed(2)}ms）`);
  return sources.inline;
}

function fetchSpriteViaWorker(url) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('js/worker.js');
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Worker 加载超时'));
    }, 8000);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      if (e.data && e.data.ok) resolve(e.data);
      else reject(new Error((e.data && e.data.error) || 'Worker 加载失败'));
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(e.message || 'Worker 错误'));
    };
    worker.postMessage({ url });
  });
}

async function fetchSpriteMainThread(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  const ids = [...text.matchAll(/<symbol[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  if (!ids.length) throw new Error('sprite 中未找到 <symbol>');
  return { text, ids };
}

function injectSpriteSymbols(spriteText) {
  const doc = new DOMParser().parseFromString(spriteText, 'image/svg+xml');
  const symbols = [...doc.querySelectorAll('symbol')];
  const markup = symbols.map((sym) => {
    const id = sym.getAttribute('id').replace(/^i-/, '');
    return `<symbol id="s-${id}" viewBox="${sym.getAttribute('viewBox') || '0 0 24 24'}" ${SYMBOL_ATTRS}>${sym.innerHTML}</symbol>`;
  });
  injectDefs('s-', markup, 'sprite');
  return symbols.length;
}

async function loadSpriteSource() {
  const start = performance.now();
  sources.sprite.status = 'loading';
  sources.sprite.detail = '';
  try {
    let text = null;
    let fromCache = false;

    if (effective('idb')) {
      try {
        const cached = await idbGet(SPRITE_CACHE_KEY);
        if (cached && cached.text) {
          text = cached.text;
          fromCache = true;
        }
      } catch (err) {
        logEvent('warn', 'IndexedDB 读取失败，改用网络加载：' + err.message);
      }
    }

    if (!text) {
      let result;
      if (effective('worker')) {
        try {
          result = await fetchSpriteViaWorker(SPRITE_URL);
        } catch (err) {
          logEvent('warn', `Worker 加载失败（${err.message}），回退主线程 fetch`);
          result = await fetchSpriteMainThread(SPRITE_URL);
        }
      } else if (effective('fetchApi')) {
        result = await fetchSpriteMainThread(SPRITE_URL);
      } else {
        throw new Error('fetch 不可用，无法加载 sprite');
      }
      text = result.text;
      if (effective('idb')) {
        try {
          await idbSet(SPRITE_CACHE_KEY, { text, savedAt: Date.now() });
        } catch (err) {
          logEvent('warn', 'IndexedDB 写入失败：' + err.message);
        }
      }
    }

    const count = injectSpriteSymbols(text);
    sources.sprite.status = 'ready';
    sources.sprite.time = performance.now() - start;
    sources.sprite.count = count;
    sources.sprite.fromCache = fromCache;
    sources.sprite.detail = `${fromCache ? 'IndexedDB 缓存命中' : '网络加载'}，注入 ${count} 个 <symbol>`;
    logEvent('ok', `sprite 源加载完成（${sources.sprite.detail}，${sources.sprite.time.toFixed(2)}ms）`);
  } catch (err) {
    sources.sprite.status = 'failed';
    sources.sprite.time = performance.now() - start;
    sources.sprite.detail = String(err.message || err);
    logEvent('error', `sprite 加载失败：${sources.sprite.detail}，已降级到内联源`);
    if (sources.inline.status !== 'ready') loadInlineSource();
  }
  return sources.sprite;
}

async function checkExternalSource() {
  const start = performance.now();
  sources.external.status = 'checking';
  const probe = await detectExternalUse(2500);
  sources.external.time = performance.now() - start;
  if (probe.supported && effective('externalUse')) {
    sources.external.status = 'ready';
    sources.external.detail = '外部引用探针渲染成功';
  } else {
    sources.external.status = 'failed';
    sources.external.detail = '外部引用被禁用或文件不可达';
  }
  logEvent(
    probe.supported ? 'ok' : 'warn',
    `外部文件源检测：${sources.external.detail}（${sources.external.time.toFixed(2)}ms）`
  );
  return sources.external;
}

/* ---------- 渲染与降级 ---------- */

const METHOD_LABELS = {
  'external-use': 'use 外部引用',
  'symbol-use': 'symbol 引用',
  'inline': '直接内联',
};

function missingIconNode(id) {
  const span = document.createElement('span');
  span.className = 'icon-missing';
  span.title = `图标缺失：${id}`;
  span.textContent = '⚠';
  return span;
}

/*
 * 解析实际渲染方式，返回 { method, reasons[], symbolRef }
 * 降级链：external-use → symbol-use → inline
 */
function resolveMethod(requested) {
  const reasons = [];
  let method = requested;

  if (method === 'external-use') {
    if (!effective('externalUse') || sources.external.status === 'failed') {
      reasons.push('外部引用不可用（被浏览器禁用或检测失败），降级为 symbol 引用');
      method = 'symbol-use';
    }
  }
  if (method === 'symbol-use') {
    if (!effective('symbolUse')) {
      reasons.push('当前浏览器不支持 <symbol> 引用，降级为直接内联');
      method = 'inline';
    }
  }

  let symbolRef = null;
  if (method === 'symbol-use') {
    if (sources.sprite.status === 'ready') {
      symbolRef = 'sprite';
    } else {
      if (sources.sprite.status === 'failed') {
        reasons.push('sprite 加载失败，symbol 来源降级为内联源');
      }
      if (sources.inline.status !== 'ready') loadInlineSource();
      symbolRef = 'inline';
    }
  }
  return { method, reasons, symbolRef };
}

function renderIcon(id, requestedMethod) {
  const start = performance.now();
  const icon = findIcon(id);
  const frag = document.createDocumentFragment();

  if (!icon) {
    frag.appendChild(missingIconNode(id));
    logEvent('error', `图标缺失：${id}（请求方式：${METHOD_LABELS[requestedMethod]}）`);
    return { node: frag, missing: true, actual: null, reasons: [`图标 "${id}" 不存在`], time: 0 };
  }

  const { method, reasons, symbolRef } = resolveMethod(requestedMethod);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', icon.viewBox);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', icon.name);

  if (method === 'inline') {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const tpl = document.createElement('template');
    tpl.innerHTML = `<svg xmlns="${SVG_NS}">${icon.content}</svg>`;
    const inner = tpl.content.firstChild;
    while (inner.firstChild) svg.appendChild(document.importNode(inner.firstChild, true));
  } else {
    const use = document.createElementNS(SVG_NS, 'use');
    if (method === 'external-use') {
      setUseHref(use, `${SPRITE_URL}#i-${icon.id}`);
    } else {
      setUseHref(use, symbolRef === 'sprite' ? `#s-${icon.id}` : `#i-${icon.id}`);
    }
    svg.appendChild(use);
  }

  frag.appendChild(svg);
  const time = performance.now() - start;
  return { node: frag, missing: false, actual: method, reasons, symbolRef, time };
}

/* ---------- 一致性验证（颜色 / 尺寸继承） ---------- */

function verifyConsistency(id) {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-9999px;top:0;color:rgb(224,49,80);font-size:32px;line-height:1;';
  document.body.appendChild(host);

  const results = [];
  for (const requested of ['external-use', 'symbol-use', 'inline']) {
    const r = renderIcon(id, requested);
    if (r.missing) continue;
    host.appendChild(r.node);
    const svg = host.lastChild;
    const rect = svg.getBoundingClientRect();
    const computedColor = getComputedStyle(svg).color;
    let colorOk = computedColor === 'rgb(224, 49, 80)';
    if (r.actual === 'inline') {
      const strokeEl = svg.querySelector('[stroke="currentColor"]') || svg.querySelector('path');
      if (strokeEl) {
        const cs = getComputedStyle(strokeEl);
        colorOk = cs.stroke === 'rgb(224, 49, 80)' || cs.fill === 'rgb(224, 49, 80)';
      }
    }
    const sizeOk = Math.abs(rect.width - 32) < 1 && Math.abs(rect.height - 32) < 1;
    results.push({
      requested,
      actual: r.actual,
      colorOk,
      sizeOk,
      width: rect.width,
      height: rect.height,
      color: computedColor,
    });
  }
  host.remove();
  const consistent =
    results.length > 0 &&
    results.every((r) => r.colorOk && r.sizeOk) &&
    new Set(results.map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`)).size === 1;
  return { results, consistent };
}
