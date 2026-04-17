import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Avatar, Dropdown, message, Button, Space, Card, Descriptions, Tag, Typography } from 'antd';
import {
  HomeOutlined,
  EnvironmentOutlined,
  BookOutlined,
  UserOutlined,
  BarChartOutlined,
  CarOutlined,
  SearchOutlined,
  LogoutOutlined,
  FireOutlined,
  BuildOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  DownOutlined,
} from '@ant-design/icons';

// 导入页面组件
import HomePage from './pages/HomePage';
import PlacesPage from './pages/PlacesPage';
import PlaceDetailPage from './pages/PlaceDetailPage';
import DiariesPage from './pages/DiariesPage';
import DiaryDetailPage from './pages/DiaryDetailPage';
import RoutePage from './pages/RoutePage';
import FacilityQueryPage from './pages/FacilityQueryPage';
import StatsPage from './pages/StatsPage';
import LoginPage from './pages/LoginPage';
import DiaryManagementPage from './pages/DiaryManagementPage';
import FoodSearchPage from './pages/FoodSearchPage';
import IndoorNavigationPage from './pages/IndoorNavigationPage';
import ConcurrencyTestPage from './pages/ConcurrencyTestPage';

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

function NavGroup({ title, icon, items, active, onMenuClick }) {
  return (
    <Dropdown menu={{ items, onClick: onMenuClick }} placement="bottomRight" trigger={['click']}>
      <Button
        className={`atlas-nav-button ${active ? 'active' : ''}`}
        icon={icon}
      >
        {title}
        <DownOutlined />
      </Button>
    </Dropdown>
  );
}

function PersonalPage({ currentUser }) {
  const interests = currentUser?.interests || [];
  const favoriteCategories = currentUser?.favoriteCategories || [];

  return (
    <div className="profile-atlas-page">
      <Card>
        <Title level={2}>个人界面</Title>
        <Paragraph type="secondary">
          查看当前登录用户的基础信息。后续可在这里继续扩展收藏、浏览历史和偏好设置。
        </Paragraph>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="用户名">
            {currentUser?.username || currentUser?.name || '未命名用户'}
          </Descriptions.Item>
          <Descriptions.Item label="用户 ID">
            {currentUser?.id || '暂无'}
          </Descriptions.Item>
          <Descriptions.Item label="兴趣标签">
            {interests.length > 0
              ? interests.map((item) => <Tag key={item}>{item}</Tag>)
              : '暂无'}
          </Descriptions.Item>
          <Descriptions.Item label="偏好分类">
            {favoriteCategories.length > 0
              ? favoriteCategories.map((item) => <Tag key={item}>{item}</Tag>)
              : '暂无'}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    const savedLoginStatus = localStorage.getItem('isLoggedIn');
    if (!savedUser || savedLoginStatus !== 'true') {
      return null;
    }

    try {
      return JSON.parse(savedUser);
    } catch (error) {
      console.error('恢复用户状态失败:', error);
      localStorage.removeItem('user');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('token');
      return null;
    }
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const savedLoginStatus = localStorage.getItem('isLoggedIn');
    const savedUser = localStorage.getItem('user');
    return savedLoginStatus === 'true' && Boolean(savedUser);
  });
  
  const navigate = useNavigate();
  const location = useLocation();

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    // 保存用户信息到localStorage
    localStorage.setItem('user', JSON.stringify(user));
    if (user?.token) {
      localStorage.setItem('token', user.token);
    }
    localStorage.setItem('isLoggedIn', 'true');
    navigate('/places');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    // 清除localStorage中的用户信息
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
    message.success('已退出登录');
  };

  // 如果用户未登录，显示登录页面
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const routeModuleItems = [
    {
      key: '/places',
      icon: <EnvironmentOutlined />,
      label: '场所浏览',
    },
    {
      key: '/route-planning',
      icon: <CarOutlined />,
      label: '路线规划',
    },
    {
      key: '/facility-query',
      icon: <SearchOutlined />,
      label: '场所查询',
    },
    {
      key: '/food-search',
      icon: <FireOutlined />,
      label: '美食搜索',
    },
  ];

  const diaryModuleItems = [
    {
      key: '/diaries',
      icon: <BookOutlined />,
      label: '旅游日记',
    },
    {
      key: '/diary-management',
      icon: <SettingOutlined />,
      label: '日记管理',
    },
  ];

  const otherModuleItems = [
    {
      key: '/stats',
      icon: <BarChartOutlined />,
      label: '统计分析',
    },
    {
      key: '/concurrency-test',
      icon: <ThunderboltOutlined />,
      label: '并发测试',
    },
  ];

  const personalItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '返回首页',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: '个人界面',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    },
  ];

  function handleMenuClick({ key }) {
    if (key === 'logout') {
      handleLogout();
      return;
    }
    navigate(key);
  }

  const isGroupActive = (items) => items.some((item) => item.key === location.pathname);

  return (
    <Layout className="main-layout atlas-shell" style={{ minHeight: '100vh' }}>
      <Layout>
        <Header 
          className="header-nav" 
          style={{ 
            padding: '0 28px', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(250, 246, 235, 0.86)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 16px 40px rgba(30, 44, 35, 0.1)',
            borderBottom: '1px solid rgba(61, 83, 68, 0.12)',
            height: 72,
            position: 'fixed',
            top: 0,
            right: 0,
            left: 0,
            zIndex: 999,
          }}
        >
          <div
            onClick={() => navigate('/')}
            style={{ 
              color: 'var(--apple-text-primary)', 
              fontSize: 22, 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              letterSpacing: '-0.015em'
            }}>
              <span style={{ fontSize: 24 }}></span>
              个性化旅游系统
            </div>
          
          <div className="atlas-top-nav">
            <Space size={10} wrap>
              <NavGroup title="路线规划" icon={<CarOutlined />} items={routeModuleItems} active={isGroupActive(routeModuleItems)} onMenuClick={handleMenuClick} />
              <NavGroup title="日记板块" icon={<BookOutlined />} items={diaryModuleItems} active={isGroupActive(diaryModuleItems)} onMenuClick={handleMenuClick} />
              <NavGroup title="其他" icon={<BarChartOutlined />} items={otherModuleItems} active={isGroupActive(otherModuleItems)} onMenuClick={handleMenuClick} />
              <Dropdown menu={{ items: personalItems, onClick: handleMenuClick }} placement="bottomRight" trigger={['click']}>
                <Button
                  className={`atlas-nav-button atlas-user-button ${isGroupActive(personalItems) ? 'active' : ''}`}
                  icon={<Avatar size={24} icon={<UserOutlined />} src={currentUser.avatar} />}
                >
                  {currentUser?.username || currentUser?.name || '个人'}
                  <DownOutlined />
                </Button>
              </Dropdown>
            </Space>
          </div>
        </Header>
        
        <Content className="content-wrapper" style={{ 
          margin: 0,
          background: 'none',
          minHeight: '100vh',
          overflow: 'auto',
          paddingTop: 72,
        }}>
          <div style={{ padding: '24px', minHeight: 'calc(100vh - 72px)' }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/places" element={<PlacesPage />} />
              <Route path="/places/:placeId" element={<PlaceDetailPage />} />
              <Route path="/diaries" element={<DiariesPage />} />
              <Route path="/diaries/:diaryId" element={<DiaryDetailPage />} />
              <Route path="/route-planning" element={<RoutePage />} />
              <Route path="/facility-query" element={<FacilityQueryPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/diary-management" element={<DiaryManagementPage />} />
              <Route path="/food-search" element={<FoodSearchPage />} />
              <Route path="/indoor-navigation" element={<IndoorNavigationPage />} />
              <Route path="/profile" element={<PersonalPage currentUser={currentUser} />} />
              <Route path="/concurrency-test" element={<ConcurrencyTestPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App; 
