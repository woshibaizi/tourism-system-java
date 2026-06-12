# 景区照片重复 Bug 分析与修复方案

## 一、Bug 现象

新增 100 个景区的封面照片出现大量重复，例如：
- **同一张照片**（374KB）被用于 **35 个不同景区**
- 另一张照片（219KB）被用于 5 个景区
- 另一张照片（406KB）被用于 4 个景区

### 量化统计

| 指标 | 数值 |
|------|------|
| 新增景区图片总数 | 100 |
| 实际唯一图片数 | ~81 |
| 重复组数 | 19 组 |
| 最大重复组 | 35 个景区共用同一张照片 |
| 去重后可节省 | ~19 张无效下载 |

---

## 二、根因分析

### 根因 1：Pexels 对中文景区覆盖率低

Pexels 是一个以西方内容为主的图库平台，对中国本土景区（如"悬空寺""乔家大院""清东陵"等）的覆盖极低。当搜索不到匹配结果时，API 返回的是通用关键词（如"China""mountain""temple"）的热门照片，导致不同景区搜到同一张照片。

**示例**：
```
搜索 "悬空寺 China scenic" → 0 结果 → 返回最热门 "China mountain" 照片
搜索 "乔家大院 landscape" → 0 结果 → 返回同一张 "China mountain" 照片
```

### 根因 2：无下载前去重检查

```python
# fetch_images.py L294 - 当前逻辑
def fetch_image_for_place(place, filename):
    if file_exists(filename):
        return "exists"          # 仅检查同名文件
    urls = search_pexels(query)  # 搜索
    img_data = download_image(url)  # 直接下载，不检查是否已存在
    filepath.write_bytes(img_data)  # 保存，可能与其他文件内容相同
```

**问题**：只检查「文件名是否已存在」，不检查「内容是否已下载过」。

### 根因 3：搜索策略过于通用

```python
search_queries = [
    f"{name} China scenic spot landscape",   # 太通用
    f"{name} 中国 景区 风景",
    f"{name} landscape tourism",
    name,
]
```

当精确搜索失败后，后续通用查询返回的是同一批 Pexels 热门照片。

### 根因 4：Pexels 热门照片的马太效应

Pexels API 默认按 popularity 排序，导致"China travel""Great Wall"等爆款照片总是排在第一位，不同景区的搜索都会命中同一张热门照片。

---

## 三、修复方案

### 方案 A：增加去重逻辑（最小改动，立即生效）

在下载流程中增加 MD5 哈希校验：

```python
# 新增全局已下载哈希集合
DOWNLOADED_HASHES = set()

def fetch_image_for_place(place, filename):
    # ... 现有逻辑 ...
    
    for query in search_queries:
        urls = search_pexels(query, max_results=10)  # 增加到10个候选
        for url in urls:
            img_data = download_image(url)
            if not img_data:
                continue
            
            # === 新增：MD5 去重检查 ===
            img_hash = hashlib.md5(img_data).hexdigest()
            if img_hash in DOWNLOADED_HASHES:
                log.info(f"  [SKIP] 重复图片: {filename}")
                continue  # 跳过，尝试下一张
            
            DOWNLOADED_HASHES.add(img_hash)
            filepath.write_bytes(img_data)
            return "pexels"
    
    # 所有URL都重复，生成占位图
    generate_placeholder(name, filename)
    return "placeholder"
```

**效果**：杜绝同一次运行中的重复下载。

### 方案 B：增加 Bing 图片搜索作为第二来源

Pexels 对中国景区覆盖差，增加 Bing Image Search 抓取：

```python
def search_bing_images(query, max_results=10):
    """通过 Bing 图片搜索获取图片URL"""
    search_url = f"https://www.bing.com/images/search?q={quote_plus(query)}&first=1"
    headers = {"User-Agent": "Mozilla/5.0 ..."}
    resp = requests.get(search_url, headers=headers)
    soup = BeautifulSoup(resp.text, 'html.parser')
    # 解析 img 标签获取真实图片URL
    urls = []
    for img in soup.select('.iusc'):
        m = img.get('m')
        if m:
            data = json.loads(m)
            urls.append(data.get('murl'))
    return urls[:max_results]
```

**效果**：对中国景区有更好的覆盖。

### 方案 C：优化搜索关键词策略

针对不同类型景区使用差异化搜索词：

```python
def build_search_queries(name, features):
    queries = []
    # 精确匹配
    queries.append(f"{name} scenic spot")
    # 中英文混合
    queries.append(f"{name} 景区 风景 旅游")
    # 地理位置限定（提高精确度）
    if province:
        queries.append(f"{name} {province} travel photography")
    # 避免使用过于通用的关键词（如"China landscape"）
    return queries
```

### 方案 D：增加随机排序和多样性参数

在 Pexels API 调用中增加随机性：

```python
params = {
    "query": query,
    "per_page": 15,        # 增加到15
    "page": random.randint(1, 5),  # 随机翻页，避免总取第一页
    "orientation": "landscape",
}
```

---

## 四、推荐实施步骤

| 步骤 | 内容 | 优先级 | 工作量 |
|------|------|--------|--------|
| 1 | 方案 A：添加 MD5 去重逻辑 | 🔴 高 | 15 分钟 |
| 2 | 方案 C：优化搜索关键词 | 🔴 高 | 20 分钟 |
| 3 | 方案 D：增加 API 随机翻页 | 🟡 中 | 10 分钟 |
| 4 | 清理现有重复图片并重新下载 | 🔴 高 | 自动 |
| 5 | 方案 B：Bing 搜索兜底 | 🟢 低 | 1 小时 |

---

## 五、验证方法

修复后运行脚本，验证指标：

```bash
# 1. 无重复
python -c "
import os, hashlib
upload = 'uploads/images/'
hashes = {}
for f in os.listdir(upload):
    with open(os.path.join(upload, f), 'rb') as fh:
        h = hashlib.md5(fh.read()).hexdigest()
    if h in hashes: print(f'DUPLICATE: {f} == {hashes[h]}')
    hashes[h] = f
print(f'Unique: {len(hashes)}')
"

# 2. 所有新景区照片 >50KB（非占位图）
# 3. 前端展示效果抽查
```
