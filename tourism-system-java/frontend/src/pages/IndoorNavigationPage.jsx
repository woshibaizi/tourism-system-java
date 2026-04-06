import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Select, 
  Button, 
  Typography, 
  Space, 
  Steps, 
  Alert, 
  Row, 
  Col,
  Spin,
  message,
  Switch,
  Divider,
  Tag,
  Timeline
} from 'antd';
import { 
  HomeOutlined, 
  EnvironmentOutlined, 
  ClockCircleOutlined,
  RightOutlined,
  UpOutlined,
  DownOutlined,
  CompassOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const IndoorNavigationPage = () => {
  const [buildingInfo, setBuildingInfo] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [avoidCongestion, setAvoidCongestion] = useState(true);
  const [navigationResult, setNavigationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // 初始化数据
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setInitialLoading(true);
      
      // 并行加载建筑信息和房间列表
      const [buildingResponse, roomsResponse] = await Promise.all([
        api.get('/indoor/building'),
        api.get('/indoor/rooms')
      ]);

      if (buildingResponse.success) {
        setBuildingInfo(buildingResponse.data);
      }

      if (roomsResponse.success) {
        setRooms(roomsResponse.data);
      }
    } catch (error) {
      message.error('加载数据失败');
      console.error('加载数据失败:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleNavigate = async () => {
    if (!selectedRoom) {
      message.warning('请选择目标房间');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/indoor/navigate', {
        roomId: selectedRoom,
        avoidCongestion: avoidCongestion
      });

      if (response.success) {
        setNavigationResult(response.data);
        message.success('导航路径计算成功');
      } else {
        message.error(response.message || '导航计算失败');
        setNavigationResult(null);
      }
    } catch (error) {
      message.error('导航计算失败');
      console.error('导航计算失败:', error);
      setNavigationResult(null);
    } finally {
      setLoading(false);
    }
  };

  const getFloorColor = (floor) => {
    const colors = ['blue', 'green', 'orange'];
    return colors[(floor - 1) % colors.length];
  };

  const getStepIcon = (step) => {
    if (step.floor_change) {
      return step.from.includes('楼') && step.to.includes('楼') ? 
        <UpOutlined /> : <RightOutlined />;
    }
    return <RightOutlined />;
  };

  if (initialLoading) {
    return (
      <div style={{ 
        padding: '24px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        minHeight: '400px'
      }}>
        <Spin size="large" tip="加载室内导航系统..." />
      </div>
    );
  }

  return (
    <div className="content-wrapper" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: '100vh' }}>
      {/* 页面标题 */}
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
          <CompassOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          室内导航
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          智能室内导航系统，为您提供最优路径规划
        </Text>
      </div>
      
      {buildingInfo && (
        <Alert
          message={`${buildingInfo.name} - ${buildingInfo.description}`}
          type="info"
          showIcon
          style={{ 
            marginBottom: '32px',
            borderRadius: '12px',
            border: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
        />
      )}

      <Card style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '32px',
        border: 'none',
      }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Text strong style={{ color: '#2c3e50', fontSize: '16px' }}>选择目标房间：</Text>
            <Select
              style={{ width: '100%', marginTop: '8px', borderRadius: '12px' }}
              placeholder="请选择要前往的房间"
              size="large"
              value={selectedRoom}
              onChange={setSelectedRoom}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {rooms.map(room => (
                <Option key={room.id} value={room.id}>
                  <Space>
                    <Tag color={getFloorColor(room.floor)}>{room.floor}楼</Tag>
                    {room.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Text strong>导航选项：</Text>
            <div style={{ marginTop: '8px' }}>
              <Switch
                checked={avoidCongestion}
                onChange={setAvoidCongestion}
                checkedChildren="避开拥挤"
                unCheckedChildren="最短距离"
              />
            </div>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <div style={{ marginTop: '32px' }}>
              <Button 
                type="primary" 
                onClick={handleNavigate}
                loading={loading}
                disabled={!selectedRoom}
                block
              >
                开始导航
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 导航结果 */}
      {navigationResult && (
        <Row gutter={[24, 24]}>
          {/* 路径概览 */}
          <Col xs={24} lg={12}>
            <Card style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white',
              overflow: 'hidden',
              height: '100%'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
                margin: '-24px -24px 24px -24px',
                padding: '20px 24px',
                color: 'white',
              }}>
                <Title level={4} style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
                  🧭 导航概览
                </Title>
              </div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>目的地：</Text>
                  <Tag color={getFloorColor(navigationResult.destination.floor)}>
                    {navigationResult.destination.floor}楼
                  </Tag>
                  {navigationResult.destination.name}
                </div>
                
                <div>
                  <Text strong>总距离：</Text>
                  <Text type="success">{navigationResult.total_distance}米</Text>
                </div>
                
                <div>
                  <Text strong>预计时间：</Text>
                  <Text type="warning">
                    <ClockCircleOutlined /> {navigationResult.estimated_time}分钟
                  </Text>
                </div>
                
                <div>
                  <Text strong>路径策略：</Text>
                  <Tag color={navigationResult.avoid_congestion ? 'orange' : 'blue'}>
                    {navigationResult.avoid_congestion ? '避开拥挤区域' : '最短距离优先'}
                  </Tag>
                </div>

                <Divider />
                
                <Paragraph>
                  <Text strong>路径描述：</Text>
                  <br />
                  {navigationResult.path_description}
                </Paragraph>
              </Space>
            </Card>
          </Col>

          {/* 详细步骤 */}
          <Col xs={24} lg={12}>
            <Card style={{
              borderRadius: '16px',
              border: 'none',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              background: 'white',
              overflow: 'hidden',
              height: '100%'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
                margin: '-24px -24px 24px -24px',
                padding: '20px 24px',
                color: 'white',
              }}>
                <Title level={4} style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
                  📍 导航步骤
                </Title>
              </div>
              <Timeline>
                <Timeline.Item 
                  dot={<HomeOutlined style={{ color: '#1890ff' }} />}
                  color="blue"
                >
                  <Text strong>起点：大门</Text>
                  <br />
                  <Text type="secondary">开始室内导航</Text>
                </Timeline.Item>
                
                {navigationResult.navigation_steps.map((step, index) => (
                  <Timeline.Item
                    key={index}
                    dot={getStepIcon(step)}
                    color={step.floor_change ? 'red' : 'green'}
                  >
                    <div>
                      <Text strong>步骤 {step.step}：{step.action}</Text>
                      {step.floor_change && (
                        <Tag color="red" style={{ marginLeft: '8px' }}>
                          跨楼层
                        </Tag>
                      )}
                      <br />
                      <Text type="secondary">
                        {step.description} ({step.distance}米)
                      </Text>
                    </div>
                  </Timeline.Item>
                ))}
                
                <Timeline.Item 
                  dot={<EnvironmentOutlined style={{ color: '#52c41a' }} />}
                  color="green"
                >
                  <Text strong>到达：{navigationResult.destination.name}</Text>
                  <br />
                  <Text type="secondary">导航完成</Text>
                </Timeline.Item>
              </Timeline>
            </Card>
          </Col>
        </Row>
      )}

      {/* 房间列表 */}
      <Card title="所有房间" style={{ marginTop: '24px' }}>
        <Row gutter={[8, 8]}>
          {[1, 2, 3].map(floor => (
            <Col key={floor} xs={24} sm={8}>
              <Card 
                size="small" 
                title={`${floor}楼房间`}
                headStyle={{ backgroundColor: '#f0f2f5' }}
              >
                <Space wrap>
                  {rooms
                    .filter(room => room.floor === floor)
                    .map(room => (
                      <Tag
                        key={room.id}
                        color={selectedRoom === room.id ? 'blue' : 'default'}
                        style={{ 
                          cursor: 'pointer',
                          marginBottom: '4px'
                        }}
                        onClick={() => setSelectedRoom(room.id)}
                      >
                        {room.name}
                      </Tag>
                    ))
                  }
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default IndoorNavigationPage; 