# SVG 图标多浏览器兼容方案

纯原生 Web 技术（SVG / DOM / Fetch / CSSOM / IndexedDB / Web Worker），无框架。

## 运行

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

> 直接双击 `index.html`（file://）时，fetch 与外部引用会被浏览器拦截——
> 页面会自动演示「sprite 加载失败 → 降级内联」「外部引用被禁 → 降级 symbol」的完整链路。

## 功能

- **三种来源**：内联数据注入 `<symbol>`；Worker 加载 `assets/sprite.svg` 并写入 IndexedDB 缓存；外部文件直接引用（不加载，仅探针检测）。
- **三种方式**：`<use href="sprite.svg#id">` 外部引用、`<symbol>` + 本地 `<use>`、直接内联 SVG。
- **能力检测**：外部 use / symbol / fetch / Worker / IndexedDB / currentColor 颜色继承 / 1em 尺寸继承，全部记录检测耗时。
- **误判修正**：检测结论再经真实渲染验证，不一致时以渲染结果为准并写日志；每项能力支持人工覆盖（自动 / 强制支持 / 强制不支持），可用于模拟老浏览器观察降级。
- **自动降级**：外部引用被禁 → symbol 引用；symbol 不支持 → 直接内联；sprite 加载失败 → 内联源。降级原因在渲染矩阵与日志中展示。
- **一致性验证**：对选中图标用三种方式渲染到 `color`/`font-size` 受控容器，用 CSSOM 读取计算样式与布局尺寸，验证颜色与尺寸继承一致。
- **图标库**：搜索、分类筛选、点击预览；缺失图标显示 ⚠ 占位并记录日志。

## 文件结构

```
index.html            页面
css/style.css         样式
js/icons-data.js      图标数据（唯一事实来源）
js/detect.js          能力检测 + 误判修正
js/store.js           IndexedDB 缓存
js/worker.js          sprite 加载 Worker
js/icon-runtime.js    来源加载 / 渲染 / 降级 / 一致性验证
js/app.js             UI 装配
assets/sprite.svg     由 tools/build-sprite.js 生成
tools/build-sprite.js sprite 生成脚本（node tools/build-sprite.js）
```
