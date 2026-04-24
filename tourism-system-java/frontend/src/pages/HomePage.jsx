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
      
      const savedUser = localStorage.getItem('user');
      const currentUserId = savedUser ? JSON.parse(savedUser).id : 'user_001';
      
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
      <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="animate-on-load delay-1" style={{ minHeight: '100vh', padding: '0 24px', maxWidth: 1200, margin: '0 auto' }}>
      
      {/* 极简Hero区 */}
      <div
        style={{
          marginBottom: 64,
          padding: '80px 0 60px 0',
          textAlign: 'center',
        }}
      >
        <Title level={1} style={{ 
          fontSize: '56px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--apple-text-primary)'
        }}>
          发现属于你的旅程
        </Title>
        <Paragraph style={{ 
          fontSize: '24px', 
          color: 'var(--apple-text-secondary)',
          fontWeight: 400,
          marginTop: 16,
          marginBottom: 40,
          letterSpacing: '-0.015em'
        }}>
          为你量身定制的地点与路线，一触即发。
        </Paragraph>
        <Space size="large">
          <Button 
            type="primary" 
            size="large" 
            onClick={() => navigate('/location-search')}
            style={{ 
              height: '52px',
              padding: '0 32px',
              fontSize: '17px',
            }}
          >
            地点搜索
          </Button>
          <Button 
            size="large" 
            onClick={() => navigate('/diaries')}
            style={{ 
              height: '52px',
              padding: '0 32px',
              fontSize: '17px',
              border: 'none',
              background: 'rgba(0,0,0,0.05)',
              color: 'var(--apple-text-primary)'
            }}
          >
            旅游日记
          </Button>
        </Space>
      </div>

      {/* 统计数据 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 48 }} className="animate-on-load delay-2">
        {[{ title: '旅游场所', val: stats.places, icon: <EnvironmentOutlined /> },
          { title: '旅游日记', val: stats.diaries, icon: <BookOutlined /> },
          { title: '注册用户', val: stats.users, icon: <UserOutlined /> },
          { title: '路径网络', val: stats.roads, icon: <NodeIndexOutlined /> }
         ].map((stat, idx) => (
          <Col xs={12} sm={6} key={idx}>
            <Card style={{ textAlign: 'center', padding: '16px 0' }} bordered={false}>
              <Statistic
                title={<span style={{ color: 'var(--apple-text-secondary)', fontWeight: 500 }}>{stat.title}</span>}
                value={stat.val || 0}
                prefix={<span style={{ color: 'var(--apple-text-primary)' }}>{stat.icon}</span>}
                valueStyle={{ color: 'var(--apple-text-primary)', fontWeight: '600', fontSize: '36px' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]}>
        {/* 推荐场所 */}
        <Col xs={24} lg={12}>
          <div style={{
            borderRadius: '16px',
            background: 'var(--apple-bg-base)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            border: '1px solid var(--apple-border)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '24px 24px 8px 24px',
              borderBottom: '1px solid var(--apple-border)'
            }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={4} style={{ margin: 0, color: 'var(--apple-text-primary)' }}>推荐地点</Title>
                </Col>
                <Col>
                  <Button type="link" onClick={() => navigate('/location-search')} style={{ padding: 0 }}>查看更多 <RightOutlined /></Button>
                </Col>
              </Row>
            </div>

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
                        borderBottom: index === recommendedPlaces.length - 1 ? 'none' : '1px solid var(--apple-border)',
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size={56}
                            src={place.image ? getFileUrl(place.image) : null}
                            icon={<EnvironmentOutlined />}
                            style={{ border: '1px solid var(--apple-border)' }}
                          />
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '500', color: 'var(--apple-text-primary)', fontSize: '16px' }}>
                              {place.name}
                            </span>
                          </div>
                        }
                        description={
                          <div>
                            <div style={{ marginBottom: 4 }}>
                              <Rate disabled value={place.rating || 0} style={{ fontSize: 12, color: 'var(--apple-text-primary)' }} />
                            </div>
                            <Text style={{ color: 'var(--apple-text-secondary)', fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {place.description || '暂无描述'}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无推荐地点" style={{ margin: '40px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </div>
        </Col>

        {/* 热门场所 */}
        <Col xs={24} lg={12}>
          <div style={{
            borderRadius: '16px',
            background: 'var(--apple-bg-base)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            border: '1px solid var(--apple-border)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '24px 24px 8px 24px',
              borderBottom: '1px solid var(--apple-border)'
            }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <Title level={4} style={{ margin: 0, color: 'var(--apple-text-primary)' }}>热门地点排行</Title>
                </Col>
                <Col>
                  <Button type="link" onClick={() => navigate('/location-search')} style={{ padding: 0 }}>查看更多 <RightOutlined /></Button>
                </Col>
              </Row>
            </div>

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
                        borderBottom: index === popularPlaces.length - 1 ? 'none' : '1px solid var(--apple-border)',
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: index < 3 ? 'var(--apple-text-primary)' : 'var(--apple-text-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 'bold', fontSize: '18px',
                          }}>
                            {index + 1}
                          </div>
                        }
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '500', color: 'var(--apple-text-primary)', fontSize: '16px' }}>
                              {place.name}
                            </span>
                          </div>
                        }
                        description={
                          <div>
                            <div style={{ marginBottom: 4 }}>
                              <Rate disabled value={place.rating || 0} style={{ fontSize: 12, color: 'var(--apple-text-primary)' }} />
                            </div>
                            <Text style={{ color: 'var(--apple-text-secondary)', fontSize: 13 }}>
                              🔥 {place.clickCount || 0} 浏览 · {place.type || '景点'}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无热门地点" style={{ margin: '40px 0' }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* 推荐日记 */}
      <Card
        style={{ marginTop: 32, borderRadius: '16px', border: '1px solid var(--apple-border)', background: 'var(--apple-bg-base)' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '32px 32px 8px 32px', borderBottom: '1px solid var(--apple-border)' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={3} style={{ margin: 0, color: 'var(--apple-text-primary)' }}>精选旅游日记</Title>
            </Col>
            <Col>
              <Button type="link" onClick={() => navigate('/diaries')} style={{ padding: 0 }}>查看更多 <RightOutlined /></Button>
            </Col>
          </Row>
        </div>

        <div style={{ padding: '32px 24px' }}>
          {recommendedDiaries.length > 0 ? (
            <Row gutter={[24, 24]}>
              {recommendedDiaries.map((diary) => (
                <Col xs={24} sm={12} lg={8} key={diary.id}>
                  <Card
                    className="diary-card"
                    onClick={() => handleDiaryClick(diary.id)}
                    style={{ cursor: 'pointer', borderRadius: '16px', overflow: 'hidden' }}
                    bodyStyle={{ padding: '20px' }}
                  >
                    <div style={{ height: 180, background: 'rgba(0,0,0,0.05)', marginBottom: 20 }}>
                      {diary.images && diary.images.length > 0 ? (
                        <img alt={diary.title} src={getFileUrl(diary.images[0])} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <BookOutlined style={{ fontSize: 32, color: 'var(--apple-text-tertiary)' }} />
                        </div>
                      )}
                    </div>
                    <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {diary.title}
                    </Title>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--apple-text-secondary)', fontSize: 13 }}>
                      <Rate disabled value={diary.rating || 0} style={{ fontSize: 12 }} />
                      <span><EyeOutlined /> {diary.clickCount || 0}</span>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <Empty description="暂无推荐日记" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
          )}
        </div>
      </Card>

      {/* 快速操作 */}
      <Card
        style={{ marginTop: 32, marginBottom: 64, borderRadius: '16px', border: '1px solid var(--apple-border)', background: 'var(--apple-bg-base)' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '32px 32px 8px 32px', borderBottom: '1px solid var(--apple-border)' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={3} style={{ margin: 0, color: 'var(--apple-text-primary)' }}>快速操作</Title>
            </Col>
          </Row>
        </div>

        <div style={{ padding: '32px 24px' }}>
          <Row gutter={[20, 20]}>
            {[
              { title: '地点搜索', desc: '统一搜索景区学校美食', icon: <EnvironmentOutlined />, route: '/location-search' },
              { title: '写游记', desc: '记录美好时光', icon: <BookOutlined />, route: '/diaries?create=true' },
              { title: '校内导航', desc: '北邮校园步行导航', icon: <EnvironmentOutlined />, route: '/campus-navigation' },
              { title: '统计分析', desc: '数据洞察分析', icon: <BarChartOutlined />, route: '/stats' }
            ].map((action, idx) => (
              <Col xs={12} sm={6} key={idx}>
                <Card 
                  className="place-card"
                  onClick={() => navigate(action.route)}
                  bordered={true}
                  style={{ cursor: 'pointer', textAlign: 'center', padding: '12px 0', height: '100%', borderRadius: 12 }}
                >
                  <div style={{ fontSize: '32px', color: 'var(--apple-text-primary)', marginBottom: '12px' }}>
                    {action.icon}
                  </div>
                  <Text style={{ color: 'var(--apple-text-primary)', fontSize: '16px', fontWeight: 600, display: 'block' }}>
                    {action.title}
                  </Text>
                  <Text style={{ color: 'var(--apple-text-secondary)', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                    {action.desc}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </Card>
    </div>
  );
}

export default HomePage;
