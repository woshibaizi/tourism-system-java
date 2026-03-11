# 🏞️ 自然语言指导的个性化旅游系统

我们**完全**基于大语言模型 Claude Sonnet 4 利用自然语言完成了北京邮电大学数据结构课程设计项目，开发了一套个性化旅游系统，融合多种算法，实现了个性化推荐、路径规划以及内容管理等核心功能。

⚠️ **温馨提示：请勿在验收前使用此代码。**
为维护 [学术诚信（Academic Honesty）](https://en.wikipedia.org/wiki/Academic_integrity)，请大家在验收完成前不要使用本代码。  
数据部分为方便大家满足课程设计要求，可以正常使用。  
感谢大家的理解与支持！


## ✨ 核心功能

- **🎯 智能推荐** - 基于协同过滤和内容推荐的个性化场所推荐
- **🗺️ 路径规划** - A* + TSP算法实现建筑物与设施间的单点/多点最优路径规划
- **📝 日记管理** - 支持多媒体内容的旅游日记创建、编辑、搜索
- **🏢 室内导航** - 建筑物内部路径规划和导航
- **🍽️ 美食搜索** - 基于地理位置和偏好的美食推荐
- **🎬 AIGC内容** - 图片转视频等AI生成内容功能
- **📊 数据分析** - 系统使用统计和性能分析
- **⚡ 并发测试** - 多线程性能测试和监控

## 🏗️ 技术架构

### 前端技术栈
- **React 18** + **Ant Design 4** - 现代化UI框架
- **React Router 6** - 单页应用路由
- **Recharts** - 数据可视化
- **Leaflet** - 地图组件
- **Axios** - HTTP客户端

### 后端技术栈
- **Flask 2.3** + **Flask-CORS** - 轻量级Web框架
- **NumPy** - 科学计算支持
- **Pillow** - 图像处理

### 核心算法
- **排序算法** - 快速排序、堆排序、Top-K排序
- **搜索算法** - 二分查找、模糊搜索、全文检索
- **路径算法** - A*、TSP
- **推荐算法** - 协同过滤、内容推荐、混合推荐
- **压缩算法** - Huffman无损压缩
- **导航算法** - 室内路径规划

## 📊 数据规模

- **场所数据**: 201个主要场所（景区+校园），7067行数据
- **建筑设施**: 63个建筑物，192个服务设施
- **路网数据**: 431条道路连接，支持多种交通方式
- **用户内容**: 10个用户档案，14篇旅游日记
- **美食数据**: 40家餐厅信息，多种菜系分类
- **室内导航**: 658行室内导航数据，支持楼层规划

## 🚀 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- npm 8+

### 一键启动
```bash
git clone https://github.com/RuiyangSi/tourism-system.git
cd tourism-system
chmod +x start.sh
./start.sh
```

### 手动启动

**后端服务**
```bash
cd backend
pip install -r requirements.txt
python app.py
```

**前端应用**
```bash
cd frontend
npm install
npm start
```

### 访问地址
- 前端应用: http://localhost:3000
- 后端API: http://localhost:5001

## 📱 功能模块

| 模块 | 功能描述 | 技术特色 |
|------|----------|----------|
| 🏠 **首页** | 系统概览、快速导航 | 响应式设计、数据统计 |
| 🏛️ **场所浏览** | 场所展示、搜索筛选 | 个性化推荐、评分系统 |
| 📖 **旅游日记** | 多媒体日记管理 | Huffman压缩、全文搜索 |
| ⚙️ **日记管理** | 管理员功能 | 批量操作、权限控制 |
| 🛣️ **路线规划** | 建筑物与设施间智能路径规划 | 多算法对比、可视化展示 |
| 🔍 **场所查询** | 附近设施查询 | 地理位置、距离计算 |
| 🍜 **美食搜索** | 餐厅推荐 | 菜系分类、评价排序 |
| 🏢 **室内导航** | 建筑内导航 | 楼层规划、最短路径 |
| 🎬 **AIGC** | AI内容生成 | 图片处理、视频合成 |
| 📈 **统计分析** | 数据可视化 | 实时统计、性能监控 |
| ⚡ **并发测试** | 性能测试 | 多线程、压力测试 |

## 🔧 API接口

### 核心接口
```
用户管理    GET/POST /api/users
场所管理    GET/POST /api/places
日记管理    GET/POST/PUT/DELETE /api/diaries
路径规划    POST /api/routes/{single|multi}
文件上传    POST /api/upload/{image|video}
推荐系统    POST /api/{places|diaries}/recommend
搜索功能    GET /api/{places|buildings|facilities}/search
统计分析    GET /api/stats
室内导航    GET/POST /api/indoor/{building|rooms|navigate}
美食搜索    GET /api/foods
```

## 📁 项目结构

```
tourism-system/
├── backend/                    # 后端服务
│   ├── algorithms/            # 核心算法模块
│   │   ├── sorting_algorithm.py           # 排序算法（快速排序、Top-K优化）
│   │   ├── search_algorithm.py            # 搜索算法（二分搜索、模糊搜索、TF-IDF）
│   │   ├── shortest_path_algorithm.py     # 路径算法（A*、TSP）
│   │   ├── recommendation_algorithm.py    # 推荐算法（协同过滤、内容推荐、混合推荐）
│   │   ├── huffman_compression.py         # Huffman压缩算法
│   │   └── indoor_navigation_algorithm.py # 室内导航算法
│   ├── data/                  # 数据文件
│   │   ├── places.json        # 场所数据（201个场所）
│   │   ├── buildings.json     # 建筑物数据（63个建筑）
│   │   ├── facilities.json    # 设施数据（192个设施）
│   │   ├── roads.json         # 道路网络数据（431条道路）
│   │   ├── users.json         # 用户数据（10个用户）
│   │   ├── diaries.json       # 日记数据（14篇日记）
│   │   ├── foods.json         # 美食数据（40家餐厅）
│   │   └── indoor_navigation.json # 室内导航数据
│   ├── uploads/               # 上传文件存储
│   │   ├── images/           # 图片文件
│   │   └── videos/           # 视频文件
│   ├── app.py                # Flask主应用（1898行）
│   └── requirements.txt      # Python依赖
├── frontend/                  # 前端应用
│   ├── src/
│   │   ├── pages/            # 页面组件
│   │   │   ├── HomePage.js           # 首页
│   │   │   ├── PlacesPage.js         # 场所浏览页
│   │   │   ├── PlaceDetailPage.js    # 场所详情页
│   │   │   ├── DiariesPage.js        # 日记浏览页
│   │   │   ├── DiaryDetailPage.js    # 日记详情页
│   │   │   ├── DiaryManagementPage.js # 日记管理页
│   │   │   ├── RoutePlanningPage.js  # 路径规划页
│   │   │   ├── FacilityQueryPage.js  # 设施查询页
│   │   │   ├── FoodSearchPage.js     # 美食搜索页
│   │   │   ├── IndoorNavigationPage.js # 室内导航页
│   │   │   ├── AIGCPage.js           # AIGC功能页
│   │   │   ├── StatsPage.js          # 统计分析页
│   │   │   └── ConcurrencyTestPage.js # 并发测试页
│   │   ├── services/         # API服务
│   │   │   └── api.js        # 统一API接口
│   │   ├── components/       # 公共组件
│   │   ├── App.js           # 主应用组件
│   │   ├── App.css          # 全局样式
│   │   └── index.js         # 应用入口
│   ├── public/               # 静态资源
│   ├── package.json          # Node.js依赖
│   └── build/               # 构建输出目录
├── docs/                      # 项目文档
│   ├── 推荐算法详细实现文档.md  # 核心技术文档
│   └── 辅助文档/             # 技术实现细节文档
├── start.sh                   # 一键启动脚本
├── LICENSE                   # 开源协议
├── .gitignore               # Git忽略文件
└── README.md                # 项目说明文档
```

## 🎯 技术亮点

- **算法集成**: 6大类核心算法，涵盖排序、搜索、推荐、压缩等
- **性能优化**: 多线程并发、数据压缩、缓存机制
- **用户体验**: 响应式设计、实时反馈、智能推荐
- **数据可视化**: 图表展示、地图集成、统计分析
- **扩展性**: 模块化设计、RESTful API、组件化开发

## 📄 开源协议

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目！

## 📧 联系作者

如有问题或建议，欢迎联系：
- 📮 邮箱：[limpid@bupt.edu.cn](mailto:limpid@bupt.edu.cn)


---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！ 