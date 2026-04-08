import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, message, Badge, Tooltip } from 'antd';
import {
  HomeOutlined,
  EnvironmentOutlined,
  BookOutlined,
  UserOutlined,
  BarChartOutlined,
  CarOutlined,
  SearchOutlined,
  VideoCameraOutlined,
  LogoutOutlined,
  FireOutlined,
  BuildOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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
import AIGCPage from './pages/AIGCPage';
import ConcurrencyTestPage from './pages/ConcurrencyTestPage';

const { Header, Content, Sider } = Layout;

function App() {
  const [collapsed, setCollapsed] = useState(false);
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

  // 菜单项配置
  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: '/places',
      icon: <EnvironmentOutlined />,
      label: '场所浏览',
    },
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
    {
      key: '/indoor-navigation',
      icon: <BuildOutlined />,
      label: '室内导航',
    },
    {
      key: '/aigc',
      icon: <VideoCameraOutlined />,
      label: 'AIGC',
    },
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

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    },
  ];

  function handleMenuClick({ key }) {
    navigate(key);
  }

  return (
    <Layout className="main-layout" style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        className="sidebar"
        width={280}
        style={{
          background: 'linear-gradient(180deg, #001529 0%, #002140 100%)',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Logo区域 */}
        <div style={{ 
          height: 80, 
          margin: '16px 16px 24px 16px', 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px',
          color: 'white',
          fontWeight: 'bold',
          fontSize: collapsed ? 20 : 18,
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 装饰性背景元素 */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '60px',
            height: '60px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            opacity: 0.6,
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-15px',
            left: '-15px',
            width: '40px',
            height: '40px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
          }} />
          
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: collapsed ? 24 : 28, marginBottom: collapsed ? 0 : 4 }}>
              🏞️
            </div>
            {!collapsed && (
              <div style={{ 
                fontSize: 14, 
                fontWeight: '600',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
              }}>
                旅游系统
              </div>
            )}
          </div>
        </div>
        
        {/* 菜单区域 */}
        <div style={{
          height: 'calc(100vh - 140px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: '20px',
        }}>
          <Menu
            theme="dark"
            selectedKeys={[location.pathname]}
            mode="inline"
            items={menuItems}
            onClick={handleMenuClick}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '15px',
            }}
            className="custom-menu"
          />
        </div>
      </Sider>
      
      <Layout style={{ marginLeft: collapsed ? 80 : 280, transition: 'margin-left 0.2s' }}>
        <Header 
          className="header-nav" 
          style={{ 
            padding: '0 32px', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            boxShadow: '0 2px 16px rgba(0, 0, 0, 0.08)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            height: 72,
            position: 'fixed',
            top: 0,
            right: 0,
            left: collapsed ? 80 : 280,
            zIndex: 999,
            transition: 'left 0.2s',
          }}
        >
          {/* 左侧区域 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* 折叠按钮 */}
            <Tooltip title={collapsed ? '展开菜单' : '收起菜单'}>
              <div
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                }}
              >
                {collapsed ? (
                  <MenuUnfoldOutlined style={{ color: 'white', fontSize: 16 }} />
                ) : (
                  <MenuFoldOutlined style={{ color: 'white', fontSize: 16 }} />
                )}
              </div>
            </Tooltip>

            {/* 标题 */}
            <div style={{ 
              color: '#2c3e50', 
              fontSize: 24, 
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              <span style={{ fontSize: 28 }}>🌟</span>
              个性化旅游系统
            </div>
          </div>
          
          {/* 右侧区域 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* 通知铃铛 */}
            <Tooltip title="通知">
              <Badge count={0} size="small">
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: 'rgba(102, 126, 234, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(102, 126, 234, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                >
                  <BellOutlined style={{ color: '#667eea', fontSize: 16 }} />
                </div>
              </Badge>
            </Tooltip>

            {/* 用户信息 */}
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
              trigger={['click']}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '16px',
                transition: 'all 0.3s ease',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                gap: 12,
                minWidth: 120,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Avatar 
                size={32} 
                icon={<UserOutlined />} 
                src={currentUser.avatar}
                style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: '2px solid white',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ 
                  color: '#2c3e50', 
                  fontWeight: 600,
                  fontSize: 14,
                  lineHeight: 1.2,
                }}>
                  {currentUser?.username || currentUser?.name}
                </span>
                <span style={{ 
                  color: '#7f8c8d', 
                  fontSize: 12,
                  lineHeight: 1.2,
                }}>
                  在线
                </span>
              </div>
            </div>
            </Dropdown>
          </div>
        </Header>
        
        <Content className="content-wrapper" style={{ 
          margin: 0,
          background: '#f5f5f5',
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
              <Route path="/aigc" element={<AIGCPage />} />
              <Route path="/concurrency-test" element={<ConcurrencyTestPage />} />
            </Routes>
          </div>
        </Content>
      </Layout>
      
      {/* 自定义样式 */}
      <style>{`
        .custom-menu .ant-menu-item {
          margin: 4px 12px !important;
          border-radius: 12px !important;
          height: 48px !important;
          line-height: 48px !important;
          transition: all 0.3s ease !important;
          border: none !important;
        }
        
        .custom-menu .ant-menu-item:hover {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%) !important;
          transform: translateX(4px) !important;
        }
        
        .custom-menu .ant-menu-item-selected {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
        }
        
        .custom-menu .ant-menu-item-selected:hover {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          transform: translateX(4px) !important;
        }
        
        .custom-menu .ant-menu-item-selected .ant-menu-item-icon {
          color: white !important;
        }
        
        .custom-menu .ant-menu-item .ant-menu-item-icon {
          font-size: 16px !important;
          margin-right: 12px !important;
        }
        
        .custom-menu .ant-menu-item span {
          font-weight: 500 !important;
        }
        
        /* 侧边栏滚动条样式 */
        .sidebar ::-webkit-scrollbar {
          width: 6px;
        }
        
        .sidebar ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        
        .sidebar ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        
        .sidebar ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
        
        /* 确保固定定位的侧边栏在所有浏览器中正常工作 */
        .ant-layout-sider-collapsed {
          width: 80px !important;
          min-width: 80px !important;
          max-width: 80px !important;
        }
        
        /* 内容区域滚动条样式 */
        .content-wrapper::-webkit-scrollbar {
          width: 8px;
        }
        
        .content-wrapper::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        
        .content-wrapper::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }
        
        .content-wrapper::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
        
        /* 防止内容溢出 */
        body {
          overflow-x: hidden;
        }
      `}</style>
    </Layout>
  );
}

export default App; 
