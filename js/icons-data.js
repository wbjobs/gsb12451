// 图标数据源（内联来源）。body 为 <symbol> 内部片段，均不带 fill/stroke，
// 依赖 currentColor 继承，保证三种渲染方式下颜色继承行为一致。
export const CATEGORIES = ['全部', '箭头', '状态', '文件', '媒体', '异常演示'];

export const ICONS = [
  { id: 'arrow-left',  name: '左箭头', category: '箭头', keywords: ['left', 'back', 'chevron'],
    body: '<path d="M14.7 6.7 9.4 12l5.3 5.3-1.4 1.4L6.6 12l6.7-6.7z"/>' },
  { id: 'arrow-right', name: '右箭头', category: '箭头', keywords: ['right', 'forward', 'chevron'],
    body: '<path d="M9.3 6.7 14.6 12l-5.3 5.3 1.4 1.4 6.7-6.7-6.7-6.7z"/>' },
  { id: 'arrow-up',    name: '上箭头', category: '箭头', keywords: ['up', 'top', 'chevron'],
    body: '<path d="M6.7 14.7 12 9.4l5.3 5.3 1.4-1.4L12 6.6l-6.7 6.7z"/>' },
  { id: 'arrow-down',  name: '下箭头', category: '箭头', keywords: ['down', 'bottom', 'chevron'],
    body: '<path d="M6.7 9.3 12 14.6l5.3-5.3 1.4 1.4L12 17.4l-6.7-6.7z"/>' },
  { id: 'refresh',     name: '刷新',   category: '箭头', keywords: ['reload', 'sync', 'refresh'],
    body: '<path d="M12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"/>' },

  { id: 'check',   name: '勾选', category: '状态', keywords: ['ok', 'done', 'tick'],
    body: '<path d="M9.6 15.6 5.4 11.4 4 12.8l5.6 5.6L20 8l-1.4-1.4z"/>' },
  { id: 'close',   name: '关闭', category: '状态', keywords: ['x', 'cancel', 'cross'],
    body: '<path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z"/>' },
  { id: 'warning', name: '警告', category: '状态', keywords: ['alert', 'danger'],
    body: '<path d="M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z"/>' },
  { id: 'info',    name: '信息', category: '状态', keywords: ['about', 'help'],
    body: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>' },

  { id: 'file',     name: '文件',   category: '文件', keywords: ['doc', 'document'],
    body: '<path d="M6 2h8l6 6v14H6V2zm7 1.5V8h4.5L13 3.5z"/>' },
  { id: 'folder',   name: '文件夹', category: '文件', keywords: ['dir', 'directory'],
    body: '<path d="M3 5h6l2 2h10v12H3V5z"/>' },
  { id: 'download', name: '下载',   category: '文件', keywords: ['save', 'arrow'],
    body: '<path d="M11 3h2v9l3.5-3.5L18 10l-6 6-6-6 1.5-1.5L11 12V3zM5 19h14v2H5z"/>' },
  { id: 'upload',   name: '上传',   category: '文件', keywords: ['send', 'arrow'],
    body: '<path d="M12 3l6 6-1.5 1.5L13 7v9h-2V7l-3.5 3.5L6 9l6-6zM5 19h14v2H5z"/>' },

  { id: 'play',  name: '播放', category: '媒体', keywords: ['start', 'video'],
    body: '<path d="M7 4l13 8-13 8V4z"/>' },
  { id: 'pause', name: '暂停', category: '媒体', keywords: ['stop', 'video'],
    body: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' },
  { id: 'image', name: '图片', category: '媒体', keywords: ['photo', 'picture'],
    body: '<path d="M4 4h16v16H4V4zm2 2v9.6l4-4 3 3 3-3 4 4V6H6zM8.5 8A1.5 1.5 0 1 1 7 9.5 1.5 1.5 0 0 1 8.5 8z"/>' },
  { id: 'music', name: '音乐', category: '媒体', keywords: ['audio', 'note', 'song'],
    body: '<path d="M9 3v10.3A3.5 3.5 0 1 0 11 16V7h6V3H9z"/>' },

  // 故意缺失 body 的图标：任何来源都解析不到，用于演示“图标缺失”提示。
  { id: 'ghost', name: '缺失示例', category: '异常演示', keywords: ['missing', 'ghost', '404'], body: null },
];

export const VIEW_BOX = '0 0 24 24';

// 由内联数据构建 symbols 映射（与 sprite.svg 解析结果同构）。
export function buildInlineSymbols() {
  const map = new Map();
  for (const icon of ICONS) {
    if (icon.body) map.set(icon.id, { viewBox: VIEW_BOX, inner: icon.body });
  }
  return map;
}
