const AMAP_SCRIPT_ID = 'travel-system-amap-jsapi';
const AMAP_VERSION = '2.0';
const DEFAULT_PLUGINS = ['AMap.ToolBar', 'AMap.Scale', 'AMap.Geolocation'];
const DEFAULT_AMAP_KEY = '90ed758f5f6d47861c3989854c899423';
const DEFAULT_AMAP_SECURITY_CODE = '6bc29aff276766a3ef4413e52baed6f0';

let amapPromise = null;

const buildPluginParam = (plugins = []) => {
  const merged = Array.from(new Set([...DEFAULT_PLUGINS, ...plugins]));
  return merged.join(',');
};

export const loadAMap = async ({ key = import.meta.env.VITE_AMAP_KEY || DEFAULT_AMAP_KEY, plugins = [] } = {}) => {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持加载高德地图');
  }

  if (window.AMap) {
    return window.AMap;
  }

  if (amapPromise) {
    return amapPromise;
  }

  const resolvedKey = key;
  const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_CODE || DEFAULT_AMAP_SECURITY_CODE;

  if (!resolvedKey) {
    throw new Error('缺少高德地图 Key');
  }

  if (securityJsCode) {
    window._AMapSecurityConfig = { securityJsCode };
  }

  amapPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(AMAP_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.AMap), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('高德地图脚本加载失败')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = AMAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=${AMAP_VERSION}&key=${encodeURIComponent(resolvedKey)}&plugin=${encodeURIComponent(buildPluginParam(plugins))}`;
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
        return;
      }
      reject(new Error('高德地图对象未注入到页面'));
    };
    script.onerror = () => reject(new Error('高德地图脚本加载失败'));
    document.head.appendChild(script);
  }).catch((error) => {
    amapPromise = null;
    throw error;
  });

  return amapPromise;
};
