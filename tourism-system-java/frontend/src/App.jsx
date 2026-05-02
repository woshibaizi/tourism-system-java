import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Avatar, Dropdown, message, Button, Space, Card, Descriptions, Tag, Typography } from 'antd';
import {
  EnvironmentOutlined,
  BookOutlined,
  UserOutlined,
  BarChartOutlined,
  CarOutlined,
  SearchOutlined,
  LogoutOutlined,
  BuildOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  DownOutlined,
  MessageOutlined,
} from '@ant-design/icons';

// 导入页面组件
import HomePage from './pages/HomePage';
import LocationSearchPage from './pages/LocationSearchPage';
import PlaceDetailPage from './pages/PlaceDetailPage';
import DiariesPage from './pages/DiariesPage';
import DiaryDetailPage from './pages/DiaryDetailPage';
import RoutePage from './pages/RoutePage';
import StatsPage from './pages/StatsPage';
import LoginPage from './pages/LoginPage';
import DiaryManagementPage from './pages/DiaryManagementPage';
import CampusNavigationPage from './pages/CampusNavigationPage';
import ConcurrencyTestPage from './pages/ConcurrencyTestPage';
import PersonalTravelAssistantPage from './pages/PersonalTravelAssistantPage';
import './App.css';

const { Header, Content } = Layout;
const { Title } = Typography;

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
    <div className="profile-atlas-page" style={{ maxWidth: 600 }}>
      <Card>
        <Title level={3} style={{ marginTop: 0 }}>个人中心</Title>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="用户名">
            {currentUser?.username || currentUser?.name || '未命名用户'}
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
    navigate('/location-search');
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

  const discoverModuleItems = [
    {
      key: '/location-search',
      icon: <EnvironmentOutlined />,
      label: '地点搜索',
    },
    {
      key: '/route-planning',
      icon: <CarOutlined />,
      label: '高德导航',
    },
    {
      key: '/campus-navigation',
      icon: <BuildOutlined />,
      label: '校内导航',
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

  const assistantModuleItems = [
    {
      key: '/travel-assistant',
      icon: <MessageOutlined />,
      // 当前先只放一个入口，后续可以扩展“图片日记”“草稿发布”等子页面。
      label: '个性化旅游助手',
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
      key: '/profile',
      icon: <UserOutlined />,
      label: '个人中心',
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
    <Layout className="main-layout" style={{ minHeight: '100vh' }}>
      <Layout>
        <Header
          className="header-nav"
          style={{
            padding: '0 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: 64,
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
              color: 'var(--text-primary)',
              fontSize: 18,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            个性化旅游系统
          </div>

          <div className="atlas-top-nav">
            <Space size={6} wrap>
              <NavGroup title="地点与导航" icon={<SearchOutlined />} items={discoverModuleItems} active={isGroupActive(discoverModuleItems)} onMenuClick={handleMenuClick} />
              <NavGroup title="日记板块" icon={<BookOutlined />} items={diaryModuleItems} active={isGroupActive(diaryModuleItems)} onMenuClick={handleMenuClick} />
              <NavGroup title="旅游助手" icon={<MessageOutlined />} items={assistantModuleItems} active={isGroupActive(assistantModuleItems)} onMenuClick={handleMenuClick} />
              <NavGroup title="其他" icon={<BarChartOutlined />} items={otherModuleItems} active={isGroupActive(otherModuleItems)} onMenuClick={handleMenuClick} />
              <Dropdown menu={{ items: personalItems, onClick: handleMenuClick }} placement="bottomRight" trigger={['click']}>
                <Button
                  className={`atlas-nav-button atlas-user-button ${isGroupActive(personalItems) ? 'active' : ''}`}
                  icon={<Avatar size={22} icon={<UserOutlined />} src={currentUser?.avatar} />}
                  style={{ borderRadius: 10 }}
                >
                  {currentUser?.username || currentUser?.name || '个人'}
                  <DownOutlined />
                </Button>
              </Dropdown>
            </Space>
          </div>
        </Header>

        <Content
          className="content-wrapper"
          style={{
            background: 'none',
            minHeight: '100vh',
            paddingTop: 64,
          }}
        >
          <div style={{ padding: '24px 0', minHeight: 'calc(100vh - 64px)' }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/location-search" element={<LocationSearchPage />} />
              <Route path="/places" element={<Navigate to="/location-search" replace />} />
              <Route path="/places/:placeId" element={<PlaceDetailPage />} />
              <Route path="/diaries" element={<DiariesPage />} />
              <Route path="/diaries/:diaryId" element={<DiaryDetailPage />} />
              <Route path="/route-planning" element={<RoutePage />} />
              <Route path="/travel-assistant" element={<PersonalTravelAssistantPage />} />
              <Route path="/facility-query" element={<Navigate to="/location-search" replace />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/diary-management" element={<DiaryManagementPage />} />
              <Route path="/food-search" element={<Navigate to="/location-search" replace />} />
              <Route path="/campus-navigation" element={<CampusNavigationPage />} />
              <Route path="/indoor-navigation" element={<Navigate to="/campus-navigation" replace />} />
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
