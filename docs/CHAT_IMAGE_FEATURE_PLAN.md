# AI 助手聊天对话框图片功能优化方案

> **版本**: v1.0  
> **日期**: 2026-06-04  
> **目标**: 在 AI 助手聊天对话框中加入图片发送、展示和 AI 图片理解能力

---

## 1. 现状诊断

### 1.1 当前聊天链路

```
用户输入文字
     │
     ▼
ChatInput (纯文本 textarea)
     │
     ▼
PersonalTravelAssistantPage.handleSend(text)
     │
     ▼
chatWithAgentStream({ userId, message, sessionId, metadata })
     │  metadata: { buddy_id }  ← 仅此而已
     ▼
POST /agent/chat/stream
     │  ChatRequest: { userId, message, sessionId, mode, metadata }
     │  ❌ 无 images 字段
     ▼
Dispatcher.process_chat_stream()
     │  context.metadata = { intent, intent_slots, ... }
     │  ❌ 无图片数据
     ▼
ChatAgent / RouteAgent / DiaryAgent
     │  ❌ 无法感知用户发了图片
     ▼
ChatBubble 渲染
     │  仅渲染 message.content 文本
     │  ❌ 无图片渲染能力
```

### 1.2 已有但隔离的图片能力

| 位置 | 能力 | 问题 |
|------|------|------|
| `DiaryModal.jsx` | 完整的图片上传 + AI 生成 | 独立弹窗，不在聊天流中 |
| `media-upload.js` | `uploadImage(file)` → 获取 URL | 仅 DiaryModal 使用 |
| `agent.js:generateDiary()` | 传 `images: []` 参数 | 仅日记生成 API，非聊天 API |
| `diary_agent.py` | Qwen VL 图片理解 ✅ (刚完成) | 仅 DiaryAgent 可触发 |
| `ChatRequest` schema | 无 images 字段 | 聊天 API 不支持图片 |

### 1.3 核心缺口

```
① ChatInput     — 缺少图片附件按钮
② 聊天消息模型   — message 无 images 字段
③ ChatBubble    — 只能渲染文字，不能渲染图片
④ 聊天 API      — ChatRequest 无 images
⑤ 后端路由      — 聊天不经过视觉模型
⑥ SSE 流式     — 图片识别结果无法流式返回
```

---

## 2. 目标效果

### 2.1 用户交互流程

```
用户在聊天框粘贴/选择图片
        │
        ▼
图片显示在输入框上方（缩略图预览，可删除）
        │
        ▼
用户输入文字（可选） + 点击发送
        │
        ▼
消息气泡显示：文字 + 图片（用户侧）
        │
        ▼
后台自动：上传图片 → 视觉模型分析 → 结合文字生成回复
        │
        ▼
AI 回复气泡显示：文字回复（含对图片内容的理解）
```

### 2.2 场景示例

| 场景 | 用户操作 | 期望 AI 回复 |
|------|----------|-------------|
| 📍 拍照问地点 | 发送景点照片 + "这是哪里？" | "这是杭州西湖的断桥残雪..." |
| 🍜 拍照问美食 | 发送食物照片 + "这叫什么？" | "这是东坡肉，杭帮菜经典..." |
| 📝 照片写游记 | 发送多张照片 + "帮我写游记" | 识别每张照片内容，生成完整游记 |
| 🏛️ 识别建筑 | 发送建筑照片 | "这是XX大学图书馆，建于..." |
| 💬 普通聊天 | 纯文字（无图片） | 和现在一样走 DeepSeek 文本 |

---

## 3. 改动方案

### 3.1 改动范围总览

```
frontend/src/
├── components/Chat/
│   ├── ChatInput.jsx          ← 🔧 增加图片附件功能
│   ├── ChatBubble.jsx         ← 🔧 增加图片渲染
│   └── ImagePreview.jsx       ← 🆕 图片预览组件
├── pages/
│   └── PersonalTravelAssistantPage.jsx  ← 🔧 集成图片处理逻辑
├── services/api/
│   └── agent.js               ← 🔧 chatStream 支持 images 参数
└── services/api/
    └── media-upload.js        ← 无需改动（复用）

agent-service/app/
├── schemas.py                 ← 🔧 ChatRequest 增加 images 字段
├── main.py                    ← 🔧 chat/stream 传递 images
├── core/
│   └── model_router.py        ← 无需改动（已完成）
├── agent/
│   ├── dispatcher.py          ← 🔧 metadata 传递 images
│   ├── chat_agent.py          ← 🔧 感知 images，调用视觉模型
│   └── diary_agent.py         ← 无需改动（已完成）
```

### 3.2 前端改动详情

#### 3.2.1 ChatInput.jsx — 增加图片附件

```jsx
// 现状：纯文本 textarea
// 改动：增加图片选择按钮 + 已选图片缩略图预览

export default function ChatInput({ onSend, disabled, placeholder }) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState([]);  // ← 新增：待发送的图片
  const fileRef = useRef(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if ((!trimmed && images.length === 0) || disabled) return;
    onSend(trimmed, images);  // ← 改动：传递图片列表
    setValue('');
    setImages([]);            // ← 清空图片
  };

  // 处理图片选择
  const handleImageAdd = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setImages((p) => [...p, {
        file,
        preview: reader.result,  // base64 预览
      }]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // 移除已选图片
  const handleRemoveImage = (index) => {
    setImages((p) => p.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t border-neutral-100 bg-white">
      {/* 图片预览区 */}
      {images.length > 0 && (
        <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
          {images.map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              <button onClick={() => handleRemoveImage(i)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full shadow 
                           flex items-center justify-center hover:bg-red-50">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="flex items-end gap-3 p-4">
        {/* 图片选择按钮 */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="p-2 rounded-lg text-muted hover:text-heading hover:bg-neutral-100 transition-colors"
        >
          <ImagePlus size={20} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple 
               onChange={handleImageAdd} className="hidden" />

        <textarea ... />  {/* 保持不变 */}
        <button onClick={handleSend} ... />  {/* 禁用条件增加：images.length===0 时也需要文字 */}
      </div>
    </div>
  );
}
```

#### 3.2.2 ChatBubble.jsx — 增加图片渲染

```jsx
// 现状：仅渲染 message.content 文本
// 改动：增加图片网格展示

export default function ChatBubble({ message, className }) {
  const isUser = message.role === 'user';
  const hasImages = message.images && message.images.length > 0;

  return (
    <div className={clsx('flex gap-3 mb-6', isUser ? 'justify-end' : 'justify-start', className)}>
      {/* 头像保持不变 */}
      ...

      <div className={clsx('max-w-[75%]', ...)}>
        {/* 图片网格 */}
        {hasImages && (
          <div className={clsx(
            'grid gap-1 mb-2',
            message.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {message.images.map((img, i) => (
              <img
                key={i}
                src={typeof img === 'string' ? img : img.preview || img.url}
                alt=""
                className={clsx(
                  'object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity',
                  message.images.length === 1 ? 'max-h-48 w-auto' : 'h-24 w-full'
                )}
                onClick={() => window.open(typeof img === 'string' ? img : img.url || img.preview, '_blank')}
              />
            ))}
          </div>
        )}

        {/* 文字内容 */}
        {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}

        {/* 时间戳 */}
        ...
      </div>
    </div>
  );
}
```

#### 3.2.3 PersonalTravelAssistantPage.jsx — 集成图片处理

核心改动：`handleSend` 函数需要先上传图片，再将图片路径传给聊天 API。

```jsx
// 改动点 1: handleSend 签名变更
const handleSend = useCallback(async (text, images = []) => {
  // ... 原有 sendingRef 检查 ...

  // 新增: 上传图片
  let imagePaths = [];
  if (images.length > 0) {
    try {
      const uploadResults = await Promise.all(
        images.map((img) => uploadImage(img.file))
      );
      imagePaths = uploadResults
        .filter((r) => r.success && r.data?.path)
        .map((r) => r.data.path);
    } catch {
      setAgentError('图片上传失败，请重试');
      return;
    }
  }

  // 改动点 2: 用户消息增加 images 字段
  const userMsg = {
    role: 'user',
    content: text,
    images: images.map((img) => img.preview),  // 本地预览（气泡展示用）
    serverImages: imagePaths,                   // 服务器路径（发给后端）
    createdAt: new Date().toISOString(),
  };
  setMessages((p) => [...p, userMsg]);

  // 改动点 3: metadata 增加 images
  const metadata = {
    ...(buddyId ? { buddy_id: buddyId } : {}),
    ...(imagePaths.length > 0 ? { images: imagePaths } : {}),
  };

  // ... 后续 SSE 流程保持不变 ...
}, [userId, mergeSession]);
```

#### 3.2.4 agent.js — API 层改动

```javascript
// chatStream 增加 images 参数传递
chatStream: async function* (payload) {
  const body = JSON.stringify({
    userId: String(payload.userId || 'anonymous'),
    message: payload.message,
    sessionId: payload.sessionId || null,
    mode: payload.mode || 'travel_assistant',
    metadata: {
      ...(payload.metadata || {}),
      // images 通过 metadata 传递到后端
    },
    // 新增：显式 images 字段
    images: payload.images || [],
  });

  // ... 其余保持不变 ...
},
```

### 3.3 后端改动详情

#### 3.3.1 schemas.py — ChatRequest 增加 images

```python
class ChatRequest(BaseModel):
    model_config = {"populate_by_name": True}

    user_id: str = Field(default="anonymous", min_length=1, alias="userId")
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: str | None = Field(default=None, alias="sessionId")
    mode: str = Field(default="travel_assistant")
    metadata: dict[str, Any] = Field(default_factory=dict)
    images: list[str] = Field(default_factory=list)  # ← 🆕 图片 URL 列表
```

#### 3.3.2 main.py — chat 端点传递 images

```python
@app.post("/agent/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    # 将 images 合并到 metadata 中
    metadata = {**(request.metadata or {})}
    if request.images:
        metadata["images"] = request.images

    result = dispatcher.process_chat(
        user_id=request.user_id,
        message=request.message,
        session_id=request.session_id,
        mode=request.mode,
        metadata=metadata,  # ← images 通过 metadata 传递
    )
    # ... 其余不变 ...

@app.post("/agent/chat/stream")
async def chat_stream(request: ChatRequest):
    # 同样处理
    ...
```

#### 3.3.3 dispatcher.py — 图片传递无需改动

`dispatcher.py` 已经将 `metadata` 完整传递到 `AgentContext.metadata`，无需额外改动。

#### 3.3.4 chat_agent.py — 感知图片，调用视觉模型

```python
# chat_agent.py 改动点

def process(self, message: str, context: AgentContext) -> AgentResponse:
    images = context.metadata.get("images", [])
    
    if images:
        # 有图片：使用视觉模型理解图片
        return self._process_with_images(message, images, context)
    else:
        # 纯文本：继续使用现有的 LLM 处理逻辑
        return self._process_text(message, context)

def _process_with_images(self, message, images, context):
    """带图片的对话处理：先用视觉模型分析图片，再结合文本生成回复。"""
    from app.core.model_router import model_router
    from app.agent.llm_client import build_vision_content
    
    if not model_router.vision_available():
        return AgentResponse(
            content="抱歉，图片理解功能暂不可用。请尝试用文字描述您的问题。",
            intent="general_chat",
            suggestions=["继续文字聊天"],
        )
    
    client = model_router.vision_client
    
    # 构建多模态消息
    vision_blocks = [{"type": "text", "text": 
        f"用户问题：{message}\n\n"
        "请根据图片内容回答问题。如果是景点/建筑/美食，请直接说出名称。"
        "如果用户要求写游记，请描述图片中的场景、氛围和细节。"
    }]
    for img_url in images:
        vision_blocks.append({"type": "image_url", "image_url": {"url": img_url}})
    
    msgs = [
        {"role": "system", "content": self.get_system_prompt()},
        {"role": "user", "content": vision_blocks},
    ]
    
    result = client.chat(msgs, max_tokens=1500)
    reply = result.content or "我已查看了您发送的图片。"
    
    return AgentResponse(
        content=reply,
        intent="general_chat",  # 或根据图片内容动态判断
        suggestions=["继续聊天", "生成游记", "推荐相关地点"],
        tools_used=["vision_model"],
    )
```

---

## 4. 完整交互时序

```
用户点击图片按钮
  │
  ▼
ChatInput 打开文件选择器
  │
  ▼
用户选择 3 张照片 + 输入"帮我写游记"
  │
  ▼
点击发送
  │
  ├─► Promise.all([uploadImage(f1), uploadImage(f2), uploadImage(f3)])
  │       │
  │       ▼
  │   返回 ["uploads/images/abc.jpg", "uploads/images/def.jpg", ...]
  │
  ├─► setMessages: 添加用户消息气泡（含本地预览图 + 文字）
  │
  └─► chatWithAgentStream({ 
        message: "帮我写游记",
        metadata: { images: ["uploads/images/abc.jpg", ...] }
      })
        │
        ▼
      POST /agent/chat/stream
        │
        ▼
      Dispatcher → ChatAgent.process()
        │
        ├─ images 非空 → _process_with_images()
        │    │
        │    ├─ build_vision_content(text, image_urls)
        │    ├─ model_router.vision_client.chat()  ← Qwen VL Max
        │    └─ 返回图片描述 + 游记草稿
        │
        ▼
      SSE 流式返回 token → AI 回复气泡逐字显示
```

---

## 5. 实施计划

### 第 1 天：后端支持

| 步骤 | 文件 | 说明 | 预计 |
|------|------|------|:--:|
| 1.1 | `schemas.py` | ChatRequest 增加 `images: list[str]` | 10min |
| 1.2 | `main.py` | chat 和 chat_stream 端点传递 images | 15min |
| 1.3 | `chat_agent.py` | 增加 `_process_with_images()` | 1h |
| 1.4 | 测试 | curl 测试含图片的聊天请求 | 30min |

### 第 2 天：前端改造

| 步骤 | 文件 | 说明 | 预计 |
|------|------|------|:--:|
| 2.1 | `ChatInput.jsx` | 增加图片选择按钮 + 缩略图预览 | 1h |
| 2.2 | `ChatBubble.jsx` | 增加图片网格渲染 | 30min |
| 2.3 | `PersonalTravelAssistantPage.jsx` | handleSend 集成图片上传 + 传递 | 1h |
| 2.4 | `agent.js` | chatStream payload 增加 images | 15min |

### 第 3 天：联调 + 边界处理

| 步骤 | 说明 | 预计 |
|------|------|:--:|
| 3.1 | 纯图片无文字 → "图片识别 + 描述" | 30min |
| 3.2 | 图片 + 文字 → "结合图片回答问题" | 30min |
| 3.3 | 多张图片 → "按序描述 + 综合理解" | 30min |
| 3.4 | 图片上传失败 → 错误提示 + 重试 | 30min |
| 3.5 | 视觉模型不可用 → 友好降级提示 | 15min |
| 3.6 | 整体回归测试 | 30min |

---

## 6. 边界场景处理

| 场景 | 处理策略 |
|------|----------|
| 只有图片没有文字 | 默认 prompt: "请描述这些图片的内容，识别地点/美食/场景" |
| 图片上传失败 | 显示错误 toast，保留文字内容，不阻塞发送 |
| 视觉模型不可用 | ChatBubble 显示图片 + 文字回复，但提示图片未被分析 |
| 超过 4 张图片 | 限制最多 4 张，超出部分提示用户 |
| 图片过大 (>10MB) | 前端压缩到 1024px 宽度后再上传 |
| 历史消息中的图片 | session 持久化时保存 images 字段（需检查 SQLite schema） |

---

## 7. 验收标准

- [ ] ChatInput 有图片选择按钮，可选择多张图片
- [ ] 已选图片显示缩略图预览，可逐个删除
- [ ] 用户消息气泡能展示图片 + 文字
- [ ] 发送旅游照片 + "这是哪里" → AI 能识别并回复地点名
- [ ] 发送美食照片 → AI 能识别菜品并回复
- [ ] 发送多张照片 + "帮我写游记" → AI 生成含图片内容的游记
- [ ] 纯文字聊天不受影响，仍走 DeepSeek
- [ ] 图片上传失败时有错误提示
- [ ] 视觉模型不可用时正常降级
