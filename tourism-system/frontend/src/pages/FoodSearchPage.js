import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Input, 
  Select, 
  Button, 
  List, 
  Typography, 
  Space, 
  Tag, 
  Row, 
  Col,
  Spin,
  message,
  Empty
} from 'antd';
import { SearchOutlined, FireOutlined, EnvironmentOutlined, ShopOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { Option } = Select;

const FoodSearchPage = () => {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('place_001'); // 默认选择北京邮电大学
  const [selectedCuisine, setSelectedCuisine] = useState('');
  const [cuisines, setCuisines] = useState([]);
  const [total, setTotal] = useState(0);

  // 获取菜系列表
  useEffect(() => {
    fetchCuisines();
  }, []);

  // 初始加载美食数据
  useEffect(() => {
    fetchFoods();
  }, [selectedPlace, selectedCuisine]);

  const fetchCuisines = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/foods/cuisines');
      if (response.data.success) {
        setCuisines(response.data.data);
      }
    } catch (error) {
      message.error('获取菜系列表失败');
    }
  };

  const fetchFoods = async () => {
    setLoading(true);
    try {
      const params = {
        placeId: selectedPlace,
        sortBy: 'popularity',
        limit: 12
      };

      if (selectedCuisine) {
        params.cuisine = selectedCuisine;
      }

      if (searchText.trim()) {
        params.search = searchText.trim();
      }

      const response = await axios.get('http://localhost:5001/api/foods', { params });
      
      if (response.data.success) {
        setFoods(response.data.data);
        setTotal(response.data.total);
      } else {
        message.error('获取美食数据失败');
      }
    } catch (error) {
      message.error('网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchFoods();
  };

  const handleCuisineChange = (value) => {
    setSelectedCuisine(value);
  };

  const handlePlaceChange = (value) => {
    setSelectedPlace(value);
  };

  const getCuisineColor = (cuisine) => {
    return cuisine === '中式' ? 'red' : 'blue';
  };

  const getPopularityLevel = (popularity) => {
    if (popularity >= 3000) return { text: '超高人气', color: 'red' };
    if (popularity >= 2500) return { text: '高人气', color: 'orange' };
    if (popularity >= 2000) return { text: '中等人气', color: 'green' };
    return { text: '一般人气', color: 'default' };
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
          <ShopOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          美食搜索
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          发现周边美食，享受味蕾盛宴
        </Text>
      </div>
      
      <Card style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '32px',
        border: 'none',
      }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Text strong style={{ color: '#2c3e50', fontSize: '16px' }}>选择场所：</Text>
            <Select
              style={{ width: '100%', marginTop: '8px', borderRadius: '12px' }}
              value={selectedPlace}
              onChange={handlePlaceChange}
              placeholder="选择场所"
              size="large"
            >
              <Option value="place_001">
                <Space>
                  <EnvironmentOutlined style={{ color: '#1890ff' }} />
                  北京邮电大学
                </Space>
              </Option>
            </Select>
          </Col>
          
          <Col xs={24} sm={12} md={6}>
            <Text strong style={{ color: '#2c3e50', fontSize: '16px' }}>菜系筛选：</Text>
            <Select
              style={{ width: '100%', marginTop: '8px', borderRadius: '12px' }}
              value={selectedCuisine}
              onChange={handleCuisineChange}
              placeholder="选择菜系"
              allowClear
              size="large"
            >
              {cuisines.map(cuisine => (
                <Option key={cuisine} value={cuisine}>
                  <Space>
                    <FireOutlined style={{ color: '#fa8c16' }} />
                    {cuisine}
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={24} sm={12} md={12}>
            <Text strong style={{ color: '#2c3e50', fontSize: '16px' }}>美食搜索：</Text>
            <Input.Search
              style={{ marginTop: '8px', borderRadius: '12px' }}
              placeholder="输入美食名称进行搜索（支持模糊搜索）"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
              enterButton={
                <Button 
                  type="primary" 
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                  }}
                >
                  🔍 搜索
                </Button>
              }
              size="large"
            />
          </Col>
        </Row>
      </Card>

      <div style={{
        borderRadius: '16px',
        border: 'none',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        background: 'white',
        overflow: 'hidden',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
          padding: '20px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
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
                <ShopOutlined style={{ color: '#faad14', fontSize: '20px' }} />
              </div>
              <div>
                <Title level={4} style={{ 
                  margin: 0, 
                  color: 'white', 
                  fontSize: '20px', 
                  fontWeight: 'bold',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  🍽️ 搜索结果
                </Title>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontSize: '13px',
                  display: 'block',
                  marginTop: '2px'
                }}>
                  共找到 {total} 道美食，显示热度前 {Math.min(foods.length, 12)} 名
                </Text>
              </div>
            </Space>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <Spin spinning={loading}>
            {foods.length === 0 ? (
              <Empty 
                description="暂无美食数据"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                grid={{ 
                  gutter: 16, 
                  xs: 1, 
                  sm: 2, 
                  md: 2, 
                  lg: 3, 
                  xl: 3, 
                  xxl: 4 
                }}
                dataSource={foods}
                renderItem={(food, index) => {
                  const popularityInfo = getPopularityLevel(food.popularity);
                  return (
                    <List.Item>
                      <Card
                        hoverable
                        style={{ height: '100%' }}
                        bodyStyle={{ padding: '16px' }}
                      >
                        <div style={{ marginBottom: '12px' }}>
                          <Space>
                            <Tag color="gold">#{index + 1}</Tag>
                            <Tag color={getCuisineColor(food.cuisine)}>
                              {food.cuisine}
                            </Tag>
                            <Tag color={popularityInfo.color}>
                              {popularityInfo.text}
                            </Tag>
                          </Space>
                        </div>
                        
                        <Title level={4} style={{ marginBottom: '8px' }}>
                          {food.name}
                        </Title>
                        
                        <Text type="secondary" style={{ display: 'block', marginBottom: '12px' }}>
                          {food.description}
                        </Text>
                        
                        <div style={{ marginBottom: '8px' }}>
                          <Space>
                            <FireOutlined style={{ color: '#ff4d4f' }} />
                            <Text strong style={{ color: '#ff4d4f' }}>
                              热度: {food.popularity}
                            </Text>
                          </Space>
                        </div>
                        
                        <div style={{ marginBottom: '8px' }}>
                          <Space>
                            <Text strong style={{ color: '#52c41a' }}>
                              价格: {food.price}
                            </Text>
                          </Space>
                        </div>
                        
                        <div>
                          <Space>
                            <EnvironmentOutlined style={{ color: '#1890ff' }} />
                            <Text type="secondary">{food.location}</Text>
                          </Space>
                        </div>
                      </Card>
                    </List.Item>
                  );
                }}
              />
            )}
          </Spin>
        </div>
      </div>
    </div>
  );
};

export default FoodSearchPage; 