# 一键生成游记 — 功能分析与优化方案

> 2026-06-02，基于 DiaryModal、DiaryAgent、prompts.py 源码审查

---

## 一、现状分析

### 1.1 当前架构流程

```
┌─────────────┐    POST /agent/diary/generate     ┌──────────────┐
│  DiaryModal │ ──────────────────────────────────→│  FastAPI      │
│  (React)    │ ←─── taskId ──────────────────────│  /diary/      │
│             │                                    │   generate   │
│  轮询轮询轮询  │ GET /agent/diary/status/{taskId}   │     │        │
│             │ ←─── progress/result ─────────────│     ↓        │
└─────────────┘                                    │ DiaryAgent   │
                                                   │  5阶段流水线  │
                                                   └──────────────┘
```

DiaryAgent 五阶段异步流水线：
1. **图片理解** (0-30%)：多模态 LLM 识别照片内容
2. **要素提取** (30-50%)：提取地点/活动/心情/亮点/美食
3. **正文撰写** (50-80%)：基于要素 + 风格生成日记正文
4. **润色定稿** (80-95%)：修正语句 + 添加话题标签
5. **持久化** (95-100%)：保存到 Java 后端数据库

### 1.2 现有风格支持

| 层级 | 支持的风格 | 说明 |
|------|-----------|------|
| 前端 `DiaryModal.jsx` | 小红书、朋友圈、游记 | 3 个选项，硬编码 `STYLES` 数组 |
| 后端 `diary_agent.py` | 小红书、随笔、攻略、回忆 | 4 种风格，在 `_generate_draft_content()` 的 `style_guide` 字典中 |
| 提示词 `prompts.py` | 小红书风、随笔风、攻略风 | 仅简单一句话描述 |

### 1.3 核心问题诊断

#### 问题一：前后端风格不一致（数据契约断裂）

前端传给后端 `style: '朋友圈'` 或 `style: '游记'`，但后端 `style_guide` 字典只有 `小红书/随笔/攻略/回忆` 四种 key。当传入 `朋友圈` 或 `游记` 时，会 fallback 到 `style_guide["小红书"]`，导致**用户选了朋友圈风格，生成的却是小红书风格文案**。

```python
# diary_agent.py L268-274
style_guide = {
    "小红书": "活泼口语化，多用 emoji，短句分段，每段 2-3 行，加上 #话题标签",
    "随笔": "文艺细腻，叙事性强，段落流畅，有画面感和情绪起伏",
    "攻略": "实用条理清晰，分点列出 tips，时间/路线/花费明确",
    "回忆": "温暖怀旧，像翻看旧相册一样娓娓道来，有具体数字和细节",
}
style_prompt = style_guide.get(style, style_guide["小红书"])  # 朋友圈/游记 → fallback 小红书
```

#### 问题二：风格定义过于简陋

每种风格仅一句话描述（平均 15-25 字），没有结构化的风格参数：

- 没有**语气控制**（正式/轻松/幽默/文艺/毒舌）
- 没有**篇幅控制**（短帖/中篇/长文）
- 没有**emoji 密度**控制
- 没有**段落结构**控制（短句分段 vs 长段落叙事）
- 没有**人称视角**（第一人称/第二人称/第三人称）

#### 问题三：用户无法自定义风格

- 6 种出游搭子人格（毒舌导游、文艺流浪猫、特种兵教官等）已经实现并运行良好，但这些**人格仅限于对话模式**，不能用于日记生成
- 用户不能输入类似"用王家卫电影的独白风格写游记"
- 不能保存自定义风格模板供下次复用

#### 问题四：生成结果不可控、不可微调

- 用户只能看最终结果，无法在中间阶段干预
- 不支持"重新生成"（在已有结果上换风格再生成）
- 不支持对生成结果进行局部编辑后重新润色

#### 问题五：缺少个性化上下文

- 没有利用用户历史行为数据（浏览记录、评分偏好）
- 没有利用用户画像（经常看什么类型的景点、偏好什么美食）
- 每次生成都是"从零开始"，没有记忆

---

## 二、优化方案

### 2.1 总体目标

从 **"3 个固定模板风格"** 升级为 **"可组合、可自定义、可记忆的风格系统"**。

### 2.2 风格系统重构

#### 2.2.1 风格参数模型

将风格从一个字符串升级为一个结构化对象 `StyleProfile`：

```
StyleProfile {
  // 基础模板（预设风格，可选）
  preset: "小红书" | "朋友圈" | "游记长文" | "攻略" | "随笔" | "文艺" | "幽默" | "自定义"

  // 语气控制
  tone: "活泼" | "文艺" | "幽默" | "毒舌" | "温暖" | "冷静" | "热血" | "随性"

  // 篇幅控制
  length: "short" | "medium" | "long"        // 短帖(100-200字) | 中篇(300-500字) | 长文(500-1000字)

  // 表达风格
  emojiDensity: "none" | "low" | "medium" | "high"   // emoji 使用频率
  paragraphStyle: "short" | "normal" | "flow"          // 短句分段 | 正常段落 | 流畅叙事
  person: "first" | "second" | "third"                 // 第一/二/三人称

  // 内容偏好
  focusOn: ["风景", "美食", "人文", "打卡", "攻略"]   // 内容侧重
  hashtagCount: 3 | 5 | 8                               // 话题标签数量

  // 高级自定义
  customPrompt: "用王家卫《重庆森林》的独白风格..."   // 自由文本描述（优先级最高）
}
```

#### 2.2.2 预设风格模板（替换旧的三选一）

```javascript
const STYLE_PRESETS = [
  {
    id: 'xiaohongshu',
    label: '小红书种草',
    icon: '📕',
    desc: '活泼种草风 · emoji多 · #话题标签',
    profile: {
      tone: '活泼', length: 'medium', emojiDensity: 'high',
      paragraphStyle: 'short', person: 'first', focusOn: ['打卡', '美食', '风景'], hashtagCount: 8,
    },
  },
  {
    id: 'pengyouquan',
    label: '朋友圈分享',
    icon: '💬',
    desc: '轻松日常 · 短小精炼 · 像和朋友聊天',
    profile: {
      tone: '随性', length: 'short', emojiDensity: 'medium',
      paragraphStyle: 'short', person: 'first', focusOn: ['打卡', '风景'], hashtagCount: 0,
    },
  },
  {
    id: 'youji',
    label: '游记长文',
    icon: '📝',
    desc: '深度记录 · 叙事细腻 · 有画面感',
    profile: {
      tone: '文艺', length: 'long', emojiDensity: 'low',
      paragraphStyle: 'flow', person: 'first', focusOn: ['风景', '人文', '美食'], hashtagCount: 3,
    },
  },
  {
    id: 'gonglve',
    label: '实用攻略',
    icon: '📋',
    desc: '条理清晰 · 时间路线花费 · tips列表',
    profile: {
      tone: '冷静', length: 'medium', emojiDensity: 'low',
      paragraphStyle: 'normal', person: 'second', focusOn: ['攻略', '美食', '打卡'], hashtagCount: 5,
    },
  },
  {
    id: 'wenyi',
    label: '文艺随笔',
    icon: '🎨',
    desc: '诗意细腻 · 情感丰富 · 像散文',
    profile: {
      tone: '文艺', length: 'long', emojiDensity: 'none',
      paragraphStyle: 'flow', person: 'first', focusOn: ['人文', '风景'], hashtagCount: 0,
    },
  },
  {
    id: 'humor',
    label: '搞笑吐槽',
    icon: '😂',
    desc: '幽默风趣 · 自嘲式分享 · 接地气',
    profile: {
      tone: '幽默', length: 'medium', emojiDensity: 'high',
      paragraphStyle: 'short', person: 'first', focusOn: ['美食', '打卡'], hashtagCount: 5,
    },
  },
  {
    id: 'custom',
    label: '自定义风格',
    icon: '✨',
    desc: '自由组合以上参数，或输入自然语言描述',
    profile: null,  // 展开高级选项面板
  },
];
```

#### 2.2.3 风格 Prompt 模板升级

将一句话风格描述替换为结构化 system prompt：

```python
def build_style_prompt(profile: dict) -> str:
    """根据 StyleProfile 构建结构化的风格提示词。"""
    if profile.get("customPrompt"):
        return f"按照以下风格要求撰写：{profile['customPrompt']}"

    tone_guide = {
        "活泼": "语气轻松活泼，像在跟好朋友兴奋地分享旅行见闻。多用感叹号和语气词。",
        "文艺": "语气文艺细腻，注重画面感和情绪描写，像一篇精致的散文。",
        "幽默": "语气幽默风趣，可以自嘲，可以夸张，让读者会心一笑。",
        "毒舌": "语气犀利直接，看不惯的就说，但吐槽背后是真诚的推荐。",
        "温暖": "语气温暖治愈，像午后阳光一样让人感到舒适和安心。",
        "冷静": "语气客观理性，像一位专业旅行编辑在整理实用信息。",
        "热血": "语气充满激情和能量，像一位冒险家在讲述自己的壮举。",
        "随性": "语气随意自然，不刻意修饰，就像随手发的一条朋友圈。",
    }

    length_guide = {
        "short": "篇幅控制在150字左右，精炼有力，适合快速阅读。",
        "medium": "篇幅控制在400字左右，有足够的细节但不冗长。",
        "long": "篇幅控制在800字左右，充分展开叙述，有起承转合。",
    }

    emoji_guide = {
        "none": "不使用任何emoji表情。",
        "low": "偶尔使用1-2个emoji点缀。",
        "medium": "适度使用emoji增强表达，每段1-2个。",
        "high": "大量使用emoji，几乎每句话都有表情点缀。",
    }

    person_guide = {
        "first": "以第一人称'我'的视角叙述，讲述自己的亲身经历和感受。",
        "second": "以第二人称'你'的视角叙述，像是在给读者做推荐和引导。",
        "third": "以第三人称视角客观描述，像是一篇旅行报道。",
    }

    focus_guide = {
        "风景": "重点描写自然/建筑景观的视觉体验和拍照角度。",
        "美食": "重点描写食物的味道、口感和用餐体验。",
        "人文": "重点描写当地文化、历史和人物故事。",
        "打卡": "重点标注打卡点和拍照机位，适合社交媒体分享。",
        "攻略": "重点提供实用信息：时间安排、路线建议、消费参考、避坑提示。",
    }

    # 组装
    parts = [
        "你是一位专业的旅行文案写手。",
        tone_guide.get(profile.get("tone", "活泼"), ""),
        length_guide.get(profile.get("length", "medium"), ""),
        emoji_guide.get(profile.get("emojiDensity", "medium"), ""),
        person_guide.get(profile.get("person", "first"), ""),
    ]

    focuses = profile.get("focusOn", ["风景", "美食"])
    parts.append("内容侧重：" + "、".join(focus_guide.get(f, f) for f in focuses))

    hashtag_count = profile.get("hashtagCount", 5)
    if hashtag_count > 0:
        parts.append(f"文末添加 {hashtag_count} 个 #话题标签。")
    else:
        parts.append("不需要添加话题标签。")

    paragraph_style = profile.get("paragraphStyle", "short")
    if paragraph_style == "short":
        parts.append("使用短句分段，每段不超过3行。")
    elif paragraph_style == "flow":
        parts.append("使用流畅的段落叙事，每段是一个完整的场景描述。")

    return "\n".join(parts)
```

### 2.3 自定义风格面板（前端 UI 改造）

#### 2.3.1 交互流程

```
┌─────────────────────────────────────────┐
│  ① 选择预设风格 (6 个卡片，横向滑动)      │
│     ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│     │📕   │ │💬   │ │📝   │ │📋   │    │
│     │小红书│ │朋友圈│ │游记  │ │攻略  │ ... │
│     └─────┘ └─────┘ └─────┘ └─────┘    │
│                                         │
│  ② 高级调参 (展开/收起)                   │
│     语气: [活泼 ██░░ 文艺 幽默 ...]      │
│     篇幅: [短帖 ○──●──○ 长文]            │
│     emoji:[无 ○─●─○ 多]                 │
│     侧重: [✓风景 ✓美食 ☐人文 ...]        │
│                                         │
│  ③ 自定义风格描述 (可选):                 │
│     ┌─────────────────────────────────┐  │
│     │ 用王家卫电影的独白风格写...       │  │
│     └─────────────────────────────────┘  │
│                                         │
│  ④ 风格预览 (可选):                      │
│     "你选择了「文艺 + 长篇 + 少emoji」   │
│      效果类似：散文式的深度旅行记录"      │
└─────────────────────────────────────────┘
```

#### 2.3.2 组件结构

```
DiaryModal
├── ImageUploader          ← 上传图片（拖拽 + 粘贴支持）
├── StyleSelector          ← 预设风格卡片（横向滚动）
├── StyleTuner             ← 高级调参面板（可折叠）
│   ├── TonePicker         ← 语气选择（chip/按钮组）
│   ├── LengthSlider       ← 篇幅滑块
│   ├── EmojiDensityPicker ← emoji 密度选择
│   ├── FocusCheckboxes    ← 内容侧重多选
│   └── PersonSelector     ← 人称视角选择
├── CustomPromptInput      ← 自由文本风格描述
├── PromptInput            ← 游记描述（保留现有）
└── GenerateButton         ← 开始生成 + 进度
```

### 2.4 复用出游搭子人格

出游搭子系统已经有 6 种个性鲜明的人格（毒舌导游、文艺流浪猫、特种兵教官、失意诗人、暗恋学妹、北京老大爷）+ 支持用户自定义搭子。可以直接复用：

```javascript
// 在风格预设中增加"使用出游搭子的人格"
{
  id: 'buddy',
  label: '用搭子风格',
  icon: '🎭',
  desc: '让当前选择的出游搭子帮你写游记',
  profile: { useBuddy: true }  // 后端从用户当前搭子获取 personality prompt
}
```

后端处理：如果 `useBuddy: true`，则将搭子的 personality prompt 注入到日记生成的 system prompt 中，日记的语气和行为方式与搭子保持一致。

### 2.5 增加"重新生成"和"换风格"能力

```
生成完成后的操作：
┌──────────────────────────────────────────┐
│  ✅ 生成完成                              │
│  ┌──────────────────────────────────┐    │
│  │ 今天去了西湖，天气真好呀...        │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [🔄 换种风格]  [✏️ 编辑调整]  [📋 复制] │
│  [📕 小红书] [💬 朋友圈] [📝 游记] ...   │
│                                          │
│  [🚀 一键发布]              [关闭]       │
└──────────────────────────────────────────┘
```

- **换种风格**：保持同样的素材（图片+描述），用不同的 StyleProfile 重新调用 LLM 生成（可跳过图片理解和要素提取阶段，直接从阶段 3 开始）
- **编辑调整**：允许用户手动修改生成结果，然后触发重新润色（阶段 4）

### 2.6 API 改动

#### 2.6.1 `/agent/diary/generate` — 请求体扩展

```json
{
  "user_id": "1",
  "prompt": "今天去了西湖...",
  "images": ["img1.jpg", "img2.jpg"],
  "style_profile": {
    "preset": "xiaohongshu",
    "tone": "活泼",
    "length": "medium",
    "emojiDensity": "high",
    "paragraphStyle": "short",
    "person": "first",
    "focusOn": ["风景", "美食"],
    "hashtagCount": 5,
    "useBuddy": false,
    "customPrompt": ""
  },
  "regenerate_from": null
}
```

- `style_profile`：结构化风格参数（向后兼容：仍支持 `"style": "小红书"` 简单形式）
- `regenerate_from`：传入已有的 `task_id`，跳过阶段 1-2，直接从阶段 3 重新生成

#### 2.6.2 `/agent/diary/regenerate` — 新增端点

```json
POST /agent/diary/regenerate
{
  "original_task_id": "diary_abc123",
  "style_profile": { ... },
  "edited_content": "用户手动修改后的文本（可选）"
}
```

用于"换种风格"或"编辑后重新润色"场景，复用已有的图片描述和要素提取结果。

### 2.7 用户风格记忆

将用户常用的风格偏好持久化：

- SQLite `user_style_prefs` 表：记录用户最近使用的 StyleProfile
- 下次打开日记生成时，默认选中上次使用的风格
- 高频组合自动提升为"我的常用风格"

---

## 三、实施计划

### 第一阶段：风格系统核心（2-3天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 1.1 统一前后端风格定义 | `prompts.py`, `DiaryModal.jsx` | 消除朋友圈/游记 fallback 到小红书的 bug |
| 1.2 实现 `StyleProfile` 模型 | `schemas.py` | Pydantic 模型，含校验 |
| 1.3 重构风格 prompt 构建器 | `diary_agent.py` | 用 `build_style_prompt()` 替换硬编码 |
| 1.4 扩展 API 接受 `style_profile` | `main.py` | 向后兼容旧 `style` 参数 |

### 第二阶段：前端交互升级（2-3天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 2.1 预设风格卡片组件 | `StyleSelector.jsx` | 6 种预设 + 搭子风格 |
| 2.2 高级调参面板 | `StyleTuner.jsx` | 语气/篇幅/emoji/侧重/人称 |
| 2.3 自定义风格输入 | `CustomPromptInput.jsx` | 自由文本描述 |
| 2.4 重构 DiaryModal | `DiaryModal.jsx` | 集成新组件 + 增加换风格/编辑功能 |
| 2.5 风格预览 | `StylePreview.jsx` | 根据当前参数显示效果摘要 |

### 第三阶段：体验增强（1-2天）

| 任务 | 文件 | 说明 |
|------|------|------|
| 3.1 复用搭子人格 | `diary_agent.py` | `useBuddy` 支持 |
| 3.2 换风格/重新生成 | `diary_agent.py`, `main.py` | `regenerate` 端点 |
| 3.3 用户风格记忆 | `sqlite_store.py` | 存储 + 回显上次使用的风格 |

---

## 四、对比总结

| 维度 | 当前 | 优化后 |
|------|------|--------|
| 可选风格数 | 3（且2个有 bug） | 6 个预设 + 自定义 + 搭子风格 |
| 风格定义 | 一句话描述（15字） | 结构化 8 维度参数 + 详细 prompt |
| 自定义能力 | 无 | 自由文本描述 + 8 参数自由组合 |
| 生成控制 | 只有"开始生成" | 生成 → 预览 → 换风格 → 编辑 → 再润色 |
| 与搭子系统联动 | 无 | 可直接用搭子人格写游记 |
| 用户记忆 | 无 | 记住常用风格，默认回显 |
| API 契约 | 前后端风格 key 不一致 | 统一 `StyleProfile` schema |
| 错误处理 | 静默 fallback 到小红书 | 明确告知不支持的风格并给出建议 |
