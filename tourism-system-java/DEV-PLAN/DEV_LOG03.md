# 个性化旅游系统 Java 重构 — 开发日志 03

---

## 📅 2026-04-06 第三次开发：前端 API 接口重构及联调适配

### 🎯 需求背景

在之前的开发中，我们完成了后端 Java Controller 层的重构与 API 的丰富。由于前端（React/Vite 项目）早期对接的是旧版 Python 后端，存在大量的旧端点调用以及硬编码的 `localhost:5001` 请求。
本次目标：
1. 重构 `frontend/src/services/api.js`，与新的 Java 后端 API 进行全面对接映射。
2. 消除前端各页面代码中直接对 `http://localhost:5001` 的 `axios` 或 `fetch` 硬拉取调用，收口到中央 API 管理体系或使用本地 Vite proxy。
3. 保证前端项目可以顺利打包运行，为后续全面的全栈联合调试打下基础。

---

### 📝 本次修改文件清单

#### API 服务层重构
| 文件 | 操作 | 改动要点 |
|---|---|---|
| `frontend/src/services/api.js` | 全面重写 | 1. 将对场所/日记的访问记录和评分等操作转换成对新后端 `/users/{id}/behavior` 接口的调用。<br/> 2. 增加了 `/places/hot` 和 `/places/top-rated` 以及 `foodAPI` 模块的接入。<br/> 3. 在不存在对应 API 时添加降级容错逻辑（前端手动排序截取），保证已有页面的稳定渲染。<br/> 4. 请求响应拦截器处理，支持新的数据信封（envelope）拆解。 |

#### 前端页面修复（移除 Python 服务硬编码 5001 端口）
| 文件 | 操作 | 改动要点 |
|---|---|---|
| `FoodSearchPage.jsx` | 修复 | 将原来前端页面里直连 `localhost:5001` 的数据初始化请求（如场所、菜系、具体美食抓取）替换为对 `api.js` 统一封装的 `foodAPI` 和 `getPlaces()` 方法调用。 |
| `DiaryManagementPage.jsx` | 修复 | 将原有直接发出的 `axios.get/put/delete('http://localhost:5001/api/...` 请求彻底去除，替换成了规范导入的 `getDiaries, getPlaces, getUsers, updateDiary, deleteDiary` API 操作，并且刷新逻辑统一为 `loadData` 函数执行。 |
| `ConcurrencyTestPage.jsx` | 修复 | 去除并发性能测试中手动添加的 `http://localhost:5001` 前缀，直接利用代理 `endpoint` 进行压力测试，便于统一指向 Java 服务器端口 (`8080`)。 |
| `IndoorNavigationPage.jsx` | 修复 | 将请求全部收口到 `api.js` 中的相对请求。将 `axios` 直接调用替成了通过统一 `api` 对象封装的调用，依赖 Vite 的 proxy，未来 Java 增加室内导航实现时可免改直连。 |
| `AIGCPage.jsx` | 修复 | 对应 AI 的直接上传与视频生成功能请求及 `<video>` 和 `<Image>` 的资源加载前缀均由 `http://localhost:5001` 变更为支持代理转换的 `/api/...`，以便使用内部反代处理。 |

---

### ✅ 验证结果

- `npx vite build` 两次执行，彻底通过编译构建。
- 前端项目中 `grep` 全局排查 `localhost:5001` 关键字，成功结果为 0。
- 旧有页面业务代码的调用与最新的统一 `services/api.js` 的接口定义结构完全对应且兼容良好。

---

### 🔮 下次开发计划

#### 全栈联调阶段（优先级：极高）

1. **前后端接口交互实测联调**
   - 现前端已对接至请求代理 `/api` (映射到 Java 8080 端口)。目标：在运行时（即 `npm run dev` 联合 `mvn spring-boot:run`）逐一验证各项业务模块的数据连通性。
   - 验证主流程边界：
     - 用户登录 / 注册 / 上下文获取。
     - 场所和日记的“热门/热榜”功能是否能在首页正确呈现。
     - `/users/{userId}/behavior` 等打分与查录行为能否正常被后端的切面/数据管理模块感知存储。

#### 后端衍生模块补齐（优先级：高）
   
2. **算法集成 - 路线规划 (`RoutePage`)**
   - 在前后端联调测试完成后，正式启动规划页面背后的逻辑支撑。提供 `calculateShortestRoute` (/routes/single) 和多目标 `calculateMultiDestinationRoute` (/routes/multi) 等核心基础地理最短路线算法服务（采用 Dijkstra 或 TSP 等方式），在后端实现基于地点/建筑坐标图的图算法返回结果。
   
3. **算法集成 - 室内外导航融合**
   - IndoorNavigationPage 提交的接口 `/api/indoor/building`, `/api/indoor/navigate` 等需求目前在 Java 中还未实现后端逻辑支持（目前会走404或5xx），下一步需要在 `tourism-system-java` 中添加 `IndoorNavigationService`，从而真正打通前端需求场景。

#### 后期优化与增强

4. **安全与资源处理**
   - 调试跨域设定(CORS)和 `JwtToken` 时延、权限管理与异常捕获。
   - 如果 AIGC 等功能依旧依赖于 Python 后端环境的调用模型计算，考虑由 Java 服务层增加 `RestTemplate` 去包装对 Python 图像处理节点的代理转发微服务调用。
