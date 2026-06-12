# 对话游记一键发布 · 图片缺失问题分析

> 问题：AI 助手对话生成的游记，点击"一键发布"后，发布到日记系统的内容缺少图片。
> 根因：发布时只携带了当前消息上下文中的图片，未聚合整个对话历史中用户上传的全部图片。

---

## 1. 问题链路总览

```
用户发图 ──▶ 上传到 Java 后端 ──▶ 存入当前消息 serverImages
    │
    ├─ 消息1: 图A + 图B  (serverImages: [A, B])
    ├─ 消息2: 纯文本      (serverImages: [])
    └─ 消息3: "帮我写游记" ──▶ AI 生成 DiaryCard ──▶ 一键发布 ──▶ 只带了消息3的图片（空）
                                                          ↑
                                                    缺少消息1的图A、图B!
```

核心矛盾：**`handlePublishDiary` 发布时取 `message.serverImages`，但这个值只反映 DiaryCard 消息创建那一刻的图片集合。如果该集合未正确聚合历史图片，发布就会丢图。**

---

## 2. 根因分析（4 个缺陷点）

### 缺陷 1：`stream_process` 中 `_process_with_images` 路径丢失 `diary_card` 元数据

**文件**: `agent-service/app/agent/chat_agent.py` 第 687-713 行

当用户发送的消息**同时包含图片和日记生成请求**（如 "帮我根据这些图写游记" + 图片），`stream_process` 走图片优先路径：

```python
# chat_agent.py:687-713
if images:
    if model_router.vision_available():
        response = await _asyncio.to_thread(
            self._process_with_images, message, images, context
        )
        # 模拟流式输出
        content = response.content
        for i in range(0, len(content), chunk_size):
            yield {"event": "token", ...}
        yield {
            "event": "done",
            "data": {
                "content": content,
                "intent": response.intent,
                "trace_id": context.session_id or "",
                "suggestions": response.suggestions,
                "tools_used": response.tools_used,
                # ❌ 缺少: **response.metadata — diary_card / diary_style 未传递!
            },
        }
        return
```

**后果**:
- `_process_with_images` 内部明明在 `img_meta` 中设置了 `diary_card: True`（第 584 行），但 `stream_process` 的 done 事件**没有将其暴露出来**
- 调度器 (`dispatcher.py:310`) 检测不到 `diary_card` → 不会注入 `all_session_images` 到 `serverImages`
- 前端检测不到 `isDiaryCard` → 不渲染 DiaryCard → 用户根本看不到发布按钮

> 该缺陷导致：**带图的日记生成请求，DiaryCard 不出现，属于功能性阻断**。

---

### 缺陷 2：前端回退逻辑 `serverImagePaths` 仅含当前消息的图片，不含历史

**文件**: `frontend/src/pages/PersonalTravelAssistantPage.jsx` 第 199 行、第 281 行

```javascript
// SSE 路径 (line 199)
serverImages: finalData.serverImages || serverImagePaths,
//                            ↑ 回退值: 仅当前 send 的图片

// 同步降级路径 (line 281)
serverImages: reply?.metadata?.serverImages || serverImagePaths,
//                                            ↑ 同上
```

变量 `serverImagePaths` 来自 `handleSend` 的闭包：

```javascript
// line 103
let serverImagePaths = [...existingPaths];  // 只含本次 send 携带的图
if (images.length > 0) {
    for (const img of images) {
        const r = await uploadImage(img.file);
        if (r.success && r.data?.path) serverImagePaths.push(r.data.path);
    }
}
```

**后果**:
- 当用户说 "帮我写游记"（不携带新图片）触发日记生成时，`serverImagePaths = []`
- 如果 `finalData.serverImages` 因任何原因缺失（调度器未注入、SSE 事件丢失字段等），回退到空数组
- 历史消息中的图片全部丢失

> 该缺陷是"发布缺图"的**直接触发点**：当调度器的 `serverImages` 注入失效时，没有任何兜底机制来聚合历史图片。

---

### 缺陷 3：`_collect_session_images` 的调用时机与 `session` 数据完整性存在耦合

**文件**: `agent-service/app/agent/dispatcher.py` 第 12-26 行、第 294 行

```python
def _collect_session_images(session: dict[str, Any], current_images: list[str]) -> list[str]:
    all_images: list[str] = list(current_images)
    seen: set[str] = set(all_images)
    for msg in session.get("messages", []):
        if msg.get("role") != "user":
            continue
        for img in (msg.get("images") or []):   # 依赖 msg["images"] 存在
            if img and img not in seen:
                all_images.append(img)
                seen.add(img)
    return all_images
```

此函数依赖两个前提条件：

| 条件 | 风险 |
|------|------|
| `session["messages"]` 已包含所有历史用户消息 | SSE 流程中 session 在开始时加载，如果之前消息的 `append_messages` 尚未提交，则消息缺失（极端并发场景） |
| 每条 user 消息的 `images` 字段非空 | 文本消息的 `images` 为 `None`/缺失是正常的，但若数据库 `images` 列解析失败（`JSONDecodeError`），会被静默设为 `[]` |

另外，在 SSE 路径中 `all_session_images` 的计算位置（第 294 行）早于消息持久化（第 360 行）。如果并发请求创建了新 session 但消息尚未提交，`_collect_session_images` 只能拿到部分消息。

---

### 缺陷 4：`serverImages` 注入条件过于严格 —— `diary_card` 为真 **且** `all_session_images` 非空

**文件**: `agent-service/app/agent/dispatcher.py` 第 310 行

```python
if sse_event["data"].get("diary_card") and all_session_images:
    sse_event["data"]["serverImages"] = all_session_images
```

两个条件都必须满足。以下场景会静默失败：

| 场景 | `diary_card` | `all_session_images` | 结果 |
|------|:-----------:|:--------------------:|------|
| 正常生成 + 有历史图 | ✅ | ✅ | ✅ 注入成功 |
| 正常生成 + 无历史图 | ✅ | ❌ (空列表) | ❌ 不注入 — 合理，没有图可注入 |
| Agent 漏设 `diary_card`（缺陷1） | ❌ | ✅ | ❌ 不注入 — **历史图丢失** |
| `_collect_session_images` 返回空（缺陷3） | ✅ | ❌ | ❌ 不注入 — **历史图丢失** |

---

## 3. 完整触发场景示例

### 场景：分两次发图，第三次触发日记生成

```
回合1  用户: "今天去了西湖" + [图A.jpg, 图B.jpg]
       系统: 上传图A→uploads/images/a.jpg  上传图B→uploads/images/b.jpg
             user_msg.serverImages = [a.jpg, b.jpg]
             metadata.images = [a.jpg, b.jpg]  → Agent
             Agent: 一般闲聊回复（无 diary_card）
             持久化: messages.images = '["a.jpg","b.jpg"]'

回合2  用户: "还吃了东坡肉" + [图C.jpg]
       系统: 上传图C→uploads/images/c.jpg
             user_msg.serverImages = [c.jpg]
             metadata.images = [c.jpg]  → Agent
             Agent: 一般闲聊回复
             持久化: messages.images = '["c.jpg"]'

回合3  用户: "帮我写一篇游记"（无新图片）
       ┌─ handleSend("帮我写一篇游记", [], [])
       ├─ serverImagePaths = []  ← 当前回合无图片
       ├─ SSE → dispatcher:
       │   ├─ user_images = []  (metadata 无 images 字段)
       │   ├─ session 加载 → messages 含回合1/2
       │   ├─ _collect_session_images → [a.jpg, b.jpg, c.jpg]  ✅
       │   ├─ Agent 生成 diary_card: True
       │   └─ 注入: serverImages = [a.jpg, b.jpg, c.jpg]  ✅
       ├─ Frontend SSE done:
       │   ├─ isDiaryCard = true
       │   └─ serverImages = finalData.serverImages || serverImagePaths
       │                    = [a.jpg, b.jpg, c.jpg] || []
       │                    = [a.jpg, b.jpg, c.jpg]  ✅
       └─ 发布: message.serverImages = [a.jpg, b.jpg, c.jpg]  ✅
```

**这个常见场景是正确的。** 但以下变体就会出错：

### 场景变体 A：调度器注入失败

```
回合3  用户: "帮我写一篇游记"
       ...
       ├─ Agent 生成的 done_meta 中 diary_card 用了 snake_case "diary_card"
       │  但调度器检查的是 sse_event["data"].get("diary_card")
       │  （实际上两边一致，这里仅为示意）
       ├─ 调度器: diary_card 为假 → 不注入 serverImages
       ├─ Frontend: isDiaryCard = false → 不渲染 DiaryCard
       └─ 如果前端用了别的条件渲染了 DiaryCard:
           serverImages = undefined || [] = []  ❌ 图片全丢
```

### 场景变体 B：图片在回合3同一消息中发送

```
回合3  用户: "帮我写游记" + [图D.jpg]
       ├─ serverImagePaths = [d.jpg]
       ├─ SSE → chat_agent.stream_process:
       │   └─ images 非空 → 走 _process_with_images 路径  ← 缺陷1
       │       └─ done 事件无 diary_card!
       ├─ 调度器: 无 diary_card → 不注入 all_session_images
       ├─ Frontend:
       │   ├─ isDiaryCard = false → 不渲染 DiaryCard  ← 功能阻断
       │   └─ 即使强行渲染: serverImages = undefined || [d.jpg]
       │                                         = [d.jpg]  只有当前图  ❌
       └─ 丢失: a.jpg, b.jpg, c.jpg
```

---

## 4. 影响范围总结

| 风险等级 | 缺陷 | 触发条件 | 影响 |
|---------|------|---------|------|
| 🔴 高 | 缺陷1: `_process_with_images` 丢 `diary_card` | 用户在**同一消息**中发图 + 请求日记 | DiaryCard 不出现，功能阻断 |
| 🟡 中 | 缺陷2: `serverImagePaths` 回退不含历史图片 | `finalData.serverImages` 因任何原因缺失 | 发布丢图 |
| 🟡 中 | 缺陷3: session 数据完整性 | 极端并发 / DB 解析异常 | 历史图未聚合 |
| 🟢 低 | 缺陷4: 注入条件严格 | Agent done 事件漏设 `diary_card` | 图片不注入 |

---

## 5. 修复建议

### 修复 1（缺陷1）：`_process_with_images` done 事件补齐元数据

在 `chat_agent.py` 第 703-712 行的 done 事件中，将 `response.metadata` 的 `diary_card`、`diary_style` 等字段传递出去：

```python
# 修改前
yield {
    "event": "done",
    "data": {
        "content": content,
        "intent": response.intent,
        ...
    },
}

# 修改后
yield {
    "event": "done",
    "data": {
        "content": content,
        "intent": response.intent,
        "trace_id": context.session_id or "",
        "suggestions": response.suggestions,
        "tools_used": response.tools_used,
        **(response.metadata or {}),   # ← 传递 diary_card / diary_style
    },
}
```

### 修复 2（缺陷2）：前端发布时兜底聚合全部历史图片

在 `handlePublishDiary` 中，不再只依赖 `message.serverImages`，增加从对话历史聚合图片的兜底逻辑：

```javascript
// PersonalTravelAssistantPage.jsx handlePublishDiary
const handlePublishDiary = useCallback(async (message) => {
    ...
    // 聚合对话中所有用户消息的图片（兜底）
    const allConversationImages = [];
    const seen = new Set();
    for (const m of messages) {
        if (m.role !== 'user') continue;
        for (const img of (m.serverImages || m.images || [])) {
            const url = typeof img === 'string' ? img : (img?.path || img?.url || '');
            if (url && !seen.has(url)) {
                allConversationImages.push(url);
                seen.add(url);
            }
        }
    }
    // 优先用消息上的 serverImages，回退到全量聚合
    const publishImages = (message.serverImages && message.serverImages.length > 0)
        ? message.serverImages
        : allConversationImages;

    const res = await createDiary({
        ...
        images: publishImages,
        ...
    });
}, [userId, messages]);
```

### 修复 3（缺陷3）：增强 `_collect_session_images` 鲁棒性

- 对 `msg.get("images")` 增加类型校验，非列表时跳过而非静默失败
- 在 SSE 流程中，如果 `all_session_images` 为空但检测到当前 session 有时间跨度较大的图片消息，记录 WARNING 日志

### 修复 4（缺陷4）：放宽注入条件

当前条件要求 `diary_card` 为真 **且** `all_session_images` 非空。可改为：

```python
# dispatcher.py:310 — 始终尝试注入，让前端自行判断
if sse_event["data"].get("diary_card"):
    sse_event["data"]["serverImages"] = all_session_images or []
```

> 即使 `all_session_images` 为空，也显式传一个空数组，避免前端走到 `undefined || serverImagePaths` 的回退分支。

---

## 6. 验证方式

修复后可通过以下步骤验证：

1. **多轮图片聚合**：分 2-3 轮发送不同图片 → 发送文本触发日记生成 → 发布 → 检查日记详情页是否包含全部图片
2. **同消息图文触发**：发送 "帮我写游记" + 图片（同一消息） → 确认 DiaryCard 正常渲染 → 发布 → 检查图片完整
3. **会话重载**：关闭页面 → 重新打开 → 选择之前的会话 → 在已生成的 DiaryCard 上点发布 → 检查图片完整
4. **换风格后发布**：生成日记 → 换风格 → 发布 → 检查图片完整
