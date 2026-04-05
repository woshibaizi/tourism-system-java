import React from 'react';
import { Card, Button, Space, Typography, Alert } from 'antd';
import { ToolOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

function FeaturePlaceholderPage({ title, description }) {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 880, margin: '40px auto' }}>
      <Card
        style={{
          borderRadius: '20px',
          border: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              <ToolOutlined style={{ marginRight: 12, color: '#1677ff' }} />
              {title}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 16 }}>
              {description}
            </Paragraph>
          </div>

          <Alert
            type="info"
            showIcon
            message="当前前端页面已生成，但 Java 后端尚未提供对应接口或仍在迁移中。"
            description="我已经把会直接报错的入口改成了占位页，避免出现 404、跨端口失败或空白页。后续如果你要继续补这部分功能，可以按页面逐个把接口接回去。"
          />

          <Space>
            <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
              返回首页
            </Button>
            <Button onClick={() => navigate('/places')}>浏览已接通功能</Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
}

export default FeaturePlaceholderPage;
