import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Card, Tag, Spin, message, Button, Switch, Slider, Tooltip } from 'antd';
import { CarOutlined, ClockCircleOutlined, LineOutlined, NodeIndexOutlined, PlayCircleOutlined, PauseCircleOutlined, RedoOutlined, SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';

// 修复 Leaflet 默认图标问题
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// 自定义图标
const createCustomIcon = (color, type, label, animated = false) => {
  const size = type === 'start' || type === 'end' ? 30 : 20;
  const fontSize = type === 'start' || type === 'end' ? '14px' : '10px';
  
  const animationStyle = animated ? 'animation: pulse 1s ease-in-out;' : '';
  const pulseKeyframes = `
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
      50% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
    }
  `;
  
  const iconHtml = type === 'start' 
    ? `<style>${pulseKeyframes}</style><div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: ${fontSize}; box-shadow: 0 2px 6px rgba(0,0,0,0.3); ${animationStyle}">S</div>`
    : type === 'end'
    ? `<style>${pulseKeyframes}</style><div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: ${fontSize}; box-shadow: 0 2px 6px rgba(0,0,0,0.3); ${animationStyle}">E</div>`
    : type === 'waypoint'
    ? `<style>${pulseKeyframes}</style><div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: ${fontSize}; box-shadow: 0 1px 3px rgba(0,0,0,0.3); ${animationStyle}">${label || ''}</div>`
    : `<style>${pulseKeyframes}</style><div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); ${animationStyle}"></div>`;
  
  return L.divIcon({
    html: iconHtml,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
  });
};

// 动画路径线组件
const AnimatedPolyline = ({ positions, color, weight, opacity, delay, duration, onComplete, visible }) => {
  const [animatedPositions, setAnimatedPositions] = useState([]);
  const animationRef = useRef();
  const startTimeRef = useRef();

  useEffect(() => {
    if (!visible || positions.length < 2) {
      setAnimatedPositions([]);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    startTimeRef.current = Date.now() + delay;
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      
      if (elapsed < 0) {
        // 还没到开始时间
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      const progress = Math.min(elapsed / duration, 1);
      if (progress < 1) {
        // 根据进度计算当前应该显示的路径段
        const totalLength = positions.length - 1;
        const currentLength = progress * totalLength;
        const segmentIndex = Math.floor(currentLength);
        const segmentProgress = currentLength - segmentIndex;
        
        let currentPositions = [];
        
        // 添加完整的线段
        for (let i = 0; i <= segmentIndex && i < positions.length; i++) {
          currentPositions.push(positions[i]);
        }
        
        // 添加部分线段
        if (segmentIndex + 1 < positions.length && segmentProgress > 0) {
          const start = positions[segmentIndex];
          const end = positions[segmentIndex + 1];
          const interpolated = [
            start[0] + (end[0] - start[0]) * segmentProgress,
            start[1] + (end[1] - start[1]) * segmentProgress
          ];
          currentPositions.push(interpolated);
        }
        
        setAnimatedPositions(currentPositions);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // 动画完成
        setAnimatedPositions(positions);
        if (onComplete) {
          onComplete();
        }
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [positions, delay, duration, onComplete, visible]);

  if (animatedPositions.length < 2) {
    return null;
  }

  return (
    <Polyline
      positions={animatedPositions}
      color={color}
      weight={weight}
      opacity={opacity}
    />
  );
};

// 地图视图自动调整组件
const MapViewUpdater = ({ routeCoordinates, buildings, facilities }) => {
  const map = useMap();
  
  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      // 计算路径边界
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [30, 30] });
    } else if (buildings.length > 0 || facilities.length > 0) {
      // 如果没有路径，显示所有建筑物和设施
      const allLocations = [...buildings, ...facilities];
      const coordinates = allLocations
        .filter(item => item?.lat != null && item?.lng != null)
        .map(item => [Number(item.lat), Number(item.lng)]);
      
      if (coordinates.length > 0) {
        const bounds = L.latLngBounds(coordinates);
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }
  }, [map, routeCoordinates, buildings, facilities]);
  
  return null;
};

const RouteMap = ({ 
  routeResult, 
  buildings = [], 
  facilities = [], 
  onSegmentClick 
}) => {
  const [loading, setLoading] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [pathNodes, setPathNodes] = useState([]);
  const [pathEdges, setPathEdges] = useState([]);
  
  // 动画控制状态
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1000); // 每段动画时长（毫秒）
  const [visibleNodes, setVisibleNodes] = useState(new Set());
  const [visibleEdges, setVisibleEdges] = useState(new Set());
  const [currentAnimationStep, setCurrentAnimationStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true); // 自动播放开关
  const animationTimeoutRef = useRef(); // 用于控制动画定时器

  // 获取节点坐标的函数
  const getNodeCoordinates = useCallback((nodeId) => {
    const routeCoordinate = routeResult?.nodeCoordinates?.[nodeId];
    if (Array.isArray(routeCoordinate) && routeCoordinate.length === 2) {
      return [Number(routeCoordinate[0]), Number(routeCoordinate[1])];
    }

    // 先在建筑物中查找
    const building = buildings.find(b => b.id === nodeId);
    if (building?.lat != null && building?.lng != null) {
      return [Number(building.lat), Number(building.lng)];
    }
    
    // 再在设施中查找
    const facility = facilities.find(f => f.id === nodeId);
    if (facility?.lat != null && facility?.lng != null) {
      return [Number(facility.lat), Number(facility.lng)];
    }
    
    return null;
  }, [buildings, facilities, routeResult]);

  // 获取节点信息的函数
  const getNodeInfo = useCallback((nodeId) => {
    const building = buildings.find(b => b.id === nodeId);
    if (building) {
      return {
        name: building.name || nodeId,
        type: building.type || '建筑物',
        id: nodeId
      };
    }
    
    const facility = facilities.find(f => f.id === nodeId);
    if (facility) {
      return {
        name: facility.name || nodeId,
        type: facility.type || '设施',
        id: nodeId
      };
    }
    
    // 如果是路口节点
    if (nodeId.includes('intersection')) {
      return {
        name: nodeId.replace('intersection_', '路口 '),
        type: '路口',
        id: nodeId
      };
    }
    
    return {
      name: nodeId,
      type: '未知',
      id: nodeId
    };
  }, [buildings, facilities]);

  // 获取节点类型颜色
  const getNodeColor = (nodeInfo, index, totalNodes) => {
    if (index === 0) return '#52c41a'; // 起点：绿色
    if (index === totalNodes - 1) return '#f5222d'; // 终点：红色
    
    switch (nodeInfo.type) {
      case '建筑物': return '#1890ff'; // 蓝色
      case '设施': return '#fa8c16'; // 橙色
      case '路口': return '#722ed1'; // 紫色
      default: return '#666666'; // 灰色
    }
  };

  // 启动路径动画
  const startAnimation = useCallback(() => {
    if (pathNodes.length === 0) return;
    
    setIsAnimating(true);
    setVisibleNodes(new Set([0])); // 显示起点
    setVisibleEdges(new Set());
    setCurrentAnimationStep(0);
    
    // 清除之前的定时器
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    
    // 简化的动画逻辑：依次显示边和节点
    let currentStep = 0;
    
    const showNextStep = () => {
      if (currentStep < pathEdges.length) {
        // 显示当前边
        setVisibleEdges(prev => {
          const newSet = new Set(prev);
          newSet.add(currentStep);
          return newSet;
        });
        
        // 等待边动画完成后显示下一个节点
        animationTimeoutRef.current = setTimeout(() => {
          setVisibleNodes(prev => {
            const newSet = new Set(prev);
            newSet.add(currentStep + 1);
            return newSet;
          });
          
          setCurrentAnimationStep(currentStep + 1);
          currentStep++;
          
          // 继续下一步
          if (currentStep < pathEdges.length) {
            animationTimeoutRef.current = setTimeout(showNextStep, 200);
          } else {
            // 动画完成
            setTimeout(() => {
              setIsAnimating(false);
            }, 500);
          }
        }, animationSpeed);
      }
    };
    
    // 开始第一步
    setTimeout(showNextStep, 500);
    
  }, [pathNodes.length, pathEdges.length, animationSpeed]); // 移除pathNodes和pathEdges的依赖

  // 停止动画
  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  // 重置动画
  const resetAnimation = useCallback(() => {
    stopAnimation();
    if (animationEnabled) {
      setVisibleNodes(new Set());
      setVisibleEdges(new Set());
      setCurrentAnimationStep(0);
    } else {
      // 如果动画被禁用，显示所有元素
      setVisibleNodes(new Set(pathNodes.map((_, index) => index)));
      setVisibleEdges(new Set(pathEdges.map((_, index) => index)));
    }
  }, [animationEnabled, pathNodes.length, pathEdges.length, stopAnimation]); // 使用length而不是整个数组

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // 处理路径数据
  useEffect(() => {
    if (!routeResult || !routeResult.path || routeResult.path.length === 0) {
      setRouteCoordinates([]);
      setPathNodes([]);
      setPathEdges([]);
      setVisibleNodes(new Set());
      setVisibleEdges(new Set());
      return;
    }

    setLoading(true);
    try {
      const path = routeResult.path;
      const coordinates = [];
      const nodes = [];
      const edges = [];
      
      // 处理所有路径节点
      for (let i = 0; i < path.length; i++) {
        const nodeId = path[i];
        const coord = getNodeCoordinates(nodeId);
        const nodeInfo = getNodeInfo(nodeId);
        
        if (coord) {
          coordinates.push(coord);
          
          // 创建节点信息
          const nodeData = {
            id: nodeId,
            coordinates: coord,
            info: nodeInfo,
            index: i,
            isStart: i === 0,
            isEnd: i === path.length - 1,
            color: getNodeColor(nodeInfo, i, path.length)
          };
          
          nodes.push(nodeData);
          
          // 创建边信息（从第二个节点开始）
          if (i > 0) {
            const fromNode = nodes[i - 1];
            const toNode = nodeData;
            
            // 从详细信息中获取边的信息
            let edgeInfo = {
              from: fromNode.info.name,
              to: toNode.info.name,
              fromId: fromNode.id,
              toId: toNode.id,
              fromCoord: fromNode.coordinates,
              toCoord: toNode.coordinates,
              coordinates: [fromNode.coordinates, toNode.coordinates],
              vehicle: routeResult.vehicle || '不限',
              distance: 0,
              time: 0,
              index: i - 1
            };
            
            // 如果有详细的段信息，使用它
            if (routeResult.detailed_info && routeResult.detailed_info.segments) {
              const detailedSegment = routeResult.detailed_info.segments[i - 1];
              if (detailedSegment) {
                edgeInfo.vehicle = detailedSegment.vehicle || edgeInfo.vehicle;
                edgeInfo.distance = detailedSegment.distance || 0;
                edgeInfo.time = detailedSegment.time || 0;
              }
            }
            
            edges.push(edgeInfo);
          }
        } else {
          console.warn(`无法找到节点 ${nodeId} 的坐标`);
        }
      }
      
      setRouteCoordinates(coordinates);
      setPathNodes(nodes);
      setPathEdges(edges);
      
      // 重置动画状态
      if (animationEnabled) {
        setVisibleNodes(new Set());
        setVisibleEdges(new Set());
        setCurrentAnimationStep(0);
        
        // 如果启用了动画且有路径数据，自动播放动画
        if (autoPlay && nodes.length > 0) {
          // 稍等一下再开始动画，让地图有时间调整视图
          setTimeout(() => {
            startAnimation();
          }, 1000);
        }
      } else {
        // 静态模式：显示所有元素
        setVisibleNodes(new Set(nodes.map((_, index) => index)));
        setVisibleEdges(new Set(edges.map((_, index) => index)));
      }
      
    } catch (error) {
      console.error('处理路径数据失败:', error);
      message.error('路径数据处理失败');
    } finally {
      setLoading(false);
    }
  }, [routeResult, getNodeCoordinates, getNodeInfo, animationEnabled, autoPlay]); // 简化依赖

  // 当动画设置改变时重置状态
  useEffect(() => {
    resetAnimation();
  }, [animationEnabled, resetAnimation]);

  // 获取路径颜色（根据交通工具）
  const getPathColor = (vehicle) => {
    const colorMap = {
      '步行': '#52c41a',
      '自行车': '#1890ff',
      '电瓶车': '#fa8c16',
      '混合': '#722ed1',
      '不限': '#13c2c2'
    };
    return colorMap[vehicle] || '#666666';
  };

  // 处理路径段点击
  const handleSegmentClick = (edge) => {
    if (onSegmentClick) {
      onSegmentClick(edge);
    }
  };

  // 默认地图中心（北京邮电大学）
  const defaultCenter = [39.9607, 116.3518];
  const defaultZoom = 16;

  return (
    <Card title={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>路径地图</span>
        {pathNodes.length > 0 && (
          <div style={{ fontSize: '12px', fontWeight: 'normal' }}>
            <Tag color="blue" icon={<NodeIndexOutlined />}>
              {pathNodes.length} 个节点
            </Tag>
            <Tag color="green" icon={<LineOutlined />}>
              {pathEdges.length} 条边
            </Tag>
            {isAnimating && (
              <Tag color="orange">
                动画进行中... ({currentAnimationStep}/{pathNodes.length})
              </Tag>
            )}
          </div>
        )}
      </div>
    } style={{ height: '650px' }}>
      <Spin spinning={loading} tip="正在处理路径数据...">
        {/* 动画控制面板 */}
        {pathNodes.length > 0 && (
          <div className="animation-control-panel" style={{ 
            marginBottom: 16, 
            padding: 12, 
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SettingOutlined style={{ color: '#1890ff' }} />
              <span style={{ fontWeight: 'bold' }}>动画控制:</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>启用动画:</span>
              <Switch 
                checked={animationEnabled}
                onChange={setAnimationEnabled}
                size="small"
              />
            </div>
            
            {animationEnabled && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>自动播放:</span>
                  <Tooltip title="路径规划完成后自动开始动画">
                    <Switch 
                      checked={autoPlay}
                      onChange={setAutoPlay}
                      size="small"
                    />
                  </Tooltip>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>动画速度:</span>
                  <Slider
                    min={200}
                    max={2000}
                    step={100}
                    value={animationSpeed}
                    onChange={setAnimationSpeed}
                    style={{ width: 100 }}
                    tooltip={{ formatter: (value) => `${value}ms` }}
                  />
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    {animationSpeed < 500 ? '快' : animationSpeed < 1000 ? '中' : '慢'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  {!isAnimating ? (
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={startAnimation}
                      size="small"
                    >
                      播放动画
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      danger
                      icon={<PauseCircleOutlined />}
                      onClick={stopAnimation}
                      size="small"
                    >
                      停止动画
                    </Button>
                  )}
                  
                  <Button
                    icon={<RedoOutlined />}
                    onClick={resetAnimation}
                    size="small"
                    disabled={isAnimating}
                  >
                    重置
                  </Button>
                </div>
              </>
            )}
            
            {animationEnabled && !isAnimating && pathNodes.length > 0 && (
              <div style={{ 
                fontSize: '12px', 
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}>
                <ThunderboltOutlined style={{ color: '#fa8c16' }} />
                <span>点击"播放动画"观看路径连接过程</span>
              </div>
            )}
            
            {isAnimating && (
              <div style={{ 
                fontSize: '12px', 
                color: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontWeight: 'bold'
              }}>
                <NodeIndexOutlined style={{ animation: 'pulse 1s infinite' }} />
                <span>正在连接第 {currentAnimationStep + 1} 个节点...</span>
              </div>
            )}
          </div>
        )}
        
        <div style={{ height: '520px', width: '100%' }}>
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* 自动调整视图 */}
            <MapViewUpdater 
              routeCoordinates={routeCoordinates}
              buildings={buildings}
              facilities={facilities}
            />
            
            {/* 路径边 */}
            {pathEdges.map((edge, index) => {
              const isVisible = !animationEnabled || visibleEdges.has(index);
              
              if (!isVisible) {
                return null;
              }
              
              if (animationEnabled) {
                // 使用动画路径线
                return (
                  <AnimatedPolyline
                    key={`animated-edge-${index}`}
                    positions={edge.coordinates}
                    color={getPathColor(edge.vehicle)}
                    weight={5}
                    opacity={0.8}
                    delay={0}
                    duration={animationSpeed * 0.6} // 缩短动画时间
                    visible={true}
                  />
                );
              } else {
                // 静态路径线
                return (
                  <Polyline
                    key={`static-edge-${index}`}
                    positions={edge.coordinates}
                    color={getPathColor(edge.vehicle)}
                    weight={5}
                    opacity={0.8}
                    eventHandlers={{
                      click: () => handleSegmentClick(edge)
                    }}
                  >
                    <Popup>
                      <div>
                        <h4>路径段 {edge.index + 1}</h4>
                        <p><strong>从:</strong> {edge.from}</p>
                        <p><strong>到:</strong> {edge.to}</p>
                        <p><strong>交通工具:</strong> 
                          <Tag color={getPathColor(edge.vehicle)} style={{ marginLeft: 8 }}>
                            <CarOutlined /> {edge.vehicle}
                          </Tag>
                        </p>
                        {edge.distance > 0 && (
                          <p><strong>距离:</strong> 
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              <LineOutlined /> {edge.distance}米
                            </Tag>
                          </p>
                        )}
                        {edge.time > 0 && (
                          <p><strong>时间:</strong> 
                            <Tag color="orange" style={{ marginLeft: 8 }}>
                              <ClockCircleOutlined /> {edge.time.toFixed(1)}分钟
                            </Tag>
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Polyline>
                );
              }
            })}
            
            {/* 路径节点 */}
            {pathNodes.map((node, index) => {
              const isVisible = !animationEnabled || visibleNodes.has(index);
              const isCurrentlyAnimating = animationEnabled && isAnimating && currentAnimationStep === index;
              
              if (!isVisible) return null;
              
              return (
                <Marker
                  key={`node-${index}`}
                  position={node.coordinates}
                  icon={createCustomIcon(
                    node.color,
                    node.isStart ? 'start' : node.isEnd ? 'end' : 'waypoint',
                    node.isStart || node.isEnd ? null : (index + 1).toString(),
                    isCurrentlyAnimating
                  )}
                  zIndexOffset={node.isStart || node.isEnd ? 1000 : 100}
                >
                  <Popup>
                    <div>
                      <h4>
                        {node.isStart && <Tag color="green">起点</Tag>}
                        {node.isEnd && <Tag color="red">终点</Tag>}
                        {!node.isStart && !node.isEnd && <Tag color="blue">节点 {index + 1}</Tag>}
                      </h4>
                      <p><strong>名称:</strong> {node.info.name}</p>
                      <p><strong>类型:</strong> 
                        <Tag color={
                          node.info.type === '建筑物' ? 'blue' :
                          node.info.type === '设施' ? 'orange' :
                          node.info.type === '路口' ? 'purple' : 'default'
                        }>
                          {node.info.type}
                        </Tag>
                      </p>
                      <p><strong>ID:</strong> <code>{node.info.id}</code></p>
                      <p><strong>坐标:</strong> {node.coordinates.join(', ')}</p>
                      {!node.isStart && !node.isEnd && (
                        <p><strong>路径顺序:</strong> 第 {index + 1} 个节点</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
        
        {/* 图例 */}
        {pathNodes.length > 0 && (
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            backgroundColor: '#f5f5f5', 
            borderRadius: 6,
            fontSize: '12px'
          }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>图例说明:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ 
                  width: 16, height: 16, borderRadius: '50%', 
                  backgroundColor: '#52c41a', border: '2px solid white' 
                }}></div>
                <span>起点</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ 
                  width: 16, height: 16, borderRadius: '50%', 
                  backgroundColor: '#f5222d', border: '2px solid white' 
                }}></div>
                <span>终点</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ 
                  width: 16, height: 16, borderRadius: '50%', 
                  backgroundColor: '#1890ff', border: '2px solid white' 
                }}></div>
                <span>建筑物</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ 
                  width: 16, height: 16, borderRadius: '50%', 
                  backgroundColor: '#fa8c16', border: '2px solid white' 
                }}></div>
                <span>设施</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ 
                  width: 16, height: 16, borderRadius: '50%', 
                  backgroundColor: '#722ed1', border: '2px solid white' 
                }}></div>
                <span>路口</span>
              </div>
            </div>
            <div style={{ marginTop: 8, color: '#666' }}>
              💡 {animationEnabled ? '使用动画控制面板播放路径动画' : '点击节点查看详细信息，点击路径线查看路段信息'}
            </div>
          </div>
        )}
      </Spin>
    </Card>
  );
};

export default RouteMap; 
