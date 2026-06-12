# 高德地图 / 定位 / 导航接入测试清单

## 自动化测试范围

- `NavigationFacilityIntegrationTests`
  - 锁定 `/api/navigation/providers/amap/config` 在测试环境无 key 时返回禁用态
  - 锁定 `/api/navigation/shortest-path` 在高德 key 缺失时自动回退本地算法
  - 锁定 `/api/navigation/nearest-node` 可将经纬度映射到最近图节点
  - 锁定 legacy `/api/routes/single` 可消费 `startLat/startLng` 并完成“我的位置”回退
  - 锁定多目标与混合交通仍走本地算法
- `NavigationControllerContractTests`
  - 锁定 canonical 室内导航返回契约
  - 锁定 legacy 室内导航 snake_case 兼容契约
  - 锁定 `/api/routes/single` 在 `strategy=time` 且未显式传 `vehicle` 时回退到混合交通分支
  - 锁定显式 `vehicle` 时不走 mixed fallback
- `IndoorNavigationIntegrationTests`
  - 使用真实 `indoor_navigation.json` 验证 canonical 室内导航可运行
  - 验证 legacy 室内导航兼容接口仍可运行
  - 验证房间列表接口可提供前端初始化数据

## 当前未自动化覆盖的缺口

- 当前自动化主要覆盖“无高德 key / fallback 生效”场景。
- 由于本地测试环境没有真实高德 key，也不会出网命中高德服务，因此尚未覆盖：
  - 高德成功返回真实 polyline / steps 的契约
  - 前端地图脚本真实加载与控件渲染
  - 浏览器授权定位与拒绝定位分支

## 后续建议的 provider switch 自动化测试

在提供可控的高德 mock server 或集成测试 key 后，补以下测试：

1. `provider=gaode` 时调用高德实现并返回统一契约
2. 高德超时/5xx/空路径时回退到本地算法或 secondary provider
3. 回退发生时响应体包含可观测字段
   - 建议字段：`provider`, `fallbackTriggered`, `fallbackReason`
4. 不同 provider 的返回统一映射到前端固定字段
   - 导航：`path`, `segments`, `totalDistance`, `totalTime`
   - 室内：`navigationSteps`, `estimatedTimeMinutes`, `floorAnalysis`

## 前端手工验证 Checklist

1. 路线规划页只调用 `/api/navigation/*`，网络面板中不再出现 `/api/routes/*` 作为主路径。
2. 室内导航页初始化时成功请求：
   - `GET /api/navigation/indoor/building-info`
   - `GET /api/navigation/indoor/rooms`
3. 选择 `room_301` 或任一有效房间后，`POST /api/navigation/indoor` 返回 200 契约且页面渲染步骤列表。
4. 室内导航结果页正确读取 canonical 字段：
   - `navigationSteps`
   - `totalDistance`
   - `estimatedTimeMinutes`
   - `floorAnalysis`
5. 当后端返回业务失败时，页面展示错误提示，不保留上一次成功路径。
6. 路线规划接口若返回 404/405/501，页面不得伪造“规划成功”；应明确提示接口缺失。
7. 若后续接入高德定位：
   - 首次授权拒绝时页面提示清晰
   - 授权后能显示当前位置
   - provider 切换或回退时页面不会卡死，且错误提示可见
