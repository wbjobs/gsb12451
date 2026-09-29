/* Web Worker：加载并校验 sprite.svg，避免阻塞主线程。 */
self.onmessage = async (event) => {
  const { url } = event.data || {};
  const start = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const ids = [...text.matchAll(/<symbol[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    if (!ids.length) throw new Error('sprite 中未找到 <symbol>');
    self.postMessage({ ok: true, text, ids, time: performance.now() - start });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err), time: performance.now() - start });
  }
};
