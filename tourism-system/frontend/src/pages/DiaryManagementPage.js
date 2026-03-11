import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Input, 
  Select, 
  Space, 
  message, 
  Modal, 
  Form, 
  Tag, 
  Popconfirm,
  Row,
  Col,
  Typography,
  Tooltip,
  Avatar
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined, 
  PlusOutlined,
  EyeOutlined,
  BookOutlined,
  SettingOutlined,
  UserOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const DiaryManagementPage = () => {
  const [diaries, setDiaries] = useState([]);
  const [filteredDiaries, setFilteredDiaries] = useState([]);
  const [places, setPlaces] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDiary, setEditingDiary] = useState(null);
  const [form] = Form.useForm();
  
  const navigate = useNavigate();

  // 初始化数据
  useEffect(() => {
    loadData();
  }, []);

  // 搜索和筛选
  useEffect(() => {
    filterDiaries();
  }, [diaries, searchText, selectedPlace, selectedAuthor]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [diariesRes, placesRes, usersRes] = await Promise.all([
        axios.get('http://localhost:5001/api/diaries?pageSize=1000'),
        axios.get('http://localhost:5001/api/places'),
        axios.get('http://localhost:5001/api/users')
      ]);

      if (diariesRes.data.success) {
        setDiaries(diariesRes.data.data.diaries || []);
      }
      if (placesRes.data.success) {
        setPlaces(placesRes.data.data || []);
      }
      if (usersRes.data.success) {
        setUsers(usersRes.data.data || []);
      }
    } catch (error) {
      message.error('加载数据失败');
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterDiaries = () => {
    let filtered = [...diaries];

    // 文本搜索
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(diary => 
        diary.title?.toLowerCase().includes(searchLower) ||
        diary.content?.toLowerCase().includes(searchLower)
      );
    }

    // 场所筛选
    if (selectedPlace) {
      filtered = filtered.filter(diary => diary.placeId === selectedPlace);
    }

    // 作者筛选
    if (selectedAuthor) {
      filtered = filtered.filter(diary => diary.authorId === selectedAuthor);
    }

    setFilteredDiaries(filtered);
  };

  const handleEdit = (diary) => {
    setEditingDiary(diary);
    form.setFieldsValue({
      title: diary.title,
      content: diary.content,
      placeId: diary.placeId,
      tags: diary.tags || []
    });
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      
      // 调用更新API
      const response = await axios.put(`http://localhost:5001/api/diaries/${editingDiary.id}`, values);
      
      if (response.data.success) {
        // 更新本地状态
        const updatedDiaries = diaries.map(diary => 
          diary.id === editingDiary.id ? response.data.data : diary
        );
        setDiaries(updatedDiaries);

        message.success('日记更新成功');
        setEditModalVisible(false);
        setEditingDiary(null);
        form.resetFields();
      } else {
        message.error(response.data.message || '更新失败');
      }
    } catch (error) {
      message.error('更新失败');
      console.error('更新失败:', error);
    }
  };

  const handleDelete = async (diaryId) => {
    try {
      // 调用删除API
      const response = await axios.delete(`http://localhost:5001/api/diaries/${diaryId}`);
      
      if (response.data.success) {
        // 更新本地状态
        const updatedDiaries = diaries.filter(diary => diary.id !== diaryId);
        setDiaries(updatedDiaries);
        message.success('日记删除成功');
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
      console.error('删除失败:', error);
    }
  };

  const handleView = (diaryId) => {
    navigate(`/diaries/${diaryId}`);
  };

  const getPlaceName = (placeId) => {
    const place = places.find(p => p.id === placeId);
    return place ? place.name : '未知场所';
  };

  const getAuthorName = (authorId) => {
    const user = users.find(u => u.id === authorId);
    return user ? user.username || user.name : '未知用户';
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text, record) => (
        <div>
          <Text strong style={{ display: 'block' }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ID: {record.id}
          </Text>
        </div>
      ),
    },
    {
      title: '作者',
      dataIndex: 'authorId',
      key: 'authorId',
      width: 120,
      render: (authorId) => (
        <Space>
          <Avatar size="small" icon={<BookOutlined />} />
          {getAuthorName(authorId)}
        </Space>
      ),
    },
    {
      title: '场所',
      dataIndex: 'placeId',
      key: 'placeId',
      width: 150,
      render: (placeId) => (
        <Tag color="blue">{getPlaceName(placeId)}</Tag>
      ),
    },
    {
      title: '内容预览',
      dataIndex: 'content',
      key: 'content',
      width: 250,
      render: (content) => (
        <Tooltip title={content}>
          <Text ellipsis style={{ maxWidth: 200 }}>
            {content?.substring(0, 50)}...
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '统计',
      key: 'stats',
      width: 120,
      render: (_, record) => (
        <div>
          <Text style={{ fontSize: '12px', display: 'block' }}>
            点击: {record.clickCount || 0}
          </Text>
          <Text style={{ fontSize: '12px', display: 'block' }}>
            评分: {record.rating || 0}/5
          </Text>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => (
        <Text style={{ fontSize: '12px' }}>
          {new Date(date).toLocaleDateString()}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleView(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这篇日记吗？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="content-wrapper" style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)', minHeight: '100vh' }}>
      {/* 页面标题 */}
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
          <SettingOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          旅游日记管理
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          管理和编辑所有旅游日记，查看统计数据和用户反馈
        </Text>
      </div>
        
      {/* 搜索和筛选 */}
      <Card style={{
        background: 'white',
        padding: '24px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '32px',
        border: 'none',
      }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8} md={6}>
            <Input
              placeholder="搜索标题或内容"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="large"
              style={{ borderRadius: '12px' }}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              placeholder="选择场所"
              style={{ width: '100%', borderRadius: '12px' }}
              value={selectedPlace}
              onChange={setSelectedPlace}
              allowClear
              size="large"
            >
              {places.map(place => (
                <Option key={place.id} value={place.id}>
                  <Space>
                    <EnvironmentOutlined style={{ color: '#1890ff' }} />
                    {place.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              placeholder="选择作者"
              style={{ width: '100%', borderRadius: '12px' }}
              value={selectedAuthor}
              onChange={setSelectedAuthor}
              allowClear
              size="large"
            >
              {users.map(user => (
                <Option key={user.id} value={user.id}>
                  <Space>
                    <UserOutlined style={{ color: '#52c41a' }} />
                    {user.username || user.name}
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Space>
              <Button 
                onClick={loadData} 
                loading={loading}
                size="large"
                style={{ borderRadius: '12px' }}
              >
                🔄 刷新
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => navigate('/diaries?create=true')}
                size="large"
                style={{
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                }}
              >
                ✍️ 新建日记
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 统计信息 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={6}>
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            overflow: 'hidden',
          }}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: '#2c3e50', fontWeight: 600, fontSize: 14 }}>总日记数</Text>
              <Title level={3} style={{ margin: '8px 0 0 0', color: '#27ae60', fontWeight: 'bold' }}>
                📚 {diaries.length}
              </Title>
            </div>
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
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: '#2c3e50', fontWeight: 600, fontSize: 14 }}>筛选结果</Text>
              <Title level={3} style={{ margin: '8px 0 0 0', color: '#e74c3c', fontWeight: 'bold' }}>
                🔍 {filteredDiaries.length}
              </Title>
            </div>
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
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>总点击量</Text>
              <Title level={3} style={{ margin: '8px 0 0 0', color: '#f39c12', fontWeight: 'bold' }}>
                👁️ {diaries.reduce((sum, diary) => sum + (diary.clickCount || 0), 0)}
              </Title>
            </div>
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
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: '#2c3e50', fontWeight: 600, fontSize: 14 }}>平均评分</Text>
              <Title level={3} style={{ margin: '8px 0 0 0', color: '#9b59b6', fontWeight: 'bold' }}>
                ⭐ {diaries.length > 0 ? 
                  (diaries.reduce((sum, diary) => sum + (diary.rating || 0), 0) / diaries.length).toFixed(1) 
                  : '0.0'}
              </Title>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 日记列表 */}
      <Card style={{
        borderRadius: '16px',
        border: 'none',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        background: 'white',
        overflow: 'hidden',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
          margin: '-24px -24px 24px -24px',
          padding: '20px 24px',
          color: 'white',
        }}>
          <Title level={4} style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
            📋 日记列表管理
          </Title>
        </div>
        <Table
          columns={columns}
          dataSource={filteredDiaries}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          style={{ 
            borderRadius: '12px',
            overflow: 'hidden',
          }}
          pagination={{
            total: filteredDiaries.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => (
              <span style={{ color: '#666', fontSize: 14 }}>
                第 {range[0]}-{range[1]} 条，共 {total} 条记录
              </span>
            ),
            style: { marginTop: '24px' }
          }}
        />
      </Card>

      {/* 编辑模态框 */}
      <Modal
        title="编辑日记"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingDiary(null);
          form.resetFields();
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入日记标题" />
          </Form.Item>

          <Form.Item
            name="placeId"
            label="场所"
            rules={[{ required: true, message: '请选择场所' }]}
          >
            <Select placeholder="请选择场所">
              {places.map(place => (
                <Option key={place.id} value={place.id}>
                  {place.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea 
              rows={8} 
              placeholder="请输入日记内容"
              showCount
              maxLength={2000}
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Select
              mode="tags"
              placeholder="添加标签（可自定义）"
              style={{ width: '100%' }}
            >
              <Option value="美食">美食</Option>
              <Option value="风景">风景</Option>
              <Option value="文化">文化</Option>
              <Option value="历史">历史</Option>
              <Option value="购物">购物</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DiaryManagementPage; 