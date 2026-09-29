# SVG 图标多浏览器兼容性实验室

纯原生实现（无框架）：SVG + DOM + Fetch + CSSOM + IndexedDB + Web Worker。

## 运行

```bash
npm run build:sprite   # 由 js/icons-data.js 重新生成 assets/sprite.svg（可选，已生成）
npm run serve          # 或任意静态服务器，必须 http(s) 协议（fetch / Worker 需要）
# 打开 http://localhost:8080
```

## 功能对照

- **三种来源**：内联数据（`js/icons-data.js`）、sprite（Fetch `assets/sprite.svg` → Web Worker 解析 → 注入文档）、外部文件（`<use href="assets/sprite.svg#id">`）。
- **三种方式**：symbol 引用（文档内 `#id`）、外部引用（文件 `#id`）、直接内联。
- **支持性检测**：`symbol` 元素、`use href`、外部 use 引用（真实渲染探针 + 包围盒测量）、`currentColor` 继承；结果缓存 IndexedDB（1h）。
- **自动降级**：`external → symbol → inline`；sprite 加载失败 → 内联数据源；symbol 不支持 → 直接内联。
- **误判修正**：渲染后用 `getBBox` 校验，失败则修正检测结论、持久化到 IndexedDB 并重渲染。
- **一致性**：图标统一 `width/height:1em; fill:currentColor`，对比面板逐项校验颜色/尺寸继承与渲染一致性。
- **耗时展示**：来源加载/解析耗时、每个图标的渲染耗时均可见。
- **搜索 / 分类 / 预览**：关键词 + 分类过滤，点击图标进入方式对比。
- **异常演示**：面板②可模拟外部引用被禁、sprite 失败、symbol 不支持、检测误判；“异常演示”分类含缺失图标示例。

## 文件结构

```
index.html            页面
css/style.css         样式（.icon 继承规则在此）
js/icons-data.js      图标数据源
js/detect.js          特性检测 + 误判修正
js/loader.js          三种来源加载 / sprite 注入
js/renderer.js        三种方式渲染 + 降级链 + 渲染校验
js/worker.js          Web Worker 解析 sprite
js/db.js              IndexedDB 封装
js/main.js            UI 状态与交互
tools/build-sprite.mjs  sprite 生成脚本
assets/sprite.svg     生成的 sprite 文件
```
