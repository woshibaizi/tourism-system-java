import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  List,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  AimOutlined,
  BuildOutlined,
  CarOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  LineOutlined,
} from '@ant-design/icons';
import { getBuildings, getFacilities, getPlaces, planSingleRoute } from '../services/api';
import RouteMap from '../components/RouteMap';
import { getCurrentLocation } from '../utils/location';

const { Title, Paragraph, Text } = Typography;
const { Option, OptGroup } = Select;

const CURRENT_LOCATION_OPTION = '__campus_current_location__';
const BUPT_PLACE_ID = 'place_001';

const formatCampusPoint = (item, sourceType) => ({
  id: item.id,
  name: item.name,
  type: item.type || (sourceType === 'building' ? '建筑物' : '设施'),
  sourceType,
  lat: Number(item.lat),
  lng: Number(item.lng),
});

function CampusNavigationPage() {
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [campusPlace, setCampusPlace] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedStart, setSelectedStart] = useState();
  const [selectedEnd, setSelectedEnd] = useState();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeResult, setRouteResult] = useState(null);

  useEffect(() => {
    loadCampusData();
  }, []);

  const loadCampusData = async () => {
    setLoading(true);
    try {
      const placesResponse = await getPlaces();
      if (!placesResponse.success) {
        throw new Error('加载校园数据失败');
      }

      const matchedCampus = (placesResponse.data || []).find((place) => place.id === BUPT_PLACE_ID)
        || (placesResponse.data || []).find((place) => place.type === '校园' || String(place.name || '').includes('北京邮电大学'));

      if (!matchedCampus) {
        throw new Error('没有找到北京邮电大学校园数据');
      }

      setCampusPlace(matchedCampus);

      const [buildingsResponse, facilitiesResponse] = await Promise.all([
        getBuildings(matchedCampus.id),
        getFacilities(matchedCampus.id),
      ]);

      setBuildings(Array.isArray(buildingsResponse?.data) ? buildingsResponse.data : []);
      setFacilities(Array.isArray(facilitiesResponse?.data) ? facilitiesResponse.data : []);
    } catch (error) {
      message.error(error.message || '加载校内导航数据失败');
    } finally {
      setLoading(false);
    }
  };

  const campusPoints = useMemo(() => {
    const buildingPoints = buildings
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
      .map((item) => formatCampusPoint(item, 'building'));
    const facilityPoints = facilities
      .filter((item) => item.type !== '路口')
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
      .map((item) => formatCampusPoint(item, 'facility'));
    return [...buildingPoints, ...facilityPoints];
  }, [buildings, facilities]);

  const groupedPoints = useMemo(() => {
    const gates = campusPoints.filter((point) => String(point.name).includes('门') || String(point.type).includes('门') || String(point.type).includes('公交站'));
    const teaching = campusPoints.filter((point) => String(point.type).includes('教学') || String(point.name).includes('教学') || String(point.name).includes('教'));
    const dorms = campusPoints.filter((point) => String(point.type).includes('宿舍') || String(point.name).includes('公寓'));
    const service = campusPoints.filter((point) => !gates.includes(point) && !teaching.includes(point) && !dorms.includes(point));

    return { gates, teaching, dorms, service };
  }, [campusPoints]);

  const resolveCurrentLocation = async () => {
    if (currentLocation?.lat != null && currentLocation?.lng != null) {
      return currentLocation;
    }
    const location = await getCurrentLocation();
    setCurrentLocation(location);
    return location;
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const location = await resolveCurrentLocation();
      setSelectedStart(CURRENT_LOCATION_OPTION);
      message.success(`已定位当前位置：${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
    } catch (error) {
      message.error(error.message || '定位失败');
    } finally {
      setLocating(false);
    }
  };

  const handleCampusNavigate = async () => {
    if (!selectedStart || !selectedEnd || !campusPlace) {
      message.warning('请先选择起点和终点');
      return;
    }

    setNavigating(true);
    try {
      const startPayload = selectedStart === CURRENT_LOCATION_OPTION
        ? await resolveCurrentLocation()
        : null;

      const response = await planSingleRoute({
        placeId: campusPlace.id,
        start: selectedStart === CURRENT_LOCATION_OPTION ? null : selectedStart,
        startLat: startPayload?.lat,
        startLng: startPayload?.lng,
        startName: selectedStart === CURRENT_LOCATION_OPTION ? '我的位置' : undefined,
        end: selectedEnd,
        vehicle: '步行',
        strategy: 'time',
        placeType: '校园',
        provider: 'local',
      });

      if (!response.success) {
        throw new Error(response.message || '校内导航失败');
      }

      setRouteResult(response.data);
      message.success('已生成北邮校内导航路线');
    } catch (error) {
      setRouteResult(null);
      message.error(error.message || '校内导航失败');
    } finally {
      setNavigating(false);
    }
  };

  const routeSteps = routeResult?.detailed_path
    || routeResult?.detailed_info?.segments?.map((segment) => `${segment.from} → ${segment.to}`)
    || [];

  const renderPointOptions = (includeCurrentLocation = false) => (
    <>
      {includeCurrentLocation && (
        <OptGroup key="current-location" label="当前位置">
          <Option value={CURRENT_LOCATION_OPTION}>我的位置</Option>
        </OptGroup>
      )}
      {groupedPoints.gates.length > 0 && (
        <OptGroup key="gates" label="校门与入口">
          {groupedPoints.gates.map((point) => (
            <Option key={point.id} value={point.id} title={point.name}>
              {point.name}
            </Option>
          ))}
        </OptGroup>
      )}
      {groupedPoints.teaching.length > 0 && (
        <OptGroup key="teaching" label="教学与科研">
          {groupedPoints.teaching.map((point) => (
            <Option key={point.id} value={point.id} title={point.name}>
              {point.name}
            </Option>
          ))}
        </OptGroup>
      )}
      {groupedPoints.dorms.length > 0 && (
        <OptGroup key="dorms" label="宿舍与生活区">
          {groupedPoints.dorms.map((point) => (
            <Option key={point.id} value={point.id} title={point.name}>
              {point.name}
            </Option>
          ))}
        </OptGroup>
      )}
      {groupedPoints.service.length > 0 && (
        <OptGroup key="service" label="服务与设施">
          {groupedPoints.service.map((point) => (
            <Option key={point.id} value={point.id} title={point.name}>
              {point.name}
            </Option>
          ))}
        </OptGroup>
      )}
    </>
  );

  const schoolTab = (
    <Row gutter={24} align="stretch">
      <Col xs={24} xl={8}>
        <Card
          style={{ borderRadius: 18, border: 'none', boxShadow: '0 18px 36px rgba(22, 42, 70, 0.08)' }}
          bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <div>
            <Title level={4} style={{ marginBottom: 6 }}>学校内导航</Title>
            <Text type="secondary">先基于你现有的北邮校园点位和最短路算法做步行导航，地图用高德承载显示。</Text>
          </div>

          {campusPlace && (
            <Alert
              type="info"
              showIcon
              message={campusPlace.name}
              description={campusPlace.description}
            />
          )}

          <div>
            <Text strong>起点</Text>
            <Select
              size="large"
              style={{ width: '100%', marginTop: 8 }}
              placeholder="选择校内起点"
              value={selectedStart}
              onChange={setSelectedStart}
              showSearch
              filterOption={(input, option) =>
                String(option?.title || option?.children || '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {renderPointOptions(true)}
            </Select>
          </div>

          <Space wrap>
            <Button icon={<AimOutlined />} loading={locating} onClick={handleUseCurrentLocation}>
              使用当前位置
            </Button>
            {currentLocation && (
              <Tag color="cyan">
                {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
              </Tag>
            )}
          </Space>

          <div>
            <Text strong>终点</Text>
            <Select
              size="large"
              style={{ width: '100%', marginTop: 8 }}
              placeholder="选择校内终点"
              value={selectedEnd}
              onChange={setSelectedEnd}
              showSearch
              filterOption={(input, option) =>
                String(option?.title || option?.children || '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {renderPointOptions(false)}
            </Select>
          </div>

          <Button type="primary" size="large" loading={navigating} onClick={handleCampusNavigate}>
            开始校内导航
          </Button>

          {routeResult && (
            <Card size="small" style={{ borderRadius: 14, background: '#f8fbff' }}>
              <Space wrap style={{ marginBottom: 12 }}>
                <Tag color="processing">北邮校内步行</Tag>
                <Tag color="blue" icon={<CarOutlined />}>{routeResult.vehicle || '步行'}</Tag>
                <Tag color="green" icon={<ClockCircleOutlined />}>
                  {routeResult.total_time ? `${routeResult.total_time.toFixed(1)} 分钟` : '暂无耗时'}
                </Tag>
                <Tag color="purple" icon={<LineOutlined />}>
                  {routeResult.total_distance ? `${routeResult.total_distance.toFixed(0)} 米` : '暂无距离'}
                </Tag>
              </Space>
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
          buildings={buildings}
          facilities={facilities}
          currentLocation={currentLocation}
          onLocationChange={setCurrentLocation}
          showControls={false}
          mapHeight={760}
        />
      </Col>
    </Row>
  );

  const indoorTab = (
    <Card style={{ borderRadius: 18, border: 'none', boxShadow: '0 18px 36px rgba(22, 42, 70, 0.08)' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ marginBottom: 6 }}>
            <HomeOutlined style={{ marginRight: 10 }} />
            室内导航
          </Title>
          <Text type="secondary">
            这一块先保留到后续开发。下一阶段会把现有楼内 JSON 图和楼层切换逻辑接进来，再和校园路径拼接成完整校内导航。
          </Text>
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <Alert
          type="warning"
          showIcon
          message="暂未开放"
          description="先完成学校内导航，再把教学楼/宿舍楼内路线接进来，避免初版把校内和室内逻辑混在一起导致体验不稳定。"
        />
      </Space>
    </Card>
  );

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="加载北邮校内导航数据..." />
      </div>
    );
  }

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
          校内导航
        </Title>
        <Paragraph style={{ color: 'var(--text-secondary)', marginTop: 10, marginBottom: 0, fontSize: 15 }}>
          使用高德地图承载展示，路径走你现有的校园路网和算法。
        </Paragraph>
      </div>

      <Tabs
        defaultActiveKey="school"
        items={[
          {
            key: 'school',
            label: (
              <span>
                <BuildOutlined />
                学校内导航
              </span>
            ),
            children: schoolTab,
          },
          {
            key: 'indoor',
            label: (
              <span>
                <EnvironmentOutlined />
                室内导航
              </span>
            ),
            children: indoorTab,
          },
        ]}
      />
    </div>
  );
}

export default CampusNavigationPage;
