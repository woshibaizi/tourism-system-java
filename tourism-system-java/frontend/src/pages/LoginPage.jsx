import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { login } from '../services/api';

const { Title, Text } = Typography;

function LoginPage({ onLoginSuccess }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const clearErrors = () => {
    setSubmitError('');
    form.setFields([
      { name: 'username', errors: [] },
      { name: 'password', errors: [] },
    ]);
  };

  const showLoginError = (messageText = '登录失败，请稍后重试') => {
    const normalizedMessage = messageText || '登录失败，请稍后重试';

    if (normalizedMessage.includes('用户名或密码错误') || normalizedMessage.includes('密码错误')) {
      form.setFields([
        { name: 'password', errors: ['用户名或密码错误，请重新输入'] },
      ]);
      setSubmitError('用户名或密码错误，请检查后重新登录');
      return;
    }

    setSubmitError(normalizedMessage);
    message.error(normalizedMessage);
  };

  const handleSubmitClick = () => {
    form.submit();
  };

  const handleLogin = async (values) => {
    setLoading(true);
    clearErrors();

    try {
      const response = await login({
        username: values.username,
        password: values.password
      });

      if (response.success) {
        setSubmitError('');
        message.success('登录成功！');
        onLoginSuccess(response.data);
      } else {
        showLoginError(response.message || '登录失败');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || '网络错误，请稍后重试';
      showLoginError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'float 20s ease-in-out infinite',
        opacity: 0.3
      }} />
      
      <Card
        style={{ 
          width: 450, 
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: '40px' }}
      >
        {/* 标题区域 */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '40px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          margin: '-40px -40px 40px -40px',
          padding: '40px',
          color: 'white'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌟</div>
          <Title level={2} style={{ 
            margin: 0, 
            color: 'white',
            fontSize: '28px',
            fontWeight: 'bold',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            个性化旅游系统
          </Title>
          <Text style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            fontSize: 16,
            display: 'block',
            marginTop: 8
          }}>
            发现精彩旅程，记录美好时光
          </Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleLogin}
          onFinishFailed={() => {
            setSubmitError('请填写完整的用户名和密码');
          }}
          onValuesChange={() => {
            clearErrors();
          }}
          autoComplete="off"
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            label={<span style={{ fontWeight: 600, color: '#2c3e50' }}>用户名</span>}
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#667eea' }} />}
              placeholder="请输入用户名"
              style={{ 
                borderRadius: '12px',
                height: '48px',
                border: '2px solid #f0f0f0',
                fontSize: '16px'
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={{ fontWeight: 600, color: '#2c3e50' }}>密码</span>}
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#667eea' }} />}
              placeholder="请输入密码"
              style={{ 
                borderRadius: '12px',
                height: '48px',
                border: '2px solid #f0f0f0',
                fontSize: '16px'
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: '32px' }}>
            <Button
              type="primary"
              htmlType="submit"
              onClick={handleSubmitClick}
              loading={loading}
              block
              icon={<LoginOutlined />}
              style={{ 
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                fontSize: '18px',
                fontWeight: 'bold',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'all 0.3s ease'
              }}
            >
              立即登录
            </Button>
          </Form.Item>

          {submitError ? (
            <Form.Item style={{ marginTop: '-8px', marginBottom: '8px' }}>
              <Text style={{ color: '#ff4d4f' }}>{submitError}</Text>
            </Form.Item>
          ) : null}
        </Form>

        {/* 测试账号信息 */}
        <div style={{ 
          marginTop: '32px', 
          padding: '20px',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          borderRadius: '12px',
          border: '1px solid #e9ecef'
        }}>
          <Text style={{ 
            display: 'block',
            textAlign: 'center',
            fontWeight: 600,
            color: '#495057',
            marginBottom: '12px',
            fontSize: '14px'
          }}>
            🔑 测试账号
          </Text>
          <div style={{ textAlign: 'center', lineHeight: '1.8' }}>
            <Text style={{ color: '#6c757d', fontSize: '13px', display: 'block' }}>
              👤 用户名：<span style={{ fontWeight: 600, color: '#495057' }}>张三</span> | 密码：<span style={{ fontWeight: 600, color: '#495057' }}>123456</span>
            </Text>
            <Text style={{ color: '#6c757d', fontSize: '13px', display: 'block' }}>
              👤 用户名：<span style={{ fontWeight: 600, color: '#495057' }}>李四</span> | 密码：<span style={{ fontWeight: 600, color: '#495057' }}>123456</span>
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default LoginPage; 
