// ==================== WGS84 ↔ GCJ-02 坐标转换 ====================

const PI = 3.1415926535897932384626;
const AXIS = 6378245.0;
const EE = 0.00669342162296594323;

const outOfChina = (lat, lng) =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

const transformLat = (lng, lat) => {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * PI) + 40.0 * Math.sin(lat / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * PI) + 320 * Math.sin(lat * PI / 30.0)) * 2.0 / 3.0;
  return ret;
};

const transformLng = (lng, lat) => {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * PI) + 40.0 * Math.sin(lng / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * PI) + 300.0 * Math.sin(lng / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
};

/**
 * WGS84 → GCJ-02 坐标转换
 * 浏览器 GPS 返回的是 WGS84，高德地图使用 GCJ-02，需要转换后传给后端
 */
export const wgs84ToGcj02 = (lat, lng) => {
  if (outOfChina(lat, lng)) {
    return { lat, lng };
  }
  let deltaLat = transformLat(lng - 105.0, lat - 35.0);
  let deltaLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  deltaLat = (deltaLat * 180.0) / ((AXIS * (1 - EE)) / (magic * sqrtMagic) * PI);
  deltaLng = (deltaLng * 180.0) / (AXIS / sqrtMagic * Math.cos(radLat) * PI);
  return { lat: lat + deltaLat, lng: lng + deltaLng };
};

// ==================== 浏览器定位 ====================

export const getCurrentLocation = (options = {}) =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('当前浏览器不支持定位'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const wgsLat = position.coords.latitude;
        const wgsLng = position.coords.longitude;
        // 浏览器 GPS 返回 WGS84，转为 GCJ-02（高德坐标系）
        const gcj = wgs84ToGcj02(wgsLat, wgsLng);
        resolve({
          lng: gcj.lng,
          lat: gcj.lat,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        const messageMap = {
          1: '定位权限被拒绝',
          2: '定位失败，请检查设备定位服务',
          3: '定位超时，请稍后重试',
        };
        reject(new Error(messageMap[error.code] || '定位失败'));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
        ...options,
      }
    );
  });
