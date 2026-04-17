import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Row, 
  Col, 
  Button, 
  Tag, 
  Descriptions, 
  List, 
  Image, 
  Spin, 
  message,
  Breadcrumb,
  Divider,
  Rate,
  Typography,
  Pagination,
  Space,
  Avatar,
  Empty
} from 'antd';
import { 
  ArrowLeftOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  StarOutlined,
  BankOutlined,
  ToolOutlined,
  HomeOutlined,
  EyeOutlined,
  CalendarOutlined,
  UserOutlined,
  FireOutlined,
  ShopOutlined,
  CarOutlined,
  BookOutlined
} from '@ant-design/icons';
import { getPlace, ratePlace, recordVisit, getUserRating, getFileUrl } from '../services/api';

const { Title, Paragraph, Text } = Typography;

function PlaceDetailPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [placeData, setPlaceData] = useState(null);
  const [userRating, setUserRating] = useState(null);
  const [hasRated, setHasRated] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  
  // 建筑物分页状态
  const [buildingCurrentPage, setBuildingCurrentPage] = useState(1);
  const [buildingPageSize] = useState(10); // 每页显示10个建筑物
  
  // 设施分页状态
  const [facilityCurrentPage, setFacilityCurrentPage] = useState(1);
  const [facilityPageSize] = useState(10); // 每页显示10个设施

  useEffect(() => {
    if (placeId) {
      loadPlaceDetail();
    }
  }, [placeId]);

  const loadPlaceDetail = async () => {
    try {
      setLoading(true);
      const response = await getPlace(placeId);
      if (response.success) {
        setPlaceData(response.data);
        
        // 自动记录访问历史
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.id) {
          try {
            await recordVisit(placeId, user.id);
            // 检查用户是否已经评分过
            await loadUserRating(user.id);
          } catch (error) {
            console.error('记录访问历史失败:', error);
            // 不显示错误消息，因为这不是关键功能
          }
        }
      } else {
        message.error('场所不存在');
        navigate('/places');
      }
    } catch (error) {
      message.error('加载场所详情失败');
      navigate('/places');
    } finally {
      setLoading(false);
    }
  };

  const loadUserRating = async (userId) => {
    try {
      const response = await getUserRating(placeId, userId);
      if (response.success) {
        setUserRating(response.data.userRating);
        setHasRated(response.data.hasRated);
      }
    } catch (error) {
      console.error('加载用户评分失败:', error);
    }
  };

  const handleRatePlace = async (rating) => {
    if (hasRated) {
      message.info('您已经为这个场所评过分了');
      return;
    }

    try {
      setRatingLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) {
        message.warning('请先登录');
        return;
      }
      
      const response = await ratePlace(placeId, rating, user.id);
      if (response.success) {
        message.success('评分成功！');
        // 更新本地数据
        setPlaceData(prev => ({
          ...prev,
          place: {
            ...prev.place,
            rating: response.data.rating,
            ratingCount: response.data.ratingCount
          }
        }));
        
        // 更新用户评分状态
        setUserRating(rating);
        setHasRated(true);
      } else {
        message.error(response.message || '评分失败');
      }
    } catch (error) {
      message.error('评分失败，请稍后重试');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/places');
  };

  // 建筑物分页处理
  const handleBuildingPageChange = (page) => {
    setBuildingCurrentPage(page);
  };

  // 设施分页处理
  const handleFacilityPageChange = (page) => {
    setFacilityCurrentPage(page);
  };

  // 获取当前页的建筑物数据
  const getCurrentBuildingData = () => {
    if (!placeData?.buildings) return [];
    const startIndex = (buildingCurrentPage - 1) * buildingPageSize;
    const endIndex = startIndex + buildingPageSize;
    return placeData.buildings.slice(startIndex, endIndex);
  };

  // 获取当前页的设施数据
  const getCurrentFacilityData = () => {
    if (!placeData?.facilities) return [];
    // 过滤掉type为"路口"的设施
    const filteredFacilities = placeData.facilities.filter(facility => facility.type !== '路口');
    const startIndex = (facilityCurrentPage - 1) * facilityPageSize;
    const endIndex = startIndex + facilityPageSize;
    return filteredFacilities.slice(startIndex, endIndex);
  };

  // 获取过滤后的设施总数
  const getFilteredFacilitiesCount = () => {
    if (!placeData?.facilities) return 0;
    return placeData.facilities.filter(facility => facility.type !== '路口').length;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '400px' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!placeData) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Title level={3}>场所不存在</Title>
        <Button type="primary" onClick={handleBack}>
          返回场所列表
        </Button>
      </div>
    );
  }

  const { place, buildings } = placeData;

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
          <EnvironmentOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          {place.name}
        </Typography.Title>
        <Typography.Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          探索精彩场所，发现美好时光
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
              <EnvironmentOutlined />
              <span onClick={handleBack} style={{ cursor: 'pointer', color: '#1890ff' }}>
                场所浏览
              </span>
            </Breadcrumb.Item>
            <Breadcrumb.Item>{place.name}</Breadcrumb.Item>
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
            返回场所列表
          </Button>
        </Space>
      </Card>

      <Row gutter={24}>
        {/* 左侧主要内容 */}
        <Col xs={24} lg={16}>
          {/* 场所基本信息卡片 */}
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
            marginBottom: '24px',
          }}>
            {/* 场所信息头部 */}
            <div style={{
              background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
              margin: '-24px -24px 24px -24px',
              padding: '20px 24px',
              color: 'white',
            }}>
              <Row gutter={24} align="middle">
                <Col xs={24} md={8}>
                  <div style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                  }}>
                    <Image
                      width="100%"
                      height={200}
                      src={place.image ? getFileUrl(place.image) : null}
                      alt={place.name}
                      style={{ objectFit: 'cover' }}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
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
                <Col xs={24} md={16}>
                  <div style={{ color: 'white' }}>
                    <div style={{ marginBottom: 16 }}>
                      <Tag 
                        color={place.type === '景区' ? 'green' : 'blue'} 
                        style={{ 
                          fontSize: 14, 
                          padding: '4px 12px',
                          borderRadius: '20px',
                          border: 'none',
                          marginBottom: 8
                        }}
                      >
                        {place.type}
                      </Tag>
                    </div>
                    
                    <div style={{ marginBottom: 16 }}>
                      <Rate disabled value={place.rating || 0} style={{ fontSize: 18 }} />
                      <Typography.Text style={{ marginLeft: 8, color: 'rgba(255, 255, 255, 0.9)', fontSize: 16 }}>
                        {place.rating?.toFixed(1) || 0}分 ({place.ratingCount || 0}人评价)
                      </Typography.Text>
                    </div>

                    <Space size="large" wrap>
                      <Space size={4}>
                        <EyeOutlined style={{ fontSize: 16 }} />
                        <span style={{ fontSize: 14, opacity: 0.9 }}>
                          {place.clickCount || 0} 次浏览
                        </span>
                      </Space>
                      <Space size={4}>
                        <EnvironmentOutlined style={{ fontSize: 16 }} />
                        <span style={{ fontSize: 14, opacity: 0.9 }}>
                          {place.address || '暂无地址信息'}
                        </span>
                      </Space>
                      <Space size={4}>
                        <ClockCircleOutlined style={{ fontSize: 16 }} />
                        <span style={{ fontSize: 14, opacity: 0.9 }}>
                          {place.openTime || '暂无开放时间'}
                        </span>
                      </Space>
                    </Space>
                  </div>
                </Col>
              </Row>
            </div>

            {/* 场所描述 */}
            <div style={{ marginBottom: 24 }}>
              <Typography.Title level={4} style={{ 
                marginBottom: 16, 
                color: '#2c3e50',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <StarOutlined style={{ color: '#fa8c16' }} />
                场所介绍
              </Typography.Title>
              <Typography.Paragraph style={{ 
                fontSize: 16, 
                lineHeight: 1.8, 
                color: '#2c3e50',
                textAlign: 'justify'
              }}>
                {place.description || '暂无详细介绍'}
              </Typography.Paragraph>
            </div>

            {/* 特色标签 */}
            {place.features && place.features.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Typography.Title level={4} style={{ 
                  marginBottom: 16, 
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <FireOutlined style={{ color: '#ff4d4f' }} />
                  特色亮点
                </Typography.Title>
                <Space size="middle" wrap>
                  {place.features.map((feature, index) => (
                    <Tag 
                      key={index}
                      color="orange" 
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '14px', 
                        borderRadius: '16px',
                        border: 'none'
                      }}
                    >
                      ✨ {feature}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <Space size="large">
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<CarOutlined />}
                  onClick={() => navigate('/route-planning')}
                  style={{
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    padding: '8px 24px',
                    height: 'auto'
                  }}
                >
                  规划路线
                </Button>
                <Button 
                  size="large"
                  icon={<BookOutlined />}
                  onClick={() => navigate('/diaries')}
                  style={{
                    borderRadius: '12px',
                    padding: '8px 24px',
                    height: 'auto'
                  }}
                >
                  查看游记
                </Button>
              </Space>
            </div>
          </Card>

          {/* 建筑物和设施信息 */}
          <Row gutter={24}>
            {/* 建筑物列表 */}
            <Col xs={24} lg={12}>
              <Card style={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                background: 'white',
                overflow: 'hidden',
                marginBottom: '24px',
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                  margin: '-24px -24px 24px -24px',
                  padding: '16px 24px',
                  color: '#2c3e50',
                }}>
                  <Typography.Title level={4} style={{ margin: 0, color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                    <BankOutlined style={{ marginRight: 8, fontSize: '20px' }} />
                    建筑物 ({buildings?.length || 0})
                  </Typography.Title>
                </div>

                {buildings && buildings.length > 0 ? (
                  <>
                    <List
                      dataSource={getCurrentBuildingData()}
                      renderItem={(building) => (
                        <List.Item style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'all 0.3s ease',
                        }}>
                          <List.Item.Meta
                            avatar={
                              <Avatar 
                                icon={<BankOutlined />} 
                                style={{ 
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  border: 'none'
                                }} 
                              />
                            }
                            title={
                              <Typography.Text strong style={{ fontSize: 16, color: '#2c3e50' }}>
                                {building.name}
                              </Typography.Text>
                            }
                            description={
                              <div style={{ marginTop: 8 }}>
                                <Typography.Text type="secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
                                  {building.description}
                                </Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                  <Tag color="blue" style={{ borderRadius: '12px', border: 'none' }}>
                                    {building.type}
                                  </Tag>
                                  {building.floor && (
                                    <Tag color="orange" style={{ borderRadius: '12px', border: 'none' }}>
                                      {building.floor}层
                                    </Tag>
                                  )}
                                </div>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    {buildings.length > buildingPageSize && (
                      <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <Pagination
                          current={buildingCurrentPage}
                          total={buildings.length}
                          pageSize={buildingPageSize}
                          onChange={handleBuildingPageChange}
                          showSizeChanger={false}
                          showQuickJumper={false}
                          showTotal={(total, range) => `第 ${range[0]}-${range[1]} 个，共 ${total} 个建筑物`}
                          size="small"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <Empty 
                    description="暂无建筑物信息"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Card>
            </Col>

            {/* 设施列表 */}
            <Col xs={24} lg={12}>
              <Card style={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                background: 'white',
                overflow: 'hidden',
                marginBottom: '24px',
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
                  margin: '-24px -24px 24px -24px',
                  padding: '16px 24px',
                  color: '#2c3e50',
                }}>
                  <Typography.Title level={4} style={{ margin: 0, color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                    <ToolOutlined style={{ marginRight: 8, fontSize: '20px' }} />
                    设施服务 ({getFilteredFacilitiesCount()})
                  </Typography.Title>
                </div>

                {placeData?.facilities && getFilteredFacilitiesCount() > 0 ? (
                  <>
                    <List
                      dataSource={getCurrentFacilityData()}
                      renderItem={(facility) => (
                        <List.Item style={{
                          padding: '16px 0',
                          borderBottom: '1px solid #f0f0f0',
                          transition: 'all 0.3s ease',
                        }}>
                          <List.Item.Meta
                            avatar={
                              <Avatar 
                                icon={<ShopOutlined />} 
                                style={{ 
                                  background: facility.type === '餐饮' ? '#fa8c16' :
                                             facility.type === '住宿' ? '#722ed1' :
                                             facility.type === '购物' ? '#52c41a' :
                                             facility.type === '娱乐' ? '#f5222d' : '#1890ff',
                                  border: 'none'
                                }} 
                              />
                            }
                            title={
                              <Typography.Text strong style={{ fontSize: 16, color: '#2c3e50' }}>
                                {facility.name}
                              </Typography.Text>
                            }
                            description={
                              <div style={{ marginTop: 8 }}>
                                <Typography.Text type="secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>
                                  {facility.description}
                                </Typography.Text>
                                <div style={{ marginTop: 8 }}>
                                  <Tag 
                                    color={
                                      facility.type === '餐饮' ? 'orange' :
                                      facility.type === '住宿' ? 'purple' :
                                      facility.type === '购物' ? 'green' :
                                      facility.type === '娱乐' ? 'red' : 'blue'
                                    } 
                                    style={{ borderRadius: '12px', border: 'none' }}
                                  >
                                    {facility.type}
                                  </Tag>
                                  {facility.openTime && (
                                    <Tag color="cyan" style={{ borderRadius: '12px', border: 'none' }}>
                                      {facility.openTime}
                                    </Tag>
                                  )}
                                </div>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                    {getFilteredFacilitiesCount() > facilityPageSize && (
                      <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <Pagination
                          current={facilityCurrentPage}
                          total={getFilteredFacilitiesCount()}
                          pageSize={facilityPageSize}
                          onChange={handleFacilityPageChange}
                          showSizeChanger={false}
                          showQuickJumper={false}
                          showTotal={(total, range) => `第 ${range[0]}-${range[1]} 个，共 ${total} 个设施`}
                          size="small"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <Empty 
                    description="暂无设施信息"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </Card>
            </Col>
          </Row>
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
                {hasRated ? "您的评分" : "为这个场所评分"}
              </Typography.Title>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <Typography.Text style={{ fontSize: 16, color: '#666' }}>
                  当前评分
                </Typography.Text>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Rate disabled value={place.rating || 0} style={{ fontSize: 24 }} />
              </div>
              <Typography.Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fa8c16' }}>
                {place.rating?.toFixed(1) || '0.0'} 分
              </Typography.Text>
              <Typography.Text style={{ fontSize: 14, color: '#999', display: 'block' }}>
                ({place.ratingCount || 0}人评价)
              </Typography.Text>
            </div>

            <Divider />

            <div style={{ textAlign: 'center' }}>
              {hasRated ? (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text style={{ fontSize: 16, color: '#666' }}>
                      您的评分
                    </Typography.Text>
                  </div>
                  <Rate 
                    disabled 
                    value={userRating}
                    style={{ fontSize: 24 }}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text style={{ color: '#52c41a', fontSize: 14 }}>
                      ✓ 您已评分：{userRating}分
                    </Typography.Text>
                  </div>
                  <div style={{ marginTop: 16, color: '#999' }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      每个用户只能为同一场所评分一次
                    </Typography.Text>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Text style={{ fontSize: 16, color: '#666' }}>
                      您觉得这个场所怎么样？
                    </Typography.Text>
                  </div>
                  <Rate 
                    allowHalf 
                    onChange={handleRatePlace}
                    style={{ fontSize: 24 }}
                    disabled={ratingLoading}
                  />
                  <div style={{ marginTop: 12 }}>
                    {ratingLoading ? (
                      <Space>
                        <Spin size="small" />
                        <Typography.Text style={{ fontSize: 14 }}>
                          评分中...
                        </Typography.Text>
                      </Space>
                    ) : (
                      <Typography.Text style={{ fontSize: 14, color: '#666' }}>
                        点击星星为场所评分
                      </Typography.Text>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default PlaceDetailPage; 
