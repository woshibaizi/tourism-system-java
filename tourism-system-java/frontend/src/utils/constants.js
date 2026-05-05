export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" fill="#f1edec"><rect width="800" height="600"/><text x="400" y="300" text-anchor="middle" dy=".3em" font-size="14" fill="#a3a3a3">No Image</text></svg>'
  );

export const DEFAULT_PAGE_SIZE = 12;

export const NAV_ITEMS = [
  { key: 'home', label: '首页', icon: 'Home', path: '/' },
  { key: 'destinations', label: '目的地', icon: 'MapPin', path: '/location-search' },
  { key: 'diaries', label: '游记', icon: 'BookOpen', path: '/diaries' },
  { key: 'routes', label: '路线规划', icon: 'Map', path: '/route-planning' },
  { key: 'campus', label: '校园导航', icon: 'Navigation', path: '/campus-navigation' },
  { key: 'assistant', label: 'AI 助手', icon: 'MessageCircle', path: '/travel-assistant' },
  { key: 'stats', label: '统计', icon: 'BarChart3', path: '/stats' },
];

export const SORT_OPTIONS = {
  places: [
    { value: 'default', label: '默认排序' },
    { value: 'rating', label: '评分最高' },
    { value: 'popularity', label: '最受欢迎' },
    { value: 'name', label: '名称排序' },
  ],
  diaries: [
    { value: 'default', label: '默认排序' },
    { value: 'rating', label: '评分最高' },
    { value: 'popularity', label: '最受欢迎' },
    { value: 'time', label: '最新发布' },
  ],
};
