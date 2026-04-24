import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, message, Slider, Spin, Switch, Tag, Tooltip } from 'antd';
import {
  AimOutlined,
  CarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  LineOutlined,
  NodeIndexOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { loadAMap } from '../utils/amapLoader';
import { getCurrentLocation } from '../utils/location';

const DEFAULT_CENTER = [116.3518, 39.9607];
const DEFAULT_ZOOM = 16;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isLngLat = (value) =>
  Array.isArray(value) &&
  value.length >= 2 &&
  Number.isFinite(Number(value[0])) &&
  Number.isFinite(Number(value[1]));

const dedupeCoordinates = (coordinates = []) => {
  const unique = [];

  coordinates.forEach((coordinate) => {
    if (!isLngLat(coordinate)) {
      return;
    }

    const normalized = [Number(coordinate[0]), Number(coordinate[1])];
    const lastCoordinate = unique[unique.length - 1];
    if (
      lastCoordinate &&
      lastCoordinate[0] === normalized[0] &&
      lastCoordinate[1] === normalized[1]
    ) {
      return;
    }

    unique.push(normalized);
  });

  return unique;
};

const toLngLatFromLegacy = (value) => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const lat = toNumber(value[0]);
  const lng = toNumber(value[1]);
  return lat != null && lng != null ? [lng, lat] : null;
};

const toLngLatFromEntity = (item) => {
  const lng = toNumber(item?.mapLng ?? item?.map_lng ?? item?.lng ?? item?.longitude);
  const lat = toNumber(item?.mapLat ?? item?.map_lat ?? item?.lat ?? item?.latitude);
  return lng != null && lat != null ? [lng, lat] : null;
};

const createMarkerHtml = ({ color, label, size = 26, borderWidth = 3 }) => `
  <div style="
    width:${size}px;
    height:${size}px;
    border-radius:50%;
    background:${color};
    border:${borderWidth}px solid #fff;
    box-shadow:0 6px 16px rgba(0,0,0,0.18);
    display:flex;
    align-items:center;
    justify-content:center;
    color:#fff;
    font-weight:700;
    font-size:${size > 24 ? 13 : 11}px;
  ">
    ${label}
  </div>
`;

const getNodeColor = (nodeInfo, index, totalNodes) => {
  if (index === 0) return '#52c41a';
  if (index === totalNodes - 1) return '#f5222d';

  switch (nodeInfo.type) {
    case '建筑物':
      return '#1890ff';
    case '设施':
      return '#fa8c16';
    case '路口':
      return '#722ed1';
    default:
      return '#666666';
  }
};

const getPathColor = (vehicle) => {
  const colorMap = {
    步行: '#52c41a',
    自行车: '#1890ff',
    电瓶车: '#fa8c16',
    混合: '#722ed1',
    不限: '#13c2c2',
  };

  return colorMap[vehicle] || '#1677ff';
};

const getNodeInfo = (nodeId, buildings, facilities) => {
  const building = buildings.find((item) => item.id === nodeId);
  if (building) {
    return {
      name: building.name || nodeId,
      type: building.type || '建筑物',
      id: nodeId,
    };
  }

  const facility = facilities.find((item) => item.id === nodeId);
  if (facility) {
    return {
      name: facility.name || nodeId,
      type: facility.type || '设施',
      id: nodeId,
    };
  }

  if (String(nodeId).includes('intersection')) {
    return {
      name: String(nodeId).replace('intersection_', '路口 '),
      type: '路口',
      id: nodeId,
    };
  }

  return {
    name: nodeId,
    type: '未知',
    id: nodeId,
  };
};

const buildVisualizationData = (routeResult, buildings, facilities) => {
  if (!routeResult) {
    return {
      routeCoordinates: [],
      pathNodes: [],
      pathEdges: [],
      allLocationCoordinates: dedupeCoordinates([
        ...buildings.map((item) => toLngLatFromEntity(item)).filter(Boolean),
        ...facilities.map((item) => toLngLatFromEntity(item)).filter(Boolean),
      ]),
    };
  }

  const nodeCoordinates = routeResult.nodeCoordinates || {};
  const getNodeCoordinate = (nodeId) => {
    const legacyCoordinate = toLngLatFromLegacy(nodeCoordinates[nodeId]);
    if (legacyCoordinate) {
      return legacyCoordinate;
    }

    const building = buildings.find((item) => item.id === nodeId);
    if (building) {
      return toLngLatFromEntity(building);
    }

    const facility = facilities.find((item) => item.id === nodeId);
    if (facility) {
      return toLngLatFromEntity(facility);
    }

    return null;
  };

  const path = Array.isArray(routeResult.path) ? routeResult.path : [];
  const mapSegments = Array.isArray(routeResult.mapSegments)
    ? routeResult.mapSegments
    : Array.isArray(routeResult.detailed_info?.segments)
      ? routeResult.detailed_info.segments
      : [];

  const pathNodes = path
    .map((nodeId, index) => {
      const coordinates = getNodeCoordinate(nodeId);
      if (!coordinates) {
        return null;
      }

      const info = getNodeInfo(nodeId, buildings, facilities);
      return {
        id: nodeId,
        coordinates,
        info,
        index,
        isStart: index === 0,
        isEnd: index === path.length - 1,
        color: getNodeColor(info, index, path.length),
      };
    })
    .filter(Boolean);

  const fallbackEdges = pathNodes.slice(1).map((node, index) => {
    const previousNode = pathNodes[index];
    return {
      key: `legacy-edge-${index}`,
      from: previousNode.info.name,
      to: node.info.name,
      fromId: previousNode.id,
      toId: node.id,
      vehicle: routeResult.vehicle || '不限',
      distance: 0,
      time: 0,
      coordinates: [previousNode.coordinates, node.coordinates],
      index,
      instruction: '',
    };
  });

  const pathEdges = (mapSegments.length > 0 ? mapSegments : fallbackEdges)
    .map((segment, index) => {
      const coordinates = Array.isArray(segment.coordinates) && segment.coordinates.length > 1
        ? dedupeCoordinates(segment.coordinates)
        : null;

      if (coordinates && coordinates.length > 1) {
        return {
          ...segment,
          coordinates,
          index,
          distance: Number(segment.distance) || 0,
          time: Number(segment.time) || 0,
          vehicle: segment.vehicle || routeResult.vehicle || '不限',
        };
      }

      const startCoordinate = getNodeCoordinate(segment.fromId || segment.from);
      const endCoordinate = getNodeCoordinate(segment.toId || segment.to);
      if (!startCoordinate || !endCoordinate) {
        return null;
      }

      return {
        ...segment,
        coordinates: [startCoordinate, endCoordinate],
        index,
        distance: Number(segment.distance) || 0,
        time: Number(segment.time) || 0,
        vehicle: segment.vehicle || routeResult.vehicle || '不限',
      };
    })
    .filter((segment) => Array.isArray(segment?.coordinates) && segment.coordinates.length > 1);

  const routeCoordinates = dedupeCoordinates(
    Array.isArray(routeResult.mapPath) && routeResult.mapPath.length > 1
      ? routeResult.mapPath
      : pathEdges.length > 0
        ? pathEdges.flatMap((segment) => segment.coordinates)
        : pathNodes.map((node) => node.coordinates)
  );

  const synthesizedNodes = pathNodes.length > 0
    ? pathNodes
    : routeCoordinates.length > 1
      ? [
          {
            id: 'route-start',
            coordinates: routeCoordinates[0],
            info: { id: 'route-start', name: '路线起点', type: '起点' },
            index: 0,
            isStart: true,
            isEnd: false,
            color: '#52c41a',
          },
          {
            id: 'route-end',
            coordinates: routeCoordinates[routeCoordinates.length - 1],
            info: { id: 'route-end', name: '路线终点', type: '终点' },
            index: 1,
            isStart: false,
            isEnd: true,
            color: '#f5222d',
          },
        ]
      : [];

  return {
    routeCoordinates,
    pathNodes: synthesizedNodes,
    pathEdges,
    allLocationCoordinates: dedupeCoordinates([
      ...buildings.map((item) => toLngLatFromEntity(item)).filter(Boolean),
      ...facilities.map((item) => toLngLatFromEntity(item)).filter(Boolean),
    ]),
  };
};

const buildSvgRoutePath = (coordinates = [], width = 520, height = 220) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return '';
  }

  const longitudes = coordinates.map((item) => item[0]);
  const latitudes = coordinates.map((item) => item[1]);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lngSpan = maxLng - minLng || 0.001;
  const latSpan = maxLat - minLat || 0.001;
  const padding = 24;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return coordinates
    .map(([lng, lat], index) => {
      const x = padding + ((lng - minLng) / lngSpan) * innerWidth;
      const y = padding + (1 - (lat - minLat) / latSpan) * innerHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

function LegacyRouteFallback({ mapError, routeCoordinates, pathNodes, pathEdges, currentLocation, routeResult, onSegmentClick }) {
  const svgPath = buildSvgRoutePath(routeCoordinates);

  return (
    <div
      style={{
        minHeight: 520,
        borderRadius: 12,
        padding: 20,
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
        border: '1px solid #dbeafe',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Alert
        type={mapError ? 'warning' : 'info'}
        showIcon
        message={mapError ? '高德地图不可用，已退回旧结果渲染' : '当前使用旧结果渲染'}
        description={mapError || routeResult?.fallbackReason || '页面仍可查看路线摘要、节点顺序和分段信息。'}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tag color={routeResult?.fallback ? 'orange' : 'blue'}>{routeResult?.mapProvider || routeResult?.provider || 'legacy'}</Tag>
        {routeResult?.vehicle && (
          <Tag color="processing">
            <CarOutlined /> {routeResult.vehicle}
          </Tag>
        )}
        {routeResult?.total_time > 0 && (
          <Tag color="green">
            <ClockCircleOutlined /> {routeResult.total_time.toFixed(2)} 分钟
          </Tag>
        )}
        {routeResult?.total_distance > 0 && (
          <Tag color="purple">
            <LineOutlined /> {routeResult.total_distance.toFixed(0)} 米
          </Tag>
        )}
        {currentLocation && (
          <Tag color="cyan">
            <EnvironmentOutlined /> {Number(currentLocation.lat).toFixed(5)}, {Number(currentLocation.lng).toFixed(5)}
          </Tag>
        )}
      </div>

      <div
        style={{
          borderRadius: 10,
          background: '#fff',
          padding: 12,
          border: '1px solid #e5e7eb',
        }}
      >
        {svgPath ? (
          <svg viewBox="0 0 520 220" style={{ width: '100%', height: 220, display: 'block' }}>
            <defs>
              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1677ff" />
                <stop offset="100%" stopColor="#52c41a" />
              </linearGradient>
            </defs>
            <path d={svgPath} fill="none" stroke="url(#routeGradient)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            暂无可绘制的坐标路径，仍可查看下方节点和分段信息
          </div>
        )}
      </div>

      {pathNodes.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>节点顺序</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pathNodes.map((node, index) => (
              <Tag key={node.id || `node-${index}`} color={index === 0 ? 'green' : index === pathNodes.length - 1 ? 'red' : 'blue'}>
                {index + 1}. {node.info.name}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {pathEdges.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>分段路线</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pathEdges.map((edge, index) => (
              <div
                key={edge.key || `edge-${index}`}
                onClick={() => onSegmentClick?.(edge)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  cursor: onSegmentClick ? 'pointer' : 'default',
                }}
              >
                <div style={{ fontWeight: 600 }}>{index + 1}. {edge.from}{' -> '}{edge.to}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color="processing">{edge.vehicle || '路线'}</Tag>
                  {edge.distance > 0 && <Tag color="blue">{edge.distance} 米</Tag>}
                  {edge.time > 0 && <Tag color="green">{edge.time.toFixed(1)} 分钟</Tag>}
                  {edge.instruction && <Tag>{edge.instruction}</Tag>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RouteMap({
  routeResult,
  buildings = [],
  facilities = [],
  onSegmentClick,
  currentLocation = null,
  onLocationChange,
  showControls = true,
  mapHeight = 520,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const overlayRefs = useRef([]);
  const animationTimeoutRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [locating, setLocating] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [pathNodes, setPathNodes] = useState([]);
  const [pathEdges, setPathEdges] = useState([]);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(900);
  const [visibleNodes, setVisibleNodes] = useState(new Set());
  const [visibleEdges, setVisibleEdges] = useState(new Set());
  const [currentAnimationStep, setCurrentAnimationStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!showControls) {
      setAnimationEnabled(false);
      setAutoPlay(false);
      setIsAnimating(false);
    }
  }, [showControls]);

  useEffect(() => {
    let cancelled = false;

    const setupMap = async () => {
      if (!mapContainerRef.current || mapInstanceRef.current) {
        return;
      }

      try {
        const AMap = await loadAMap();
        if (cancelled || !mapContainerRef.current) {
          return;
        }

        const map = new AMap.Map(mapContainerRef.current, {
          zoom: DEFAULT_ZOOM,
          center: DEFAULT_CENTER,
          viewMode: '2D',
          resizeEnable: true,
          mapStyle: 'amap://styles/normal',
        });

        if (AMap.ToolBar) {
          map.addControl(new AMap.ToolBar());
        }
        if (AMap.Scale) {
          map.addControl(new AMap.Scale());
        }

        mapInstanceRef.current = map;
        setMapReady(true);
        setMapError('');
      } catch (error) {
        if (!cancelled) {
          setMapError(error.message || '高德地图加载失败');
        }
      }
    };

    setupMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      overlayRefs.current.forEach((overlay) => overlay?.setMap?.(null));
      overlayRefs.current = [];
      mapInstanceRef.current?.destroy?.();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!routeResult) {
      setRouteCoordinates([]);
      setPathNodes([]);
      setPathEdges([]);
      setVisibleNodes(new Set());
      setVisibleEdges(new Set());
      return;
    }

    setLoading(true);

    try {
      const visualization = buildVisualizationData(routeResult, buildings, facilities);
      setRouteCoordinates(visualization.routeCoordinates);
      setPathNodes(visualization.pathNodes);
      setPathEdges(visualization.pathEdges);

      if (animationEnabled) {
        setVisibleNodes(new Set());
        setVisibleEdges(new Set());
        setCurrentAnimationStep(0);
      } else {
        setVisibleNodes(new Set(visualization.pathNodes.map((_, index) => index)));
        setVisibleEdges(new Set(visualization.pathEdges.map((_, index) => index)));
      }
    } catch (error) {
      message.error('路径数据处理失败');
      setRouteCoordinates([]);
      setPathNodes([]);
      setPathEdges([]);
    } finally {
      setLoading(false);
    }
  }, [routeResult, buildings, facilities, animationEnabled]);

  useEffect(() => {
    if (!animationEnabled || !autoPlay || pathEdges.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleNodes(new Set([0]));
      setVisibleEdges(new Set());
      setCurrentAnimationStep(0);
      setIsAnimating(true);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [animationEnabled, autoPlay, pathEdges.length, routeResult]);

  useEffect(() => {
    if (!isAnimating) {
      return undefined;
    }

    if (pathEdges.length === 0) {
      setIsAnimating(false);
      return undefined;
    }

    let stepIndex = 0;
    setVisibleNodes(new Set([0]));
    setVisibleEdges(new Set());

    const showNextStep = () => {
      if (stepIndex >= pathEdges.length) {
        setIsAnimating(false);
        return;
      }

      setVisibleEdges((previous) => {
        const next = new Set(previous);
        next.add(stepIndex);
        return next;
      });

      animationTimeoutRef.current = window.setTimeout(() => {
        setVisibleNodes((previous) => {
          const next = new Set(previous);
          next.add(stepIndex + 1);
          return next;
        });
        setCurrentAnimationStep(stepIndex + 1);
        stepIndex += 1;
        showNextStep();
      }, animationSpeed);
    };

    showNextStep();

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [animationSpeed, isAnimating, pathEdges.length]);

  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) {
      return;
    }

    const map = mapInstanceRef.current;
    const AMap = window.AMap;
    if (!AMap) {
      return;
    }

    overlayRefs.current.forEach((overlay) => overlay?.setMap?.(null));
    overlayRefs.current = [];

    const overlays = [];
    const visibleEdgeIndexes = animationEnabled ? visibleEdges : new Set(pathEdges.map((_, index) => index));
    const visibleNodeIndexes = animationEnabled ? visibleNodes : new Set(pathNodes.map((_, index) => index));

    pathEdges.forEach((edge, index) => {
      if (!visibleEdgeIndexes.has(index)) {
        return;
      }

      const polyline = new AMap.Polyline({
        path: edge.coordinates,
        strokeColor: getPathColor(edge.vehicle),
        strokeWeight: 6,
        strokeOpacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
        showDir: true,
        bubble: true,
      });

      polyline.on('click', () => {
        if (onSegmentClick) {
          onSegmentClick(edge);
        }
      });

      map.add(polyline);
      overlays.push(polyline);
    });

    pathNodes.forEach((node, index) => {
      if (!visibleNodeIndexes.has(index)) {
        return;
      }

      const marker = new AMap.Marker({
        position: node.coordinates,
        title: node.info.name,
        offset: new AMap.Pixel(-13, -13),
        content: createMarkerHtml({
          color: node.color,
          label: node.isStart ? 'S' : node.isEnd ? 'E' : String(index + 1),
          size: node.isStart || node.isEnd ? 28 : 24,
          borderWidth: node.isStart || node.isEnd ? 3 : 2,
        }),
      });

      marker.on('click', () => {
        message.info(`${node.info.name} (${node.info.type})`);
      });

      map.add(marker);
      overlays.push(marker);
    });

    if (currentLocation?.lng != null && currentLocation?.lat != null) {
      const locationMarker = new AMap.Marker({
        position: [Number(currentLocation.lng), Number(currentLocation.lat)],
        title: '当前位置',
        offset: new AMap.Pixel(-14, -14),
        content: createMarkerHtml({
          color: '#1677ff',
          label: '我',
          size: 28,
          borderWidth: 3,
        }),
      });
      map.add(locationMarker);
      overlays.push(locationMarker);
    }

    overlayRefs.current = overlays;

    if (overlays.length > 0) {
      map.setFitView(overlays, false, [60, 60, 60, 60]);
      return;
    }

    const fallbackCoordinates = dedupeCoordinates([
      ...routeCoordinates,
      ...buildings.map((item) => toLngLatFromEntity(item)).filter(Boolean),
      ...facilities.map((item) => toLngLatFromEntity(item)).filter(Boolean),
      currentLocation?.lng != null && currentLocation?.lat != null
        ? [Number(currentLocation.lng), Number(currentLocation.lat)]
        : null,
    ].filter(Boolean));

    if (fallbackCoordinates.length > 0) {
      map.setCenter(fallbackCoordinates[0]);
      if (fallbackCoordinates.length === 1) {
        map.setZoom(17);
      }
    } else {
      map.setZoomAndCenter(DEFAULT_ZOOM, DEFAULT_CENTER);
    }
  }, [
    animationEnabled,
    buildings,
    currentLocation,
    facilities,
    mapReady,
    onSegmentClick,
    pathEdges,
    pathNodes,
    routeCoordinates,
    visibleEdges,
    visibleNodes,
  ]);

  const startAnimation = () => {
    if (pathEdges.length === 0) {
      return;
    }

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    setVisibleNodes(new Set([0]));
    setVisibleEdges(new Set());
    setCurrentAnimationStep(0);
    setIsAnimating(true);
  };

  const stopAnimation = () => {
    setIsAnimating(false);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  };

  const resetAnimation = () => {
    stopAnimation();
    if (animationEnabled) {
      setVisibleNodes(new Set());
      setVisibleEdges(new Set());
      setCurrentAnimationStep(0);
      return;
    }

    setVisibleNodes(new Set(pathNodes.map((_, index) => index)));
    setVisibleEdges(new Set(pathEdges.map((_, index) => index)));
  };

  const handleLocateCurrentPosition = async () => {
    setLocating(true);
    try {
      const location = await getCurrentLocation();
      onLocationChange?.(location);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setZoomAndCenter(17, [location.lng, location.lat]);
      }
      message.success('已定位到当前位置');
    } catch (error) {
      message.error(error.message || '定位失败');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Card
      title={(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>高德地图</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tag color={routeResult?.mapProvider === 'amap' ? 'processing' : 'default'}>
              {routeResult?.mapProvider === 'amap' ? '高德导航结果' : '旧路径兼容模式'}
            </Tag>
            <Tag color="blue" icon={<NodeIndexOutlined />}>
              {pathNodes.length} 个节点
            </Tag>
            <Tag color="green" icon={<LineOutlined />}>
              {pathEdges.length} 条路径段
            </Tag>
          </div>
        </div>
      )}
      style={{ borderRadius: 18, border: 'none', boxShadow: '0 18px 36px rgba(22, 42, 70, 0.08)' }}
    >
      <Spin spinning={loading} tip="正在处理路径数据...">
        {mapError && (
          <Alert
            type="error"
            showIcon
            message="高德地图初始化失败"
            description={mapError}
            style={{ marginBottom: 16 }}
          />
        )}

        {showControls && (
          <div
            className="animation-control-panel"
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SettingOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontWeight: 'bold' }}>地图控制:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>启用路径动画:</span>
            <Switch checked={animationEnabled} onChange={setAnimationEnabled} size="small" />
          </div>

          {animationEnabled && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>自动播放:</span>
                <Tooltip title="路径规划成功后自动播放分段路线">
                  <Switch checked={autoPlay} onChange={setAutoPlay} size="small" />
                </Tooltip>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>动画速度:</span>
                <Slider
                  min={300}
                  max={1800}
                  step={100}
                  value={animationSpeed}
                  onChange={setAnimationSpeed}
                  style={{ width: 120 }}
                  tooltip={{ formatter: (value) => `${value}ms` }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {!isAnimating ? (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={startAnimation} size="small" disabled={pathEdges.length === 0}>
                    播放动画
                  </Button>
                ) : (
                  <Button type="primary" danger icon={<PauseCircleOutlined />} onClick={stopAnimation} size="small">
                    停止动画
                  </Button>
                )}

                <Button icon={<RedoOutlined />} onClick={resetAnimation} size="small" disabled={pathEdges.length === 0}>
                  重置
                </Button>
              </div>
            </>
          )}

          <Button
            icon={<AimOutlined />}
            onClick={handleLocateCurrentPosition}
            loading={locating}
            size="small"
          >
            定位到我
          </Button>

          {currentLocation && (
            <Tag color="cyan" icon={<EnvironmentOutlined />}>
              当前坐标: {Number(currentLocation.lat).toFixed(5)}, {Number(currentLocation.lng).toFixed(5)}
            </Tag>
          )}

          {animationEnabled && !isAnimating && pathEdges.length > 0 && (
            <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ThunderboltOutlined style={{ color: '#fa8c16' }} />
              <span>点击“播放动画”查看分段导航过程</span>
            </div>
          )}

          {isAnimating && (
            <div style={{ fontSize: 12, color: '#1890ff', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
              <NodeIndexOutlined />
              <span>正在连接第 {currentAnimationStep + 1} 个节点...</span>
            </div>
          )}
          </div>
        )}

        {mapError ? (
          <LegacyRouteFallback
            mapError={mapError}
            routeCoordinates={routeCoordinates}
            pathNodes={pathNodes}
            pathEdges={pathEdges}
            currentLocation={currentLocation}
            routeResult={routeResult}
            onSegmentClick={onSegmentClick}
          />
        ) : (
          <div
            ref={mapContainerRef}
            style={{ height: `${mapHeight}px`, width: '100%', borderRadius: 12, overflow: 'hidden', background: '#f5f5f5' }}
          />
        )}

        {pathEdges.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pathEdges.slice(0, 5).map((edge, index) => (
              <Tag
                key={edge.key || `legend-${index}`}
                color={getPathColor(edge.vehicle)}
                style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
                onClick={() => onSegmentClick?.(edge)}
              >
                <CarOutlined /> {edge.vehicle || '路线'} · {edge.distance ? `${edge.distance}米` : edge.instruction || `${edge.from} -> ${edge.to}`}
              </Tag>
            ))}
            {pathEdges.length > 5 && <Tag>其余 {pathEdges.length - 5} 段可在结果列表查看</Tag>}
          </div>
        )}

        {!routeResult && (
          <Alert
            type="info"
            showIcon
            message="等待路径规划结果"
            description="选择起点和终点后，地图将展示高德路线；如果后端仍返回旧节点路径，地图会自动回退兼容显示。"
            style={{ marginTop: 16 }}
          />
        )}
      </Spin>
    </Card>
  );
}

export default RouteMap;
