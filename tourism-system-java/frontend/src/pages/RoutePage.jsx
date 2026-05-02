import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AutoComplete,
  Alert,
  Button,
  Card,
  Col,
  Input,
  List,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  AimOutlined,
  CarOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  LineOutlined,
} from '@ant-design/icons';
import RouteMap from '../components/RouteMap';
import { loadAMap } from '../utils/amapLoader';
import { getCurrentLocation } from '../utils/location';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

const CURRENT_LOCATION_VALUE = '__current_location__';
const AMAP_ROUTE_PLUGINS = ['AMap.AutoComplete', 'AMap.Driving', 'AMap.Walking', 'AMap.Riding'];

const toCoordinate = (location) => {
  if (!location) {
    return null;
  }

  if (Array.isArray(location) && location.length >= 2) {
    return [Number(location[0]), Number(location[1])];
  }

  if (typeof location.getLng === 'function' && typeof location.getLat === 'function') {
    return [Number(location.getLng()), Number(location.getLat())];
  }

  if (typeof location.lng === 'number' && typeof location.lat === 'number') {
    return [location.lng, location.lat];
  }

  return null;
};

const formatPoiOption = (poi) => {
  const coordinate = toCoordinate(poi.location);
  return {
    value: poi.id || `${poi.name}-${poi.address || ''}-${coordinate?.join(',') || ''}`,
    label: poi.name,
    title: poi.name,
    poi: {
      id: poi.id,
      name: poi.name,
      address: [poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join(' '),
      coordinate,
      type: poi.type,
    },
  };
};

const buildSearchService = (AMap) =>
  new AMap.AutoComplete({
    city: '全国',
    citylimit: false,
  });

const loadAmapPlugins = (AMap, plugins) =>
  new Promise((resolve, reject) => {
    if (!AMap?.plugin) {
      reject(new Error('高德插件加载能力不可用'));
      return;
    }

    AMap.plugin(plugins, () => resolve());
  });

const loadAmapServices = (AMap, services) =>
  new Promise((resolve, reject) => {
    if (!AMap?.service) {
      resolve();
      return;
    }

    try {
      AMap.service(services, () => resolve());
    } catch (error) {
      reject(error);
    }
  });

const getPrimaryRoute = (result) => {
  if (Array.isArray(result?.routes) && result.routes.length > 0) {
    return result.routes[0];
  }
  if (Array.isArray(result?.route?.paths) && result.route.paths.length > 0) {
    return result.route.paths[0];
  }
  return null;
};

const extractStepPath = (step) => {
  if (Array.isArray(step?.path)) {
    return step.path
      .map((point) => toCoordinate(point))
      .filter(Boolean);
  }

  if (typeof step?.polyline === 'string') {
    return step.polyline
      .split(';')
      .map((point) => point.split(',').map(Number))
      .filter((point) => point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  }

  return [];
};

const buildRouteResultFromAmap = ({ route, mode, origin, destination }) => {
  const steps = Array.isArray(route?.steps) ? route.steps : [];
  const mapSegments = steps.map((step, index) => {
    const coordinates = extractStepPath(step);
    return {
      key: `amap-segment-${index}`,
      from: index === 0 ? origin.name : '继续前进',
      to: step.road || step.instruction || destination.name,
      vehicle: mode,
      distance: Number(step.distance || step.step_distance || 0),
      time: Number(step.time || step.duration || step.cost?.duration || 0) / 60,
      instruction: step.instruction || step.road || `第 ${index + 1} 段`,
      coordinates,
    };
  });

  const mapPath = mapSegments.flatMap((segment, index) => {
    if (index === 0) {
      return segment.coordinates;
    }
    return segment.coordinates.slice(1);
  });

  const totalDistance = Number(route?.distance || 0);
  const totalTime = Number(route?.time || route?.duration || 0) / 60;

  return {
    provider: 'amap',
    mapProvider: 'amap',
    source: 'amap-jsapi',
    vehicle: mode,
    strategy: 'time',
    total_distance: totalDistance,
    total_time: totalTime,
    path: [origin.name, destination.name],
    detailed_path: mapSegments.map((segment) => segment.instruction),
    detailed_info: { segments: mapSegments },
    mapPath,
    mapSegments,
    startLocation: origin,
    endLocation: destination,
  };
};

function RoutePage() {
  const location = useLocation();
  const placeSearchRef = useRef(null);
  const routeServiceRef = useRef({});

  const [amapReady, setAmapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchingStart, setSearchingStart] = useState(false);
  const [searchingEnd, setSearchingEnd] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState('');
  const [startOptions, setStartOptions] = useState([]);
  const [endOptions, setEndOptions] = useState([]);
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [startKeyword, setStartKeyword] = useState('');
  const [endKeyword, setEndKeyword] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [travelMode, setTravelMode] = useState('步行');
  const [routeResult, setRouteResult] = useState(null);

  const searchPois = useCallback(async (keyword, field) => {
    const normalizedKeyword = String(keyword || '').trim();
    if (!normalizedKeyword) {
      if (field === 'start') {
        setStartOptions([]);
      } else {
        setEndOptions([]);
      }
      return;
    }

    const setSearching = field === 'start' ? setSearchingStart : setSearchingEnd;
    const setOptions = field === 'start' ? setStartOptions : setEndOptions;

    if (!placeSearchRef.current) {
      return;
    }

    setSearching(true);
    try {
      const options = await new Promise((resolve, reject) => {
        placeSearchRef.current.search(normalizedKeyword, (status, result) => {
          if (status !== 'complete') {
            reject(new Error(typeof result === 'string' ? result : '高德地点搜索失败'));
            return;
          }

          const pois = Array.isArray(result?.tips) ? result.tips : [];
          resolve(
            pois
              .map(formatPoiOption)
              .filter((item) => Array.isArray(item.poi.coordinate))
          );
        });
      });

      setOptions(options);

      if (field === 'end' && location.state?.presetDestinationKeyword === normalizedKeyword && options[0]) {
        setSelectedEnd({
          ...options[0].poi,
          selectionValue: options[0].value,
        });
        setEndKeyword(options[0].label);
      }
    } catch (error) {
      message.error(error.message || '地点搜索失败');
      setOptions([]);
    } finally {
      setSearching(false);
    }
  }, [location.state]);

  useEffect(() => {
    let cancelled = false;

    const setupAmap = async () => {
      try {
        const AMap = await loadAMap({ plugins: AMAP_ROUTE_PLUGINS });
        await loadAmapPlugins(AMap, AMAP_ROUTE_PLUGINS);
        await loadAmapServices(AMap, AMAP_ROUTE_PLUGINS);
        if (cancelled) {
          return;
        }

        placeSearchRef.current = buildSearchService(AMap);
        routeServiceRef.current = {
          步行: new AMap.Walking({ hideMarkers: false }),
          驾车: new AMap.Driving({
            policy: AMap.DrivingPolicy?.LEAST_TIME,
            extensions: 'all',
          }),
          骑行: new AMap.Riding({}),
        };
        setAmapReady(true);
        setMapError('');
      } catch (error) {
        if (!cancelled) {
          setMapError(error.message || '高德地图初始化失败');
        }
      }
    };

    setupAmap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const presetKeyword = location.state?.presetDestinationKeyword;
    if (!presetKeyword || !amapReady) {
      return;
    }

    searchPois(presetKeyword, 'end');
  }, [amapReady, location.state, searchPois]);

  const routeSteps = useMemo(
    () => routeResult?.detailed_path || [],
    [routeResult]
  );

  const resolveCurrentLocation = async () => {
    if (currentLocation?.coordinate) {
      return currentLocation;
    }

    const locationResult = await getCurrentLocation();
    const resolved = {
      value: CURRENT_LOCATION_VALUE,
      label: '我的位置',
      title: '我的位置',
      poi: {
        id: CURRENT_LOCATION_VALUE,
        name: '我的位置',
        address: '当前定位点',
        coordinate: [locationResult.lng, locationResult.lat],
        type: '定位',
        selectionValue: CURRENT_LOCATION_VALUE,
      },
    };
    setCurrentLocation(resolved.poi);
    return resolved.poi;
  };

  const handleSelectOption = (value, field) => {
    const options = field === 'start' ? startOptions : endOptions;
    const matched = options.find((option) => option.value === value);
    if (!matched) {
      return;
    }

    if (field === 'start') {
      setSelectedStart({
        ...matched.poi,
        selectionValue: matched.value,
      });
      setStartKeyword(matched.label);
    } else {
      setSelectedEnd({
        ...matched.poi,
        selectionValue: matched.value,
      });
      setEndKeyword(matched.label);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const poi = await resolveCurrentLocation();
      setSelectedStart(poi);
      setStartKeyword('我的位置');
      message.success(`已定位当前位置：${poi.coordinate[1].toFixed(5)}, ${poi.coordinate[0].toFixed(5)}`);
    } catch (error) {
      message.error(error.message || '定位失败');
    } finally {
      setLocating(false);
    }
  };

  const handlePlanRoute = async () => {
    if (!selectedStart || !selectedEnd) {
      message.warning('请先选择出发地和目的地');
      return;
    }

    const service = routeServiceRef.current[travelMode];
    if (!service) {
      message.error('当前出行方式未初始化');
      return;
    }

    setLoading(true);
    try {
      const AMap = await loadAMap({ plugins: AMAP_ROUTE_PLUGINS });
      const origin = new AMap.LngLat(selectedStart.coordinate[0], selectedStart.coordinate[1]);
      const destination = new AMap.LngLat(selectedEnd.coordinate[0], selectedEnd.coordinate[1]);

      const result = await new Promise((resolve, reject) => {
        service.search(origin, destination, (status, response) => {
          if (status !== 'complete') {
            reject(new Error(typeof response === 'string' ? response : '高德路线规划失败'));
            return;
          }
          resolve(response);
        });
      });

      const route = getPrimaryRoute(result);
      if (!route) {
        throw new Error('高德未返回可用路线');
      }

      const normalizedMode = travelMode === '骑行' ? '骑行' : travelMode === '驾车' ? '驾车' : '步行';
      setRouteResult(
        buildRouteResultFromAmap({
          route,
          mode: normalizedMode,
          origin: selectedStart,
          destination: selectedEnd,
        })
      );
      message.success('已生成高德导航路线');
    } catch (error) {
      setRouteResult(null);
      message.error(error.message || '高德路线规划失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <div
        className="page-header"
        style={{
          background: 'var(--glass-surface)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          padding: '34px',
          borderRadius: '18px',
          border: '1px solid var(--glass-border-strong)',
          boxShadow: 'var(--glass-shadow)',
          marginBottom: '26px',
        }}
      >
        <Title level={2} style={{ margin: 0, color: 'var(--text-primary)' }}>
          <CompassOutlined style={{ marginRight: 12 }} />
          高德导航
        </Title>
        <Paragraph style={{ color: 'var(--text-secondary)', marginTop: 10, marginBottom: 0, fontSize: 15 }}>
          这一页完全使用高德 API：地址搜索、定位、路线规划和地图展示都不再查你的数据库。
        </Paragraph>
      </div>

      <Row gutter={24} align="stretch">
        <Col xs={24} xl={8}>
          <Card
            style={{ borderRadius: 18, border: 'none', boxShadow: '0 18px 36px rgba(22, 42, 70, 0.08)' }}
            bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div>
              <Title level={4} style={{ marginBottom: 6 }}>地址选择栏</Title>
              <Text type="secondary">直接搜索高德地点或地址作为出发地和目的地。</Text>
            </div>

            {mapError && (
              <Alert
                type="error"
                showIcon
                message="高德地图不可用"
                description={mapError}
              />
            )}

            <div>
              <Text strong>出发地</Text>
              <AutoComplete
                size="large"
                style={{ width: '100%', marginTop: 8 }}
                options={startOptions}
                onSearch={(value) => {
                  setStartKeyword(value);
                  setSelectedStart(null);
                  searchPois(value, 'start');
                }}
                onChange={(value) => setStartKeyword(value)}
                onSelect={(value) => handleSelectOption(value, 'start')}
                value={startKeyword}
              >
                <Input placeholder={searchingStart ? '正在搜索高德地点...' : '输入关键词搜索高德地点'} />
              </AutoComplete>
            </div>

            <Space wrap>
              <Button icon={<AimOutlined />} onClick={handleUseCurrentLocation} loading={locating}>
                使用当前位置
              </Button>
              {currentLocation && (
                <Tag color="cyan">
                  {currentLocation.coordinate[1].toFixed(5)}, {currentLocation.coordinate[0].toFixed(5)}
                </Tag>
              )}
            </Space>

            <div>
              <Text strong>目的地</Text>
              <AutoComplete
                size="large"
                style={{ width: '100%', marginTop: 8 }}
                options={endOptions}
                onSearch={(value) => {
                  setEndKeyword(value);
                  setSelectedEnd(null);
                  searchPois(value, 'end');
                }}
                onChange={(value) => setEndKeyword(value)}
                onSelect={(value) => handleSelectOption(value, 'end')}
                value={endKeyword}
              >
                <Input placeholder={searchingEnd ? '正在搜索高德地点...' : '输入关键词搜索高德地点'} />
              </AutoComplete>
            </div>

            <div>
              <Text strong>出行方式</Text>
              <Select
                size="large"
                style={{ width: '100%', marginTop: 8 }}
                value={travelMode}
                onChange={setTravelMode}
              >
                <Option value="步行">步行</Option>
                <Option value="骑行">骑行</Option>
                <Option value="驾车">驾车</Option>
              </Select>
            </div>

            <Button type="primary" size="large" onClick={handlePlanRoute} loading={loading} disabled={!amapReady}>
              开始高德导航
            </Button>

            {routeResult && (
              <Card size="small" style={{ borderRadius: 14, background: '#f8fbff' }}>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Tag color="processing">高德导航</Tag>
                  <Tag color="blue" icon={<CarOutlined />}>{routeResult.vehicle}</Tag>
                  <Tag color="green" icon={<ClockCircleOutlined />}>
                    {routeResult.total_time ? `${routeResult.total_time.toFixed(1)} 分钟` : '暂无耗时'}
                  </Tag>
                  <Tag color="purple" icon={<LineOutlined />}>
                    {routeResult.total_distance ? `${routeResult.total_distance.toFixed(0)} 米` : '暂无距离'}
                  </Tag>
                </Space>

                <Title level={5} style={{ marginBottom: 10 }}>导航步骤</Title>
                <List
                  size="small"
                  dataSource={routeSteps}
                  locale={{ emptyText: '暂无导航步骤' }}
                  renderItem={(step, index) => (
                    <List.Item>
                      <Text>{index + 1}. {step}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <RouteMap
            routeResult={routeResult}
            buildings={[]}
            facilities={[]}
            currentLocation={currentLocation ? { lng: currentLocation.coordinate[0], lat: currentLocation.coordinate[1] } : null}
            onLocationChange={(locationResult) => {
              setCurrentLocation({
                id: CURRENT_LOCATION_VALUE,
                name: '我的位置',
                address: '当前定位点',
                coordinate: [locationResult.lng, locationResult.lat],
                type: '定位',
              });
            }}
            showControls={false}
            mapHeight={760}
          />
        </Col>
      </Row>

      {!amapReady && !mapError && (
        <Alert
          type="info"
          showIcon
          message="高德资源加载中"
          description="请稍等，地图和搜索服务正在初始化。"
          style={{ marginTop: 20 }}
        />
      )}
    </div>
  );
}

export default RoutePage;
