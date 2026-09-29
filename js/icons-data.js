/*
 * 图标数据源（内联源的唯一事实来源）。
 * 每个图标: { id, name, category, viewBox, content }
 * content 为 <symbol>/<svg> 内部片段，统一使用 currentColor，
 * 描边图标依赖外层提供的 fill="none" stroke="currentColor" 等属性，
 * 填充图标在 path 上自行覆盖 fill="currentColor" stroke="none"。
 */
const ICONS = [
  // 界面
  { id: 'home',     name: '首页',   category: '界面', viewBox: '0 0 24 24', content: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>' },
  { id: 'search',   name: '搜索',   category: '界面', viewBox: '0 0 24 24', content: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>' },
  { id: 'settings', name: '设置',   category: '界面', viewBox: '0 0 24 24', content: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>' },
  { id: 'user',     name: '用户',   category: '界面', viewBox: '0 0 24 24', content: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>' },
  { id: 'menu',     name: '菜单',   category: '界面', viewBox: '0 0 24 24', content: '<path d="M4 6h16M4 12h16M4 18h16"/>' },
  { id: 'close',    name: '关闭',   category: '界面', viewBox: '0 0 24 24', content: '<path d="M6 6l12 12M18 6 6 18"/>' },
  // 媒体
  { id: 'play',     name: '播放',   category: '媒体', viewBox: '0 0 24 24', content: '<path fill="currentColor" stroke="none" d="M8 5v14l11-7z"/>' },
  { id: 'pause',    name: '暂停',   category: '媒体', viewBox: '0 0 24 24', content: '<path d="M9 5v14M15 5v14"/>' },
  { id: 'camera',   name: '相机',   category: '媒体', viewBox: '0 0 24 24', content: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>' },
  { id: 'image',    name: '图片',   category: '媒体', viewBox: '0 0 24 24', content: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 18 5-5 3 3 3-3 3 3"/>' },
  { id: 'music',    name: '音乐',   category: '媒体', viewBox: '0 0 24 24', content: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' },
  // 文件
  { id: 'file',     name: '文件',   category: '文件', viewBox: '0 0 24 24', content: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/>' },
  { id: 'folder',   name: '文件夹', category: '文件', viewBox: '0 0 24 24', content: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>' },
  { id: 'download', name: '下载',   category: '文件', viewBox: '0 0 24 24', content: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 21h16"/>' },
  { id: 'upload',   name: '上传',   category: '文件', viewBox: '0 0 24 24', content: '<path d="M12 15V3"/><path d="m7 7 5-5 5 5"/><path d="M4 21h16"/>' },
  { id: 'trash',    name: '删除',   category: '文件', viewBox: '0 0 24 24', content: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>' },
  // 状态
  { id: 'check',    name: '成功',   category: '状态', viewBox: '0 0 24 24', content: '<path d="m4 12.5 5 5L20 6.5"/>' },
  { id: 'warning',  name: '警告',   category: '状态', viewBox: '0 0 24 24', content: '<path d="M12 3 2 21h20z"/><path d="M12 10v5"/><path d="M12 18.5v.01"/>' },
  { id: 'error',    name: '错误',   category: '状态', viewBox: '0 0 24 24', content: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>' },
  { id: 'info',     name: '信息',   category: '状态', viewBox: '0 0 24 24', content: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/>' },
  { id: 'star',     name: '收藏',   category: '状态', viewBox: '0 0 24 24', content: '<path fill="currentColor" stroke="none" d="m12 2 3 6.6 7 .8-5.2 4.8 1.4 7L12 17.5 5.8 21.2l1.4-7L2 9.4l7-.8z"/>' },
  { id: 'heart',    name: '喜欢',   category: '状态', viewBox: '0 0 24 24', content: '<path fill="currentColor" stroke="none" d="M12 21C7 16.5 3 13 3 8.8 3 6 5.2 4 7.8 4c1.7 0 3.2.9 4.2 2.3C13 4.9 14.5 4 16.2 4 18.8 4 21 6 21 8.8c0 4.2-4 7.7-9 12.2z"/>' },
];

const ICON_CATEGORIES = ['全部', ...new Set(ICONS.map((i) => i.category))];

function findIcon(id) {
  return ICONS.find((i) => i.id === id) || null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ICONS, ICON_CATEGORIES };
}
