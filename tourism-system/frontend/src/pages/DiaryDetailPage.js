import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Breadcrumb, 
  Button, 
  Rate, 
  Tag, 
  Row, 
  Col, 
  Spin, 
  message, 
  Typography,
  Image,
  Space,
  Avatar,
  Divider
} from 'antd';
import { 
  ArrowLeftOutlined, 
  HomeOutlined, 
  BookOutlined, 
  UserOutlined,
  EyeOutlined,
  CalendarOutlined,
  StarOutlined,
  PictureOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import { getDiary, getUsers, rateDiary, getUserDiaryRating, getFileUrl } from '../services/api';

const { Title, Paragraph } = Typography;

function DiaryDetailPage() {
  const { diaryId } = useParams();
  const navigate = useNavigate();
  const [diary, setDiary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(null);
  const [hasRated, setHasRated] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const loadedDiaryIdRef = useRef(null);

  useEffect(() => {
    // 防止React.StrictMode导致的重复调用
    if (loadedDiaryIdRef.current !== diaryId) {
      loadedDiaryIdRef.current = diaryId;
      loadDiary();
    }
  }, [diaryId]);

  useEffect(() => {
    // 只在组件首次加载时获取用户数据
    loadUsers();
  }, []);

  const loadDiary = async () => {
    try {
      setLoading(true);
      const response = await getDiary(diaryId);
      if (response.success) {
        setDiary(response.data);
        
        // 检查用户是否已经评分过
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.id) {
          await loadUserDiaryRating(user.id);
        }
      } else {
        message.error('日记不存在');
        navigate('/diaries');
      }
    } catch (error) {
      message.error('加载日记失败');
      navigate('/diaries');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDiaryRating = async (userId) => {
    try {
      const response = await getUserDiaryRating(diaryId, userId);
      if (response.success) {
        setUserRating(response.data.userRating);
        setHasRated(response.data.hasRated);
      }
    } catch (error) {
      console.error('加载用户评分失败:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await getUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  };

  const getAuthorName = (authorId) => {
    const author = users.find(user => user.id === authorId);
    return author ? author.username : '未知作者';
  };

  const handleRateDiary = async (rating) => {
    if (hasRated) {
      message.info('您已经为这篇日记评过分了');
      return;
    }

    try {
      setRatingLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) {
        message.warning('请先登录');
        return;
      }
      
      const response = await rateDiary(diaryId, rating, user.id);
      if (response.success) {
        message.success('评分成功！');
        setDiary(prev => ({
          ...prev,
          rating: response.data.rating,
          ratingCount: response.data.ratingCount
        }));
        
        // 更新用户评分状态
        setUserRating(rating);
        setHasRated(true);
      } else {
        message.error(response.message || '评分失败');
      }
    } catch (error) {
      message.error('评分失败，请重试');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/diaries');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!diary) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Title level={3}>日记不存在</Title>
        <Button type="primary" onClick={handleBack}>返回日记列表</Button>
      </div>
    );
  }

  return (
    <div className="content-wrapper" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: '100vh' }}>
      {/* 页面头部 */}
      <div className="page-header" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '32px',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        marginBottom: '32px',
        textAlign: 'center',
        color: 'white',
      }}>
        <Typography.Title level={2} style={{ margin: 0, color: 'white', fontSize: '28px', fontWeight: 'bold' }}>
          <BookOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          {diary.title}
        </Typography.Title>
        <Typography.Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          分享旅途中的美好时光
        </Typography.Text>
      </div>

      {/* 面包屑导航 */}
      <Card style={{
        borderRadius: '16px',
        border: 'none',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '24px',
        background: 'white',
      }}>
        <Space size="large" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Breadcrumb>
            <Breadcrumb.Item>
              <HomeOutlined />
              <span>首页</span>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <BookOutlined />
              <span>旅游日记</span>
            </Breadcrumb.Item>
            <Breadcrumb.Item>{diary.title}</Breadcrumb.Item>
          </Breadcrumb>
          
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBack}
            type="primary"
            style={{
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            }}
          >
            返回日记列表
          </Button>
        </Space>
      </Card>

      <Row gutter={24}>
        {/* 左侧主要内容 */}
        <Col xs={24} lg={16}>
          {/* 日记内容卡片 */}
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
            marginBottom: '24px',
          }}>
            {/* 作者信息栏 */}
            <div style={{
              background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
              margin: '-24px -24px 24px -24px',
              padding: '20px 24px',
              color: 'white',
            }}>
              <Space size="large" style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <Space>
                  <Avatar 
                    size={48} 
                    icon={<UserOutlined />} 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: '2px solid rgba(255, 255, 255, 0.3)'
                    }} 
                  />
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                      {getAuthorName(diary.authorId)}
                    </div>
                    <Space size="middle">
                      <Space size={4}>
                        <CalendarOutlined />
                        <span style={{ fontSize: '14px', opacity: 0.9 }}>
                          {new Date(diary.createdAt).toLocaleDateString()}
                        </span>
                      </Space>
                      <Space size={4}>
                        <EyeOutlined />
                        <span style={{ fontSize: '14px', opacity: 0.9 }}>
                          {diary.clickCount || 0} 次浏览
                        </span>
                      </Space>
                    </Space>
                  </div>
                </Space>
                
                <div style={{ textAlign: 'right' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <Rate disabled value={diary.rating || 0} style={{ fontSize: 16 }} />
                  </div>
                  <div style={{ fontSize: '14px', opacity: 0.9 }}>
                    {diary.rating?.toFixed(1) || '0.0'}分 ({diary.ratingCount || 1}人评价)
                  </div>
                </div>
              </Space>
            </div>

            {/* 日记正文 */}
            <div style={{ marginBottom: 32 }}>
              <Typography.Paragraph style={{ 
                fontSize: 16, 
                lineHeight: 1.8, 
                whiteSpace: 'pre-wrap',
                minHeight: '200px',
                color: '#2c3e50',
                textAlign: 'justify'
              }}>
                {diary.content}
              </Typography.Paragraph>
            </div>

            {/* 媒体内容统计 */}
            {(diary.images?.length > 0 || diary.videos?.length > 0) && (
              <div style={{ marginBottom: 24 }}>
                <Space size="large">
                  {diary.images?.length > 0 && (
                    <Tag 
                      icon={<PictureOutlined />} 
                      color="blue" 
                      style={{ 
                        padding: '8px 16px', 
                        fontSize: '14px', 
                        borderRadius: '20px',
                        border: 'none'
                      }}
                    >
                      {diary.images.length} 张图片
                    </Tag>
                  )}
                  {diary.videos?.length > 0 && (
                    <Tag 
                      icon={<VideoCameraOutlined />} 
                      color="purple" 
                      style={{ 
                        padding: '8px 16px', 
                        fontSize: '14px', 
                        borderRadius: '20px',
                        border: 'none'
                      }}
                    >
                      {diary.videos.length} 个视频
                    </Tag>
                  )}
                </Space>
              </div>
            )}

            {/* 图片展示 - 使用现代化的图片画廊 */}
            {diary.images && diary.images.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <Typography.Title level={4} style={{ 
                  marginBottom: 20, 
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <PictureOutlined style={{ color: '#1890ff' }} />
                  精彩图片
                </Typography.Title>
                <Image.PreviewGroup>
                  <Row gutter={[16, 16]}>
                    {diary.images.map((image, index) => (
                      <Col key={index} xs={12} sm={8} md={6}>
                        <div style={{
                          borderRadius: '12px',
                          overflow: 'hidden',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                        }}>
                          <Image
                            src={getFileUrl(image)}
                            alt={`图片${index + 1}`}
                            style={{ 
                              width: '100%', 
                              height: 180, 
                              objectFit: 'cover',
                            }}
                            preview={{
                              mask: (
                                <div style={{ 
                                  background: 'rgba(0, 0, 0, 0.6)',
                                  color: 'white',
                                  padding: '8px',
                                  borderRadius: '8px',
                                  fontSize: '12px'
                                }}>
                                  点击预览
                                </div>
                              )
                            }}
                          />
                        </div>
                      </Col>
                    ))}
                  </Row>
                </Image.PreviewGroup>
              </div>
            )}

            {/* 视频展示 */}
            {diary.videos && diary.videos.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <Typography.Title level={4} style={{ 
                  marginBottom: 20, 
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <VideoCameraOutlined style={{ color: '#722ed1' }} />
                  精彩视频
                </Typography.Title>
                <Row gutter={[16, 16]}>
                  {diary.videos.map((video, index) => (
                    <Col key={index} xs={24} sm={12} md={8}>
                      <div style={{
                        borderRadius: '12px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                      }}>
                        <video
                          src={getFileUrl(video)}
                          controls
                          style={{ 
                            width: '100%', 
                            height: 200, 
                            objectFit: 'cover'
                          }}
                        />
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </Card>
        </Col>

        {/* 右侧评分区域 */}
        <Col xs={24} lg={8}>
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
            position: 'sticky',
            top: '24px',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              margin: '-24px -24px 24px -24px',
              padding: '20px 24px',
              textAlign: 'center',
            }}>
              <StarOutlined style={{ fontSize: '32px', color: '#fa8c16', marginBottom: '8px' }} />
              <Typography.Title level={4} style={{ margin: 0, color: '#d4380d' }}>
                为这篇日记评分
              </Typography.Title>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <Typography.Text style={{ fontSize: 16, color: '#666' }}>
                  当前评分
                </Typography.Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Rate disabled value={diary.rating || 0} style={{ fontSize: 24 }} />
              </div>
              <Typography.Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fa8c16' }}>
                {diary.rating?.toFixed(1) || '0.0'} 分
              </Typography.Text>
              <Typography.Text style={{ fontSize: 14, color: '#999', display: 'block' }}>
                ({diary.ratingCount || 1}人评价)
              </Typography.Text>
            </div>

            <Divider />

            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 16 }}>
                <Typography.Text style={{ fontSize: 16, color: '#666' }}>
                  {hasRated ? '您的评分' : '请为这篇日记评分'}
                </Typography.Text>
              </div>
              <Rate
                value={userRating}
                onChange={handleRateDiary}
                disabled={hasRated || ratingLoading}
                style={{ fontSize: 24 }}
              />
              {hasRated && (
                <div style={{ marginTop: 12 }}>
                  <Typography.Text style={{ color: '#52c41a', fontSize: 14 }}>
                    ✓ 您已评分
                  </Typography.Text>
                </div>
              )}
              {ratingLoading && (
                <div style={{ marginTop: 12 }}>
                  <Spin size="small" />
                  <Typography.Text style={{ marginLeft: 8, fontSize: 14 }}>
                    评分中...
                  </Typography.Text>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default DiaryDetailPage; 