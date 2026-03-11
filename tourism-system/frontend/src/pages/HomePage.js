import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Statistic,
  List,
  Avatar,
  Button,
  Typography,
  Space,
  Rate,
  Tag,
  Spin,
  Empty
} from 'antd';
import {
  EnvironmentOutlined,
  BookOutlined,
  UserOutlined,
  EyeOutlined,
  RightOutlined,
  FireOutlined,
  StarOutlined,
  BarChartOutlined,
  NodeIndexOutlined
} from '@ant-design/icons';
import { getStatistics, getRecommendedPlaces, getRecommendedDiaries, getPlaces, getFileUrl } from '../services/api';

const { Title, Paragraph, Text } = Typography;

function HomePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [recommendedPlaces, setRecommendedPlaces] = useState([]);
  const [recommendedDiaries, setRecommendedDiaries] = useState([]);
  const [popularPlaces, setPopularPlaces] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 获取当前用户信息
      const savedUser = localStorage.getItem('user');
      const currentUserId = savedUser ? JSON.parse(savedUser).id : 'user_001';
      
      // 并行加载数据
      const [
        statsResult,
        placesResult,
        diariesResult,
        popularResult
      ] = await Promise.allSettled([
        getStatistics(),
        getRecommendedPlaces(currentUserId, 'hybrid'),
        getRecommendedDiaries(currentUserId, 'content'),
        getPlaces()
      ]);

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data);
      }
      
      if (placesResult.status === 'fulfilled') {
        setRecommendedPlaces(placesResult.value.data.slice(0, 4));
      }
      
      if (diariesResult.status === 'fulfilled') {
        setRecommendedDiaries(diariesResult.value.data.slice(0, 6));
      }
      
      if (popularResult.status === 'fulfilled') {
        // 按评分排序并取前5个
        const sortedPlaces = popularResult.value.data.sort((a, b) => b.rating - a.rating);
        setPopularPlaces(sortedPlaces.slice(0, 5));
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceClick = (placeId) => {
    navigate(`/places/${placeId}`);
  };

  const handleDiaryClick = (diaryId) => {
    navigate(`/diaries/${diaryId}`);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: '100vh', padding: '0' }}>
      {/* 欢迎横幅 */}
      <Card
        style={{
          marginBottom: 32,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          color: '#fff',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <Row align="middle">
          <Col span={16}>
            <Title level={1} style={{ 
              color: '#fff', 
              marginBottom: 16,
              fontSize: '36px',
              fontWeight: 'bold',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              🌟 欢迎来到个性化旅游系统
            </Title>
            <Paragraph style={{ 
              color: 'rgba(255,255,255,0.95)', 
              fontSize: 18, 
              marginBottom: 24,
              lineHeight: 1.6,
              textShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              发现精彩旅程，记录美好时光，让AI为您推荐最适合的旅游目的地
            </Paragraph>
            <Space size="large">
              <Button 
                type="primary" 
                size="large" 
                onClick={() => navigate('/places')}
                style={{ 
                  background: 'rgba(255,255,255,0.2)', 
                  borderColor: 'transparent',
                  borderRadius: '12px',
                  height: '48px',
                  padding: '0 24px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                icon={<EnvironmentOutlined />}
              >
                🗺️ 浏览场所
              </Button>
              <Button 
                size="large" 
                onClick={() => navigate('/diaries')}
                style={{ 
                  color: '#fff', 
                  borderColor: 'rgba(255,255,255,0.8)',
                  background: 'rgba(255,255,255,0.1)',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  height: '48px',
                  padding: '0 24px',
                  fontSize: '16px',
                  backdropFilter: 'blur(10px)',
                }}
                icon={<BookOutlined />}
              >
                📖 旅游日记
              </Button>
            </Space>
          </Col>
          <Col span={8} style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: 120, 
              opacity: 0.4,
              textShadow: '0 4px 8px rgba(0,0,0,0.1)',
              animation: 'float 3s ease-in-out infinite'
            }}>
              🏞️
            </div>
          </Col>
        </Row>
      </Card>

      {/* 统计数据 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={6}>
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            overflow: 'hidden',
          }}>
            <Statistic
              title={<span style={{ color: '#2c3e50', fontWeight: 600 }}>旅游场所</span>}
              value={stats.places || 0}
              prefix={<EnvironmentOutlined style={{ color: '#27ae60' }} />}
              valueStyle={{ color: '#27ae60', fontWeight: 'bold', fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            overflow: 'hidden',
          }}>
            <Statistic
              title={<span style={{ color: '#2c3e50', fontWeight: 600 }}>旅游日记</span>}
              value={stats.diaries || 0}
              prefix={<BookOutlined style={{ color: '#e74c3c' }} />}
              valueStyle={{ color: '#e74c3c', fontWeight: 'bold', fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, #a8caba 0%, #5d4e75 100%)',
            overflow: 'hidden',
          }}>
            <Statistic
              title={<span style={{ color: 'white', fontWeight: 600 }}>注册用户</span>}
              value={stats.users || 0}
              prefix={<UserOutlined style={{ color: '#3498db' }} />}
              valueStyle={{ color: '#3498db', fontWeight: 'bold', fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
            overflow: 'hidden',
          }}>
            <Statistic
              title={<span style={{ color: '#2c3e50', fontWeight: 600 }}>路径网络</span>}
              value={stats.roads || 0}
              prefix={<NodeIndexOutlined style={{ color: '#9b59b6' }} />}
              valueStyle={{ color: '#9b59b6', fontWeight: 'bold', fontSize: '28px' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* 推荐场所 */}
        <Col xs={24} lg={12}>
          <div style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
          }}>
            {/* 推荐场所标题栏 */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space size="middle" align="center">
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '10px',
                        padding: '10px',
                        backdropFilter: 'blur(10px)',
                      }}>
                        <StarOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                      </div>
                      <div>
                        <Title level={4} style={{ 
                          margin: 0, 
                          color: 'white', 
                          fontSize: '20px', 
                          fontWeight: 'bold',
                          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}>
                          🎯 为您推荐的场所
                        </Title>
                        <Text style={{ 
                          color: 'rgba(255, 255, 255, 0.9)', 
                          fontSize: '13px',
                          display: 'block',
                          marginTop: '2px'
                        }}>
                          基于您的偏好智能推荐
                        </Text>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Button 
                      type="text"
                      onClick={() => navigate('/places')}
                      icon={<RightOutlined />}
                      style={{
                        color: 'white',
                        fontWeight: 'bold',
                        background: 'rgba(255, 255, 255, 0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        height: 'auto',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      查看更多
                    </Button>
                  </Col>
                </Row>
              </div>
            </div>

            {/* 推荐场所内容区域 */}
            <div style={{ padding: '24px' }}>
              {recommendedPlaces.length > 0 ? (
                <List
                  dataSource={recommendedPlaces}
                  renderItem={(place, index) => (
                    <List.Item
                      className="place-card"
                      onClick={() => handlePlaceClick(place.id)}
                      style={{ 
                        cursor: 'pointer', 
                        padding: '16px 0',
                        borderBottom: index === recommendedPlaces.length - 1 ? 'none' : '1px solid #f0f0f0',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
                        e.currentTarget.style.borderRadius = '12px';
                        e.currentTarget.style.padding = '16px 12px';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderRadius = '0';
                        e.currentTarget.style.padding = '16px 0';
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size={56}
                            src={place.image ? getFileUrl(place.image) : null}
                            icon={<EnvironmentOutlined />}
                            style={{
                              border: '3px solid #f0f0f0',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            }}
                          />
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ 
                              fontWeight: 'bold', 
                              color: '#2c3e50',
                              fontSize: '16px',
                            }}>
                              {place.name}
                            </span>
                            <Tag 
                              color="blue" 
                              style={{
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '11px',
                              }}
                            >
                              #{index + 1}
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <div style={{ marginBottom: 8 }}>
                              <Rate disabled value={place.rating || 0} style={{ fontSize: 14 }} />
                              <span style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>
                                {place.rating?.toFixed(1) || '0.0'} ({place.ratingCount || 0}人)
                              </span>
                            </div>
                            <Text 
                              style={{ 
                                color: '#666', 
                                fontSize: 13,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {place.description || '暂无描述'}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty 
                  description="暂无推荐场所" 
                  style={{ margin: '40px 0' }}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </div>
        </Col>

        {/* 热门场所 */}
        <Col xs={24} lg={12}>
          <div style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
          }}>
            {/* 热门场所标题栏 */}
            <div style={{
              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
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
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space size="middle" align="center">
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '10px',
                        padding: '10px',
                        backdropFilter: 'blur(10px)',
                      }}>
                        <FireOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                      </div>
                      <div>
                        <Title level={4} style={{ 
                          margin: 0, 
                          color: 'white', 
                          fontSize: '20px', 
                          fontWeight: 'bold',
                          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                        }}>
                          🔥 热门场所排行
                        </Title>
                        <Text style={{ 
                          color: 'rgba(255, 255, 255, 0.9)', 
                          fontSize: '13px',
                          display: 'block',
                          marginTop: '2px'
                        }}>
                          最受欢迎的旅游目的地
                        </Text>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Button 
                      type="text"
                      onClick={() => navigate('/places')}
                      icon={<RightOutlined />}
                      style={{
                        color: 'white',
                        fontWeight: 'bold',
                        background: 'rgba(255, 255, 255, 0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '20px',
                        padding: '8px 16px',
                        height: 'auto',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      查看更多
                    </Button>
                  </Col>
                </Row>
              </div>
            </div>

            {/* 热门场所内容区域 */}
            <div style={{ padding: '24px' }}>
              {popularPlaces.length > 0 ? (
                <List
                  dataSource={popularPlaces}
                  renderItem={(place, index) => (
                    <List.Item
                      className="place-card"
                      onClick={() => handlePlaceClick(place.id)}
                      style={{ 
                        cursor: 'pointer', 
                        padding: '16px 0',
                        borderBottom: index === popularPlaces.length - 1 ? 'none' : '1px solid #f0f0f0',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'linear-gradient(135deg, #fff5f5 0%, #ffe8e8 100%)';
                        e.currentTarget.style.borderRadius = '12px';
                        e.currentTarget.style.padding = '16px 12px';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderRadius = '0';
                        e.currentTarget.style.padding = '16px 0';
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: index < 3 
                              ? `linear-gradient(135deg, ${index === 0 ? '#ffd700, #ffed4e' : index === 1 ? '#c0c0c0, #e8e8e8' : '#cd7f32, #daa520'})` 
                              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: '18px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            border: '3px solid white',
                          }}>
                            {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                          </div>
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ 
                              fontWeight: 'bold', 
                              color: '#2c3e50',
                              fontSize: '16px',
                            }}>
                              {place.name}
                            </span>
                            <Tag 
                              color={index < 3 ? 'gold' : 'default'}
                              style={{
                                borderRadius: '12px',
                                fontWeight: 'bold',
                                fontSize: '11px',
                              }}
                            >
                              {index < 3 ? 'TOP' : `#${index + 1}`}
                            </Tag>
                          </div>
                        }
                        description={
                          <div>
                            <div style={{ marginBottom: 8 }}>
                              <Rate disabled value={place.rating || 0} style={{ fontSize: 14 }} />
                              <span style={{ marginLeft: 8, color: '#666', fontSize: 13 }}>
                                {place.rating?.toFixed(1) || '0.0'} ({place.ratingCount || 0}人)
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Tag 
                                color="orange" 
                                style={{
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                }}
                              >
                                🔥 {place.clickCount || 0} 浏览
                              </Tag>
                              <Tag 
                                color="blue" 
                                style={{
                                  borderRadius: '8px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                }}
                              >
                                📍 {place.type || '景点'}
                              </Tag>
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty 
                  description="暂无热门场所" 
                  style={{ margin: '40px 0' }}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* 推荐日记 */}
      <Card
        style={{
          marginTop: 32,
          borderRadius: '16px',
          border: 'none',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          background: 'white',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        {/* 精选日记标题栏 */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 装饰性背景元素 */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '150px',
            height: '150px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            opacity: 0.6,
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-30px',
            left: '-30px',
            width: '100px',
            height: '100px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Row justify="space-between" align="middle">
              <Col>
                <Space size="large" align="center">
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '12px',
                    backdropFilter: 'blur(10px)',
                  }}>
                    <BookOutlined style={{ color: '#faad14', fontSize: '24px' }} />
                  </div>
                  <div>
                    <Title level={3} style={{ 
                      margin: 0, 
                      color: 'white', 
                      fontSize: '24px', 
                      fontWeight: 'bold',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                      📖 精选旅游日记
                    </Title>
                    <Text style={{ 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontSize: '14px',
                      display: 'block',
                      marginTop: '4px'
                    }}>
                      发现精彩故事，分享旅行感悟
                    </Text>
                  </div>
                </Space>
              </Col>
              <Col>
                <Button 
                  type="text"
                  onClick={() => navigate('/diaries')}
                  icon={<RightOutlined />}
                  style={{
                    color: 'white',
                    fontWeight: 'bold',
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '20px',
                    padding: '8px 16px',
                    height: 'auto',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.25)';
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  查看更多
                </Button>
              </Col>
            </Row>
          </div>
        </div>

        {/* 日记内容区域 */}
        <div style={{ padding: '32px 24px' }}>
          {recommendedDiaries.length > 0 ? (
            <Row gutter={[24, 24]}>
              {recommendedDiaries.map((diary, index) => (
                <Col xs={24} sm={12} lg={8} key={diary.id}>
                  <Card
                    className="diary-card"
                    onClick={() => handleDiaryClick(diary.id)}
                    style={{ 
                      cursor: 'pointer',
                      borderRadius: '16px',
                      border: 'none',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                    bodyStyle={{ padding: 0 }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-8px)';
                      e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
                    }}
                  >
                    {/* 图片/视频封面 */}
                    <div style={{ 
                      height: 180, 
                      position: 'relative',
                      overflow: 'hidden',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    }}>
                      {diary.images && diary.images.length > 0 ? (
                        <img
                          alt={diary.title}
                          src={getFileUrl(diary.images[0])}
                          style={{ 
                            height: '100%', 
                            width: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.3s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                          }}
                        />
                      ) : diary.videos && diary.videos.length > 0 ? (
                        <video
                          style={{ 
                            height: '100%', 
                            width: '100%', 
                            objectFit: 'cover',
                            transition: 'transform 0.3s ease',
                          }}
                          src={getFileUrl(diary.videos[0])}
                          muted
                          preload="metadata"
                          onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                          }}
                        />
                      ) : (
                        <div style={{ 
                          height: '100%', 
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          flexDirection: 'column',
                          color: 'white'
                        }}>
                          <BookOutlined style={{ fontSize: 48, marginBottom: 8, opacity: 0.8 }} />
                          <Text style={{ color: 'white', fontSize: 14, opacity: 0.9 }}>精彩文字</Text>
                        </div>
                      )}
                      
                      {/* 推荐标签 */}
                      {index < 3 && (
                        <div style={{
                          position: 'absolute',
                          top: 12,
                          left: 12,
                          background: index === 0 
                            ? 'linear-gradient(135deg, #ff6b6b, #ee5a52)' 
                            : index === 1 
                              ? 'linear-gradient(135deg, #4ecdc4, #44a08d)' 
                              : 'linear-gradient(135deg, #45b7d1, #96c93d)',
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: 12,
                          fontWeight: 'bold',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                          backdropFilter: 'blur(10px)',
                        }}>
                          {index === 0 ? '🔥 热门' : index === 1 ? '⭐ 推荐' : '✨ 精选'}
                        </div>
                      )}
                      
                      {/* 媒体类型标签 */}
                      <div style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        background: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontSize: 11,
                        fontWeight: '600',
                        backdropFilter: 'blur(10px)',
                      }}>
                        {diary.images?.length > 0 ? `📷 ${diary.images.length}` : 
                         diary.videos?.length > 0 ? `🎬 ${diary.videos.length}` : '📝'}
                      </div>
                    </div>

                    {/* 内容区域 */}
                    <div style={{ padding: '20px' }}>
                      <Title level={5} style={{ 
                        margin: '0 0 12px 0', 
                        fontSize: 16,
                        fontWeight: 'bold',
                        color: '#2c3e50',
                        lineHeight: 1.4,
                        height: '44px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {diary.title}
                      </Title>
                      
                      {/* 评分和浏览量 */}
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <Rate disabled value={diary.rating || 0} style={{ fontSize: 14 }} />
                          <Text style={{ 
                            marginLeft: 8, 
                            fontSize: 13, 
                            color: '#fa8c16',
                            fontWeight: '600'
                          }}>
                            {diary.rating?.toFixed(1) || '0.0'}
                          </Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <EyeOutlined style={{ fontSize: 12, color: '#999' }} />
                          <Text style={{ marginLeft: 4, fontSize: 12, color: '#999' }}>
                            {diary.clickCount || 0}
                          </Text>
                        </div>
                      </div>
                      
                      {/* 标签 */}
                      {diary.tags && diary.tags.length > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '6px',
                          marginTop: 8
                        }}>
                          {diary.tags.slice(0, 3).map((tag) => (
                            <Tag 
                              key={tag} 
                              style={{
                                margin: 0,
                                borderRadius: '12px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                                color: 'white',
                                fontSize: 11,
                                padding: '2px 8px',
                              }}
                            >
                              {tag}
                            </Tag>
                          ))}
                          {diary.tags.length > 3 && (
                            <Tag style={{
                              margin: 0,
                              borderRadius: '12px',
                              border: '1px solid #d9d9d9',
                              background: '#f5f5f5',
                              color: '#666',
                              fontSize: 11,
                              padding: '2px 8px',
                            }}>
                              +{diary.tags.length - 3}
                            </Tag>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty 
              description="暂无推荐日记"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '40px 0' }}
            />
          )}
        </div>
      </Card>

      {/* 快速操作 */}
      <Card
        style={{
          marginTop: 32,
          borderRadius: '16px',
          border: 'none',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          background: 'white',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        {/* 快速操作标题栏 */}
        <div style={{
          background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
          padding: '20px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 装饰性背景元素 */}
          <div style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '100px',
            height: '100px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            opacity: 0.6,
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Space size="middle" align="center">
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                padding: '10px',
                backdropFilter: 'blur(10px)',
              }}>
                <NodeIndexOutlined style={{ color: '#faad14', fontSize: '20px' }} />
              </div>
              <div>
                <Title level={4} style={{ 
                  margin: 0, 
                  color: 'white', 
                  fontSize: '20px', 
                  fontWeight: 'bold',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  🚀 快速操作
                </Title>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontSize: '13px',
                  display: 'block',
                  marginTop: '2px'
                }}>
                  一键直达，高效便捷
                </Text>
              </div>
            </Space>
          </div>
        </div>

        {/* 快速操作按钮区域 */}
        <div style={{ padding: '32px 24px' }}>
          <Row gutter={[20, 20]}>
            <Col xs={12} sm={6}>
              <div
                onClick={() => navigate('/places')}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.3)';
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '60px',
                  height: '60px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                }} />
                <EnvironmentOutlined style={{ 
                  fontSize: '32px', 
                  color: 'white',
                  marginBottom: '12px',
                  display: 'block'
                }} />
                <Text style={{ 
                  color: 'white', 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  display: 'block'
                }}>
                  浏览场所
                </Text>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.8)', 
                  fontSize: '12px',
                  display: 'block',
                  marginTop: '4px'
                }}>
                  发现精彩地点
                </Text>
              </div>
            </Col>
            
            <Col xs={12} sm={6}>
              <div
                onClick={() => navigate('/diaries?create=true')}
                style={{
                  background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
                  borderRadius: '16px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 16px rgba(78, 205, 196, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(78, 205, 196, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(78, 205, 196, 0.3)';
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '60px',
                  height: '60px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                }} />
                <BookOutlined style={{ 
                  fontSize: '32px', 
                  color: 'white',
                  marginBottom: '12px',
                  display: 'block'
                }} />
                <Text style={{ 
                  color: 'white', 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  display: 'block'
                }}>
                  写游记
                </Text>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.8)', 
                  fontSize: '12px',
                  display: 'block',
                  marginTop: '4px'
                }}>
                  记录美好时光
                </Text>
              </div>
            </Col>
            
            <Col xs={12} sm={6}>
              <div
                onClick={() => navigate('/route-planning')}
                style={{
                  background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                  borderRadius: '16px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 16px rgba(252, 182, 159, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(252, 182, 159, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(252, 182, 159, 0.3)';
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '60px',
                  height: '60px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%',
                }} />
                <RightOutlined style={{ 
                  fontSize: '32px', 
                  color: '#d4380d',
                  marginBottom: '12px',
                  display: 'block'
                }} />
                <Text style={{ 
                  color: '#d4380d', 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  display: 'block'
                }}>
                  路线规划
                </Text>
                <Text style={{ 
                  color: 'rgba(212, 56, 13, 0.8)', 
                  fontSize: '12px',
                  display: 'block',
                  marginTop: '4px'
                }}>
                  智能路径推荐
                </Text>
              </div>
            </Col>
            
            <Col xs={12} sm={6}>
              <div
                onClick={() => navigate('/stats')}
                style={{
                  background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                  borderRadius: '16px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 16px rgba(168, 237, 234, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(168, 237, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(168, 237, 234, 0.3)';
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '60px',
                  height: '60px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%',
                }} />
                <BarChartOutlined style={{ 
                  fontSize: '32px', 
                  color: '#2c3e50',
                  marginBottom: '12px',
                  display: 'block'
                }} />
                <Text style={{ 
                  color: '#2c3e50', 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  display: 'block'
                }}>
                  统计分析
                </Text>
                <Text style={{ 
                  color: 'rgba(44, 62, 80, 0.8)', 
                  fontSize: '12px',
                  display: 'block',
                  marginTop: '4px'
                }}>
                  数据洞察分析
                </Text>
              </div>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  );
}

export default HomePage; 