import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Select, Input, Form, message, Spin, List, Tag, Steps, Radio, Alert, Modal, Typography, Space } from 'antd';
import { EnvironmentOutlined, CarOutlined, ClockCircleOutlined, LineOutlined, InfoCircleOutlined, RightOutlined, SettingOutlined } from '@ant-design/icons';
import { planSingleRoute, planMultiRoute, getBuildings, getFacilities, getPlaces } from '../services/api';
import RouteMap from '../components/RouteMap';

const { Option, OptGroup } = Select;
const { Step } = Steps;
const { Title, Text } = Typography;

function RoutePage() {
  const [loading, setLoading] = useState(false);
  const [routeType, setRouteType] = useState('single');
  const [strategy, setStrategy] = useState('distance'); // 默认最短距离
  const [useMixedVehicles, setUseMixedVehicles] = useState(false); // 是否使用混合交通工具
  const [places, setPlaces] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [routeResult, setRouteResult] = useState(null);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [segmentModalVisible, setSegmentModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPlaces();
  }, []);

  useEffect(() => {
    if (selectedPlace) {
      loadPlaceData(selectedPlace);
    }
  }, [selectedPlace]);

  const loadPlaces = async () => {
    try {
      const placesRes = await getPlaces();
      if (placesRes.success) {
        setPlaces(placesRes.data);
      }
    } catch (error) {
      message.error('加载场所数据失败');
    }
  };

  const loadPlaceData = async (placeId) => {
    try {
      setLoading(true);
      const [buildingsRes, facilitiesRes] = await Promise.all([
        getBuildings(placeId),
        getFacilities(placeId)
      ]);
      
      if (buildingsRes.success) {
        setBuildings(buildingsRes.data);
      }
      if (facilitiesRes.success) {
        setFacilities(facilitiesRes.data);
      }
    } catch (error) {
      message.error('加载场所内部数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getAllLocations = () => {
    if (!selectedPlace) return [];
    
    const locations = [];
    
    buildings.forEach(building => {
      locations.push({
        id: building.id,
        name: building.name,
        type: '建筑物',
        placeId: building.placeId
      });
    });
    
    return locations;
  };

  // 获取按场所分组的建筑物和设施
  const getLocationsByPlace = () => {
    const locationsByPlace = {};
    
    // 添加建筑物
    buildings.forEach(building => {
      const place = places.find(p => p.id === building.placeId);
      const placeName = place ? place.name : '未知场所';
      
      if (!locationsByPlace[placeName]) {
        locationsByPlace[placeName] = { buildings: [], facilities: [] };
      }
      
      locationsByPlace[placeName].buildings.push({
        id: building.id,
        name: building.name,
        type: building.type || '建筑物'
      });
    });

    // 添加设施
    facilities.forEach(facility => {
      const place = places.find(p => p.id === facility.placeId);
      const placeName = place ? place.name : '未知场所';
      
      if (!locationsByPlace[placeName]) {
        locationsByPlace[placeName] = { buildings: [], facilities: [] };
      }
      
      locationsByPlace[placeName].facilities.push({
        id: facility.id,
        name: facility.name,
        type: facility.type || '设施'
      });
    });
    
    return locationsByPlace;
  };

  // 渲染建筑物和设施选项（按类型分组）
  const renderLocationOptions = () => {
    const options = [];
    
    // 添加建筑物选项
    if (buildings.length > 0) {
      options.push(
        <OptGroup key="buildings" label="📍 建筑物">
          {buildings.map(building => (
            <Option key={building.id} value={building.id}>
              🏢 {building.name}
            </Option>
          ))}
        </OptGroup>
      );
    }
    
    // 添加设施选项（过滤掉路口类型）
    const filteredFacilities = facilities.filter(facility => facility.type !== '路口');
    if (filteredFacilities.length > 0) {
      options.push(
        <OptGroup key="facilities" label="🎯 设施">
          {filteredFacilities.map(facility => (
            <Option key={facility.id} value={facility.id}>
              🏪 {facility.name} ({facility.type})
            </Option>
          ))}
        </OptGroup>
      );
    }
    
    return options;
  };

  // 获取当前场所类型
  const getCurrentPlaceType = () => {
    if (!selectedPlace) return '景区';
    const place = places.find(p => p.id === selectedPlace);
    return place?.type === '校园' ? '校园' : '景区';
  };

  // 获取可用的交通工具
  const getAvailableVehicles = () => {
    const placeType = getCurrentPlaceType();
    if (placeType === '校园') {
      return ['步行', '自行车'];
    } else {
      return ['步行', '电瓶车'];
    }
  };

  const handlePlaceChange = (placeId) => {
    setSelectedPlace(placeId);
    setRouteResult(null);
    form.resetFields(['start', 'end', 'destinations', 'vehicle']);
  };

  const handleStrategyChange = (e) => {
    setStrategy(e.target.value);
    setRouteResult(null);
    // 如果切换到最短距离，清除交通工具选择和混合模式
    if (e.target.value === 'distance') {
      form.setFieldsValue({ vehicle: undefined });
      setUseMixedVehicles(false);
    }
  };

  // 处理路径段点击
  const handleSegmentClick = (segment) => {
    setSelectedSegment(segment);
    setSegmentModalVisible(true);
  };

  // 关闭路径段详情模态框
  const handleSegmentModalClose = () => {
    setSegmentModalVisible(false);
    setSelectedSegment(null);
  };

  const handlePlanRoute = async (values) => {
    if (!selectedPlace) {
      message.warning('请先选择场所');
      return;
    }

    setLoading(true);
    try {
      let response;
      const placeType = getCurrentPlaceType();
      
      if (routeType === 'single') {
        response = await planSingleRoute({
          placeId: selectedPlace,
          start: values.start,
          end: values.end,
          strategy: strategy,
          vehicle: values.vehicle,
          placeType: placeType,
          useMixedVehicles: useMixedVehicles
        });
      } else {
        // 多目标路径只考虑最短距离
        response = await planMultiRoute({
          placeId: selectedPlace,
          start: values.start,
          destinations: values.destinations,
          algorithm: values.algorithm
        });
      }
      
      if (response.success) {
        setRouteResult(response.data);
        message.success('路径规划成功');
      }
    } catch (error) {
      message.error('路径规划失败');
    } finally {
      setLoading(false);
    }
  };

  const renderRouteResult = () => {
    if (!routeResult) return null;

    return (
      <>
        {/* 地图可视化 */}
        <RouteMap
          routeResult={routeResult}
          buildings={buildings}
          facilities={facilities}
          selectedPlace={selectedPlace}
          onSegmentClick={handleSegmentClick}
        />

        <Card title="路径规划结果" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={24}>
              <div style={{ marginBottom: 16 }}>
                <Tag color="blue" icon={<CarOutlined />}>
                  交通工具: {routeResult.vehicle || '不限'}
                </Tag>
                <Tag color="purple" icon={<EnvironmentOutlined />}>
                  策略: {routeResult.strategy === 'distance' ? '最短距离' : '最短时间'}
                </Tag>
                {routeResult.algorithm_name && (
                  <Tag color="cyan" icon={<LineOutlined />}>
                    算法: {routeResult.algorithm_name}
                  </Tag>
                )}
                {routeResult.total_time && (
                  <Tag color="green" icon={<ClockCircleOutlined />}>
                    总时间: {routeResult.total_time.toFixed(2)} 分钟
                  </Tag>
                )}
                <Tag color="orange" icon={<LineOutlined />}>
                  总距离: {(routeResult.total_distance || routeResult.cost)?.toFixed(0)} 米
                </Tag>
              </div>
            </Col>
          </Row>

          {/* 显示可用交通工具（仅最短时间策略） */}
          {routeResult.available_vehicles && (
            <div style={{ marginBottom: 16 }}>
              <h4>可用交通工具:</h4>
              <div>
                {routeResult.available_vehicles.map(vehicle => (
                  <Tag key={vehicle} color="cyan">{vehicle}</Tag>
                ))}
              </div>
            </div>
          )}

          {routeResult.path && (
            <div style={{ marginTop: 16 }}>
              <h4>路径节点:</h4>
              <Steps direction="vertical" size="small">
                {routeResult.path.map((node, index) => (
                  <Step
                    key={index}
                    title={`节点 ${index + 1}`}
                    description={node}
                    status={index === 0 ? 'process' : index === routeResult.path.length - 1 ? 'finish' : 'wait'}
                  />
                ))}
              </Steps>
            </div>
          )}

          {/* 显示详细路径信息（最短时间策略的混合交通工具信息） */}
          {routeResult.detailed_info && routeResult.detailed_info.segments && (
            <div style={{ marginTop: 16 }}>
              <h4>详细路径（混合交通工具）:</h4>
              <List
                size="small"
                dataSource={routeResult.detailed_info.segments}
                renderItem={(segment, index) => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSegmentClick(segment)}
                  >
                    <div style={{ width: '100%' }}>
                      <div style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 'bold' }}>
                          {index + 1}. {segment.from} → {segment.to}
                        </span>
                      </div>
                      <div>
                        <Tag color="blue">{segment.vehicle}</Tag>
                        <Tag color="green">距离: {segment.distance}米</Tag>
                        <Tag color="orange">时间: {segment.time.toFixed(1)}分钟</Tag>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
              <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                💡 点击路径段可查看详细信息
              </div>
            </div>
          )}

          {routeResult.detailed_path && !routeResult.detailed_info?.segments && (
            <div style={{ marginTop: 16 }}>
              <h4>详细路径:</h4>
              <List
                size="small"
                dataSource={routeResult.detailed_path}
                renderItem={(item, index) => (
                  <List.Item>
                    <span style={{ marginRight: 8 }}>{index + 1}.</span>
                    {item}
                  </List.Item>
                )}
              />
            </div>
          )}

          {routeResult.destinations_order && (
            <div style={{ marginTop: 16 }}>
              <h4>访问顺序:</h4>
              <List
                size="small"
                dataSource={routeResult.destinations_order}
                renderItem={(item, index) => (
                  <List.Item>
                    <span style={{ marginRight: 8 }}>{index + 1}.</span>
                    {item}
                  </List.Item>
                )}
              />
            </div>
          )}

          {routeResult.message && (
            <Alert
              message={routeResult.message}
              type="success"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          {/* 显示不可达目标点警告 */}
          {routeResult.unreachable_destinations && routeResult.unreachable_destinations.length > 0 && (
            <Alert
              message="部分目标点不可达"
              description={
                <div>
                  <p>以下目标点无法从起点到达，已从路径规划中排除：</p>
                  <div>
                    {routeResult.unreachable_destinations.map(dest => (
                      <Tag key={dest} color="red" style={{ marginBottom: 4 }}>
                        {dest}
                      </Tag>
                    ))}
                  </div>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          {/* 显示详细信息中的警告 */}
          {routeResult.detailed_info?.warning && (
            <Alert
              message="路径规划警告"
              description={routeResult.detailed_info.warning}
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}

          {/* 显示错误信息 */}
          {routeResult.detailed_info?.error && (
            <Alert
              message="路径规划失败"
              description={routeResult.detailed_info.error}
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>
      </>
    );
  };

  return (
    <div className="content-wrapper" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: '100vh' }}>
      <div className="page-header" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        marginBottom: '32px',
        textAlign: 'center',
        color: 'white',
      }}>
        <Title level={2} style={{ margin: 0, color: 'white', fontSize: '28px', fontWeight: 'bold' }}>
          <EnvironmentOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          智能路径规划
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          智能路径规划，支持单点到单点和多目标路径，提供最优出行方案
        </Text>
      </div>

      <Row gutter={24}>
        <Col xs={24} md={12}>
          <div style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
          }}>
            {/* 路径规划设置标题栏 */}
            <div style={{
              background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
              padding: '20px 24px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* 装饰性背景元素 */}
              <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '80px',
                height: '80px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                opacity: 0.6,
              }} />
              <div style={{
                position: 'absolute',
                bottom: '-15px',
                left: '-15px',
                width: '60px',
                height: '60px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '50%',
              }} />
              
              <div style={{ position: 'relative', zIndex: 1 }}>
                <Space size="middle" align="center">
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '10px',
                    padding: '10px',
                    backdropFilter: 'blur(10px)',
                  }}>
                    <SettingOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                  </div>
                  <div>
                    <Title level={4} style={{ 
                      margin: 0, 
                      color: 'white', 
                      fontSize: '20px', 
                      fontWeight: 'bold',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                      路径规划设置
                    </Title>
                    <Text style={{ 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontSize: '13px',
                      display: 'block',
                      marginTop: '2px'
                    }}>
                      智能路径规划与导航
                    </Text>
                  </div>
                </Space>
              </div>
            </div>

            {/* 路径规划设置内容区域 */}
            <div style={{ padding: '24px' }}>
              <Form form={form} layout="vertical" onFinish={handlePlanRoute}>
                <Form.Item 
                  label="选择场所"
                  rules={[{ required: true, message: '请选择场所' }]}
                >
                  <Select 
                    placeholder="请先选择要规划路径的场所"
                    value={selectedPlace}
                    onChange={handlePlaceChange}
                  >
                    {places.map(place => (
                      <Option key={place.id} value={place.id}>
                        {place.name} ({place.type})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label="规划类型">
                  <Select value={routeType} onChange={setRouteType}>
                    <Option value="single">单点到单点</Option>
                    <Option value="multi">多目标路径</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  name="start"
                  label="起点"
                  rules={[{ required: true, message: '请选择起点' }]}
                >
                  <Select
                    placeholder={selectedPlace ? "选择起点" : "请先选择场所"}
                    disabled={!selectedPlace}
                    showSearch
                    filterOption={(input, option) =>
                      option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                    }
                  >
                    {renderLocationOptions()}
                  </Select>
                </Form.Item>

                {routeType === 'single' ? (
                  <Form.Item
                    name="end"
                    label="终点"
                    rules={[{ required: true, message: '请选择终点' }]}
                  >
                    <Select
                      placeholder={selectedPlace ? "选择终点" : "请先选择场所"}
                      disabled={!selectedPlace}
                      showSearch
                      filterOption={(input, option) =>
                        option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {renderLocationOptions()}
                    </Select>
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="destinations"
                    label="目标点"
                    rules={[{ required: true, message: '请选择至少一个目标点' }]}
                  >
                    <Select
                      mode="multiple"
                      placeholder={selectedPlace ? "选择多个目标点" : "请先选择场所"}
                      disabled={!selectedPlace}
                      showSearch
                      filterOption={(input, option) =>
                        option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                      }
                    >
                      {renderLocationOptions()}
                    </Select>
                  </Form.Item>
                )}

                {routeType === 'single' && (
                  <>
                    <Form.Item
                      name="strategy"
                      label="优化策略"
                      initialValue="distance"
                      rules={[{ required: true, message: '请选择优化策略' }]}
                    >
                      <Radio.Group onChange={handleStrategyChange} value={strategy}>
                        <Radio.Button value="distance">最短距离</Radio.Button>
                        <Radio.Button value="time">最短时间</Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    {/* 策略说明 */}
                    <Alert
                      message={
                        strategy === 'distance' 
                          ? "最短距离策略：只考虑路径距离，不限制交通工具" 
                          : "最短时间策略：考虑道路拥挤度和交通工具，可混合使用多种交通工具"
                      }
                      type="info"
                      showIcon
                      icon={<EnvironmentOutlined />}
                      style={{ marginBottom: 16 }}
                    />

                    {/* 只在最短时间策略时显示交通工具选择 */}
                    {strategy === 'time' && (
                      <>
                        <Form.Item label="交通工具模式">
                          <Radio.Group 
                            value={useMixedVehicles ? 'mixed' : 'single'} 
                            onChange={(e) => {
                              const isMixed = e.target.value === 'mixed';
                              setUseMixedVehicles(isMixed);
                              setRouteResult(null);
                              if (isMixed) {
                                form.setFieldsValue({ vehicle: undefined });
                              }
                            }}
                          >
                            <Radio.Button value="single">指定交通工具</Radio.Button>
                            <Radio.Button value="mixed">混合交通工具（自动优化）</Radio.Button>
                          </Radio.Group>
                        </Form.Item>

                        {!useMixedVehicles && (
                          <Form.Item
                            name="vehicle"
                            label={`选择交通工具 (${getCurrentPlaceType()})`}
                            rules={[{ required: true, message: '请选择交通工具' }]}
                            extra={`当前场所支持的交通工具：${getAvailableVehicles().join('、')}`}
                          >
                            <Select placeholder="请选择一种交通工具">
                              {getAvailableVehicles().map(vehicle => (
                                <Option key={vehicle} value={vehicle}>
                                  {vehicle}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        )}

                        {useMixedVehicles && (
                          <Alert
                            message="混合交通工具模式：系统将自动选择最优的交通工具组合以实现最短时间"
                            type="success"
                            showIcon
                            style={{ marginBottom: 16 }}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {routeType === 'multi' && (
                  <>
                    <Alert
                      message="多目标路径规划：只考虑最短距离策略，不限制交通工具"
                      type="info"
                      showIcon
                      icon={<EnvironmentOutlined />}
                      style={{ marginBottom: 16 }}
                    />
                    
                    <Form.Item
                      name="algorithm"
                      label="算法选择"
                      initialValue="nearest_neighbor"
                      rules={[{ required: true, message: '请选择算法' }]}
                    >
                      <Select>
                        <Option value="nearest_neighbor">最近邻算法（快速贪心）</Option>
                        <Option value="dynamic_programming">动态规划（精确最优，适用于≤8个目标点）</Option>
                        <Option value="simulated_annealing">模拟退火算法（随机优化，适用于大规模问题）</Option>
                        <Option value="genetic_algorithm">遗传算法（进化优化，全局搜索能力强）</Option>
                      </Select>
                    </Form.Item>
                    
                    <Alert
                      message={
                        <div>
                          <strong>算法选择建议：</strong>
                          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                            <li><strong>最近邻算法</strong>：速度最快，适合快速规划</li>
                            <li><strong>动态规划</strong>：保证最优解，但仅适用于8个以内目标点</li>
                            <li><strong>模拟退火</strong>：平衡速度与质量，适合10+个目标点</li>
                            <li><strong>遗传算法</strong>：全局搜索，适合复杂优化场景</li>
                          </ul>
                        </div>
                      }
                      type="success"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                  </>
                )}

                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading} block>
                    <EnvironmentOutlined />
                    开始规划路径
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </div>
        </Col>

        <Col xs={24} md={12}>
          {renderRouteResult()}
        </Col>
      </Row>

      {/* 路径段详情模态框 */}
      <Modal
        title="路径段详细信息"
        open={segmentModalVisible}
        onCancel={handleSegmentModalClose}
        footer={[
          <Button key="close" onClick={handleSegmentModalClose}>
            关闭
          </Button>
        ]}
        width={500}
      >
        {selectedSegment && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Card size="small" title="起点">
                  <p><strong>名称:</strong> {selectedSegment.from}</p>
                  <p><strong>ID:</strong> {selectedSegment.fromId}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="终点">
                  <p><strong>名称:</strong> {selectedSegment.to}</p>
                  <p><strong>ID:</strong> {selectedSegment.toId}</p>
                </Card>
              </Col>
            </Row>
            
            <Card size="small" title="路径信息">
              <Row gutter={16}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <CarOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                    <p style={{ margin: '8px 0 4px', fontWeight: 'bold' }}>交通工具</p>
                    <Tag color="blue">{selectedSegment.vehicle}</Tag>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <LineOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                    <p style={{ margin: '8px 0 4px', fontWeight: 'bold' }}>距离</p>
                    <Tag color="green">{selectedSegment.distance} 米</Tag>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <ClockCircleOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
                    <p style={{ margin: '8px 0 4px', fontWeight: 'bold' }}>时间</p>
                    <Tag color="orange">{selectedSegment.time?.toFixed(1)} 分钟</Tag>
                  </div>
                </Col>
              </Row>
            </Card>

            {selectedSegment.coordinates && (
              <Card size="small" title="坐标信息" style={{ marginTop: 16 }}>
                <p><strong>起点坐标:</strong> {selectedSegment.coordinates[0]?.join(', ')}</p>
                <p><strong>终点坐标:</strong> {selectedSegment.coordinates[1]?.join(', ')}</p>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default RoutePage; 