# Bug 分析：风格确认跳过 & 换风格图片分析失败

> **问题 1**: 直接说 "帮我写游记" 依旧不会弹出风格选择，直接生成  
> **问题 2**: 点击 "换风格" 后报错 `图片分析暂时失败 → Error code: 400 - Failed to download`

---

## 问题 1：风格确认依旧被跳过

### 根因：`_extract_style_from_message` 把 "游记" 这个常用词误判为风格选择

**文件**: `agent-service/app/agent/chat_agent.py`

**触发链路**:

```
用户: "帮我写一篇游记"
    │
    ▼
stream_process L819-824:
    │
    explicit_style = self._extract_style_from_message("帮我写一篇游记")
    │                       │
    │                       ▼
    │              遍历 _STYLE_KEYWORDS:
    │                  {"小红书":"小红书", ... "游记":"游记", ...}
    │                       │
    │              "游记" in "帮我写一篇游记" → True → return "游记"
    │
    ▼
    explicit_style = "游记"  ← 非 None!
    │
    ▼
    if explicit_style or override_style:    # ← True! 走进了"已指定风格"分支
        context.metadata["diary_style"] = "游记"
        # 直接生成，跳过风格推荐
```

**根本矛盾**: `_STYLE_KEYWORDS` (L975-981) 中，`"游记"` 这个词承担了**双重语义**：

| 场景 | 用户说的 | 实际意图 |
|------|---------|---------|
| "帮我写一篇游记" | 日记**请求**，对风格无偏好 | → 应问风格 |
| "用游记的风格写" | 明确指定**风格**为"游记风" | → 应直接用游记风 |

但关键词匹配无法区分这两种情况——所有包含 `"游记"` 的消息都被视为风格选择。

同样的问题也存在于其他风格的误判：如果用户说 "写个小红书文案"，`"小红书"` 和 `"文案"` 都可能被匹配成风格而非产品名称。

### 当前关键字表（L975-981）

```python
_STYLE_KEYWORDS: dict[str, str] = {
    "小红书": "小红书", "朋友圈": "朋友圈", "游记": "游记",
    "攻略": "攻略", "文艺": "文艺", "幽默": "幽默",
    "随笔": "随笔", "回忆": "回忆", "吐槽": "幽默",
    "长文": "游记", "种草": "小红书", "日常": "朋友圈",
    "轻松": "朋友圈", "详细": "攻略", "有趣": "幽默",
}
```

这些短关键词在用户自然语言中出现频率极高——用户说"写攻略""写游记""写随笔"和选择"攻略风格""游记风格""随笔风格"在字面上完全无法区分。

---

## 问题 2：换风格后图片分析失败 400

### 根因：换风格时缺少 `image_data_urls`，视觉模型无法下载本地服务器图片

**文件**: `agent-service/app/agent/chat_agent.py` L608-658  
**关联前端**: `frontend/src/pages/PersonalTravelAssistantPage.jsx` L429-434

### 触发链路

```
用户点击 "换风格" → 选择 "朋友圈"
    │
    ▼
handleRestyleDiary:
    existingImages = message.serverImages  // = ["uploads/images/a.jpg", "uploads/images/b.jpg"]
    handleSend("帮我把这篇游记换成朋友圈风格重新写", /*images=*/[], /*existingPaths=*/existingImages)
    │
    ▼
handleSend:
    serverImagePaths = [...existingPaths]  // = ["uploads/images/a.jpg", ...]
    metadata.images = serverImagePaths     // ✅ 有路径
    metadata.image_data_urls = []          // ❌ 没有 base64！(images参数为空数组)
    │
    ▼
Agent stream_process:
    images = ["uploads/images/a.jpg", "uploads/images/b.jpg"]  // 服务器相对路径
    _img_intent == "generate_diary" → 走 _understand_images_for_diary
    │
    ▼
_understand_images_for_diary L622-634:
    data_urls = context.metadata.get("image_data_urls", [])  // = [] (空!)
    │
    if data_urls:        # False!
        ...              # 跳过
    else:
        # 降级：拼接 HTTP URL
        for img in images:
            # "uploads/images/a.jpg" → "http://java-backend:8080/uploads/images/a.jpg"
            vision_urls.append(f"{backend}/{img.lstrip('/')}")
    │
    ▼
视觉模型 API（Qwen VL，阿里云）:
    尝试下载 "http://java-backend:8080/uploads/images/a.jpg"
    │
    ❌ Java 后端在开发者本地 → 阿里云无法访问 → HTTP 400
    │
    错误: Error code: 400 - InternalError.Algo.InvalidParameter: Failed to download...
```

### 为什么首次上传图片不会触发这个问题？

首次上传时，前端同时传了两个字段：

```javascript
// PersonalTravelAssistantPage.jsx L148-153
const imageDataUrls = images.map((img) => img.preview);  // base64 data URLs
const metadata = {
    ...(serverImagePaths.length > 0 ? { images: serverImagePaths } : {}),
    ...(imageDataUrls.length > 0 ? { image_data_urls: imageDataUrls } : {}),  // ← 有关键!
};
```

`image_data_urls` 是 base64 编码的图片数据（`data:image/jpeg;base64,/9j/4AAQ...`），视觉模型可以直接解码，不需要网络下载。

但换风格时，`images` 参数是空数组（没有新上传的文件），所以 `imageDataUrls` 也是空的：

```javascript
handleSend(`帮我把这篇游记换成朋友圈风格重新写`, [], existingImages);
//                                               ↑ images参数为空
```

`existingImages` 只有服务器路径（`existingPaths`），不包含 base64 数据。

### 同样的问题也会影响首次带图触发生成

如果用户**先上传图片 → 再单独发一条 "帮我写游记"**（不带新图片），也会触发同样的错误：

```
回合1: 用户: "去了故宫" + [图A]
       → metadata: {images: ["uploads/a.jpg"], image_data_urls: ["data:image/..."]}
       → 视觉模型分析图片 ✅ (有base64)

回合2: 用户: "帮我写游记" (无新图片)
       → metadata: {images: []}  ← 空!
       → 但 _img_intent == "generate_diary"
       → 走 _understand_images_for_diary
       → images = [] → vision_urls = [] → 空描述
       → ⚠️ 这里不会报错(空列表直接返回)，但图片信息丢失了
```

而如果回合2通过 `handleRestyleDiary` 触发（带 `existingPaths`），就会触发 400 错误：

```
回合2: 换风格
       → metadata: {images: ["uploads/a.jpg"]}  ← 有路径
       → 但 image_data_urls 为空
       → _understand_images_for_diary 降级到 HTTP URL
       → 视觉模型无法下载 → 400 错误 ❌
```

---

## 影响范围

| 问题 | 严重度 | 影响 |
|------|--------|------|
| "游记" 等词误判风格 | 🟡 中 | 用户说 "帮我写游记" 不弹风格选择，直接以 "游记风" 生成 |
| "小红书""攻略"等同理 | 🟡 中 | 用户说 "写个攻略" 也一样误判 |
| 换风格 400 错误 | 🔴 高 | 换风格功能完全不可用（带图片时） |
| image_data_urls 缺失 | 🔴 高 | 所有不附带新图片的二次请求（换风格/编辑重生成）都可能触发 |

---

## 修复方案

### 修复 1：`_extract_style_from_message` 增加上下文判断 —— 区分 "请求" vs "选择"

**文件**: `agent-service/app/agent/chat_agent.py`

当前逻辑：消息中包含关键词就视为风格选择。

修改逻辑：只有当关键词出现在**明确的风格上下文**中才视为风格选择。

```python
def _extract_style_from_message(self, message: str) -> str | None:
    """从用户消息中提取明确的风格偏好。
    
    只有当风格关键词出现在明确的选择上下文中才返回，
    避免误判 "帮我写游记" 这样的日记请求。
    """
    # 显式风格选择模式："XX风格" / "XX风" / "用XX" / "换成XX"
    explicit_patterns = [
        (r'(?:用|换成?|改成?|写成?|来一篇)\s*({})\s*(?:风格|风|的)', kw)
        for kw in self._STYLE_KEYWORDS
    ]
    # "XX风格" / "XX风"
    style_suffix = re.findall(r'(\S+?)(?:风格|风)', message)
    combined = []
    for s in style_suffix:
        if s in self._STYLE_KEYWORDS:
            combined.append(s)
    if len(combined) == 1:
        return self._STYLE_KEYWORDS[combined[0]]
    
    # 原有的简单匹配作为兜底（但提高阈值：至少 3 个不同关键词命中才采纳）
    # ...
```

**更简单的方案**：在风格确认逻辑中加一个判断——如果 `explicit_style` 是由 `_extract_style_from_message` 返回的，且消息中同时包含 "帮我""生成""写一篇" 等请求短语，则忽略 explicit_style，走风格推荐流程。

```python
# L819-824 修改
if intent == "generate_diary":
    explicit_style = self._extract_style_from_message(message)
    override_style = context.metadata.get("diary_style")
    
    # 如果消息包含日记请求短语，且没有显式的"XX风格/XX风"表述，
    # 则忽略 explicit_style，让用户选择风格
    _diary_request_patterns = ["帮我写", "生成", "写一篇", "写个", "来一篇", "帮我生成"]
    _has_style_suffix = any(kw + "风格" in message or kw + "风" in message
                           for kw in self._STYLE_KEYWORDS)
    if explicit_style and not _has_style_suffix and any(p in message for p in _diary_request_patterns):
        explicit_style = None  # 忽略模糊匹配，走风格推荐
    
    if explicit_style or override_style:
        ...
```

### 修复 2：`_understand_images_for_diary` 增加数据源降级保护

**文件**: `agent-service/app/agent/chat_agent.py` L608-658

当前：`data_urls` 为空时降级到 HTTP URL → 视觉模型可能无法访问。  
修改：`data_urls` 为空且只有服务器相对路径时，**跳过视觉理解，返回空描述**（让 LLM 基于对话文本生成），不抛异常。

```python
def _understand_images_for_diary(self, images: list[str], context: AgentContext) -> str:
    ...
    data_urls = context.metadata.get("image_data_urls", [])
    if data_urls:
        vision_urls = list(data_urls)
    else:
        # 检查是否有可下载的 HTTP URL
        http_urls = [img for img in images
                     if img.startswith("http://") or img.startswith("https://")]
        if http_urls:
            vision_urls = http_urls
        else:
            # 只有相对路径，视觉模型无法下载 → 跳过图片理解
            logger.warning(
                "缺少 image_data_urls 或可下载的 HTTP URL，跳过图片理解 "
                "(images=%d, 均为相对路径)", len(images)
            )
            return ""  # 返回空，让 LLM 基于对话文本生成
    ...
```

### 修复 3（前端）：换风格时传 base64 兜底

**文件**: `frontend/src/pages/PersonalTravelAssistantPage.jsx` L429-434

换风格时，除了传 `existingImages`（服务器路径），同时尝试从用户消息的原始 `images` 属性中提取 base64 preview 作为 `image_data_urls` 的兜底。

```javascript
const handleRestyleDiary = useCallback((message, selectedStyle) => {
    const existingImages = message.serverImages || message.images || [];
    const styleText = selectedStyle || '另一种风格';
    
    // 从对话历史中查找用户原始上传的图片 base64（作为 image_data_urls 兜底）
    const base64Fallbacks = [];
    // 遍历消息列表找到这个日记卡片之前的用户消息中的图片
    // ...（需要读取 messages 状态）
    
    handleSend(
        `帮我把这篇游记换成${styleText}风格重新写`,
        base64Fallbacks.length > 0 ? base64Fallbacks.map(b => ({preview: b})) : [],
        existingImages
    );
}, [handleSend, messages]);
```

这个修复比较复杂（需要关联前后消息），建议优先做修复 1 + 修复 2，修复 3 作为后续优化。
