import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Input, Button, Select, Tag, Rate, Spin, message, Pagination, Typography, Space } from 'antd';
import { SearchOutlined, EnvironmentOutlined, EyeOutlined, ClearOutlined, ReloadOutlined, StarOutlined, FireOutlined } from '@ant-design/icons';
import { getPlaces, searchPlaces, getRecommendedPlaces, sortPlaces, getFileUrl } from '../services/api';

const { Search } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

function PlacesPage() {
  const [places, setPlaces] = useState([]);
  const [originalPlaces, setOriginalPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('fuzzy');
  const [sortType, setSortType] = useState('recommendation');
  const [isSearchMode, setIsSearchMode] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);

  const navigate = useNavigate();

  useEffect(() => {
    loadPlacesAndRecommend();
  }, []);

  // 重置分页
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // 获取当前页数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return places.slice(startIndex, endIndex);
  };

  // 处理分页变化
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // 加载场所数据并进行推荐
  const loadPlacesAndRecommend = async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (user.id) {
        // 用户已登录，获取个性化推荐
        const [allPlacesResponse, recommendResponse] = await Promise.all([
          getPlaces(),
          getRecommendedPlaces(user.id, 'hybrid')
        ]);

        if (allPlacesResponse.success && recommendResponse.success) {
          // 创建推荐分数映射
          const recommendScores = {};
          recommendResponse.data.forEach((place, index) => {
            recommendScores[place.id] = {
              matchScore: Math.max(0.9 - index * 0.1, 0.1),
              recommendRank: index + 1
            };
          });

          // 为所有场所添加推荐信息
          const placesWithRecommendation = allPlacesResponse.data.map(place => {
            const recommendation = recommendScores[place.id];
            return {
              ...place,
              matchScore: recommendation?.matchScore || 0.1,
              recommendRank: recommendation?.recommendRank || 999,
              recommendLevel: getRecommendLevel(recommendation?.matchScore || 0.1),
              recommendBadge: getRecommendBadge(recommendation?.matchScore || 0.1)
            };
          });

          // 按推荐分数排序
          const sortedPlaces = placesWithRecommendation.sort((a, b) => {
            if (b.matchScore !== a.matchScore) {
              return b.matchScore - a.matchScore;
            }
            return b.rating - a.rating;
          });

          setPlaces(sortedPlaces);
          setOriginalPlaces(sortedPlaces);
          setSortType('recommendation');
        }
      } else {
        // 用户未登录，只获取场所列表
        const response = await getPlaces();
        if (response.success) {
          setPlaces(response.data);
          setOriginalPlaces(response.data);
        }
      }
    } catch (error) {
      message.error('加载场所数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 搜索处理
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }

    setLoading(true);
    resetPagination();
    
    try {
      const response = await searchPlaces(searchQuery, searchType);
      
      if (response.success) {
        setPlaces(response.data);
        setOriginalPlaces(response.data);
        setIsSearchMode(true);
        setSortType('recommendation');
        
        // 如果用户已登录且有搜索结果，进行推荐排序
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.id && response.data.length > 0) {
          await handleGetRecommendationsForSearch(response.data);
        }
      }
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchMode(false);
    setSortType('recommendation');
    resetPagination();
    loadPlacesAndRecommend();
  };

  // 搜索类型变化处理
  const handleSearchTypeChange = (value) => {
    setSearchType(value);
  };

  // 为搜索结果执行个性化推荐
  const handleGetRecommendationsForSearch = async (searchResults) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      return;
    }

    try {
      const recommendResponse = await getRecommendedPlaces(user.id, 'hybrid');
      
      if (recommendResponse.success) {
        const recommendScores = {};
        recommendResponse.data.forEach((place, index) => {
          recommendScores[place.id] = {
            matchScore: Math.max(0.9 - index * 0.1, 0.1),
            recommendRank: index + 1
          };
        });

        const resultsWithRecommendation = searchResults.map(place => {
          const recommendation = recommendScores[place.id];
          return {
            ...place,
            matchScore: recommendation?.matchScore || 0.1,
            recommendRank: recommendation?.recommendRank || 999,
            recommendLevel: getRecommendLevel(recommendation?.matchScore || 0.1),
            recommendBadge: getRecommendBadge(recommendation?.matchScore || 0.1)
          };
        });

        const sortedResults = resultsWithRecommendation.sort((a, b) => {
          if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
          }
          return b.rating - a.rating;
        });

        setPlaces(sortedResults);
        setOriginalPlaces(sortedResults);
      }
    } catch (error) {
      console.error('搜索结果推荐排序失败:', error);
    }
  };

  // 排序处理函数
  const handleSortChange = async (value) => {
    setSortType(value);
    resetPagination(); // 重置分页
    
    switch (value) {
      case 'popularity': // 按热度（浏览量）排序
        await handleBackendSort('popularity');
        break;
      case 'rating': // 按评价排序
        await handleBackendSort('rating');
        break;
      case 'recommendation': // 个性化推荐
        if (isSearchMode) {
          handleGetRecommendationsForSearch(originalPlaces);
        } else {
          handleGetRecommendations();
        }
        break;
    }
  };

  // 调用后端Top-K排序API
  const handleBackendSort = async (sortType) => {
    setLoading(true);
    try {
      // 获取当前显示的场所ID列表
      const currentPlaceIds = places.map(place => place.id);
      
      // 调用后端排序API，前12个精确排序，其余保持原顺序
      const response = await sortPlaces(sortType, 12, currentPlaceIds);
      
      if (response.success) {
        setPlaces(response.data);
        message.success(`已按${sortType === 'popularity' ? '热度' : '评价'}排序，前12个结果为精确排序`);
      } else {
        message.error('排序失败');
      }
    } catch (error) {
      console.error('后端排序失败:', error);
      message.error('排序失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleGetRecommendations = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      message.warning('请先登录');
      return;
    }

    setLoading(true);
    try {
      const [allPlacesResponse, recommendResponse] = await Promise.all([
        getPlaces(),
        getRecommendedPlaces(user.id, 'hybrid')
      ]);

      if (allPlacesResponse.success && recommendResponse.success) {
        const recommendScores = {};
        recommendResponse.data.forEach((place, index) => {
          recommendScores[place.id] = {
            matchScore: Math.max(0.9 - index * 0.1, 0.1),
            recommendRank: index + 1
          };
        });

        const placesWithRecommendation = allPlacesResponse.data.map(place => {
          const recommendation = recommendScores[place.id];
          return {
            ...place,
            matchScore: recommendation?.matchScore || 0.1,
            recommendRank: recommendation?.recommendRank || 999,
            recommendLevel: getRecommendLevel(recommendation?.matchScore || 0.1),
            recommendBadge: getRecommendBadge(recommendation?.matchScore || 0.1)
          };
        });

        const sortedPlaces = placesWithRecommendation.sort((a, b) => {
          if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
          }
          return b.rating - a.rating;
        });

        setPlaces(sortedPlaces);
        setOriginalPlaces(sortedPlaces);
        setSortType('recommendation');
      }
    } catch (error) {
      message.error('获取推荐失败');
    } finally {
      setLoading(false);
    }
  };

  const getRecommendLevel = (matchScore) => {
    if (matchScore >= 0.7) return 'highly_recommended';
    if (matchScore >= 0.5) return 'recommended';
    if (matchScore >= 0.3) return 'might_like';
    return 'explore';
  };

  const getRecommendBadge = (matchScore) => {
    if (matchScore >= 0.7) return '为您推荐';
    if (matchScore >= 0.5) return '推荐';
    if (matchScore >= 0.3) return '可能喜欢';
    return null;
  };

  const showPlaceDetail = (place) => {
    navigate(`/places/${place.id}`);
  };

  const getFilteredPlaces = () => {
    return places;
  };

  const renderPlaceCard = (place) => (
    <Col xs={24} sm={12} md={8} lg={6} key={place.id}>
      <Card
        hoverable
        className={`place-card ${place.recommendLevel || ''}`}
        style={{
          borderRadius: '16px',
          overflow: 'hidden',
          border: 'none',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
        }}
        cover={
          <div style={{ 
            height: 220, 
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}>
            {place.image ? (
              <img
                alt={place.name}
                src={getFileUrl(place.image)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transition: 'transform 0.3s ease',
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                }}
              />
            ) : null}
            <div style={{ 
              height: '100%', 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              display: place.image ? 'none' : 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexDirection: 'column',
              color: 'white'
            }}>
              <EnvironmentOutlined style={{ fontSize: 48, marginBottom: 8 }} />
              <Text style={{ color: 'white', fontSize: 14, opacity: 0.9 }}>暂无图片</Text>
            </div>
            
            {/* 推荐标签 */}
            {place.recommendBadge && (
              <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: place.matchScore >= 0.7 
                  ? 'linear-gradient(135deg, #ff6b6b, #ee5a52)' 
                  : place.matchScore >= 0.5 
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
                {place.recommendBadge}
              </div>
            )}
            
            {/* 类型标签 */}
            <div style={{
              position: 'absolute',
              top: 12,
              left: 12,
              background: 'rgba(255, 255, 255, 0.9)',
              color: '#1890ff',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: 11,
              fontWeight: '600',
              backdropFilter: 'blur(10px)',
            }}>
              {place.type}
            </div>
            
            {/* 匹配度指示器 */}
            {place.matchScore > 0.1 && (
              <div style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                background: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '10px',
                fontSize: 10,
                fontWeight: 'bold',
                backdropFilter: 'blur(10px)',
              }}>
                匹配 {Math.round(place.matchScore * 100)}%
              </div>
            )}
          </div>
        }
        bodyStyle={{
          padding: '20px',
          background: 'white',
        }}
        actions={[
          <Button 
            key="view" 
            type="primary" 
            icon={<EyeOutlined />} 
            onClick={() => showPlaceDetail(place)}
            style={{
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            }}
          >
            查看详情
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ 
            margin: 0, 
            marginBottom: 8,
            fontSize: 16,
            fontWeight: 600,
            color: '#2c3e50',
            lineHeight: 1.3,
          }}>
            {place.name}
          </Title>
          
          {/* 评分区域 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: 12,
            padding: '8px 12px',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            borderRadius: '10px',
          }}>
            <Rate 
              disabled 
              value={place.rating || 0} 
              style={{ fontSize: 14 }} 
              allowHalf
            />
            <span style={{ 
              marginLeft: 8, 
              fontSize: 13,
              fontWeight: 500,
              color: '#495057'
            }}>
              {place.rating?.toFixed(1) || 0}
            </span>
            <span style={{ 
              marginLeft: 4, 
              fontSize: 12,
              color: '#6c757d'
            }}>
              ({place.ratingCount || 0}人)
            </span>
          </div>
          
          {/* 统计信息 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            padding: '6px 0',
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              background: 'linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%)',
              padding: '4px 8px',
              borderRadius: '8px',
            }}>
              <EyeOutlined style={{ fontSize: 12, color: '#e17055', marginRight: 4 }} />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#e17055' }}>
                {place.clickCount || 0}
              </span>
            </div>
            
            {place.recommendRank && place.recommendRank <= 4 && (
              <div style={{
                background: 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: 11,
                fontWeight: 'bold',
              }}>
                推荐 #{place.recommendRank}
              </div>
            )}
          </div>
          
          {/* 描述文本 */}
          <Paragraph 
            style={{ 
              fontSize: 13,
              color: '#6c757d',
              lineHeight: 1.5,
              margin: 0,
              height: '40px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
            ellipsis={{ rows: 2, expandable: false }}
          >
            {place.description || '暂无描述'}
          </Paragraph>
        </div>
      </Card>
    </Col>
  );

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
          场所浏览
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          发现精彩旅游目的地，个性化推荐最适合您的场所
        </Text>
      </div>

      <div className="filter-container" style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '32px',
        border: 'none',
      }}>
        {/* 搜索区域 */}
        <div style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={8} md={6}>
              <Select
                value={searchType}
                onChange={handleSearchTypeChange}
                style={{ width: '100%', borderRadius: '12px' }}
                size="large"
                placeholder="搜索类型"
              >
                <Option value="fuzzy">🔍 模糊搜索</Option>
                <Option value="exact">🎯 精确搜索</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={14}>
              <Input
                placeholder="搜索场所名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPressEnter={handleSearch}
                suffix={<SearchOutlined />}
                size="large"
                style={{ borderRadius: '12px' }}
              />
            </Col>
            <Col xs={24} sm={4} md={4}>
              <Space>
                <Button 
                  type="primary" 
                  onClick={handleSearch} 
                  icon={<SearchOutlined />}
                  size="large"
                  style={{
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  }}
                >
                  搜索
                </Button>
                {isSearchMode && (
                  <Button 
                    onClick={handleClearSearch} 
                    icon={<ClearOutlined />}
                    size="large"
                    style={{ borderRadius: '12px' }}
                  >
                    清除
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </div>
        
        {/* 排序选择器 */}
        <div style={{ 
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          borderRadius: '12px',
          border: '1px solid #e9ecef',
        }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={8} md={6}>
              <span style={{ 
                fontWeight: 'bold', 
                color: '#495057',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Tag color="blue" style={{ marginRight: 8, borderRadius: '8px' }}>排序</Tag>
                选择排序方式
              </span>
            </Col>
            <Col xs={24} sm={16} md={18}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <Select
                  value={sortType}
                  onChange={handleSortChange}
                  style={{ width: 240, borderRadius: '12px' }}
                  size="large"
                  placeholder="选择排序方式"
                  disabled={places.length === 0}
                >
                  <Option value="recommendation">
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <StarOutlined style={{ marginRight: 8, color: '#faad14' }} />
                      个性化推荐
                    </span>
                  </Option>
                  <Option value="popularity">
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <FireOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                      按热度排序 (Top-K优化)
                    </span>
                  </Option>
                  <Option value="rating">
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <StarOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                      按评价排序 (Top-K优化)
                    </span>
                  </Option>
                </Select>
                {(sortType === 'popularity' || sortType === 'rating') && (
                  <Tag 
                    color="green" 
                    style={{ 
                      borderRadius: '12px',
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                      border: 'none',
                      color: 'white',
                    }}
                  >
                    ⚡ 已使用Top-K算法优化
                  </Tag>
                )}
              </div>
            </Col>
          </Row>
        </div>
      </div>

      <Spin spinning={loading} tip={loading ? "正在为您个性化推荐..." : ""}>
        <Row gutter={[20, 20]}>
          {getCurrentPageData().map(renderPlaceCard)}
        </Row>
        {!loading && places.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 20px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            margin: '20px 0',
          }}>
            <EnvironmentOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
            <Title level={4} style={{ color: '#999', margin: 0 }}>
              {isSearchMode ? '未找到相关场所' : '暂无场所数据'}
            </Title>
            <Text style={{ color: '#999', fontSize: 14 }}>
              {isSearchMode ? '尝试调整搜索关键词' : '请稍后再试'}
            </Text>
          </div>
        )}
      </Spin>

      {getFilteredPlaces().length > 0 && (
        <div style={{
          background: 'white',
          padding: '24px',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          marginTop: '32px',
          textAlign: 'center',
        }}>
          <Pagination
            current={currentPage}
            total={getFilteredPlaces().length}
            pageSize={pageSize}
            onChange={handlePageChange}
            showSizeChanger={false}
            showQuickJumper={true}
            showTotal={(total, range) => (
              <span style={{ color: '#666', fontSize: 14 }}>
                第 {range[0]}-{range[1]} 条，共 {total} 条
              </span>
            )}
            style={{ margin: 0 }}
          />
        </div>
      )}
    </div>
  );
}

export default PlacesPage; 