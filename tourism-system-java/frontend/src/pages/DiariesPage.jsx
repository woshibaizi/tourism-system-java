import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Row, Col, Input, Button, Tag, Rate, Spin, message, Modal, Form, Upload, Select, Pagination, Typography } from 'antd';
import { SearchOutlined, PlusOutlined, EyeOutlined, EditOutlined, UploadOutlined, BookOutlined, StarOutlined, FireOutlined } from '@ant-design/icons';
import { getDiaries, searchDiariesByTitle, searchDiariesByContent, searchDiariesByDestination, createDiary, getRecommendedDiaries, uploadImage, uploadVideo, getUsers, rateDiary, getPlaces, getFileUrl } from '../services/api';

const { Search } = Input;
const { TextArea } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

function DiariesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [diaries, setDiaries] = useState([]);
  const [originalDiaries, setOriginalDiaries] = useState([]);
  const [users, setUsers] = useState([]);
  const [places, setPlaces] = useState([]); // 添加场所列表
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDiary, setSelectedDiary] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [imageList, setImageList] = useState([]);
  const [videoList, setVideoList] = useState([]);
  const [sortType, setSortType] = useState('recommendation'); // 默认为个性化推荐
  const [searchKeyword, setSearchKeyword] = useState(''); // 保存搜索关键字
  const [isSearchMode, setIsSearchMode] = useState(false); // 是否在搜索模式
  const [searchType, setSearchType] = useState('title'); // 搜索类型：title、content或destination
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // 是否完成初始加载

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12); // 每页显示12个

  useEffect(() => {
    loadDiariesAndRecommend();
    loadUsers();
    loadPlaces(); // 加载场所列表
    
    // 检查URL查询参数，如果包含create=true则打开创建模态框
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('create') === 'true') {
      setCreateModalVisible(true);
      // 清除URL中的查询参数
      navigate('/diaries', { replace: true });
    }
  }, [location.search, navigate]);

  // 重置分页到第一页
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // 获取当前页的数据
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return diaries.slice(startIndex, endIndex);
  };

  // 处理分页变化
  const handlePageChange = (page) => {
    setCurrentPage(page);
    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 首次加载时自动执行个性化推荐
  const loadDiariesAndRecommend = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user.id) {
      // 用户未登录，显示提示并加载普通日记列表
      setLoading(true);
      try {
        const response = await getDiaries({ pageSize: 100 });
        if (response.success) {
          const diariesData = response.data.diaries || response.data;
          setDiaries(diariesData);
          setOriginalDiaries(diariesData);
        }
        message.info('已为您个性化推荐');
      } catch (error) {
        message.error('加载日记失败');
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
      return;
    }

    // 用户已登录，执行个性化推荐
    setLoading(true);
    try {
      const [allDiariesResponse, recommendResponse] = await Promise.all([
        getDiaries({ pageSize: 100 }),
        getRecommendedDiaries(user.id)
      ]);

      if (allDiariesResponse.success && recommendResponse.success) {
        const recommendScores = {};
        recommendResponse.data.forEach((diary, index) => {
          recommendScores[diary.id] = {
            matchScore: Math.max(0.9 - index * 0.1, 0.1),
            recommendRank: index + 1
          };
        });

        const allDiariesData = allDiariesResponse.data.diaries || allDiariesResponse.data;
        
        const diariesWithRecommendation = allDiariesData.map(diary => {
          const recommendation = recommendScores[diary.id];
          return {
            ...diary,
            matchScore: recommendation?.matchScore || 0.1,
            recommendRank: recommendation?.recommendRank || 999,
            recommendLevel: getRecommendLevel(recommendation?.matchScore || 0.1),
            recommendBadge: getRecommendBadge(recommendation?.matchScore || 0.1)
          };
        });

        const sortedDiaries = diariesWithRecommendation.sort((a, b) => {
          if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
          }
          return (b.clickCount || 0) - (a.clickCount || 0);
        });

        setDiaries(sortedDiaries);
        setOriginalDiaries(sortedDiaries);
        message.success('已为您个性化推荐');
      }
    } catch (error) {
      message.error('获取推荐失败');
      // 失败时加载普通列表
      try {
        const response = await getDiaries({ pageSize: 100 });
        if (response.success) {
          const diariesData = response.data.diaries || response.data;
          setDiaries(diariesData);
          setOriginalDiaries(diariesData);
        }
      } catch (fallbackError) {
        message.error('加载日记失败');
      }
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
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

  const loadPlaces = async () => {
    try {
      const response = await getPlaces();
      if (response.success) {
        setPlaces(response.data);
      }
    } catch (error) {
      console.error('加载场所信息失败:', error);
    }
  };

  const getAuthorName = (authorId) => {
    const author = users.find(user => user.id === authorId);
    return author ? author.username : '未知作者';
  };

  const handleRateDiary = async (diaryId, rating) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) {
        message.warning('请先登录');
        return;
      }
      
      const response = await rateDiary(diaryId, rating, user.id);
      if (response.success) {
        message.success('评分成功！');
        
        setDiaries(prevDiaries => 
          prevDiaries.map(d => 
            d.id === diaryId 
              ? { 
                  ...d, 
                  rating: response.data.rating,
                  ratingCount: response.data.ratingCount
                }
              : d
          )
        );
        
        if (selectedDiary && selectedDiary.id === diaryId) {
          setSelectedDiary(prev => ({
            ...prev,
            rating: response.data.rating,
            ratingCount: response.data.ratingCount
          }));
        }
      } else {
        message.error(response.message || '评分失败');
      }
    } catch (error) {
      message.error('评分失败，请重试');
    }
  };

  // 增强的搜索功能
  const handleSearch = async (value) => {
    setSearchKeyword(value);
    resetPagination(); // 重置分页
    
    if (!value.trim()) {
      // 清空搜索，恢复到推荐状态
      setIsSearchMode(false);
      if (initialLoadComplete) {
        setDiaries([...originalDiaries]);
        setSortType('recommendation');
      }
      return;
    }

    setLoading(true);
    setIsSearchMode(true);
    
    try {
      let searchResults = [];
      
      if (searchType === 'title') {
        // 标题精准搜索
        const response = await searchDiariesByTitle(value);
        if (response.success) {
          searchResults = response.data;
        }
      } else if (searchType === 'content') {
        // 内容搜索
        const response = await searchDiariesByContent(value);
        if (response.success) {
          searchResults = response.data;
        }
      } else if (searchType === 'destination') {
        // 目的地搜索
        const response = await searchDiariesByDestination(value);
        if (response.success) {
          searchResults = response.data;
        }
      }

      setDiaries(searchResults);
      setOriginalDiaries(searchResults);
      
      // 搜索后默认按个性化推荐排序
      if (searchResults.length > 0) {
        setSortType('recommendation');
        await handleGetRecommendationsForSearch(searchResults);
      } else {
        setSortType('recommendation');
        message.info('未找到相关日记');
      }
      
    } catch (error) {
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  // 为搜索结果执行个性化推荐
  const handleGetRecommendationsForSearch = async (searchResults) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      return;
    }

    try {
      const recommendResponse = await getRecommendedDiaries(user.id);
      
      if (recommendResponse.success) {
        const recommendScores = {};
        recommendResponse.data.forEach((diary, index) => {
          recommendScores[diary.id] = {
            matchScore: Math.max(0.9 - index * 0.1, 0.1),
            recommendRank: index + 1
          };
        });

        const resultsWithRecommendation = searchResults.map(diary => {
          const recommendation = recommendScores[diary.id];
          return {
            ...diary,
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
          return (b.clickCount || 0) - (a.clickCount || 0);
        });

        setDiaries(sortedResults);
        setOriginalDiaries(sortedResults);
      }
    } catch (error) {
      console.error('搜索结果推荐排序失败:', error);
    }
  };

  // 排序处理函数
  const handleSortChange = (value) => {
    setSortType(value);
    resetPagination(); // 重置分页
    
    switch (value) {
      case 'popularity': // 按热度（浏览量）排序
        {
          let sortedDiaries = [...diaries];
          sortedDiaries.sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
          setDiaries(sortedDiaries);
        }
        break;
      case 'rating': // 按评价排序
        {
          let sortedDiaries = [...diaries];
          sortedDiaries.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          setDiaries(sortedDiaries);
        }
        break;
      case 'recommendation': // 个性化推荐
        if (isSearchMode) {
          handleGetRecommendationsForSearch(originalDiaries);
        } else {
          handleGetRecommendations();
        }
        break;
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
      const [allDiariesResponse, recommendResponse] = await Promise.all([
        getDiaries({ pageSize: 100 }),
        getRecommendedDiaries(user.id)
      ]);

      if (allDiariesResponse.success && recommendResponse.success) {
        const recommendScores = {};
        recommendResponse.data.forEach((diary, index) => {
          recommendScores[diary.id] = {
            matchScore: Math.max(0.9 - index * 0.1, 0.1),
            recommendRank: index + 1
          };
        });

        const allDiariesData = allDiariesResponse.data.diaries || allDiariesResponse.data;
        
        const diariesWithRecommendation = allDiariesData.map(diary => {
          const recommendation = recommendScores[diary.id];
          return {
            ...diary,
            matchScore: recommendation?.matchScore || 0.1,
            recommendRank: recommendation?.recommendRank || 999,
            recommendLevel: getRecommendLevel(recommendation?.matchScore || 0.1),
            recommendBadge: getRecommendBadge(recommendation?.matchScore || 0.1)
          };
        });

        const sortedDiaries = diariesWithRecommendation.sort((a, b) => {
          if (b.matchScore !== a.matchScore) {
            return b.matchScore - a.matchScore;
          }
          return (b.clickCount || 0) - (a.clickCount || 0);
        });

        setDiaries(sortedDiaries);
        setOriginalDiaries(sortedDiaries);
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

  const showDiaryDetail = (diary) => {
    // 跳转到日记详情页面
    navigate(`/diaries/${diary.id}`);
  };

  const handleCreateDiary = async (values) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.id) {
      message.warning('请先登录');
      return;
    }

    try {
      const diaryData = {
        ...values,
        authorId: user.id,
        images: imageList.map(file => file.response?.data?.path).filter(Boolean),
        videos: videoList.map(file => file.response?.data?.path).filter(Boolean),
        tags: values.tags ? values.tags.split(',').map(tag => tag.trim()) : []
      };

      const response = await createDiary(diaryData);
      if (response.success) {
        message.success('日记创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        setImageList([]);
        setVideoList([]);
        loadDiariesAndRecommend();
      }
    } catch (error) {
      message.error('创建日记失败');
    }
  };

  const handleImageUpload = async (file) => {
    try {
      const response = await uploadImage(file);
      if (response.success) {
        message.success('图片上传成功');
        return response;
      }
    } catch (error) {
      message.error('图片上传失败');
    }
    return false;
  };

  const handleVideoUpload = async (file) => {
    try {
      const response = await uploadVideo(file);
      if (response.success) {
        message.success('视频上传成功');
        return response;
      }
    } catch (error) {
      message.error('视频上传失败');
    }
    return false;
  };

  const renderDiaryCard = (diary) => (
    <Col xs={24} sm={12} md={8} lg={6} key={diary.id}>
      <Card
        hoverable
        className={`diary-card ${diary.recommendLevel || ''}`}
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
            {diary.images && diary.images.length > 0 ? (
              <img
                alt={diary.title}
                src={getFileUrl(diary.images[0])}
                style={{ 
                  height: '100%', 
                  objectFit: 'cover', 
                  width: '100%',
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
                <EditOutlined style={{ fontSize: 48, marginBottom: 8 }} />
                <Text style={{ color: 'white', fontSize: 14, opacity: 0.9 }}>暂无媒体</Text>
              </div>
            )}
            
            {/* 推荐标签 */}
            {diary.recommendBadge && (
              <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: diary.matchScore >= 0.7 
                  ? 'linear-gradient(135deg, #ff6b6b, #ee5a52)' 
                  : diary.matchScore >= 0.5 
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
                {diary.recommendBadge}
              </div>
            )}
            
            {/* 媒体类型标签 */}
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
              {diary.images?.length > 0 ? `📷 ${diary.images.length}张图片` : 
               diary.videos?.length > 0 ? `🎬 ${diary.videos.length}个视频` : '📝 文字'}
            </div>
            
            {/* 匹配度指示器 */}
            {diary.matchScore > 0.1 && (
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
                匹配 {Math.round(diary.matchScore * 100)}%
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
            onClick={() => showDiaryDetail(diary)}
            style={{
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            }}
          >
            阅读全文
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
            {diary.title}
          </Title>
          
          {/* 评分和作者区域 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: 12,
            padding: '8px 12px',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            borderRadius: '10px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Rate 
                disabled 
                value={diary.rating || 0} 
                style={{ fontSize: 14 }} 
                allowHalf
              />
              <span style={{ 
                marginLeft: 8, 
                fontSize: 13,
                fontWeight: 500,
                color: '#495057'
              }}>
                {diary.rating?.toFixed(1) || 0}
              </span>
              <span style={{ 
                marginLeft: 4, 
                fontSize: 12,
                color: '#6c757d'
              }}>
                ({diary.ratingCount || 1}人)
              </span>
            </div>
            <span style={{ 
              fontSize: 12, 
              color: '#1890ff', 
              fontWeight: 500,
              background: 'rgba(24, 144, 255, 0.1)',
              padding: '2px 8px',
              borderRadius: '8px',
            }}>
              {getAuthorName(diary.authorId)}
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
                {diary.clickCount || 0}
              </span>
            </div>
            
            {diary.recommendRank && diary.recommendRank <= 4 && (
              <div style={{
                background: 'linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: 11,
                fontWeight: 'bold',
              }}>
                推荐 #{diary.recommendRank}
              </div>
            )}
          </div>
          
          {/* 内容预览 */}
          <Paragraph 
            style={{ 
              fontSize: 13,
              color: '#6c757d',
              lineHeight: 1.5,
              margin: 0,
              marginBottom: 12,
              height: '40px',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
            ellipsis={{ rows: 2, expandable: false }}
          >
            {diary.content || '暂无内容'}
          </Paragraph>
          
          {/* 标签区域 */}
          {diary.tags && diary.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {diary.tags.slice(0, 3).map(tag => (
                <Tag 
                  key={tag} 
                  style={{
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                    color: '#495057',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </Tag>
              ))}
              {diary.tags.length > 3 && (
                <Tag style={{
                  borderRadius: '12px',
                  border: 'none',
                  background: '#f8f9fa',
                  color: '#6c757d',
                  fontSize: 11,
                }}>
                  +{diary.tags.length - 3}
                </Tag>
              )}
            </div>
          )}
        </div>
      </Card>
    </Col>
  );

  // 获取搜索框占位符文本
  const getSearchPlaceholder = () => {
    switch (searchType) {
      case 'title':
        return '输入日记标题进行精准搜索...';
      case 'content':
        return '搜索日记内容...';
      case 'destination':
        return '搜索旅游目的地...';
      default:
        return '搜索日记...';
    }
  };

  // 处理搜索类型变化
  const handleSearchTypeChange = (value) => {
    setSearchType(value);
    resetPagination(); // 重置分页
    // 清空搜索关键字，避免类型切换时的混淆
    setSearchKeyword('');
    if (isSearchMode) {
      // 如果当前在搜索模式，恢复到推荐状态
      setIsSearchMode(false);
      setDiaries([...originalDiaries]);
      setSortType('recommendation');
    }
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
          <BookOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          旅游日记
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          记录美好旅程，分享精彩时光，发现个性化推荐内容
        </Text>
        <div className="action-buttons" style={{ marginTop: '16px' }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setCreateModalVisible(true)}
            size="large"
            style={{
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              backdropFilter: 'blur(10px)',
              fontWeight: 'bold',
            }}
          >
            ✍️ 写日记
          </Button>
        </div>
      </div>

      <div className="filter-container" style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '32px',
        border: 'none',
      }}>
        <Row gutter={16} className="filter-row">
          <Col xs={24} sm={10} md={8}>
            <Search
              placeholder={getSearchPlaceholder()}
              allowClear
              enterButton={
                <Button 
                  type="primary"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '0 12px 12px 0',
                  }}
                >
                  <SearchOutlined />
                </Button>
              }
              size="large"
              onSearch={handleSearch}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ borderRadius: '12px' }}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              value={searchType}
              onChange={handleSearchTypeChange}
              style={{ width: '100%', borderRadius: '12px' }}
              size="large"
              placeholder="搜索类型"
            >
              <Option value="title">📝 标题搜索</Option>
              <Option value="content">📄 内容搜索</Option>
              <Option value="destination">🗺️ 目的地搜索</Option>
            </Select>
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Select
              value={sortType}
              onChange={handleSortChange}
              style={{ width: '100%', borderRadius: '12px' }}
              size="large"
              placeholder="排序方式"
              disabled={diaries.length === 0}
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
                  按热度排序
                </span>
              </Option>
              <Option value="rating">
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <StarOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                  按评价排序
                </span>
              </Option>
            </Select>
          </Col>
        </Row>
      </div>

      <Spin spinning={loading} tip={loading ? "正在为您个性化推荐..." : ""}>
        <Row gutter={[20, 20]}>
          {getCurrentPageData().map(renderDiaryCard)}
        </Row>
        {!loading && diaries.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '80px 20px',
            background: 'white',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            margin: '20px 0',
          }}>
            <BookOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
            <Title level={4} style={{ color: '#999', margin: 0 }}>
              {isSearchMode ? '未找到相关日记' : '暂无日记数据'}
            </Title>
            <Text style={{ color: '#999', fontSize: 14 }}>
              {isSearchMode ? '尝试调整搜索关键词' : '开始写下您的第一篇旅游日记吧'}
            </Text>
          </div>
        )}
      </Spin>

      {/* 日记详情模态框 */}
      <Modal
        title={selectedDiary?.title}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedDiary && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <Rate disabled value={selectedDiary.rating || 0} />
                  <span style={{ marginLeft: 8 }}>
                    {selectedDiary.rating?.toFixed(1) || '0.0'}分 ({selectedDiary.ratingCount || 1}人评价)
                  </span>
                  <span style={{ marginLeft: 16, color: '#666' }}>
                    浏览量: {selectedDiary.clickCount || 0}
                  </span>
                </div>
                <div style={{ color: '#1890ff', fontWeight: 500, fontSize: 14 }}>
                  作者: {getAuthorName(selectedDiary.authorId)}
                </div>
              </div>
              
              {/* 用户评分区域 */}
              <div style={{ 
                padding: '12px', 
                background: '#f5f5f5', 
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>为这篇日记评分：</span>
                <Rate 
                  onChange={(value) => handleRateDiary(selectedDiary.id, value)}
                  style={{ fontSize: 18 }}
                />
              </div>
            </div>
            
            <div style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 16 }}>
              {selectedDiary.content}
            </div>
            
            {selectedDiary.images && selectedDiary.images.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4>图片:</h4>
                <Row gutter={8}>
                  {selectedDiary.images.map((image, index) => (
                    <Col key={index} span={6}>
                      <img
                        src={getFileUrl(image)}
                        alt={`图片${index + 1}`}
                        style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4 }}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )}
            
            {selectedDiary.videos && selectedDiary.videos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4>视频:</h4>
                <Row gutter={8}>
                  {selectedDiary.videos.map((video, index) => (
                    <Col key={index} span={12}>
                      <video
                        controls
                        style={{ width: '100%', height: 150, borderRadius: 4 }}
                        src={getFileUrl(video)}
                      >
                        您的浏览器不支持视频播放
                      </video>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
            
            {selectedDiary.tags && selectedDiary.tags.length > 0 && (
              <div>
                <h4>标签:</h4>
                {selectedDiary.tags.map(tag => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 创建日记模态框 */}
      <Modal
        title="写日记"
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateDiary}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入日记标题' }]}
          >
            <Input placeholder="请输入日记标题" />
          </Form.Item>

          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入日记内容' }]}
          >
            <TextArea rows={8} placeholder="分享您的旅游体验..." />
          </Form.Item>

          <Form.Item 
            name="placeId" 
            label="关联场所"
            rules={[{ required: true, message: '请选择关联的场所' }]}
          >
            <Select placeholder="请选择相关场所">
              {places.map(place => (
                <Option key={place.id} value={place.id}>{place.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="rating" label="评分">
            <Rate />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Input placeholder="用逗号分隔多个标签，如：风景,摄影,美食" />
          </Form.Item>

          <Form.Item label="上传图片">
            <Upload
              listType="picture-card"
              fileList={imageList}
              onChange={({ fileList }) => setImageList(fileList)}
              customRequest={({ file, onSuccess, onError }) => {
                handleImageUpload(file).then(response => {
                  if (response) {
                    onSuccess(response);
                  } else {
                    onError(new Error('上传失败'));
                  }
                });
              }}
            >
              {imageList.length < 5 && (
                <div>
                  <PlusOutlined />
                  <div style={{ marginTop: 8 }}>上传图片</div>
                </div>
              )}
            </Upload>
          </Form.Item>

          <Form.Item label="上传视频">
            <Upload
              fileList={videoList}
              onChange={({ fileList }) => setVideoList(fileList)}
              customRequest={({ file, onSuccess, onError }) => {
                handleVideoUpload(file).then(response => {
                  if (response) {
                    onSuccess(response);
                  } else {
                    onError(new Error('上传失败'));
                  }
                });
              }}
            >
              <Button icon={<UploadOutlined />}>上传视频</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <div style={{ textAlign: 'right' }}>
              <Button onClick={() => setCreateModalVisible(false)} style={{ marginRight: 8 }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                发布日记
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 分页组件 */}
      {diaries.length > 0 && (
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
            total={diaries.length}
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

export default DiariesPage; 
