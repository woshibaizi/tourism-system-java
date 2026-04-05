import React, { useState, useRef } from 'react';
import { 
  Card, 
  Button, 
  Progress, 
  Table, 
  Statistic, 
  Row, 
  Col, 
  Alert, 
  Typography,
  Space,
  Tag,
  Divider,
  InputNumber,
  Select
} from 'antd';
import { 
  PlayCircleOutlined, 
  StopOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  LoadingOutlined,
  BarChartOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

function ConcurrencyTestPage() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({});
  const [progress, setProgress] = useState(0);
  const [testConfig, setTestConfig] = useState({
    requestCount: 20,
    maxConcurrency: 10,
    testType: 'basic'
  });
  
  const abortControllerRef = useRef(null);

  // 测试单个请求
  const testSingleRequest = async (endpoint, requestId, signal) => {
    const startTime = Date.now();
    const threadId = Math.random().toString(36).substr(2, 9); // 模拟线程ID
    
    try {
      const response = await fetch(`http://localhost:5001${endpoint}`, {
        signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        requestId,
        threadId,
        endpoint,
        statusCode: response.status,
        responseTime,
        success: response.ok,
        timestamp: new Date().toLocaleTimeString(),
        dataSize: response.headers.get('content-length') || 0
      };
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      return {
        requestId,
        threadId,
        endpoint,
        statusCode: 0,
        responseTime,
        success: false,
        error: error.message,
        timestamp: new Date().toLocaleTimeString(),
        dataSize: 0
      };
    }
  };

  // 执行并发测试
  const runConcurrencyTest = async () => {
    setTesting(true);
    setResults([]);
    setStats({});
    setProgress(0);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    const endpoints = [
      '/api/places',
      '/api/buildings',
      '/api/facilities',
      '/api/diaries',
      '/api/stats'
    ];
    
    const startTime = Date.now();
    const promises = [];
    
    try {
      // 创建并发请求
      for (let i = 0; i < testConfig.requestCount; i++) {
        const endpoint = endpoints[i % endpoints.length];
        const promise = testSingleRequest(endpoint, i + 1, signal);
        promises.push(promise);
        
        // 控制并发数量
        if (promises.length >= testConfig.maxConcurrency) {
          const batchResults = await Promise.allSettled(promises.splice(0, testConfig.maxConcurrency));
          const completedResults = batchResults
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
          
          setResults(prev => [...prev, ...completedResults]);
          setProgress((prev) => Math.min(prev + (testConfig.maxConcurrency / testConfig.requestCount) * 100, 100));
        }
      }
      
      // 处理剩余请求
      if (promises.length > 0) {
        const batchResults = await Promise.allSettled(promises);
        const completedResults = batchResults
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value);
        
        setResults(prev => [...prev, ...completedResults]);
      }
      
      setProgress(100);
      
      // 计算统计信息
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      setResults(currentResults => {
        const successfulRequests = currentResults.filter(r => r.success);
        const failedRequests = currentResults.filter(r => !r.success);
        const responseTimes = successfulRequests.map(r => r.responseTime);
        const uniqueThreads = new Set(successfulRequests.map(r => r.threadId));
        
        setStats({
          totalRequests: currentResults.length,
          successfulRequests: successfulRequests.length,
          failedRequests: failedRequests.length,
          successRate: (successfulRequests.length / currentResults.length * 100).toFixed(1),
          totalTime,
          avgResponseTime: responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2) : 0,
          minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
          maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
          threadsUsed: uniqueThreads.size,
          concurrentCapacity: (currentResults.length / (totalTime / 1000)).toFixed(2)
        });
        
        return currentResults;
      });
      
    } catch (error) {
      console.error('测试失败:', error);
    } finally {
      setTesting(false);
    }
  };

  // 停止测试
  const stopTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setTesting(false);
  };

  // 表格列定义
  const columns = [
    {
      title: '请求ID',
      dataIndex: 'requestId',
      key: 'requestId',
      width: 80,
      sorter: (a, b) => a.requestId - b.requestId
    },
    {
      title: '线程ID',
      dataIndex: 'threadId',
      key: 'threadId',
      width: 120,
      render: (threadId) => <Tag color="blue">{threadId}</Tag>
    },
    {
      title: '端点',
      dataIndex: 'endpoint',
      key: 'endpoint',
      width: 150
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 80,
      render: (success, record) => (
        success ? 
          <Tag color="green" icon={<CheckCircleOutlined />}>成功</Tag> :
          <Tag color="red" icon={<ExclamationCircleOutlined />}>失败</Tag>
      )
    },
    {
      title: '响应时间',
      dataIndex: 'responseTime',
      key: 'responseTime',
      width: 100,
      render: (time) => `${time}ms`,
      sorter: (a, b) => a.responseTime - b.responseTime
    },
    {
      title: '时间戳',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 120
    }
  ];

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
          <ThunderboltOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          并发测试中心
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          测试系统的多并发处理能力，验证多用户同时访问的性能表现
        </Text>
      </div>

      {/* 测试配置 */}
      <div style={{
        background: 'white',
        padding: 0,
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '32px',
        border: 'none',
        overflow: 'hidden',
      }}>
        {/* 测试配置标题栏 */}
        <div style={{
          background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
          padding: '20px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 装饰性背景元素 */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '80px',
            height: '80px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            opacity: 0.6,
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-15px',
            left: '-15px',
            width: '60px',
            height: '60px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Space size="middle" align="center">
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                padding: '10px',
                backdropFilter: 'blur(10px)',
              }}>
                <SettingOutlined style={{ color: '#faad14', fontSize: '20px' }} />
              </div>
              <div>
                <Title level={4} style={{ 
                  margin: 0, 
                  color: 'white', 
                  fontSize: '20px', 
                  fontWeight: 'bold',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  ⚙️ 测试配置
                </Title>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontSize: '13px',
                  display: 'block',
                  marginTop: '2px'
                }}>
                  配置并发测试参数
                </Text>
              </div>
            </Space>
          </div>
        </div>

        {/* 测试配置内容区域 */}
        <div style={{ padding: '24px' }}>
          <Row gutter={16} align="middle">
            <Col>
              <Text strong>请求数量：</Text>
              <InputNumber
                min={1}
                max={100}
                value={testConfig.requestCount}
                onChange={(value) => setTestConfig(prev => ({ ...prev, requestCount: value }))}
                disabled={testing}
                style={{ marginLeft: 8, marginRight: 16 }}
              />
            </Col>
            <Col>
              <Text strong>最大并发：</Text>
              <InputNumber
                min={1}
                max={20}
                value={testConfig.maxConcurrency}
                onChange={(value) => setTestConfig(prev => ({ ...prev, maxConcurrency: value }))}
                disabled={testing}
                style={{ marginLeft: 8, marginRight: 16 }}
              />
            </Col>
            <Col>
              <Text strong>测试类型：</Text>
              <Select
                value={testConfig.testType}
                onChange={(value) => setTestConfig(prev => ({ ...prev, testType: value }))}
                disabled={testing}
                style={{ marginLeft: 8, width: 120 }}
              >
                <Option value="basic">基础测试</Option>
                <Option value="stress">压力测试</Option>
              </Select>
            </Col>
            <Col>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={runConcurrencyTest}
                  loading={testing}
                  disabled={testing}
                >
                  开始测试
                </Button>
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={stopTest}
                  disabled={!testing}
                >
                  停止测试
                </Button>
              </Space>
            </Col>
          </Row>
        </div>
      </div>

      {/* 测试进度 */}
      {testing && (
        <div style={{
          background: 'white',
          padding: 0,
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          marginBottom: '32px',
          border: 'none',
          overflow: 'hidden',
        }}>
          {/* 测试进度标题栏 */}
          <div style={{
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
            padding: '20px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* 装饰性背景元素 */}
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              opacity: 0.6,
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-15px',
              left: '-15px',
              width: '60px',
              height: '60px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '50%',
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <Space size="middle" align="center">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '10px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <LoadingOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                </div>
                <div>
                  <Title level={4} style={{ 
                    margin: 0, 
                    color: 'white', 
                    fontSize: '20px', 
                    fontWeight: 'bold',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}>
                    ⚡ 测试进度
                  </Title>
                  <Text style={{ 
                    color: 'rgba(255, 255, 255, 0.9)', 
                    fontSize: '13px',
                    display: 'block',
                    marginTop: '2px'
                  }}>
                    实时监控测试执行状态
                  </Text>
                </div>
              </Space>
            </div>
          </div>

          {/* 测试进度内容区域 */}
          <div style={{ padding: '24px' }}>
            <Progress 
              percent={progress} 
              status={testing ? 'active' : 'success'}
              strokeColor={{
                '0%': '#667eea',
                '100%': '#764ba2',
              }}
              style={{ marginBottom: 16 }}
            />
            <Text type="secondary">正在执行并发测试，请稍候...</Text>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      {Object.keys(stats).length > 0 && (
        <div style={{
          background: 'white',
          padding: 0,
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          marginBottom: '32px',
          border: 'none',
          overflow: 'hidden',
        }}>
          {/* 统计信息标题栏 */}
          <div style={{
            background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            padding: '20px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* 装饰性背景元素 */}
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              opacity: 0.6,
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-15px',
              left: '-15px',
              width: '60px',
              height: '60px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '50%',
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <Space size="middle" align="center">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '10px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <BarChartOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                </div>
                <div>
                  <Title level={4} style={{ 
                    margin: 0, 
                    color: '#2c3e50', 
                    fontSize: '20px', 
                    fontWeight: 'bold',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}>
                    📊 测试统计
                  </Title>
                  <Text style={{ 
                    color: 'rgba(44, 62, 80, 0.8)', 
                    fontSize: '13px',
                    display: 'block',
                    marginTop: '2px'
                  }}>
                    详细的性能测试数据分析
                  </Text>
                </div>
              </Space>
            </div>
          </div>

          {/* 统计信息内容区域 */}
          <div style={{ padding: '24px' }}>
            <Row gutter={16}>
              <Col xs={12} sm={8} md={6}>
                <Statistic
                  title="总请求数"
                  value={stats.totalRequests}
                  prefix={<ThunderboltOutlined />}
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Statistic
                  title="成功率"
                  value={stats.successRate}
                  suffix="%"
                  valueStyle={{ color: stats.successRate >= 95 ? '#3f8600' : '#cf1322' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Statistic
                  title="平均响应时间"
                  value={stats.avgResponseTime}
                  suffix="ms"
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Statistic
                  title="使用线程数"
                  value={stats.threadsUsed}
                  valueStyle={{ color: stats.threadsUsed > 1 ? '#3f8600' : '#cf1322' }}
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Statistic
                  title="总耗时"
                  value={stats.totalTime}
                  suffix="ms"
                />
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Statistic
                  title="并发处理能力"
                  value={stats.concurrentCapacity}
                  suffix="请求/秒"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
            </Row>
          </div>
        </div>
      )}

      {/* 详细结果 */}
      {results.length > 0 && (
        <div style={{
          borderRadius: '16px',
          border: 'none',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          background: 'white',
          overflow: 'hidden',
          marginBottom: '32px',
        }}>
          {/* 详细结果标题栏 */}
          <div style={{
            background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
            padding: '20px 24px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* 装饰性背景元素 */}
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              opacity: 0.6,
            }} />
            <div style={{
              position: 'absolute',
              bottom: '-15px',
              left: '-15px',
              width: '60px',
              height: '60px',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '50%',
            }} />
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <Space size="middle" align="center">
                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '10px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <BarChartOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                </div>
                <div>
                  <Title level={4} style={{ 
                    margin: 0, 
                    color: '#2c3e50', 
                    fontSize: '20px', 
                    fontWeight: 'bold',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}>
                    📋 详细结果
                  </Title>
                  <Text style={{ 
                    color: 'rgba(44, 62, 80, 0.8)', 
                    fontSize: '13px',
                    display: 'block',
                    marginTop: '2px'
                  }}>
                    每个请求的详细执行信息
                  </Text>
                </div>
              </Space>
            </div>
          </div>

          {/* 详细结果内容区域 */}
          <div style={{ padding: '24px' }}>
            <Table
              columns={columns}
              dataSource={results}
              rowKey="id"
              size="small"
              scroll={{ x: 800 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
              }}
              style={{
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            />
          </div>
        </div>
      )}

      {/* 并发说明 */}
      <Alert
        message="什么是多并发？"
        description={
          <div>
            <p><strong>并发处理</strong>：系统能够同时处理多个用户请求，而不是让用户排队等待。</p>
            <p><strong>判断标准</strong>：</p>
            <ul>
              <li>✅ <strong>支持并发</strong>：看到多个不同的线程ID，请求同时处理</li>
              <li>❌ <strong>不支持并发</strong>：只有一个线程ID，请求串行处理</li>
              <li>📊 <strong>性能指标</strong>：成功率 ≥ 95%，响应时间 ≤ 100ms</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        style={{
          borderRadius: '12px',
          border: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      />
    </div>
  );
}

export default ConcurrencyTestPage; 