// Node 冒烟测试：DOM 桩验证渲染降级链逻辑 + 数据一致性。
// 运行：node tools/smoke-test.mjs
import { readFileSync } from 'node:fs';
import { ICONS, buildInlineSymbols } from '../js/icons-data.js';

/* ---- 最小 DOM 桩 ---- */
function makeEl(tag) {
  return {
    tag, attrs: {}, children: [], innerHTML: '',
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { this.children.push(c); },
  };
}
globalThis.document = {
  createElementNS: (ns, tag) => makeEl(tag),
  createElement: (tag) => makeEl(tag),
};

const { renderIcon, verifyRender } = await import('../js/renderer.js');

const symbols = buildInlineSymbols();
const baseSupport = { symbol: true, useHref: true, externalUse: true, currentColor: true };
const noSim = { disableExternal: false, failSprite: false, disableSymbol: false, misdetect: false };

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✅', name); }
  else { fail++; console.error('  ❌', name); }
}

console.log('— 降级链 —');
let r = renderIcon({ iconId: 'check', method: 'external', support: baseSupport, sim: noSim, symbols, spriteReady: true });
check('external 支持时直接用 external', r.actual === 'external');

r = renderIcon({ iconId: 'check', method: 'external', support: baseSupport, sim: { ...noSim, disableExternal: true }, symbols, spriteReady: true });
check('外部引用被禁 → 降级 symbol', r.actual === 'symbol' && r.chain[0].tried === 'external' && !r.chain[0].ok);

r = renderIcon({ iconId: 'check', method: 'external', support: baseSupport, sim: { ...noSim, disableExternal: true, disableSymbol: true }, symbols, spriteReady: true });
check('外部+symbol 均不可用 → 降级 inline', r.actual === 'inline' && r.chain.filter(c => !c.ok).length === 2);

r = renderIcon({ iconId: 'check', method: 'symbol', support: { ...baseSupport, symbol: false }, sim: noSim, symbols, spriteReady: true });
check('symbol 不支持 → 降级 inline', r.actual === 'inline');

r = renderIcon({ iconId: 'check', method: 'symbol', support: baseSupport, sim: noSim, symbols, spriteReady: false });
check('sprite 未就绪 → symbol 降级 inline', r.actual === 'inline');

r = renderIcon({ iconId: 'check', method: 'auto', support: baseSupport, sim: noSim, symbols, spriteReady: true });
check('auto 优先 symbol', r.actual === 'symbol');

r = renderIcon({ iconId: 'ghost', method: 'auto', support: baseSupport, sim: noSim, symbols, spriteReady: true });
check('缺失图标返回 missing 标记', r.missing === true && r.actual === null);

console.log('— 渲染校验（误判修正依据）—');
check('模拟外部引用被禁时 external 校验失败', verifyRender(null, 'external', { ...noSim, disableExternal: true }) === false);
check('模拟 symbol 不支持时 symbol 校验失败', verifyRender(null, 'symbol', { ...noSim, disableSymbol: true }) === false);

console.log('— 数据一致性 —');
const sprite = readFileSync(new URL('../assets/sprite.svg', import.meta.url), 'utf8');
const withBody = ICONS.filter(i => i.body);
check('sprite.svg 含全部 symbol', withBody.every(i => sprite.includes(`<symbol id="${i.id}"`)));
check('sprite.svg 含探测 symbol', sprite.includes('id="__probe__"'));
check('内联 symbols 数量与数据一致', symbols.size === withBody.length);
check('图标 id 唯一', new Set(ICONS.map(i => i.id)).size === ICONS.length);
check('图标 body 不含 fill/stroke 属性（保证颜色继承）', withBody.every(i => !/fill=|stroke=/.test(i.body)));
check('缺失演示图标无 body', ICONS.find(i => i.id === 'ghost').body === null);

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
