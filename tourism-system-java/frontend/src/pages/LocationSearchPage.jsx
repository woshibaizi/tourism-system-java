import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Pagination,
  Radio,
  Rate,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  EnvironmentOutlined,
  FireOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { foodAPI, getFileUrl, getPlaces } from '../services/api';

const { Title, Paragraph, Text } = Typography;

const CATEGORY_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '景区', value: '景区' },
  { label: '学校', value: '学校' },
  { label: '公园', value: '公园' },
  { label: '美食', value: '美食' },
];

const PAGE_SIZE = 12;

const normalizePlaceCategory = (type) => {
  if (type === '校园') {
    return '学校';
  }
  return type || '其他';
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const buildFoodResult = (food, placeMap) => {
  const place = placeMap.get(food.placeId);
  return {
    id: `food-${food.id}`,
    entityId: food.id,
    entityType: 'food',
    category: '美食',
    title: food.name,
    subtitle: place?.name || '未知地点',
    description: food.description || food.location || '暂无描述',
    tags: [food.cuisine, place?.type ? normalizePlaceCategory(place.type) : null].filter(Boolean),
    rating: Number(food.rating || 0),
    heat: Number(food.popularity || 0),
    image: null,
    placeId: food.placeId,
    placeName: place?.name || '',
    meta: food.location || '',
  };
};

const buildPlaceResult = (place) => ({
  id: `place-${place.id}`,
  entityId: place.id,
  entityType: 'place',
  category: normalizePlaceCategory(place.type),
  title: place.name,
  subtitle: place.address || place.type || '地点',
  description: place.description || '暂无描述',
  tags: [normalizePlaceCategory(place.type), ...(Array.isArray(place.features) ? place.features.slice(0, 2) : [])].filter(Boolean),
  rating: Number(place.rating || 0),
  heat: Number(place.clickCount || 0),
  image: place.image ? getFileUrl(place.image) : null,
  placeId: place.id,
  placeName: place.name,
  meta: place.openTime || '',
});

function LocationSearchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState([]);
  const [foods, setFoods] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('smart');
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [submittedKeyword, category, sortBy]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [placesResponse, foodsResponse] = await Promise.all([
        getPlaces(),
        foodAPI.searchFoods(undefined, { limit: 500, sortBy: 'popularity' }),
      ]);

      if (placesResponse.success) {
        setPlaces(Array.isArray(placesResponse.data) ? placesResponse.data : []);
      }

      if (foodsResponse.success) {
        setFoods(Array.isArray(foodsResponse.data) ? foodsResponse.data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  const placeMap = new Map(places.map((place) => [place.id, place]));
  const allResults = [
    ...places.map(buildPlaceResult),
    ...foods.map((food) => buildFoodResult(food, placeMap)),
  ];

  const filteredResults = allResults
    .filter((item) => {
      if (category !== 'all' && item.category !== category) {
        return false;
      }

      if (!submittedKeyword.trim()) {
        return true;
      }

      const haystack = [
        item.title,
        item.subtitle,
        item.description,
        item.meta,
        item.placeName,
        ...(item.tags || []),
      ]
        .map(normalizeText)
        .join(' ');

      return haystack.includes(normalizeText(submittedKeyword));
    })
    .sort((left, right) => {
      if (sortBy === 'rating') {
        return right.rating - left.rating || right.heat - left.heat;
      }
      if (sortBy === 'heat') {
        return right.heat - left.heat || right.rating - left.rating;
      }
      if (left.entityType !== right.entityType) {
        return left.entityType === 'place' ? -1 : 1;
      }
      return right.rating * 20 + right.heat - (left.rating * 20 + left.heat);
    });

  const pagedResults = filteredResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSearch = (value) => {
    setSubmittedKeyword(value.trim());
  };

  const openRoutePlanning = (result) => {
    navigate('/route-planning', {
      state: {
        presetDestinationKeyword: result.title,
      },
    });
  };

  return (
    <div style={{ minHeight: '100vh' }} className="animate-on-load delay-1">
      <div
        className="page-header"
        style={{
          background: 'var(--glass-surface)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          padding: '36px',
          borderRadius: '18px',
          border: '1px solid var(--glass-border-strong)',
          boxShadow: 'var(--glass-shadow)',
          marginBottom: '28px',
        }}
      >
        <Title level={2} style={{ color: 'var(--text-primary)', margin: 0 }}>
          <SearchOutlined style={{ marginRight: 12 }} />
          地点搜索
        </Title>
        <Paragraph style={{ color: 'var(--text-secondary)', marginTop: 10, marginBottom: 0, fontSize: 15 }}>
          把景区、学校、公园和美食收进一个入口里找。
        </Paragraph>
      </div>

      <Card style={{ borderRadius: 18, border: 'none', boxShadow: '0 14px 32px rgba(25, 42, 70, 0.08)', marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={12}>
            <Input.Search
              size="large"
              placeholder="搜索地点、美食、菜系、地址"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={handleSearch}
              enterButton="搜索"
            />
          </Col>
          <Col xs={24} lg={7}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <Radio.Button key={option.value} value={option.value}>
                  {option.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Col>
          <Col xs={24} lg={5}>
            <Select
              size="large"
              style={{ width: '100%' }}
              value={sortBy}
              onChange={setSortBy}
              options={[
                { label: '综合排序', value: 'smart' },
                { label: '评分优先', value: 'rating' },
                { label: '热度优先', value: 'heat' },
              ]}
            />
          </Col>
        </Row>

        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Tag color="blue">共 {filteredResults.length} 条结果</Tag>
          <Tag color="green">地点 {places.length}</Tag>
          <Tag color="orange">美食 {foods.length}</Tag>
          {submittedKeyword && <Tag color="purple">关键词：{submittedKeyword}</Tag>}
        </div>
      </Card>

      <Spin spinning={loading} tip="正在加载地点与美食数据...">
        {pagedResults.length === 0 ? (
          <Card style={{ borderRadius: 18 }}>
            <Empty description="没有匹配到结果，换个关键词或分类再试。" />
          </Card>
        ) : (
          <>
            <Row gutter={[18, 18]}>
              {pagedResults.map((result) => (
                <Col xs={24} md={12} xl={8} key={result.id}>
                  <Card
                    hoverable
                    style={{ borderRadius: 18, height: '100%', border: 'none', boxShadow: '0 12px 28px rgba(25, 42, 70, 0.08)' }}
                    bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                    cover={
                      result.image ? (
                        <img src={result.image} alt={result.title} style={{ height: 190, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', background: result.entityType === 'food' ? 'linear-gradient(135deg, #fff1e6 0%, #ffe7ba 100%)' : 'linear-gradient(135deg, #e6f4ff 0%, #d6e4ff 100%)' }}>
                          {result.entityType === 'food' ? (
                            <FireOutlined style={{ fontSize: 46, color: '#d46b08' }} />
                          ) : (
                            <EnvironmentOutlined style={{ fontSize: 46, color: '#1d39c4' }} />
                          )}
                        </div>
                      )
                    }
                  >
                    <Space wrap>
                      <Tag color={result.entityType === 'food' ? 'orange' : 'blue'}>
                        {result.entityType === 'food' ? '美食' : result.category}
                      </Tag>
                      {result.tags.map((tag) => (
                        <Tag key={`${result.id}-${tag}`}>{tag}</Tag>
                      ))}
                    </Space>

                    <div>
                      <Title level={4} style={{ marginBottom: 6 }}>{result.title}</Title>
                      <Text type="secondary">{result.subtitle}</Text>
                    </div>

                    <Paragraph style={{ marginBottom: 0, minHeight: 44 }}>
                      {result.description}
                    </Paragraph>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <Rate disabled value={result.rating} style={{ fontSize: 13 }} />
                      <Text type="secondary">热度 {result.heat || 0}</Text>
                    </div>

                    {result.meta && (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {result.entityType === 'food' ? `位置：${result.meta}` : result.meta}
                      </Text>
                    )}

                    <Space style={{ marginTop: 'auto' }}>
                      <Button
                        type="primary"
                        onClick={() => {
                          if (result.entityType === 'food') {
                            navigate(`/places/${result.placeId}`);
                            return;
                          }
                          navigate(`/places/${result.entityId}`);
                        }}
                      >
                        {result.entityType === 'food' ? '查看所属地点' : '查看详情'}
                      </Button>
                      <Button icon={<RightOutlined />} onClick={() => openRoutePlanning(result)}>
                        去导航
                      </Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={filteredResults.length}
                onChange={setPage}
                showSizeChanger={false}
              />
            </div>
          </>
        )}
      </Spin>
    </div>
  );
}

export default LocationSearchPage;
