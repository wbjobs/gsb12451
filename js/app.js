/* UI 装配：检测面板、来源面板、渲染矩阵、图标库、日志。 */
const $ = (sel) => document.querySelector(sel);

const state = {
  selectedIcon: 'check',
  search: '',
  category: '全部',
};

/* ---------- 日志 ---------- */

function onRuntimeLog(entry) {
  appendLog(entry);
}

function appendLog({ type, message, at }) {
  const list = $('#log-list');
  const item = document.createElement('li');
  item.className = `log-item log-${type}`;
  const time = at.toLocaleTimeString('zh-CN', { hour12: false });
  item.innerHTML = `<span class="log-time">${time}</span><span class="log-msg"></span>`;
  item.querySelector('.log-msg').textContent = message;
  list.prepend(item);
  while (list.children.length > 80) list.lastChild.remove();
}

/* ---------- 能力检测面板 ---------- */

function capStatusText(cap) {
  const value = cap.override !== null ? cap.override : cap.supported;
  if (value === null || value === undefined) return { text: '未检测', cls: 'tag-muted' };
  const suffix = cap.override !== null ? '（人工）' : cap.source === 'verify' ? '（已修正）' : '';
  return value
    ? { text: '支持' + suffix, cls: 'tag-ok' }
    : { text: '不支持' + suffix, cls: 'tag-bad' };
}

function renderCapsTable() {
  const tbody = $('#caps-body');
  tbody.innerHTML = '';
  for (const cap of Object.values(caps)) {
    const tr = document.createElement('tr');
    const status = capStatusText(cap);
    tr.innerHTML = `
      <td class="cap-label"></td>
      <td><span class="tag ${status.cls}">${status.text}</span></td>
      <td>${cap.time === null ? '—' : cap.time.toFixed(2) + ' ms'}</td>
      <td class="cap-note"></td>
      <td>
        <select data-cap="${cap.key}" class="cap-override">
          <option value="auto">自动</option>
          <option value="on">强制支持</option>
          <option value="off">强制不支持</option>
        </select>
      </td>`;
    tr.querySelector('.cap-label').textContent = cap.label;
    tr.querySelector('.cap-note').textContent = cap.note || '';
    const select = tr.querySelector('select');
    select.value = cap.override === null ? 'auto' : cap.override ? 'on' : 'off';
    select.addEventListener('change', () => {
      cap.override = select.value === 'auto' ? null : select.value === 'on';
      cap.note = cap.override === null ? '' : '人工覆盖生效';
      logEvent('warn', `能力「${cap.label}」被人工${cap.override === null ? '恢复自动检测' : cap.override ? '强制为支持' : '强制为不支持'}`);
      renderCapsTable();
      refreshMatrix();
      renderIconGrid();
    });
    tbody.appendChild(tr);
  }
}

async function runDetection() {
  $('#btn-detect').disabled = true;
  logEvent('info', '开始能力检测…');
  await runAllDetection();
  renderCapsTable();
  logEvent('info', '检测完成，开始渲染验证（误判修正）…');
  const corrections = await verifyAndCorrect();
  if (corrections.length) {
    for (const c of corrections) {
      logEvent('warn', `误判修正：${c.label} ${c.before ? '支持' : '不支持'} → ${c.after ? '支持' : '不支持'}`);
    }
  } else {
    logEvent('ok', '渲染验证通过，未发现误判');
  }
  renderCapsTable();
  $('#btn-detect').disabled = false;
}

/* ---------- 来源面板 ---------- */

function renderSources() {
  for (const [key, src] of Object.entries(sources)) {
    const card = $(`#src-${key}`);
    const statusEl = card.querySelector('.src-status');
    const timeEl = card.querySelector('.src-time');
    const detailEl = card.querySelector('.src-detail');
    const map = {
      idle: ['未加载', 'tag-muted'],
      loading: ['加载中…', 'tag-info'],
      checking: ['检测中…', 'tag-info'],
      ready: ['就绪', 'tag-ok'],
      failed: ['失败', 'tag-bad'],
    };
    const [text, cls] = map[src.status];
    statusEl.className = `src-status tag ${cls}`;
    statusEl.textContent = text;
    timeEl.textContent = src.time === null ? '—' : src.time.toFixed(2) + ' ms';
    detailEl.textContent = src.detail || '';
  }
}

async function loadSource(key) {
  if (key === 'inline') loadInlineSource();
  else if (key === 'sprite') await loadSpriteSource();
  else await checkExternalSource();
  renderSources();
  refreshMatrix();
  renderIconGrid();
}

async function loadAllSources() {
  loadInlineSource();
  renderSources();
  await Promise.all([loadSpriteSource(), checkExternalSource()]);
  renderSources();
  refreshMatrix();
  renderIconGrid();
}

/* ---------- 渲染矩阵 ---------- */

function refreshMatrix() {
  const id = state.selectedIcon;
  $('#matrix-icon-name').textContent = `${findIcon(id) ? findIcon(id).name : id}（${id}）`;
  const tbody = $('#matrix-body');
  tbody.innerHTML = '';

  for (const requested of ['external-use', 'symbol-use', 'inline']) {
    const r = renderIcon(id, requested);
    const tr = document.createElement('tr');
    const iconCell = document.createElement('td');
    iconCell.className = 'matrix-icon';
    iconCell.appendChild(r.node);

    const actualText = r.missing ? '—' : METHOD_LABELS[r.actual] + (r.symbolRef ? `（${r.symbolRef === 'sprite' ? 'sprite 源' : '内联源'}）` : '');
    const reasonText = r.reasons.length ? r.reasons.join('；') : '—';
    tr.appendChild(iconCell);
    tr.insertAdjacentHTML('beforeend', `
      <td>${METHOD_LABELS[requested]}</td>
      <td>${actualText}</td>
      <td>${r.missing ? '—' : r.time.toFixed(3) + ' ms'}</td>
      <td class="${r.reasons.length ? 'reason-cell' : ''}">${reasonText}</td>`);
    tbody.appendChild(tr);
  }

  const icon = findIcon(id);
  const box = $('#consistency-result');
  if (!icon) {
    box.textContent = '图标缺失，无法验证一致性';
    box.className = 'consistency bad';
    return;
  }
  const { results, consistent } = verifyConsistency(id);
  const detail = results
    .map((r) => `${METHOD_LABELS[r.actual]}: ${Math.round(r.width)}×${Math.round(r.height)}px, 颜色${r.colorOk ? '✓' : '✗'}, 尺寸${r.sizeOk ? '✓' : '✗'}`)
    .join('　');
  box.textContent = (consistent ? '✓ 三种方式渲染一致（颜色与尺寸继承正确）　' : '✗ 渲染不一致　') + detail;
  box.className = 'consistency ' + (consistent ? 'ok' : 'bad');
}

/* ---------- 图标库 ---------- */

function bestMethod() {
  if (effective('externalUse') && sources.external.status === 'ready') return 'external-use';
  if (effective('symbolUse')) return 'symbol-use';
  return 'inline';
}

function renderCategoryChips() {
  const wrap = $('#category-chips');
  wrap.innerHTML = '';
  for (const cat of ICON_CATEGORIES) {
    const btn = document.createElement('button');
    btn.className = 'chip' + (cat === state.category ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      state.category = cat;
      renderCategoryChips();
      renderIconGrid();
    });
    wrap.appendChild(btn);
  }
}

function filteredIcons() {
  const kw = state.search.trim().toLowerCase();
  return ICONS.filter((icon) => {
    if (state.category !== '全部' && icon.category !== state.category) return false;
    if (!kw) return true;
    return icon.id.toLowerCase().includes(kw) || icon.name.includes(kw);
  });
}

function renderIconGrid() {
  const grid = $('#icon-grid');
  grid.innerHTML = '';
  const list = filteredIcons();
  $('#icon-count').textContent = `${list.length} / ${ICONS.length} 个图标`;
  const method = bestMethod();
  $('#grid-method').textContent = `当前渲染方式：${METHOD_LABELS[method]}`;

  for (const icon of list) {
    const card = document.createElement('button');
    card.className = 'icon-card' + (icon.id === state.selectedIcon ? ' selected' : '');
    const r = renderIcon(icon.id, method);
    card.appendChild(r.node);
    card.insertAdjacentHTML('beforeend', `<span class="icon-name">${icon.name}</span><span class="icon-id">${icon.id}</span>`);
    card.addEventListener('click', () => {
      state.selectedIcon = icon.id;
      renderIconGrid();
      refreshMatrix();
    });
    grid.appendChild(card);
  }
  if (!list.length) {
    grid.innerHTML = '<p class="empty">没有匹配的图标</p>';
  }
}

function testMissingIcon() {
  const id = $('#missing-input').value.trim() || 'not-exist';
  const box = $('#missing-result');
  box.innerHTML = '';
  const r = renderIcon(id, bestMethod());
  box.appendChild(r.node);
  box.insertAdjacentHTML('beforeend', `<span class="missing-text">图标缺失：${id}（已显示占位提示）</span>`);
}

/* ---------- 启动 ---------- */

async function boot() {
  renderCategoryChips();
  renderSources();
  renderCapsTable();

  $('#btn-detect').addEventListener('click', async () => {
    await runDetection();
    refreshMatrix();
    renderIconGrid();
  });
  $('#btn-load-all').addEventListener('click', loadAllSources);
  document.querySelectorAll('[data-load]').forEach((btn) =>
    btn.addEventListener('click', () => loadSource(btn.dataset.load))
  );
  $('#btn-clear-cache').addEventListener('click', async () => {
    try {
      await idbClear();
      logEvent('info', 'IndexedDB 缓存已清空');
    } catch (err) {
      logEvent('error', '清空缓存失败：' + err.message);
    }
  });
  $('#icon-search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderIconGrid();
  });
  $('#btn-missing').addEventListener('click', testMissingIcon);

  await runDetection();
  await loadAllSources();
  logEvent('info', '初始化完成');
}

document.addEventListener('DOMContentLoaded', boot);
