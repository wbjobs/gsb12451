// Web Worker：在后台线程解析 sprite 文本，提取 symbol 列表，避免阻塞主线程。
self.onmessage = (e) => {
  const { spriteText } = e.data;
  const started = performance.now();
  try {
    const doc = new DOMParser().parseFromString(spriteText, 'image/svg+xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      self.postMessage({ ok: false, error: 'sprite XML 解析失败: ' + parseError.textContent.slice(0, 120) });
      return;
    }
    const symbols = {};
    for (const sym of doc.querySelectorAll('symbol')) {
      const id = sym.getAttribute('id');
      if (!id) continue;
      let inner = '';
      for (const node of sym.childNodes) {
        inner += node.nodeType === 1 ? new XMLSerializer().serializeToString(node) : '';
      }
      symbols[id] = { viewBox: sym.getAttribute('viewBox') || '0 0 24 24', inner };
    }
    self.postMessage({ ok: true, symbols, parseMs: performance.now() - started });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
