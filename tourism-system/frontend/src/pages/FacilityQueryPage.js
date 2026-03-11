import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Select, 
  Button, 
  Spin, 
  message, 
  Tag, 
  Rate, 
  Alert, 
  Typography, 
  Pagination,
  Avatar,
  Space,
  Divider,
  Input,
  Tooltip
} from 'antd';
import { 
  EnvironmentOutlined, 
  SearchOutlined, 
  ClockCircleOutlined,
  ShopOutlined,
  CoffeeOutlined,
  BookOutlined,
  HomeOutlined,
  CarOutlined,
  CustomerServiceOutlined,
  ShoppingCartOutlined,
  RestOutlined,
  BankOutlined,
  StarOutlined,
  BuildOutlined,
  FilterOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { getPlaces, getBuildingsByPlace, getNearestFacilities } from '../services/api';

const { Option } = Select;
const { Title, Text } = Typography;

function FacilityQueryPage() {
  const [places, setPlaces] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [allFacilities, setAllFacilities] = useState([]); // 存储所有设施
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFacilityType, setSelectedFacilityType] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12); // 每页显示12个

  // 预定义的设施类别（用于下拉选择）
  const availableCategories = [
    { value: 'all', label: '全部类型' },
    { value: '商店', label: '商店' },
    { value: '饭店', label: '饭店' },
    { value: '洗手间', label: '洗手间' },
    { value: '图书馆', label: '图书馆' },
    { value: '食堂', label: '食堂' },
    { value: '超市', label: '超市' },
    { value: '咖啡馆', label: '咖啡馆' },
    { value: '公交站', label: '公交站' },
    { value: '服务中心', label: '服务中心' },
    { value: '其他', label: '其他' }
  ];

  // 处理设施类型选择变化
  const handleFacilityTypeChange = (value) => {
    setSelectedFacilityType(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 设施类型图标和颜色映射
  const getFacilityIcon = (type) => {
    const iconMap = {
      '商店': { icon: <ShopOutlined />, color: '#1890ff', bgColor: '#e6f7ff' },
      '饭店': { icon: <CoffeeOutlined />, color: '#fa8c16', bgColor: '#fff7e6' },
      '洗手间': { icon: <RestOutlined />, color: '#52c41a', bgColor: '#f6ffed' },
      '图书馆': { icon: <BookOutlined />, color: '#722ed1', bgColor: '#f9f0ff' },
      '食堂': { icon: <HomeOutlined />, color: '#eb2f96', bgColor: '#fff0f6' },
      '超市': { icon: <ShoppingCartOutlined />, color: '#13c2c2', bgColor: '#e6fffb' },
      '咖啡馆': { icon: <CoffeeOutlined />, color: '#a0522d', bgColor: '#fdf6ec' },
      '公交站': { icon: <CarOutlined />, color: '#faad14', bgColor: '#fffbe6' },
      '服务中心': { icon: <CustomerServiceOutlined />, color: '#f5222d', bgColor: '#fff1f0' },
      '其他': { icon: <BankOutlined />, color: '#666666', bgColor: '#f5f5f5' }
    };
    return iconMap[type] || iconMap['其他'];
  };

  // 获取距离颜色
  const getDistanceColor = (distance) => {
    if (distance <= 100) return '#52c41a';
    if (distance <= 300) return '#faad14';
    if (distance <= 500) return '#fa8c16';
    return '#f5222d';
  };

  useEffect(() => {
    loadPlaces();
  }, []);

  // 加载场所列表
  const loadPlaces = async () => {
    try {
      const response = await getPlaces();
      if (response.success) {
        setPlaces(response.data);
      }
    } catch (error) {
      message.error('加载场所失败');
    }
  };

  // 处理场所选择变化
  const handlePlaceChange = async (placeId) => {
    setSelectedPlace(placeId);
    setSelectedBuilding(null);
    setAllFacilities([]);
    setHasSearched(false);
    setCurrentPage(1);
    
    if (!placeId) {
      setBuildings([]);
      return;
    }

    try {
      const response = await getBuildingsByPlace(placeId);
      if (response.success) {
        setBuildings(response.data);
      }
    } catch (error) {
      message.error('加载建筑物失败');
      setBuildings([]);
    }
  };

  // 处理建筑物选择变化
  const handleBuildingChange = (buildingId) => {
    setSelectedBuilding(buildingId);
    setAllFacilities([]);
    setHasSearched(false);
    setCurrentPage(1);
  };

  // 获取当前页的设施数据
  const getCurrentPageFacilities = () => {
    let filteredFacilities = allFacilities;
    
    // 根据设施类型过滤
    if (selectedFacilityType !== 'all') {
      filteredFacilities = allFacilities.filter(facility => facility.type === selectedFacilityType);
    }
    
    // 分页
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredFacilities.slice(startIndex, endIndex);
  };

  // 获取过滤后的设施总数
  const getFilteredFacilitiesCount = () => {
    if (selectedFacilityType === 'all') {
      return allFacilities.length;
    }
    return allFacilities.filter(facility => facility.type === selectedFacilityType).length;
  };

  // 处理分页变化
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // 查询最近的设施
  const handleQuery = async () => {
    if (!selectedPlace || !selectedBuilding) {
      message.warning('请先选择场所和建筑物');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setCurrentPage(1);
    
    // 显示查询参数信息
    console.log('查询参数:', {
      selectedBuilding,
      selectedPlace,
      selectedFacilityType
    });
    
    try {
      // 调用后端API查询最近的设施，不传递limit参数
      const response = await getNearestFacilities(
        selectedBuilding,
        selectedPlace,
        selectedFacilityType
      );
      
      console.log('API响应:', response);
      
      if (response.success) {
        setAllFacilities(response.data);
        const facilityTypeText = selectedFacilityType !== 'all' ? `类型为"${selectedFacilityType}"的` : '';
        message.success(`找到 ${response.data.length} 个可达的${facilityTypeText}设施`);
      } else {
        message.error(response.message || '查询失败');
        setAllFacilities([]);
      }
    } catch (error) {
      console.error('查询错误:', error);
      message.error('查询失败，请稍后重试');
      setAllFacilities([]);
    } finally {
      setLoading(false);
    }
  };

  // 渲染美化的设施卡片
  const renderFacilityCard = (facility) => {
    const facilityIcon = getFacilityIcon(facility.type);
    const distanceColor = getDistanceColor(facility.distance);
    
    return (
      <Col xs={24} sm={12} md={8} lg={6} key={facility.id}>
        <Card
          hoverable
          className="facility-card"
          style={{ 
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease',
            border: '1px solid #f0f0f0'
          }}
          bodyStyle={{ padding: '16px' }}
        >
          {/* 顶部图标区域 */}
          <div 
            className="facility-icon-bg"
            style={{ 
              background: `linear-gradient(135deg, ${facilityIcon.bgColor} 0%, ${facilityIcon.color}20 100%)`,
              padding: '20px',
              textAlign: 'center',
              position: 'relative',
              marginBottom: '16px',
              borderRadius: '8px'
            }}
          >
            <Avatar 
              size={48} 
              icon={facilityIcon.icon}
              style={{ 
                backgroundColor: facilityIcon.color,
                fontSize: '24px'
              }}
            />
            
            {/* 距离标签 */}
            {facility.distance !== undefined && (
              <div 
                className="distance-badge"
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: distanceColor,
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <EnvironmentOutlined />
                {facility.distance}m
              </div>
            )}
          </div>

          {/* 设施信息 */}
          <div style={{ textAlign: 'center' }}>
            <Title level={5} style={{ 
              margin: '0 0 8px 0', 
              fontSize: '16px',
              fontWeight: 600,
              color: '#262626'
            }}>
              {facility.name}
            </Title>
            
            <Tag 
              color={facilityIcon.color} 
              style={{ 
                marginBottom: '12px',
                borderRadius: '12px',
                padding: '2px 8px'
              }}
            >
              {facility.type}
            </Tag>

            {/* 评分区域 */}
            <div style={{ marginBottom: '12px' }}>
              <Space align="center">
                <Rate 
                  disabled 
                  value={facility.rating || 0} 
                  style={{ fontSize: '14px' }}
                  character={<StarOutlined />}
                />
                <Text style={{ fontSize: '12px', color: '#666' }}>
                  {facility.rating?.toFixed(1) || '0.0'}
                </Text>
              </Space>
            </div>

            {/* 描述信息 */}
            {facility.description && (
              <Text 
                type="secondary" 
                style={{ 
                  fontSize: '12px',
                  display: 'block',
                  marginBottom: '12px',
                  lineHeight: '1.4'
                }}
              >
                {facility.description.length > 40 
                  ? `${facility.description.substring(0, 40)}...` 
                  : facility.description
                }
              </Text>
            )}

            <Divider style={{ margin: '12px 0' }} />

            {/* 底部信息 */}
            <Row gutter={8} className="facility-info-bottom">
              <Col span={12}>
                <div style={{ 
                  color: distanceColor, 
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}>
                  <EnvironmentOutlined />
                  {facility.distance}米
                </div>
              </Col>
              {facility.travelTime && (
                <Col span={12}>
                  <div style={{ 
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}>
                    <ClockCircleOutlined />
                    {facility.travelTime.toFixed(1)}分钟
                  </div>
                </Col>
              )}
            </Row>
          </div>
        </Card>
      </Col>
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
          <SearchOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          场所查询
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          选择场所和建筑物，查找距离最近的设施（基于路径距离）
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
        <Row gutter={16} className="filter-row">
          <Col xs={24} sm={6} md={6}>
            <Select
              value={selectedPlace}
              onChange={handlePlaceChange}
              placeholder="🏛️ 选择场所"
              style={{ width: '100%', borderRadius: '12px' }}
              size="large"
              allowClear
            >
              {places.map(place => (
                <Option key={place.id} value={place.id}>
                  <Space>
                    <EnvironmentOutlined style={{ color: '#1890ff' }} />
                    {place.name} ({place.type})
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={24} sm={6} md={6}>
            <Select
              value={selectedBuilding}
              onChange={handleBuildingChange}
              placeholder="🏢 选择建筑物"
              style={{ width: '100%', borderRadius: '12px' }}
              size="large"
              allowClear
              disabled={!selectedPlace}
            >
              {buildings.map(building => (
                <Option key={building.id} value={building.id}>
                  <Space>
                    <BuildOutlined style={{ color: '#52c41a' }} />
                    {building.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={4} md={4}>
            <Select
              value={selectedFacilityType}
              onChange={handleFacilityTypeChange}
              placeholder="选择设施类型"
              style={{ width: '100%', borderRadius: '12px' }}
              size="large"
              allowClear
              showSearch
              optionFilterProp="children"
              suffixIcon={<FilterOutlined style={{ color: '#fa8c16' }} />}
            >
              {availableCategories.map(category => (
                <Option key={category.value} value={category.value}>
                  {category.label}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={4} md={4}>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              size="large"
              onClick={handleQuery}
              style={{ 
                width: '100%',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              }}
              disabled={!selectedPlace || !selectedBuilding}
              loading={loading}
            >
              🔍 查询
            </Button>
          </Col>
        </Row>
      </div>

      {hasSearched && !loading && (
        <Alert
          message={`查询结果`}
          description={`从 ${buildings.find(b => b.id === selectedBuilding)?.name || '选定建筑物'} 出发，找到 ${getFilteredFacilitiesCount()} 个可达设施${selectedFacilityType !== 'all' ? `（类型：${selectedFacilityType}）` : ''}`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Spin spinning={loading} tip="正在查询最近的设施...">
        <Row gutter={[16, 16]}>
          {getCurrentPageFacilities().map(renderFacilityCard)}
        </Row>
        
        {hasSearched && !loading && getFilteredFacilitiesCount() === 0 && (
          <div className="empty-state" style={{ 
            textAlign: 'center', 
            padding: '50px', 
            color: '#999'
          }}>
            <EnvironmentOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              {selectedFacilityType !== 'all' 
                ? `未找到类型为"${selectedFacilityType}"的设施` 
                : '未找到相关设施'
              }
            </div>
            <Text type="secondary">请尝试选择其他建筑物或设施类型</Text>
          </div>
        )}

        {/* 只有当数据量大于一页时才显示分页器 */}
        {hasSearched && !loading && getFilteredFacilitiesCount() > pageSize && (
          <Pagination
            current={currentPage}
            total={getFilteredFacilitiesCount()}
            pageSize={pageSize}
            onChange={handlePageChange}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
            style={{ marginTop: 24, textAlign: 'center' }}
          />
        )}
      </Spin>
    </div>
  );
}

export default FacilityQueryPage; 