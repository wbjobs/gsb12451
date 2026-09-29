import { ICONS, CATEGORIES } from './icons-data.js';
import { detectSupport, correctDetection, getCorrections } from './detect.js';
import { loadInlineSource, loadSpriteSource, injectSprite, SPRITE_URL } from './loader.js';
import { renderIcon, verifyRender, METHOD_LABELS } from './renderer.js';

const SPRITE_CONTAINER_ID = 'svg-sprite-container';

const state = {
  source: 'sprite',          // inline | sprite | external
  method: 'auto',            // auto | symbol | external | inline
  color: '#1f6feb',
  size: 32,
  search: '',
  category: '全部',
  selected: 'check',
  sim: { disableExternal: false, failSprite: false, disableSymbol: false, misdetect: false },
  support: null,             // 检测结果（可能被误判修正更新）
  inlineSymbols: null,
  spriteSymbols: null,       // null 表示 sprite 加载失败
  spriteLoadInfo: null,
};

const $ = (sel) => document.querySelector(sel);

/* ---------- 日志 ---------- */
function log(msg, type = 'info') {
  const li = document.createElement('li');
  li.className = `log log--${type}`;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  li.innerHTML = `<span class="log__time">${time}</span><span>${msg}</span>`;
  $('#log-list').prepend(li);
}

/* ---------- 当前生效的 symbols ---------- */
function activeSymbols() {
  if (state.source === 'sprite' && state.spriteSymbols) return state.spriteSymbols;
  return state.inlineSymbols;
}

function spriteReady() {
  return Boolean(document.getElementById(SPRITE_CONTAINER_ID));
}

/* ---------- 支持性面板 ---------- */
function renderSupportPanel() {
  const s = state.support;
  const rows = [
    ['symbol 元素', s.symbol, ''],
    ['use href 引用', s.useHref, ''],
    ['外部 use 引用', s.externalUse, s.externalUseReason || ''],
    ['currentColor 颜色继承', s.currentColor, ''],
  ];
  $('#support-list').innerHTML = rows.map(([name, ok, note]) => `
    <tr>
      <td>${name}</td>
      <td class="${ok ? 'ok' : 'bad'}">${ok ? '✅ 支持' : '❌ 不支持'}</td>
      <td class="muted">${note}</td>
    </tr>`).join('') +
    `<tr><td colspan="3" class="muted">${s.fromCache ? '结果来自 IndexedDB 缓存（1 小时内有效）' : '本次实时检测'}，UA: ${navigator.userAgent.slice(0, 80)}…</td></tr>`;
}

async function renderCorrections() {
  const list = await getCorrections();
  $('#corrections-list').innerHTML = list.length
    ? list.slice(-5).reverse().map((c) =>
        `<li>检测误判已修正：<code>${c.key} → ${c.value}</code>（${c.note}）</li>`).join('')
    : '<li class="muted">暂无误判修正记录</li>';
}

/* ---------- 来源加载 ---------- */
async function loadSources() {
  const inline = loadInlineSource();
  state.inlineSymbols = inline.symbols;
  log(`内联数据源就绪：${inline.symbols.size} 个图标，耗时 ${inline.loadMs.toFixed(2)}ms`);

  state.spriteSymbols = null;
  try {
    const sprite = await loadSpriteSource({ simulateFailure: state.sim.failSprite });
    state.spriteSymbols = sprite.symbols;
    state.spriteLoadInfo = sprite;
    injectSprite(sprite.symbols, SPRITE_CONTAINER_ID);
    log(`sprite 加载成功：${sprite.symbols.size} 个 symbol，总耗时 ${sprite.loadMs.toFixed(2)}ms` +
        `（Worker 解析 ${sprite.parseMs.toFixed(2)}ms）${sprite.fromCache ? '，来自 IndexedDB 缓存' : ''}`);
  } catch (err) {
    // sprite 加载失败 → 降级到内联数据源
    injectSprite(state.inlineSymbols, SPRITE_CONTAINER_ID);
    state.spriteLoadInfo = null;
    log(`sprite 加载失败：${err.message} → 已降级到内联数据源`, 'warn');
  }
  renderSourceInfo();
}

function renderSourceInfo() {
  const info = state.spriteLoadInfo;
  $('#source-info').textContent = info
    ? `sprite：${SPRITE_URL}，加载+解析 ${info.loadMs.toFixed(2)}ms${info.fromCache ? '（缓存）' : ''}`
    : `sprite：不可用（已降级内联数据源）`;
}

/* ---------- 图标网格 ---------- */
function filteredIcons() {
  const q = state.search.trim().toLowerCase();
  return ICONS.filter((icon) => {
    if (state.category !== '全部' && icon.category !== state.category) return false;
    if (!q) return true;
    return icon.id.includes(q) || icon.name.includes(q) ||
           icon.keywords.some((k) => k.toLowerCase().includes(q));
  });
}

function renderGrid() {
  const grid = $('#icon-grid');
  grid.innerHTML = '';
  const icons = filteredIcons();
  $('#grid-count').textContent = `${icons.length} 个图标`;

  for (const icon of icons) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell' + (icon.id === state.selected ? ' cell--selected' : '');
    cell.dataset.iconId = icon.id;

    const stage = document.createElement('span');
    stage.className = 'cell__stage';
    stage.style.fontSize = `${state.size}px`;
    stage.style.color = state.color;

    const result = renderIcon({
      iconId: icon.id,
      method: state.method,
      support: state.support,
      sim: state.sim,
      symbols: activeSymbols(),
      spriteReady: spriteReady(),
    });
    stage.appendChild(result.node);

    const name = document.createElement('span');
    name.className = 'cell__name';
    name.textContent = icon.name;

    const badge = document.createElement('span');
    badge.className = 'cell__badge';
    if (result.missing) {
      badge.classList.add('badge--missing');
      badge.textContent = '缺失';
      log(`图标缺失：${icon.id}（${icon.name}），所有来源均无此图标`, 'error');
    } else {
      const failed = result.chain.filter((c) => !c.ok);
      badge.textContent = `${result.actual} · ${result.renderMs.toFixed(2)}ms`;
      if (failed.length) {
        badge.classList.add('badge--fallback');
        badge.textContent = `⚠ ${result.actual}`;
        badge.title = failed.map((f) => `${f.tried}: ${f.reason}`).join('\n') + `\n已降级为 ${result.actual}`;
      }
    }

    cell.append(stage, name, badge);
    cell.addEventListener('click', () => {
      state.selected = icon.id;
      renderGrid();
      renderCompare();
    });
    grid.appendChild(cell);

    // 保存渲染结果供校验阶段使用
    cell._render = result;
  }

  // 渲染后校验：检测误判修正
  requestAnimationFrame(verifyGrid);
}

function verifyGrid() {
  let corrected = false;
  for (const cell of $('#icon-grid').children) {
    const result = cell._render;
    if (!result || result.missing || !result.actual || result.actual === 'inline') continue;
    const svgEl = cell.querySelector('svg');
    if (!svgEl) continue;
    if (!verifyRender(svgEl, result.actual, state.sim)) {
      const key = result.actual === 'external' ? 'externalUse' : 'symbol';
      if (state.support[key]) {
        state.support[key] = false;
        correctDetection(key, false, `图标 ${cell.dataset.iconId} 渲染校验失败`);
        log(`检测误判修正：${result.actual} 检测为支持但实际渲染失败，已更新支持表并重渲染`, 'warn');
        corrected = true;
      }
    }
  }
  if (corrected) {
    renderSupportPanel();
    renderCorrections();
    renderGrid();
    renderCompare();
  }
}

/* ---------- 方式对比面板 ---------- */
function renderCompare() {
  const icon = ICONS.find((i) => i.id === state.selected);
  $('#compare-title').textContent = `方式对比：${icon.name}（${icon.id}）`;
  const body = $('#compare-body');
  body.innerHTML = '';

  const expectedColor = state.color;
  const results = [];

  for (const method of ['symbol', 'external', 'inline']) {
    const box = document.createElement('div');
    box.className = 'compare__item';

    const stage = document.createElement('div');
    stage.className = 'compare__stage';
    stage.style.fontSize = `${state.size}px`;
    stage.style.color = expectedColor;

    const result = renderIcon({
      iconId: icon.id, method, support: state.support, sim: state.sim,
      symbols: activeSymbols(), spriteReady: spriteReady(),
    });
    stage.appendChild(result.node);
    box.appendChild(stage);

    const meta = document.createElement('div');
    meta.className = 'compare__meta';
    box.appendChild(meta);
    body.appendChild(box);

    results.push({ method, result, stage, meta, box });
  }

  requestAnimationFrame(() => {
    const sizes = [];
    for (const r of results) {
      const svgEl = r.stage.querySelector('svg');
      let colorOk = false, sizeOk = false, rendered = false, sizeText = '—';
      if (svgEl && !r.result.missing) {
        try {
          const box = svgEl.getBBox();
          rendered = box.width > 0;
        } catch { /* 未渲染 */ }
        const rect = svgEl.getBoundingClientRect();
        sizeOk = Math.abs(rect.width - state.size) < 1 && rect.width > 0;
        sizeText = `${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`;
        sizes.push(rect.width);
        const target = svgEl.querySelector('path, use');
        if (target) {
          const fill = getComputedStyle(target).fill;
          const expected = getComputedStyle(r.stage).color;
          colorOk = fill === expected || fill === 'currentcolor';
          if (!colorOk && fill.startsWith('rgb')) {
            // currentColor 解析后应与容器 color 一致
            colorOk = fill === expected;
          }
        }
      }
      const chainInfo = r.result.chain.filter((c) => !c.ok)
        .map((c) => `${c.tried}✗`).join(' → ');
      r.meta.innerHTML = r.result.missing
        ? `<strong>${METHOD_LABELS[r.method]}</strong><br><span class="bad">图标缺失</span>`
        : `<strong>${METHOD_LABELS[r.method]}</strong><br>` +
          `实际方式：<code>${r.result.actual}</code>${chainInfo ? `（${chainInfo} 降级）` : ''}<br>` +
          `颜色继承：${colorOk ? '<span class="ok">✅</span>' : '<span class="bad">❌</span>'} ` +
          `尺寸继承：${sizeOk ? '<span class="ok">✅</span>' : '<span class="bad">❌</span>'} <span class="muted">${sizeText}</span><br>` +
          `耗时：${r.result.renderMs.toFixed(2)}ms`;
      r.rendered = rendered;
      r.sizeOk = sizeOk;
      r.colorOk = colorOk;
    }
    const okSizes = sizes.filter((w) => w > 0);
    const consistent = okSizes.length === 3 && okSizes.every((w) => Math.abs(w - okSizes[0]) < 1);
    $('#compare-summary').innerHTML = consistent
      ? '<span class="ok">✅ 三种方式渲染结果一致（尺寸相同、均正常渲染）</span>'
      : '<span class="bad">⚠ 三种方式渲染结果不一致或存在失败项（查看上方各项详情与降级原因）</span>';
  });
}

/* ---------- 分类 / 搜索 ---------- */
function renderCategories() {
  const tabs = $('#category-tabs');
  tabs.innerHTML = '';
  for (const cat of CATEGORIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab' + (cat === state.category ? ' tab--active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => { state.category = cat; renderCategories(); renderGrid(); });
    tabs.appendChild(btn);
  }
}

/* ---------- 事件绑定 ---------- */
function bindEvents() {
  $('#sel-source').addEventListener('change', (e) => {
    state.source = e.target.value;
    log(`切换图标来源：${e.target.selectedOptions[0].textContent}`);
    renderGrid(); renderCompare();
  });
  $('#sel-method').addEventListener('change', (e) => {
    state.method = e.target.value;
    log(`切换使用方式：${METHOD_LABELS[state.method]}`);
    renderGrid(); renderCompare();
  });
  $('#inp-color').addEventListener('input', (e) => {
    state.color = e.target.value;
    renderGrid(); renderCompare();
  });
  $('#inp-size').addEventListener('input', (e) => {
    state.size = Number(e.target.value);
    $('#size-val').textContent = `${state.size}px`;
    renderGrid(); renderCompare();
  });
  $('#inp-search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderGrid();
  });
  $('#btn-redetect').addEventListener('click', async () => {
    log('重新进行特性检测…');
    state.support = await detectSupport({ force: true, spriteUrl: SPRITE_URL });
    renderSupportPanel();
    renderGrid(); renderCompare();
    log('特性检测完成');
  });

  const simBindings = [
    ['#sim-external', 'disableExternal', '模拟：外部引用被禁用'],
    ['#sim-sprite-fail', 'failSprite', '模拟：sprite 加载失败'],
    ['#sim-symbol', 'disableSymbol', '模拟：symbol 不被支持'],
  ];
  for (const [sel, key, label] of simBindings) {
    $(sel).addEventListener('change', async (e) => {
      state.sim[key] = e.target.checked;
      log(`${label}：${e.target.checked ? '开启' : '关闭'}`, 'warn');
      if (key === 'failSprite') await loadSources();
      renderGrid(); renderCompare();
    });
  }
  $('#sim-misdetect').addEventListener('change', (e) => {
    state.sim.misdetect = e.target.checked;
    if (e.target.checked) {
      // 注入误判：强制声称支持，渲染校验会识别并修正
      state.support.externalUse = true;
      state.support.symbol = true;
      log('已注入检测误判：强制声称 externalUse/symbol 受支持（渲染校验将修正）', 'warn');
    }
    renderSupportPanel();
    renderGrid(); renderCompare();
  });
}

/* ---------- 启动 ---------- */
async function init() {
  state.support = await detectSupport({ spriteUrl: SPRITE_URL });
  renderSupportPanel();
  renderCorrections();
  await loadSources();
  renderCategories();
  bindEvents();
  renderGrid();
  renderCompare();
  log('初始化完成：三种来源就绪，可切换来源/方式/异常模拟进行验证');
}

init().catch((err) => log(`初始化失败：${err.message}`, 'error'));
