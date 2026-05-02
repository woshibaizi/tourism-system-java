import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Progress,
  Tag,
  Rate,
  Spin,
  Typography,
  Space,
  Divider,
  List,
  Avatar
} from 'antd';
import {
  BarChartOutlined,
  TrophyOutlined,
  UserOutlined,
  EnvironmentOutlined,
  BookOutlined,
  EyeOutlined,
  StarOutlined,
  FireOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { statsAPI, placeAPI, diaryAPI, userAPI } from '../services/api';

const { Title, Text } = Typography;

function StatsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [places, setPlaces] = useState([]);
  const [diaries, setDiaries] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // 并行加载所有数据
      const [
        statsResult,
        placesResult,
        diariesResult,
        usersResult
      ] = await Promise.allSettled([
        statsAPI.getStatistics(),
        placeAPI.getPlaces(),
        diaryAPI.getDiaries({ pageSize: 1000 }),
        userAPI.getUsers()
      ]);

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value.data);
      }
      
      if (placesResult.status === 'fulfilled') {
        setPlaces(placesResult.value.data);
      }
      
      if (diariesResult.status === 'fulfilled') {
        setDiaries(Array.isArray(diariesResult.value.data) ? diariesResult.value.data : []);
      }
      
      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value.data);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算热门场所排行
  const getPopularPlaces = () => {
    if (!Array.isArray(places)) return [];
    return places
      .sort((a, b) => b.clickCount - a.clickCount)
      .slice(0, 5)
      .map((place, index) => ({
        ...place,
        rank: index + 1
      }));
  };

  // 计算热门日记排行
  const getPopularDiaries = () => {
    if (!Array.isArray(diaries)) return [];
    return diaries
      .sort((a, b) => b.clickCount - a.clickCount)
      .slice(0, 5)
      .map((diary, index) => ({
        ...diary,
        rank: index + 1
      }));
  };

  // 计算用户活跃度
  const getUserActivity = () => {
    if (!Array.isArray(diaries) || !Array.isArray(users)) return [];
    
    const userDiaryCount = {};
    diaries.forEach(diary => {
      userDiaryCount[diary.authorId] = (userDiaryCount[diary.authorId] || 0) + 1;
    });

    return users
      .map(user => ({
        ...user,
        diaryCount: userDiaryCount[user.id] || 0
      }))
      .sort((a, b) => b.diaryCount - a.diaryCount)
      .slice(0, 5);
  };

  // 计算评分分布
  const getRatingDistribution = () => {
    if (!Array.isArray(places) || !Array.isArray(diaries)) return [];
    
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    
    [...places, ...diaries].forEach(item => {
      const rating = Math.floor(item.rating);
      if (rating >= 1 && rating <= 5) {
        distribution[rating]++;
      }
    });

    const totalItems = places.length + diaries.length;
    if (totalItems === 0) return [];

    return Object.entries(distribution).map(([rating, count]) => ({
      rating: `${rating}星`,
      count,
      percentage: ((count / totalItems) * 100).toFixed(1)
    }));
  };

  // 计算类型分布
  const getTypeDistribution = () => {
    if (!Array.isArray(places) || places.length === 0) return [];
    
    const placeTypes = {};
    places.forEach(place => {
      placeTypes[place.type] = (placeTypes[place.type] || 0) + 1;
    });

    return Object.entries(placeTypes).map(([type, count]) => ({
      type,
      count,
      percentage: ((count / places.length) * 100).toFixed(1)
    }));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const popularPlaces = getPopularPlaces();
  const popularDiaries = getPopularDiaries();
  const activeUsers = getUserActivity();
  const ratingDistribution = getRatingDistribution();
  const typeDistribution = getTypeDistribution();

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="page-header" style={{
        background: 'var(--glass-surface)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        padding: '32px',
        borderRadius: '18px',
        border: '1px solid var(--glass-border-strong)',
        boxShadow: 'var(--glass-shadow)',
        marginBottom: '32px',
        textAlign: 'center',
      }}>
        <Title level={2} style={{ margin: 0, color: 'var(--text-primary)', fontSize: 28, fontWeight: 600 }}>
          <DashboardOutlined style={{ marginRight: 12, fontSize: 32 }} />
          统计分析
        </Title>
        <Text style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 8, display: 'block' }}>
          系统数据统计与分析报告，全面了解平台运营状况
        </Text>
      </div>

      {/* 系统概览 */}
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
              suffix="个"
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
              suffix="篇"
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
              suffix="人"
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
              title={<span style={{ color: '#2c3e50', fontWeight: 600 }}>道路网络</span>}
              value={stats.roads || 0}
              prefix={<ClockCircleOutlined style={{ color: '#9b59b6' }} />}
              valueStyle={{ color: '#9b59b6', fontWeight: 'bold', fontSize: '28px' }}
              suffix="条"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* 热门场所排行榜 */}
        <Col xs={24} lg={12}>
          <div style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
          }}>
            {/* 热门场所排行榜标题栏 */}
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
                <Space size="middle" align="center">
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '10px',
                    padding: '10px',
                    backdropFilter: 'blur(10px)',
                  }}>
                    <TrophyOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                  </div>
                  <div>
                    <Title level={4} style={{ 
                      margin: 0, 
                      color: 'white', 
                      fontSize: '20px', 
                      fontWeight: 'bold',
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                      🏆 热门场所排行榜
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
              </div>
            </div>

            {/* 热门场所排行榜内容区域 */}
            <div style={{ padding: '24px' }}>
              <List
                dataSource={popularPlaces}
                renderItem={(place) => (
                  <List.Item style={{ 
                    padding: '16px 0',
                    borderBottom: '1px solid #f0f0f0',
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
                  }}>
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: place.rank <= 3 
                            ? `linear-gradient(135deg, ${place.rank === 1 ? '#ffd700, #ffed4e' : place.rank === 2 ? '#c0c0c0, #e8e8e8' : '#cd7f32, #daa520'})` 
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
                          {place.rank <= 3 ? ['🥇', '🥈', '🥉'][place.rank - 1] : place.rank}
                        </div>
                      }
                      title={
                        <Space>
                          <Text strong style={{ fontSize: '16px', color: '#2c3e50' }}>{place.name}</Text>
                          <Tag 
                            color={place.type === '景区' ? 'green' : 'blue'}
                            style={{
                              borderRadius: '12px',
                              fontWeight: 'bold',
                              fontSize: '11px',
                            }}
                          >
                            {place.type}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space>
                          <Tag 
                            color="orange" 
                            style={{
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                            }}
                          >
                            <EyeOutlined /> {place.clickCount}
                          </Tag>
                          <Rate disabled value={place.rating || 0} size="small" />
                          <Text style={{ fontSize: '12px', color: '#666' }}>({place.rating})</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          </div>
        </Col>

        {/* 热门日记排行榜 */}
        <Col xs={24} lg={12}>
          <div style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
          }}>
            {/* 热门日记排行榜标题栏 */}
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
                      🔥 热门日记排行榜
                    </Title>
                    <Text style={{ 
                      color: 'rgba(255, 255, 255, 0.9)', 
                      fontSize: '13px',
                      display: 'block',
                      marginTop: '2px'
                    }}>
                      最受欢迎的旅游日记
                    </Text>
                  </div>
                </Space>
              </div>
            </div>

            {/* 热门日记排行榜内容区域 */}
            <div style={{ padding: '24px' }}>
              <List
                dataSource={popularDiaries}
                renderItem={(diary) => (
                  <List.Item style={{ 
                    padding: '16px 0',
                    borderBottom: '1px solid #f0f0f0',
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
                  }}>
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: diary.rank <= 3 
                            ? `linear-gradient(135deg, ${diary.rank === 1 ? '#ffd700, #ffed4e' : diary.rank === 2 ? '#c0c0c0, #e8e8e8' : '#cd7f32, #daa520'})` 
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
                          {diary.rank <= 3 ? ['🥇', '🥈', '🥉'][diary.rank - 1] : diary.rank}
                        </div>
                      }
                      title={
                        <Space>
                          <Text strong style={{ fontSize: '16px', color: '#2c3e50' }}>{diary.title}</Text>
                        </Space>
                      }
                      description={
                        <Space>
                          <Tag 
                            color="orange" 
                            style={{
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                            }}
                          >
                            <EyeOutlined /> {diary.clickCount}
                          </Tag>
                          <Rate disabled value={diary.rating || 0} size="small" />
                          <Text style={{ fontSize: '12px', color: '#666' }}>({diary.rating})</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        {/* 用户活跃度 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <TeamOutlined style={{ color: '#1890ff' }} />
                用户活跃度排行
              </Space>
            }
          >
            <List
              dataSource={activeUsers}
              renderItem={(user, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={user.username}
                    description={
                      <Space>
                        <Text>发布日记: {user.diaryCount}篇</Text>
                        {user.diaryCount > 0 && (
                          <Tag color="green">活跃用户</Tag>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* 评分分布 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <StarOutlined style={{ color: '#faad14' }} />
                评分分布统计
              </Space>
            }
          >
            <div>
              {ratingDistribution.map((item) => (
                <div key={item.rating} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{item.rating}</Text>
                    <Text>{item.count}个 ({item.percentage}%)</Text>
                  </div>
                  <Progress 
                    percent={parseFloat(item.percentage)} 
                    showInfo={false}
                    strokeColor={
                      item.rating === '5星' ? '#52c41a' :
                      item.rating === '4星' ? '#1890ff' :
                      item.rating === '3星' ? '#faad14' :
                      item.rating === '2星' ? '#fa8c16' : '#f5222d'
                    }
                  />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 场所类型分布 */}
      <Card 
        title={
          <Space>
            <EnvironmentOutlined style={{ color: '#52c41a' }} />
            场所类型分布
          </Space>
        }
        style={{ marginTop: 24 }}
      >
        <Row gutter={[16, 16]}>
          {typeDistribution.map((item) => (
            <Col xs={12} sm={8} md={6} key={item.type}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Statistic
                  title={item.type}
                  value={item.count}
                  suffix="个"
                  valueStyle={{ color: item.type === '景区' ? '#52c41a' : '#1890ff' }}
                />
                <Text type="secondary">{item.percentage}%</Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 数据压缩统计 */}
      {stats.compression_stats && (
        <Card 
          title={
            <Space>
              <BarChartOutlined style={{ color: '#722ed1' }} />
              数据压缩统计
            </Space>
          }
          style={{ marginTop: 24 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic
                title="压缩文件个数"
                value={stats.compression_stats.compressed_files}
                suffix="个"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="压缩比率"
                value={stats.compression_stats.compression_ratio}
                suffix="%"
                valueStyle={{ 
                  color: stats.compression_stats.compression_ratio > 0 ? '#52c41a' : '#d9d9d9'
                }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="原始总大小"
                value={stats.compression_stats.total_original_size}
                suffix="字节"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="压缩后总大小"
                value={stats.compression_stats.total_compressed_size}
                suffix="字节"
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
}

export default StatsPage; 
