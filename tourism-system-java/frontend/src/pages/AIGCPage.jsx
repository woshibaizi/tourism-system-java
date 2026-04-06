import React, { useState } from 'react';
import { 
  Card, 
  Upload, 
  Button, 
  Row, 
  Col, 
  message, 
  Progress, 
  Image, 
  Space,
  Typography,
  Alert,
  Spin,
  Modal
} from 'antd';
import { 
  InboxOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined,
  DownloadOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  RobotOutlined
} from '@ant-design/icons';

const { Dragger } = Upload;
const { Title, Text } = Typography;

function AIGCPage() {
  const [imageList, setImageList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 处理图片上传
  const handleUpload = async (file) => {
    // 检查文件类型
    if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
      message.error('只支持JPG格式的图片！');
      return false;
    }

    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        const newImage = {
          uid: Date.now() + Math.random(),
          name: file.name,
          status: 'done',
          url: `/api/${result.data.path}`,
          path: result.data.path,
          size: result.data.size
        };
        
        setImageList(prev => [...prev, newImage]);
        message.success('图片上传成功！');
      } else {
        message.error(result.message || '上传失败');
      }
    } catch (error) {
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
    
    return false;
  };

  // 删除图片
  const handleRemove = (uid) => {
    setImageList(prev => prev.filter(item => item.uid !== uid));
    message.success('图片已删除');
  };

  // 转换为视频
  const handleConvertToVideo = async () => {
    if (imageList.length === 0) {
      message.warning('请先上传图片！');
      return;
    }

    setConverting(true);
    setProgress(0);
    setVideoUrl(null);

    try {
      const imagePaths = imageList.map(img => img.path);
      
      const response = await fetch('/api/aigc/convert-to-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imagePaths: imagePaths,
          outputFormat: 'mp4',
          fps: 30,
          width: 848,
          height: 480
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setVideoUrl(`/api/${result.data.videoPath}`);
        setProgress(100);
        message.success('视频转换成功！');
      } else {
        message.error(result.message || '转换失败');
      }
    } catch (error) {
      message.error('转换失败，请重试');
    } finally {
      setConverting(false);
    }
  };

  // 下载视频
  const handleDownloadVideo = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `aigc_video_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
          <RobotOutlined style={{ marginRight: 12, fontSize: '32px' }} />
          AIGC 图片转视频
        </Title>
        <Text style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', marginTop: '8px', display: 'block' }}>
          上传多张JPG图片，自动转换为848×480分辨率的MP4视频
        </Text>
      </div>

      {/* 演示视频区域 */}
      <Card style={{
        borderRadius: '16px',
        border: 'none',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        background: 'white',
        overflow: 'hidden',
        marginBottom: '32px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%)',
          margin: '-24px -24px 24px -24px',
          padding: '20px 24px',
          color: 'white',
        }}>
          <Title level={4} style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
            🎬 编辑功能演示
          </Title>
        </div>
        <Row gutter={24}>
          <Col xs={24} lg={12}>
            <div style={{ textAlign: 'center' }}>
              <video
                controls
                style={{ 
                  width: '100%',
                  maxWidth: '400px',
                  height: 'auto',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6
                }}
                src="/api/uploads/videos/demo.mp4"
              >
                您的浏览器不支持视频播放
              </video>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">演示视频</Text>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <Alert
              message="重要说明"
              description={
                <div>
                  <p>鉴于项目目前尚未开源，且推理阶段对计算资源的需求极高（需配备 4 张 <strong>NVIDIA H100 Tensor Core GPU 运行 30 分钟</strong>），视音频编辑模块暂无法按计划如期发布。
                </p>
                <p>
                  本项目支持在原始视音频中实现内容的添加、替换与去除操作，并在编辑质量方面达到了行业领先水平。相关成果已提交至 NeurIPS 2025，目前处于审稿阶段。
                </p>
                </div>
              }
              type="warning"
              showIcon
            />
          </Col>
        </Row>
      </Card>

      {/* 编辑质量展示区域 */}
      <Card style={{
        borderRadius: '16px',
        border: 'none',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        background: 'white',
        overflow: 'hidden',
        marginBottom: '32px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
          margin: '-24px -24px 24px -24px',
          padding: '20px 24px',
          color: 'white',
        }}>
          <Title level={4} style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
            🏆 编辑质量展示 - 行业领先水平
          </Title>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 14 }}>
            以下图片展示了我们在视音频编辑质量方面达到的行业领先水平，包括音频处理、视频编辑和音视频同步等核心技术能力。
          </Text>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Image
                src="/api/uploads/images/audio_video.jpg"
                alt="音视频同步编辑质量"
                style={{ 
                  width: '100%',
                  maxWidth: '300px',
                  height: 'auto',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6
                }}
                preview={{
                  mask: <div style={{ color: 'white' }}>点击预览</div>
                }}
              />
              <div style={{ marginTop: 8 }}>
                <Text strong>音视频同步编辑</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  高精度音视频同步处理技术
                </Text>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Image
                src="/api/uploads/images/audio.jpg"
                alt="音频编辑质量"
                style={{ 
                  width: '100%',
                  maxWidth: '300px',
                  height: 'auto',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6
                }}
                preview={{
                  mask: <div style={{ color: 'white' }}>点击预览</div>
                }}
              />
              <div style={{ marginTop: 8 }}>
                <Text strong>音频处理技术</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  专业级音频编辑与优化
                </Text>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Image
                src="/api/uploads/images/video.jpg"
                alt="视频编辑质量"
                style={{ 
                  width: '100%',
                  maxWidth: '300px',
                  height: 'auto',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6
                }}
                preview={{
                  mask: <div style={{ color: 'white' }}>点击预览</div>
                }}
              />
              <div style={{ marginTop: 8 }}>
                <Text strong>视频编辑技术</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  高质量视频内容编辑处理
                </Text>
              </div>
            </div>
          </Col>
        </Row>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Alert
            message="技术成果"
            description="这些图片展示了我们在视音频编辑领域的技术突破，相关算法和模型已达到行业领先水平，能够实现高质量的内容添加、替换与去除操作。"
            type="success"
            showIcon
            style={{ textAlign: 'left' }}
          />
        </div>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              margin: '-24px -24px 24px -24px',
              padding: '20px 24px',
              color: '#2c3e50',
            }}>
              <Title level={4} style={{ margin: 0, color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                📤 图片上传
              </Title>
            </div>
            <Dragger
              multiple
              beforeUpload={handleUpload}
              showUploadList={false}
              accept=".jpg,.jpeg"
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽JPG图片到此区域上传</p>
              <p className="ant-upload-hint">支持单个或批量上传，只支持JPG格式</p>
            </Dragger>

            <Alert
              message="转换说明"
              description="由于资金不足我们将其进行了简化，图片将被调整为848×480分辨率，每张图片在视频中显示1秒（30帧），最终输出为MP4格式视频。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Space style={{ width: '100%', justifyContent: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleConvertToVideo}
                disabled={imageList.length === 0 || converting}
                loading={converting}
              >
                {converting ? '转换中...' : '开始转换'}
              </Button>
              
              {videoUrl && (
                <Button
                  type="default"
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadVideo}
                >
                  下载视频
                </Button>
              )}
            </Space>

            {converting && (
              <div style={{ marginTop: 16 }}>
                <Progress 
                  percent={progress} 
                  status={converting ? 'active' : 'success'}
                />
                <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>
                  正在处理图片并生成视频...
                </Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card style={{
            borderRadius: '16px',
            border: 'none',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            background: 'white',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
              margin: '-24px -24px 24px -24px',
              padding: '20px 24px',
              color: '#2c3e50',
            }}>
              <Title level={4} style={{ margin: 0, color: '#2c3e50', fontSize: '18px', fontWeight: 'bold' }}>
                🖼️ 图片预览 ({imageList.length} 张)
              </Title>
            </div>
            {imageList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <PictureOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>暂无图片，请先上传</div>
              </div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <Row gutter={[8, 8]}>
                  {imageList.map((image, index) => (
                    <Col xs={12} sm={8} md={6} key={image.uid}>
                      <div style={{ 
                        position: 'relative',
                        border: '1px solid #d9d9d9',
                        borderRadius: 6,
                        overflow: 'hidden'
                      }}>
                        <Image
                          src={image.url}
                          alt={image.name}
                          style={{ width: '100%', height: 80, objectFit: 'cover' }}
                          preview={false}
                        />
                        <div style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          background: 'rgba(0,0,0,0.5)',
                          borderRadius: 4,
                          padding: '2px 6px'
                        }}>
                          <Text style={{ color: 'white', fontSize: 12 }}>
                            {index + 1}
                          </Text>
                        </div>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          style={{
                            position: 'absolute',
                            bottom: 4,
                            right: 4,
                            background: 'rgba(255,255,255,0.9)'
                          }}
                          onClick={() => handleRemove(image.uid)}
                        />
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {videoUrl && (
        <Row style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card title="生成的视频">
              <div style={{ textAlign: 'center' }}>
                <video
                  controls
                  style={{ 
                    width: '424px',  // 固定宽度，保持848:480的比例
                    height: '240px', // 固定高度
                    border: '1px solid #d9d9d9',
                    borderRadius: 6
                  }}
                  src={videoUrl}
                >
                  您的浏览器不支持视频播放
                </video>
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">
                    视频尺寸: 848×480 | 帧率: 30fps | 时长: {imageList.length}秒
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
}

export default AIGCPage; 