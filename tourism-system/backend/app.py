"""
Flask主应用
旅游系统后端API服务
"""

import json
import os
import subprocess
import signal
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# 导入算法模块
from algorithms.sorting_algorithm import SortingAlgorithm
from algorithms.search_algorithm import SearchAlgorithm, FacilityCategoryMatcher
from algorithms.shortest_path_algorithm import ShortestPathAlgorithm
from algorithms.huffman_compression import DiaryCompressionManager
from algorithms.recommendation_algorithm import RecommendationAlgorithm
from algorithms.indoor_navigation_algorithm import IndoorNavigationAlgorithm

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'

# 允许的文件扩展名
ALLOWED_IMAGE_EXTENSIONS = {'jpg', 'jpeg'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4'}

# 全局变量存储数据
data_cache = {
    'users': [],
    'places': [],
    'buildings': [],
    'facilities': [],
    'roads': [],
    'diaries': []
}

# 算法实例
sorting_algo = SortingAlgorithm()
search_algo = SearchAlgorithm()
path_algo = None  # 将在加载数据后初始化
compression_manager = DiaryCompressionManager()
recommendation_algo = RecommendationAlgorithm()
indoor_nav_algo = None  # 室内导航算法实例
facility_matcher = FacilityCategoryMatcher()  # 设施类别匹配器


def clear_port(port):
    """清理指定端口上的进程（避免杀死自己）"""
    try:
        print(f"正在检查端口 {port} 是否被占用...")
        
        # 获取当前进程ID和父进程ID
        current_pid = os.getpid()
        parent_pid = os.getppid()
        
        # 使用lsof查找占用端口的进程
        result = subprocess.run(['lsof', '-ti', f':{port}'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            print(f"发现 {len(pids)} 个进程占用端口 {port}: {pids}")
            print(f"当前进程ID: {current_pid}, 父进程ID: {parent_pid}")
            
            for pid_str in pids:
                try:
                    pid = int(pid_str.strip())
                    
                    # 避免杀死自己或父进程
                    if pid == current_pid:
                        print(f"跳过当前进程 {pid}")
                        continue
                    if pid == parent_pid:
                        print(f"跳过父进程 {pid}")
                        continue
                    
                    print(f"正在终止进程 {pid}...")
                    os.kill(pid, signal.SIGTERM)
                    
                    # 等待一下，如果进程还在运行，强制终止
                    import time
                    time.sleep(1)
                    try:
                        os.kill(pid, 0)  # 检查进程是否还存在
                        print(f"进程 {pid} 仍在运行，强制终止...")
                        os.kill(pid, signal.SIGKILL)
                    except OSError:
                        pass  # 进程已经终止
                        
                except (ValueError, OSError) as e:
                    print(f"终止进程 {pid_str} 失败: {e}")
            
            print(f"端口 {port} 清理完成")
        else:
            print(f"端口 {port} 未被占用")
            
    except FileNotFoundError:
        print("lsof命令不可用，跳过端口清理")
    except Exception as e:
        print(f"清理端口 {port} 时出错: {e}")


def load_data():
    """加载所有JSON数据文件"""
    global path_algo, indoor_nav_algo
    import os
    
    # 获取当前脚本的目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    data_files = {
        'users': 'users.json',
        'places': 'places.json',
        'buildings': 'buildings.json',
        'facilities': 'facilities.json',
        'roads': 'roads.json',
        'diaries': 'diaries.json'
    }
    
    for key, filename in data_files.items():
        file_path = os.path.join(script_dir, 'data', filename)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data_cache[key] = json.load(f)
            print(f"已加载 {key}: {len(data_cache[key])} 条记录 (从 {file_path})")
        except FileNotFoundError:
            print(f"警告: 文件 {file_path} 不存在")
            data_cache[key] = []
        except json.JSONDecodeError as e:
            print(f"错误: 解析 {file_path} 失败: {e}")
            data_cache[key] = []
    
    # 初始化路径算法
    if data_cache['roads']:
        path_algo = ShortestPathAlgorithm(data_cache['roads'], data_cache['places'], data_cache['buildings'])
    
    # 初始化室内导航算法
    indoor_nav_file = os.path.join(script_dir, 'data', 'indoor_navigation.json')
    if os.path.exists(indoor_nav_file):
        indoor_nav_algo = IndoorNavigationAlgorithm(indoor_nav_file)
    else:
        print(f"警告: 室内导航数据文件 {indoor_nav_file} 不存在")


def save_data(data_type):
    """保存数据到JSON文件"""
    import os
    # 获取当前脚本的目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, 'data', f'{data_type}.json')
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data_cache[data_type], f, ensure_ascii=False, indent=2)
        print(f"成功保存 {data_type} 到 {file_path}")
        return True
    except Exception as e:
        print(f"保存 {data_type} 失败: {e}")
        print(f"尝试保存到路径: {file_path}")
        return False


def allowed_file(filename, file_type):
    """检查文件扩展名是否允许"""
    if '.' not in filename:
        return False
    
    ext = filename.rsplit('.', 1)[1].lower()
    
    if file_type == 'image':
        return ext in ALLOWED_IMAGE_EXTENSIONS
    elif file_type == 'video':
        return ext in ALLOWED_VIDEO_EXTENSIONS
    
    return False


def handle_diary_data_change(operation, diary_data=None):
    """
    统一处理日记数据变更后的缓存清除
    
    Args:
        operation: 操作类型 ('创建', '更新', '删除')
        diary_data: 日记数据（可选）
    """
    # 清除日记标题哈希缓存
    SearchAlgorithm.clear_diary_title_cache()
    
    # 添加日志记录
    print(f"[缓存管理] 日记数据{operation}，已清除日记标题哈希缓存")
    
    # 可以在这里添加其他相关缓存的清除
    # 例如：推荐算法缓存、搜索结果缓存等
    # clear_other_related_caches()


# ==================== 用户相关API ====================

@app.route('/api/users', methods=['GET'])
def get_users():
    """获取所有用户"""
    return jsonify({
        'success': True,
        'data': data_cache['users']
    })


@app.route('/api/users/<user_id>', methods=['GET'])
def get_user(user_id):
    """获取特定用户"""
    user = next((u for u in data_cache['users'] if u['id'] == user_id), None)
    if user:
        return jsonify({
            'success': True,
            'data': user
        })
    return jsonify({
        'success': False,
        'message': '用户不存在'
    }), 404


@app.route('/api/users/login', methods=['POST'])
def login():
    """用户登录"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = next((u for u in data_cache['users'] 
                if u['username'] == username and u['password'] == password), None)
    
    if user:
        return jsonify({
            'success': True,
            'data': user,
            'message': '登录成功'
        })
    
    return jsonify({
        'success': False,
        'message': '用户名或密码错误'
    }), 401


# ==================== 场所相关API ====================

@app.route('/api/places', methods=['GET'])
def get_places():
    """获取所有场所"""
    return jsonify({
        'success': True,
        'data': data_cache['places']
    })


@app.route('/api/places/<place_id>', methods=['GET'])
def get_place(place_id):
    """获取特定场所详情"""
    # 找到原始场所在data_cache中的索引
    place_index = None
    original_place = None
    for i, p in enumerate(data_cache['places']):
        if p['id'] == place_id:
            place_index = i
            original_place = p
            break
    
    if original_place is None:
        return jsonify({
            'success': False,
            'message': '场所不存在'
        }), 404
    
    # 记录增加前的浏览量
    old_count = original_place.get('clickCount', 0)
    print(f"[DEBUG] 场所 {place_id} 增加浏览量前: {old_count}")
    
    # 增加原始场所的浏览量
    original_place['clickCount'] = old_count + 1
    new_count = original_place['clickCount']
    print(f"[DEBUG] 场所 {place_id} 增加浏览量后: {new_count}")
    
    # 保存数据
    save_data('places')
    print(f"[DEBUG] 场所 {place_id} 数据已保存")
    
    # 获取相关建筑物和设施
    buildings = [b for b in data_cache['buildings'] if b['placeId'] == place_id]
    facilities = [f for f in data_cache['facilities'] if f['placeId'] == place_id]
    
    return jsonify({
        'success': True,
        'data': {
            'place': original_place,
            'buildings': buildings,
            'facilities': facilities
        }
    })


@app.route('/api/places/search', methods=['GET'])
def search_places():
    """搜索场所"""
    query = request.args.get('query', '')
    search_type = request.args.get('type', 'fuzzy')
    
    if not query:
        return jsonify({
            'success': True,
            'data': data_cache['places']
        })
    
    results = search_algo.search_places(data_cache['places'], query, search_type)
    
    return jsonify({
        'success': True,
        'data': results
    })


@app.route('/api/places/recommend', methods=['POST'])
def recommend_places():
    """推荐场所"""
    data = request.get_json()
    user_id = data.get('userId')
    algorithm = data.get('algorithm', 'hybrid')
    top_k = data.get('topK', 12)  # 支持指定返回数量，默认12个
    
    user = next((u for u in data_cache['users'] if u['id'] == user_id), None)
    if not user:
        return jsonify({
            'success': False,
            'message': '用户不存在'
        }), 404
    
    recommendations = recommendation_algo.recommend_places(
        user, data_cache['places'], data_cache['users'], algorithm, top_k
    )
    
    return jsonify({
        'success': True,
        'data': recommendations,
        'algorithm': algorithm,
        'count': len(recommendations)
    })


@app.route('/api/places/<place_id>/user-rating/<user_id>', methods=['GET'])
def get_user_rating(place_id, user_id):
    """获取用户对特定场所的评分"""
    # 查找用户
    user = next((u for u in data_cache['users'] if u['id'] == user_id), None)
    if not user:
        return jsonify({
            'success': False,
            'message': '用户不存在'
        }), 404
    
    # 检查场所是否存在
    place_exists = any(p['id'] == place_id for p in data_cache['places'])
    if not place_exists:
        return jsonify({
            'success': False,
            'message': '场所不存在'
        }), 404
    
    # 查找用户对该场所的评分
    user_rating = None
    for rating_record in user.get('ratingHistory', []):
        if rating_record['placeId'] == place_id:
            user_rating = rating_record['rating']
            break
    
    return jsonify({
        'success': True,
        'data': {
            'userRating': user_rating,
            'hasRated': user_rating is not None
        }
    })


@app.route('/api/places/<place_id>/rate', methods=['POST'])
def rate_place(place_id):
    """为场所评分"""
    data = request.get_json()
    rating = data.get('rating')
    user_id = data.get('userId')  # 添加用户ID
    
    if not rating or not isinstance(rating, (int, float)) or rating < 1 or rating > 5:
        return jsonify({
            'success': False,
            'message': '评分必须是1-5之间的数字'
        }), 400
    
    if not user_id:
        return jsonify({
            'success': False,
            'message': '用户ID不能为空'
        }), 400
    
    # 找到原始场所在data_cache中的索引
    place_index = None
    original_place = None
    for i, p in enumerate(data_cache['places']):
        if p['id'] == place_id:
            place_index = i
            original_place = p
            break
    
    if not original_place:
        return jsonify({
            'success': False,
            'message': '场所不存在'
        }), 404
    
    # 查找用户
    user_index = None
    for i, user in enumerate(data_cache['users']):
        if user['id'] == user_id:
            user_index = i
            break
    
    if user_index is None:
        return jsonify({
            'success': False,
            'message': '用户不存在'
        }), 404
    
    # 计算新的平均评分
    current_rating = original_place.get('rating', 0)
    current_count = original_place.get('ratingCount', 1)
    
    # 新平均分 = (当前平均分 × 当前评价人数 + 新评分) / (当前评价人数 + 1)
    new_rating = (current_rating * current_count + rating) / (current_count + 1)
    new_count = current_count + 1
    
    # 更新原始场所的评分信息
    original_place['rating'] = round(new_rating, 1)
    original_place['ratingCount'] = new_count
    
    # 更新用户评分历史
    user = data_cache['users'][user_index]
    if 'ratingHistory' not in user:
        user['ratingHistory'] = []
    
    # 检查用户是否已经评分过这个场所
    existing_rating = None
    for i, rating_record in enumerate(user['ratingHistory']):
        if rating_record['placeId'] == place_id:
            existing_rating = i
            break
    
    from datetime import datetime
    rating_record = {
        'placeId': place_id,
        'rating': rating,
        'date': datetime.now().isoformat() + 'Z'
    }
    
    if existing_rating is not None:
        # 更新现有评分
        user['ratingHistory'][existing_rating] = rating_record
        message = '评分已更新'
    else:
        # 添加新评分
        user['ratingHistory'].append(rating_record)
        message = '评分成功'
    
    # 保存数据
    save_data('places')
    save_data('users')
    
    # 返回更新后的评分信息
    return jsonify({
        'success': True,
        'data': {
            'rating': original_place['rating'],
            'ratingCount': original_place['ratingCount'],
            'userRating': rating
        },
        'message': message
    })


@app.route('/api/places/<place_id>/visit', methods=['POST'])
def record_visit(place_id):
    """记录用户访问场所"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({
                'success': False,
                'message': '用户ID不能为空'
            }), 400
        
        # 检查场所是否存在
        place_exists = any(p['id'] == place_id for p in data_cache['places'])
        if not place_exists:
            return jsonify({
                'success': False,
                'message': '场所不存在'
            }), 404
        
        # 查找用户
        user_index = None
        for i, user in enumerate(data_cache['users']):
            if user['id'] == user_id:
                user_index = i
                break
        
        if user_index is None:
            return jsonify({
                'success': False,
                'message': '用户不存在'
            }), 404
        
        # 更新用户访问历史
        user = data_cache['users'][user_index]
        if 'visitHistory' not in user:
            user['visitHistory'] = []
        
        # 如果用户还没有访问过这个场所，则添加到访问历史
        if place_id not in user['visitHistory']:
            user['visitHistory'].append(place_id)
            
            # 更新场所的浏览量
            for place in data_cache['places']:
                if place['id'] == place_id:
                    place['clickCount'] = place.get('clickCount', 0) + 1
                    break
            
            # 保存数据
            save_data('users')
            save_data('places')
            
            return jsonify({
                'success': True,
                'message': '访问记录已保存',
                'data': {
                    'visitHistory': user['visitHistory']
                }
            })
        else:
            return jsonify({
                'success': True,
                'message': '已访问过该场所',
                'data': {
                    'visitHistory': user['visitHistory']
                }
            })
            
    except Exception as e:
        print(f"记录访问失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'记录访问失败: {str(e)}'
        }), 500


@app.route('/api/places/sort', methods=['POST'])
def sort_places():
    """场所排序API，使用Top-K优化算法"""
    try:
        data = request.get_json()
        sort_type = data.get('sortType', 'popularity')  # 排序类型：popularity, rating
        top_k = data.get('topK', 12)  # 返回前K个，默认12个
        place_ids = data.get('placeIds', [])  # 可选：指定要排序的场所ID列表
        
        # 获取场所数据
        if place_ids:
            # 如果指定了场所ID，只对这些场所进行排序
            places_to_sort = [p for p in data_cache['places'] if p['id'] in place_ids]
        else:
            # 否则对所有场所进行排序
            places_to_sort = data_cache['places']
        
        if not places_to_sort:
            return jsonify({
                'success': True,
                'data': [],
                'sortType': sort_type,
                'count': 0
            })
        
        # 根据排序类型定义排序函数
        if sort_type == 'popularity':
            def sort_key(place):
                # 主排序：浏览量，二级排序：ID（确保一致性）
                return (place.get('clickCount', 0), place.get('id', ''))
        elif sort_type == 'rating':
            def sort_key(place):
                # 主排序：评分，二级排序：ID（确保一致性）
                return (place.get('rating', 0), place.get('id', ''))
        else:
            return jsonify({
                'success': False,
                'message': f'不支持的排序类型: {sort_type}'
            }), 400
        
        # 使用部分排序算法：返回所有数据，但前K个是精确排序的
        sorted_places = sorting_algo.partial_sort_with_all_data(
            places_to_sort, 
            sort_key, 
            top_k, 
            reverse=True  # 降序排列
        )
        
        return jsonify({
            'success': True,
            'data': sorted_places,
            'sortType': sort_type,
            'count': len(sorted_places),
            'total': len(places_to_sort)
        })
        
    except Exception as e:
        print(f"场所排序失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'排序失败: {str(e)}'
        }), 500


@app.route('/api/places/sort-by-distance', methods=['POST'])
def sort_places_by_distance():
    """场所按距离排序API，支持堆排序算法"""
    try:
        data = request.get_json()
        target_location = data.get('location')  # 目标位置 {"lat": latitude, "lng": longitude}
        algorithm = data.get('algorithm', 'heap')  # 排序算法选择
        top_k = data.get('topK')  # 可选：只返回前K个最近的场所
        place_ids = data.get('placeIds', [])  # 可选：指定要排序的场所ID列表
        
        if not target_location:
            return jsonify({
                'success': False,
                'message': '目标位置不能为空'
            }), 400
        
        # 获取场所数据
        if place_ids:
            # 如果指定了场所ID，只对这些场所进行排序
            places_to_sort = [p for p in data_cache['places'] if p['id'] in place_ids]
        else:
            # 否则对所有场所进行排序
            places_to_sort = data_cache['places']
        
        if not places_to_sort:
            return jsonify({
                'success': True,
                'data': [],
                'algorithm': algorithm,
                'count': 0
            })
        
        # 使用堆排序算法按距离排序
        sorted_places = sorting_algo.sort_places_by_distance(
            places_to_sort, 
            target_location, 
            algorithm=algorithm,
            k=top_k
        )
        
        return jsonify({
            'success': True,
            'data': sorted_places,
            'algorithm': algorithm,
            'count': len(sorted_places),
            'total': len(places_to_sort),
            'target_location': target_location
        })
        
    except Exception as e:
        print(f"场所距离排序失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'距离排序失败: {str(e)}'
        }), 500


# ==================== 建筑物相关API ====================

@app.route('/api/buildings', methods=['GET'])
def get_buildings():
    """获取建筑物"""
    place_id = request.args.get('placeId')
    
    if place_id:
        buildings = [b for b in data_cache['buildings'] if b['placeId'] == place_id]
    else:
        buildings = data_cache['buildings']
    
    return jsonify({
        'success': True,
        'data': buildings
    })


@app.route('/api/buildings/search', methods=['GET'])
def search_buildings():
    """搜索建筑物"""
    query = request.args.get('query', '')
    place_id = request.args.get('placeId')
    
    results = search_algo.search_buildings(data_cache['buildings'], query, place_id)
    
    return jsonify({
        'success': True,
        'data': results
    })


# ==================== 设施相关API ====================

@app.route('/api/facilities', methods=['GET'])
def get_facilities():
    """获取设施"""
    place_id = request.args.get('placeId')
    facility_type = request.args.get('type')
    
    facilities = data_cache['facilities']
    
    if place_id:
        facilities = [f for f in facilities if f['placeId'] == place_id]
    
    if facility_type:
        facilities = [f for f in facilities if f['type'] == facility_type]
    
    return jsonify({
        'success': True,
        'data': facilities
    })


@app.route('/api/facilities/search', methods=['GET'])
def search_facilities():
    """搜索设施"""
    query = request.args.get('query', '')
    place_id = request.args.get('placeId')
    facility_type = request.args.get('type')
    
    results = search_algo.search_facilities(
        data_cache['facilities'], query, place_id, facility_type
    )
    
    return jsonify({
        'success': True,
        'data': results
    })


@app.route('/api/facilities/search-category', methods=['POST'])
def search_facility_category():
    """使用哈希查找算法搜索设施类型"""
    try:
        data = request.get_json()
        input_text = data.get('input', '').strip()
        
        # 使用哈希查找算法进行类型匹配
        result = facility_matcher.search_categories(input_text)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"设施类型搜索失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '搜索失败',
            'error': str(e)
        })


@app.route('/api/facilities/nearest', methods=['POST'])
def get_nearest_facilities():
    """获取距离指定建筑物最近的设施"""
    try:
        data = request.get_json()
        building_id = data.get('buildingId')
        place_id = data.get('placeId')
        facility_type = data.get('facilityType')  # 添加设施类型过滤
        
        if not building_id or not place_id:
            return jsonify({
                'success': False,
                'message': '缺少必要参数'
            })
        
        # 获取指定场所的设施，过滤掉路口类型
        facilities = [f for f in data_cache['facilities'] 
                     if f['placeId'] == place_id and f.get('type') != '路口']
        
        # 如果指定了设施类型，进行过滤
        if facility_type and facility_type != 'all':
            facilities = [f for f in facilities if f.get('type') == facility_type]
        
        if not facilities:
            return jsonify({
                'success': True,
                'data': [],
                'total': 0
            })
        
        # 使用最短路径算法计算距离
        from algorithms.shortest_path_algorithm import ShortestPathAlgorithm
        
        roads = data_cache['roads']
        path_algorithm = ShortestPathAlgorithm(roads, data_cache['places'], data_cache['buildings'])
        
        # 计算到每个设施的距离
        facility_distances = []
        
        for facility in facilities:
            facility_id = facility['id']
            
            # 使用最短距离策略（不考虑交通工具）
            path, distance = path_algorithm._dijkstra_distance_only(building_id, facility_id)
            
            if distance != float('inf'):
                facility_with_distance = facility.copy()
                facility_with_distance['distance'] = int(distance)
                facility_with_distance['path'] = path
                facility_distances.append(facility_with_distance)
        
        # 按距离排序
        facility_distances.sort(key=lambda x: x['distance'])
        
        # 返回所有可达的设施，不进行数量限制
        return jsonify({
            'success': True,
            'data': facility_distances,
            'total': len(facility_distances)
        })
        
    except Exception as e:
        print(f"查询最近设施失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': '查询失败'
        })


@app.route('/api/facilities/nearby', methods=['POST'])
def get_nearby_facilities():
    """获取附近设施"""
    data = request.get_json()
    location = data.get('location')
    facility_type = data.get('type')
    max_distance = data.get('maxDistance', 1000)
    algorithm = data.get('algorithm', 'heap')  # 新增：排序算法选择
    
    if not location:
        return jsonify({
            'success': False,
            'message': '位置信息不能为空'
        }), 400
    
    # 使用排序算法按距离排序
    facilities = data_cache['facilities']
    if facility_type:
        facilities = [f for f in facilities if f['type'] == facility_type]
    
    # 使用指定的排序算法
    sorted_facilities = sorting_algo.sort_facilities_by_distance(facilities, location, algorithm)
    
    return jsonify({
        'success': True,
        'data': sorted_facilities,
        'algorithm_used': algorithm
    })


# ==================== 路径规划API ====================

@app.route('/api/routes/single', methods=['POST'])
def plan_single_route():
    """单点到单点路径规划"""
    data = request.get_json()
    start = data.get('start')
    end = data.get('end')
    strategy = data.get('strategy', 'distance')  # 默认最短距离
    vehicle = data.get('vehicle')  # 用户选择的交通工具
    place_type = data.get('placeType', '景区')  # 场所类型，用于确定可用交通工具
    use_mixed_vehicles = data.get('useMixedVehicles', False)  # 是否使用混合交通工具
    
    if not start or not end:
        return jsonify({
            'success': False,
            'message': '起点和终点不能为空'
        }), 400
    
    if not path_algo:
        return jsonify({
            'success': False,
            'message': '路径算法未初始化'
        }), 500
    
    try:
        if strategy == 'distance':
            # 最短距离策略：不需要考虑交通工具
            path, cost = path_algo.find_shortest_path_with_strategy(start, end, 'distance', place_type=place_type)
            
            return jsonify({
                'success': True,
                'data': {
                    'path': path,
                    'total_distance': cost,
                    'total_time': None,
                    'strategy': 'distance',
                    'vehicle': '不限',
                    'detailed_info': path_algo.get_detailed_route_info(start, end, 'distance', place_type)
                }
            })
        
        elif strategy == 'time':
            # 最短时间策略：根据是否使用混合交通工具决定算法
            if use_mixed_vehicles or not vehicle:
                # 使用混合交通工具模式
                path_segments, total_time = path_algo.dijkstra_with_mixed_vehicles(start, end, place_type)
                
                if not path_segments:
                    return jsonify({
                        'success': False,
                        'message': '无法找到有效路径'
                    }), 400
                
                # 提取节点路径
                path = [start]
                for segment in path_segments:
                    path.append(segment['to'])
                
                # 计算总距离
                total_distance = sum(segment['distance'] for segment in path_segments)
                
                # 构建详细路径描述
                detailed_path = []
                for segment in path_segments:
                    detailed_path.append(
                        f"从 {segment['from']} 到 {segment['to']} "
                        f"(使用{segment['vehicle']}, "
                        f"距离{segment['distance']}米, "
                        f"时间{segment['time']:.1f}分钟)"
                    )
                
                detailed_info = {
                    'path': path,
                    'total_distance': total_distance,
                    'total_time': total_time,
                    'strategy': 'time',
                    'vehicle': '混合',
                    'detailed_path': detailed_path,
                    'segments': path_segments
                }
                
                return jsonify({
                    'success': True,
                    'data': {
                        'path': path,
                        'total_distance': total_distance,
                        'total_time': total_time,
                        'strategy': 'time',
                        'vehicle': '混合',
                        'available_vehicles': path_algo.get_available_vehicles_for_place(place_type),
                        'detailed_info': detailed_info
                    }
                })
            else:
                # 使用指定的单一交通工具
                path, total_time = path_algo.dijkstra(start, end, vehicle)
                
                if not path:
                    return jsonify({
                        'success': False,
                        'message': f'使用{vehicle}无法找到有效路径'
                    }), 400
                
                # 计算总距离
                total_distance = 0
                for i in range(len(path) - 1):
                    from_node = path[i]
                    to_node = path[i + 1]
                    if from_node in path_algo.graph and to_node in path_algo.graph[from_node]:
                        road = path_algo.graph[from_node][to_node]
                        total_distance += road.get('distance', 0)
                
                detailed_info = {
                    'path': path,
                    'total_distance': total_distance,
                    'total_time': total_time,
                    'strategy': 'time',
                    'vehicle': vehicle,
                    'detailed_path': [f"从 {path[i]} 到 {path[i+1]} (使用{vehicle})" for i in range(len(path)-1)],
                    'segments': []
                }
                
                return jsonify({
                    'success': True,
                    'data': {
                        'path': path,
                        'total_distance': total_distance,
                        'total_time': total_time,
                        'strategy': 'time',
                        'vehicle': vehicle,
                        'available_vehicles': path_algo.get_available_vehicles_for_place(place_type),
                        'detailed_info': detailed_info
                    }
                })
        
        else:
            return jsonify({
                'success': False,
                'message': '不支持的策略类型'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'路径规划失败: {str(e)}'
        }), 500


@app.route('/api/routes/multi', methods=['POST'])
def plan_multi_route():
    """多目标路径规划（只考虑最短距离）"""
    data = request.get_json()
    start = data.get('start')
    destinations = data.get('destinations', [])
    algorithm = data.get('algorithm', 'nearest_neighbor')
    
    if not start or not destinations:
        return jsonify({
            'success': False,
            'message': '起点和目标点不能为空'
        }), 400
    
    if not path_algo:
        return jsonify({
            'success': False,
            'message': '路径算法未初始化'
        }), 500
    
    try:
        # 多目标路径规划只考虑最短距离
        result = path_algo.multi_destination_route(start, destinations, algorithm)
        
        return jsonify({
            'success': True,
            'data': result,
            'message': '多目标路径规划完成（基于最短距离）'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'多目标路径规划失败: {str(e)}'
        }), 500


# ==================== 日记相关API ====================

@app.route('/api/diaries', methods=['GET'])
def get_diaries():
    """获取日记"""
    place_id = request.args.get('placeId')
    author_id = request.args.get('authorId')
    page = int(request.args.get('page', 1))
    page_size = int(request.args.get('pageSize', 10))
    
    diaries = data_cache['diaries']
    
    # 筛选
    if place_id:
        diaries = [d for d in diaries if d['placeId'] == place_id]
    
    if author_id:
        diaries = [d for d in diaries if d['authorId'] == author_id]
    
    # 排序（按创建时间倒序）
    diaries.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
    
    # 分页
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_diaries = diaries[start_idx:end_idx]
    
    return jsonify({
        'success': True,
        'data': {
            'diaries': paginated_diaries,
            'total': len(diaries),
            'page': page,
            'pageSize': page_size
        }
    })


@app.route('/api/diaries/<diary_id>', methods=['GET'])
def get_diary(diary_id):
    """获取特定日记"""
    # 找到原始日记在data_cache中的索引
    diary_index = None
    original_diary = None
    for i, d in enumerate(data_cache['diaries']):
        if d['id'] == diary_id:
            diary_index = i
            original_diary = d
            break
    
    if original_diary is None:
        return jsonify({
            'success': False,
            'message': '日记不存在'
        }), 404
    
    # 增加原始日记的点击量
    original_diary['clickCount'] = original_diary.get('clickCount', 0) + 1
    
    # 解压缩内容用于返回
    if 'compressedContent' in original_diary:
        decompressed_diary = compression_manager.decompress_diary(original_diary)
        # 确保解压缩后的日记也有更新的点击量
        decompressed_diary['clickCount'] = original_diary['clickCount']
    else:
        decompressed_diary = original_diary.copy()
    
    # 保存数据
    save_data('diaries')
    
    return jsonify({
        'success': True,
        'data': decompressed_diary
    })


@app.route('/api/diaries', methods=['POST'])
def create_diary():
    """创建日记"""
    data = request.get_json()
    
    # 生成新ID
    existing_ids = [int(d['id'].split('_')[1]) for d in data_cache['diaries'] if d['id'].startswith('diary_')]
    new_id = f"diary_{max(existing_ids) + 1:03d}" if existing_ids else "diary_001"
    
    diary = {
        'id': new_id,
        'title': data.get('title', ''),
        'content': data.get('content', ''),
        'placeId': data.get('placeId', ''),
        'authorId': data.get('authorId', ''),
        'clickCount': 0,
        'rating': data.get('rating', 0),
        'ratingCount': 1,  # 初始评分人数为1（作者）
        'createdAt': datetime.now().isoformat() + 'Z',
        'images': data.get('images', []),
        'videos': data.get('videos', []),
        'tags': data.get('tags', [])
    }
    
    # 压缩内容
    compressed_diary = compression_manager.compress_diary(diary)
    
    data_cache['diaries'].append(compressed_diary)
    save_data('diaries')
    
    # 🔧 添加缓存清除：确保新日记能被搜索到
    handle_diary_data_change('创建', diary)
    
    return jsonify({
        'success': True,
        'data': diary,
        'message': '日记创建成功'
    })


@app.route('/api/diaries/search', methods=['GET'])
def search_diaries():
    """搜索日记"""
    query = request.args.get('query', '')
    search_type = request.args.get('type', 'fulltext')
    
    if not query:
        return jsonify({
            'success': True,
            'data': data_cache['diaries']
        })
    
    # 先解压缩所有日记内容用于搜索
    decompressed_diaries = []
    for diary in data_cache['diaries']:
        if 'compressedContent' in diary:
            decompressed_diaries.append(compression_manager.decompress_diary(diary))
        else:
            decompressed_diaries.append(diary)
    
    # 如果是按目的地搜索
    if search_type == 'destination':
        results = []
        query_lower = query.lower()
        
        # 通过场所名称搜索
        for diary in decompressed_diaries:
            if diary.get('placeId'):
                # 找到对应的场所
                place = next((p for p in data_cache['places'] if p['id'] == diary['placeId']), None)
                if place and query_lower in place['name'].lower():
                    results.append(diary)
        
        # 按热度和评分排序
        results.sort(key=lambda x: (x.get('clickCount', 0), x.get('rating', 0)), reverse=True)
        
        return jsonify({
            'success': True,
            'data': results
        })
    
    # 如果是按名称精准搜索
    if search_type == 'title':
        # 使用哈希表进行O(1)精准查找
        results = search_algo.search_diary_by_title_hash(decompressed_diaries, query.strip())
        
        return jsonify({
            'success': True,
            'data': results,
            'search_method': 'hash_table_O1',
            'query': query.strip()
        })
    
    # 如果是内容搜索，只搜索content字段
    if search_type == 'content':
        results = search_algo.full_text_search(decompressed_diaries, query, 'content')
        return jsonify({
            'success': True,
            'data': results
        })
    
    # 原有的全文搜索逻辑（向后兼容）
    results = search_algo.search_diaries(decompressed_diaries, query, search_type)
    
    return jsonify({
        'success': True,
        'data': results
    })


@app.route('/api/diaries/recommend', methods=['POST'])
def recommend_diaries():
    """推荐日记"""
    data = request.get_json()
    user_id = data.get('userId')
    algorithm = data.get('algorithm', 'content')
    top_k = data.get('topK', 12)  # 支持指定返回数量，默认12个
    
    user = next((u for u in data_cache['users'] if u['id'] == user_id), None)
    if not user:
        return jsonify({
            'success': False,
            'message': '用户不存在'
        }), 404
    
    # 解压缩日记内容用于推荐
    decompressed_diaries = []
    for diary in data_cache['diaries']:
        if 'compressedContent' in diary:
            decompressed_diaries.append(compression_manager.decompress_diary(diary))
        else:
            decompressed_diaries.append(diary)
    
    recommendations = recommendation_algo.recommend_diaries(
        user, decompressed_diaries, data_cache['users'], algorithm, top_k
    )
    
    return jsonify({
        'success': True,
        'data': recommendations,
        'algorithm': algorithm,
        'count': len(recommendations)
    })


@app.route('/api/diaries/<diary_id>/user-rating/<user_id>', methods=['GET'])
def get_user_diary_rating(diary_id, user_id):
    """获取用户对特定日记的评分"""
    # 查找用户
    user = next((u for u in data_cache['users'] if u['id'] == user_id), None)
    if not user:
        return jsonify({
            'success': False,
            'message': '用户不存在'
        }), 404
    
    # 检查日记是否存在
    diary_exists = any(d['id'] == diary_id for d in data_cache['diaries'])
    if not diary_exists:
        return jsonify({
            'success': False,
            'message': '日记不存在'
        }), 404
    
    # 查找用户对该日记的评分
    user_rating = None
    diary_rating_history = user.get('diaryRatingHistory', [])
    for rating_record in diary_rating_history:
        if rating_record['diaryId'] == diary_id:
            user_rating = rating_record['rating']
            break
    
    return jsonify({
        'success': True,
        'data': {
            'userRating': user_rating,
            'hasRated': user_rating is not None
        }
    })


@app.route('/api/diaries/<diary_id>/rate', methods=['POST'])
def rate_diary(diary_id):
    """为日记评分"""
    data = request.get_json()
    rating = data.get('rating')
    user_id = data.get('userId')  # 添加用户ID
    
    if not rating or not isinstance(rating, (int, float)) or rating < 1 or rating > 5:
        return jsonify({
            'success': False,
            'message': '评分必须是1-5之间的数字'
        }), 400
    
    if not user_id:
        return jsonify({
            'success': False,
            'message': '用户ID不能为空'
        }), 400
    
    # 找到原始日记在data_cache中的索引
    diary_index = None
    original_diary = None
    for i, d in enumerate(data_cache['diaries']):
        if d['id'] == diary_id:
            diary_index = i
            original_diary = d
            break
    
    if not original_diary:
        return jsonify({
            'success': False,
            'message': '日记不存在'
        }), 404
    
    # 查找用户
    user_index = None
    for i, user in enumerate(data_cache['users']):
        if user['id'] == user_id:
            user_index = i
            break
    
    if user_index is None:
        return jsonify({
            'success': False,
            'message': '用户不存在'
        }), 404
    
    # 计算新的平均评分
    current_rating = original_diary.get('rating', 0)
    current_count = original_diary.get('ratingCount', 1)
    
    # 新平均分 = (当前平均分 × 当前评价人数 + 新评分) / (当前评价人数 + 1)
    new_rating = (current_rating * current_count + rating) / (current_count + 1)
    new_count = current_count + 1
    
    # 更新原始日记的评分信息
    original_diary['rating'] = round(new_rating, 1)
    original_diary['ratingCount'] = new_count
    
    # 更新用户日记评分历史
    user = data_cache['users'][user_index]
    if 'diaryRatingHistory' not in user:
        user['diaryRatingHistory'] = []
    
    # 检查用户是否已经评分过这个日记
    existing_rating = None
    for i, rating_record in enumerate(user['diaryRatingHistory']):
        if rating_record['diaryId'] == diary_id:
            existing_rating = i
            break
    
    from datetime import datetime
    rating_record = {
        'diaryId': diary_id,
        'rating': rating,
        'date': datetime.now().isoformat() + 'Z'
    }
    
    if existing_rating is not None:
        # 更新现有评分
        user['diaryRatingHistory'][existing_rating] = rating_record
        message = '评分已更新'
    else:
        # 添加新评分
        user['diaryRatingHistory'].append(rating_record)
        message = '评分成功'
    
    # 保存数据
    save_data('diaries')
    save_data('users')
    
    # 返回更新后的评分信息
    return jsonify({
        'success': True,
        'data': {
            'rating': original_diary['rating'],
            'ratingCount': original_diary['ratingCount'],
            'userRating': rating
        },
        'message': message
    })


@app.route('/api/diaries/<diary_id>', methods=['PUT'])
def update_diary(diary_id):
    """更新日记"""
    data = request.get_json()
    
    # 找到原始日记在data_cache中的索引
    diary_index = None
    original_diary = None
    for i, d in enumerate(data_cache['diaries']):
        if d['id'] == diary_id:
            diary_index = i
            original_diary = d
            break
    
    if not original_diary:
        return jsonify({
            'success': False,
            'message': '日记不存在'
        }), 404
    
    # 更新日记信息
    if 'title' in data:
        original_diary['title'] = data['title']
    if 'content' in data:
        original_diary['content'] = data['content']
    if 'placeId' in data:
        original_diary['placeId'] = data['placeId']
    if 'tags' in data:
        original_diary['tags'] = data['tags']
    
    # 更新修改时间
    original_diary['updatedAt'] = datetime.now().isoformat() + 'Z'
    
    # 如果有压缩内容，需要重新压缩
    if 'compressedContent' in original_diary:
        # 先删除压缩内容，让压缩管理器重新压缩
        del original_diary['compressedContent']
        compressed_diary = compression_manager.compress_diary(original_diary)
        data_cache['diaries'][diary_index] = compressed_diary
    
    # 保存数据
    save_data('diaries')
    
    # 🔧 添加缓存清除：确保更新后的日记标题能被正确搜索
    handle_diary_data_change('更新', original_diary)
    
    # 返回解压缩后的日记用于显示
    if 'compressedContent' in data_cache['diaries'][diary_index]:
        decompressed_diary = compression_manager.decompress_diary(data_cache['diaries'][diary_index])
    else:
        decompressed_diary = data_cache['diaries'][diary_index]
    
    return jsonify({
        'success': True,
        'data': decompressed_diary,
        'message': '日记更新成功'
    })


@app.route('/api/diaries/<diary_id>', methods=['DELETE'])
def delete_diary(diary_id):
    """删除日记"""
    # 找到原始日记在data_cache中的索引
    diary_index = None
    for i, d in enumerate(data_cache['diaries']):
        if d['id'] == diary_id:
            diary_index = i
            break
    
    if diary_index is None:
        return jsonify({
            'success': False,
            'message': '日记不存在'
        }), 404
    
    # 删除日记
    deleted_diary = data_cache['diaries'].pop(diary_index)
    
    # 保存数据
    save_data('diaries')
    
    # 🔧 添加缓存清除：确保删除的日记不会在搜索结果中出现
    handle_diary_data_change('删除', deleted_diary)
    
    return jsonify({
        'success': True,
        'message': '日记删除成功',
        'data': {
            'deletedId': diary_id,
            'deletedTitle': deleted_diary.get('title', '未知标题')
        }
    })


@app.route('/api/diaries/sort', methods=['POST'])
def sort_diaries():
    """日记归并排序API - 按浏览量或评分排序"""
    try:
        data = request.get_json()
        sort_type = data.get('sortType', 'views')  # 排序类型：views(浏览量), rating(评分), multi(多键排序)
        diary_ids = data.get('diaryIds', [])  # 可选：指定要排序的日记ID列表
        primary_key = data.get('primaryKey', 'rating')  # 多键排序的主键
        secondary_key = data.get('secondaryKey', 'clickCount')  # 多键排序的次键
        reverse = data.get('reverse', True)  # 是否降序排列，默认True
        
        # 获取日记数据
        if diary_ids:
            # 如果指定了日记ID，只对这些日记进行排序
            diaries_to_sort = [d for d in data_cache['diaries'] if d['id'] in diary_ids]
        else:
            # 否则对所有日记进行排序
            diaries_to_sort = data_cache['diaries']
        
        if not diaries_to_sort:
            return jsonify({
                'success': True,
                'data': [],
                'sortType': sort_type,
                'count': 0,
                'algorithm': 'merge_sort'
            })
        
        # 解压缩日记内容（如果有压缩）
        decompressed_diaries = []
        for diary in diaries_to_sort:
            if 'compressedContent' in diary:
                decompressed_diaries.append(compression_manager.decompress_diary(diary))
            else:
                decompressed_diaries.append(diary.copy())
        
        # 根据排序类型选择归并排序算法
        if sort_type == 'views':
            sorted_diaries = sorting_algo.merge_sort_by_views(decompressed_diaries, reverse)
            algorithm_used = 'merge_sort_by_views'
        elif sort_type == 'rating':
            sorted_diaries = sorting_algo.merge_sort_by_rating(decompressed_diaries, reverse)
            algorithm_used = 'merge_sort_by_rating'
        elif sort_type == 'multi':
            sorted_diaries = sorting_algo.merge_sort_multi_key(
                decompressed_diaries, 
                primary_key=primary_key, 
                secondary_key=secondary_key, 
                reverse=reverse
            )
            algorithm_used = 'merge_sort_multi_key'
        else:
            return jsonify({
                'success': False,
                'message': f'不支持的排序类型: {sort_type}。支持的类型: views, rating, multi'
            }), 400
        
        return jsonify({
            'success': True,
            'data': sorted_diaries,
            'sortType': sort_type,
            'algorithm': algorithm_used,
            'count': len(sorted_diaries),
            'total': len(diaries_to_sort),
            'reverse': reverse,
            'primaryKey': primary_key if sort_type == 'multi' else None,
            'secondaryKey': secondary_key if sort_type == 'multi' else None
        })
        
    except Exception as e:
        print(f"日记归并排序失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'排序失败: {str(e)}'
        }), 500


@app.route('/api/places/sort-merge', methods=['POST'])
def sort_places_merge():
    """场所归并排序API - 按热度或评分排序"""
    try:
        data = request.get_json()
        sort_type = data.get('sortType', 'popularity')  # 排序类型：popularity(热度), rating(评分)
        place_ids = data.get('placeIds', [])  # 可选：指定要排序的场所ID列表
        reverse = data.get('reverse', True)  # 是否降序排列，默认True
        
        # 获取场所数据
        if place_ids:
            # 如果指定了场所ID，只对这些场所进行排序
            places_to_sort = [p for p in data_cache['places'] if p['id'] in place_ids]
        else:
            # 否则对所有场所进行排序
            places_to_sort = data_cache['places']
        
        if not places_to_sort:
            return jsonify({
                'success': True,
                'data': [],
                'sortType': sort_type,
                'count': 0,
                'algorithm': 'merge_sort'
            })
        
        # 根据排序类型选择归并排序算法
        if sort_type == 'popularity':
            sorted_places = sorting_algo.merge_sort_places_by_popularity(places_to_sort, reverse)
            algorithm_used = 'merge_sort_places_by_popularity'
        elif sort_type == 'rating':
            sorted_places = sorting_algo.merge_sort_places_by_rating(places_to_sort, reverse)
            algorithm_used = 'merge_sort_places_by_rating'
        else:
            return jsonify({
                'success': False,
                'message': f'不支持的排序类型: {sort_type}。支持的类型: popularity, rating'
            }), 400
        
        return jsonify({
            'success': True,
            'data': sorted_places,
            'sortType': sort_type,
            'algorithm': algorithm_used,
            'count': len(sorted_places),
            'total': len(places_to_sort),
            'reverse': reverse
        })
        
    except Exception as e:
        print(f"场所归并排序失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'排序失败: {str(e)}'
        }), 500


# ==================== 文件上传API ====================

@app.route('/api/upload/image', methods=['POST'])
def upload_image():
    """上传图片"""
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'message': '没有文件'
        }), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({
            'success': False,
            'message': '没有选择文件'
        }), 400
    
    if not allowed_file(file.filename, 'image'):
        return jsonify({
            'success': False,
            'message': '不支持的图片格式'
        }), 400
    
    # 检查文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > 5 * 1024 * 1024:  # 5MB
        return jsonify({
            'success': False,
            'message': '图片文件过大，最大支持5MB'
        }), 400
    
    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
    filename = timestamp + filename
    
    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], 'images', filename)
    os.makedirs(os.path.dirname(upload_path), exist_ok=True)
    
    file.save(upload_path)
    
    return jsonify({
        'success': True,
        'data': {
            'filename': filename,
            'path': f'uploads/images/{filename}',
            'size': file_size
        },
        'message': '图片上传成功'
    })


@app.route('/api/upload/video', methods=['POST'])
def upload_video():
    """上传视频"""
    if 'file' not in request.files:
        return jsonify({
            'success': False,
            'message': '没有文件'
        }), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({
            'success': False,
            'message': '没有选择文件'
        }), 400
    
    if not allowed_file(file.filename, 'video'):
        return jsonify({
            'success': False,
            'message': '不支持的视频格式'
        }), 400
    
    # 检查文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > 50 * 1024 * 1024:  # 50MB
        return jsonify({
            'success': False,
            'message': '视频文件过大，最大支持50MB'
        }), 400
    
    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
    filename = timestamp + filename
    
    upload_path = os.path.join(app.config['UPLOAD_FOLDER'], 'videos', filename)
    os.makedirs(os.path.dirname(upload_path), exist_ok=True)
    
    file.save(upload_path)
    
    return jsonify({
        'success': True,
        'data': {
            'filename': filename,
            'path': f'uploads/videos/{filename}',
            'size': file_size
        },
        'message': '视频上传成功'
    })


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    """提供上传文件的访问"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# ==================== AIGC相关API ====================

@app.route('/api/aigc/convert-to-video', methods=['POST'])
def convert_images_to_video():
    """将多张图片转换为视频"""
    try:
        import cv2
        import numpy as np
        
        data = request.get_json()
        image_paths = data.get('imagePaths', [])
        output_format = data.get('outputFormat', 'mp4')
        fps = data.get('fps', 30)
        width = data.get('width', 480)
        height = data.get('height', 848)
        
        if not image_paths:
            return jsonify({
                'success': False,
                'message': '没有提供图片路径'
            }), 400
        
        # 创建输出目录
        output_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'videos')
        os.makedirs(output_dir, exist_ok=True)
        
        # 生成输出文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f'aigc_video_{timestamp}.{output_format}'
        output_path = os.path.join(output_dir, output_filename)
        
        # 设置视频编码器 - 尝试多种编码器以确保兼容性
        fourcc_options = [
            cv2.VideoWriter_fourcc(*'avc1'),  # H.264 (最兼容)
            cv2.VideoWriter_fourcc(*'H264'),  # H.264 备用
            cv2.VideoWriter_fourcc(*'XVID'),  # XVID 备用
            cv2.VideoWriter_fourcc(*'mp4v'),  # MP4V 备用
        ]
        
        video_writer = None
        for fourcc in fourcc_options:
            video_writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            if video_writer.isOpened():
                print(f"使用编码器: {fourcc}")
                break
            video_writer.release()
        
        if not video_writer or not video_writer.isOpened():
            return jsonify({
                'success': False,
                'message': '无法创建视频文件，所有编码器都不可用'
            }), 500
        
        # 处理每张图片
        for image_path in image_paths:
            # 构建完整的文件路径
            full_image_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), image_path)
            
            if not os.path.exists(full_image_path):
                print(f"警告: 图片文件不存在: {full_image_path}")
                continue
            
            # 读取图片
            img = cv2.imread(full_image_path)
            if img is None:
                print(f"警告: 无法读取图片: {full_image_path}")
                continue
            
            print(f"原始图片尺寸: {img.shape[1]} x {img.shape[0]} (宽x高)")
            
            # 调整图片尺寸到指定分辨率
            resized_img = cv2.resize(img, (width, height), interpolation=cv2.INTER_LINEAR)
            
            print(f"调整后图片尺寸: {resized_img.shape[1]} x {resized_img.shape[0]} (宽x高)")
            print(f"目标尺寸: {width} x {height} (宽x高)")
            
            # 每张图片写入30帧（1秒）
            for _ in range(fps):
                video_writer.write(resized_img)
        
        # 释放资源
        video_writer.release()
        
        # 检查输出文件是否创建成功
        if not os.path.exists(output_path):
            return jsonify({
                'success': False,
                'message': '视频文件创建失败'
            }), 500
        
        # 获取文件大小
        file_size = os.path.getsize(output_path)
        
        return jsonify({
            'success': True,
            'data': {
                'videoPath': f'uploads/videos/{output_filename}',
                'filename': output_filename,
                'size': file_size,
                'duration': len(image_paths),  # 秒数
                'resolution': f'{width}x{height}',
                'fps': fps
            },
            'message': '视频转换成功'
        })
        
    except ImportError:
        return jsonify({
            'success': False,
            'message': 'OpenCV库未安装，请安装opencv-python'
        }), 500
    except Exception as e:
        print(f"视频转换失败: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'视频转换失败: {str(e)}'
        }), 500


# ==================== 统计API ====================

@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """获取系统统计信息"""
    # 获取智能压缩统计信息
    compression_stats = compression_manager.calculate_real_compression_statistics(data_cache['diaries'])
    
    stats = {
        'users': len(data_cache['users']),
        'places': len(data_cache['places']),
        'buildings': len(data_cache['buildings']),
        'facilities': len(data_cache['facilities']),
        'diaries': len(data_cache['diaries']),
        'roads': len(data_cache['roads']),
        'compression_stats': {
            'compressed_files': compression_stats['real_compressed_files'],
            'compression_ratio': round(compression_stats['compression_ratio'], 1),
            'total_original_size': compression_stats['total_original_size'],
            'total_compressed_size': compression_stats['total_compressed_size']
        }
    }
    
    return jsonify({
        'success': True,
        'data': stats
    })


# ==================== 美食相关API ====================

@app.route('/api/foods', methods=['GET'])
def get_foods():
    """获取美食列表"""
    try:
        place_id = request.args.get('placeId')
        cuisine = request.args.get('cuisine')  # 菜系过滤
        search = request.args.get('search')    # 搜索关键词
        sort_by = request.args.get('sortBy', 'popularity')  # 排序方式，默认按热度
        limit = int(request.args.get('limit', 12))  # 限制返回数量，默认12个
        
        # 新增搜索参数
        search_mode = request.args.get('searchMode', 'advanced')  # 'simple' 或 'advanced'
        threshold = float(request.args.get('threshold', 0.3))     # 相似度阈值
        
        # 读取美食数据
        with open('data/foods.json', 'r', encoding='utf-8') as f:
            foods = json.load(f)
        
        # 按场所过滤
        if place_id:
            foods = [food for food in foods if food['placeId'] == place_id]
        
        # 按菜系过滤
        if cuisine:
            foods = [food for food in foods if food['cuisine'] == cuisine]
        
        # 高级模糊搜索
        if search:
            if search_mode == 'advanced':
                # 使用高级模糊搜索算法
                search_algo = SearchAlgorithm()
                foods = search_algo.fuzzy_search(
                    foods, 
                    search, 
                    search_fields=['name', 'description', 'cuisine'],
                    threshold=threshold
                )
                print(f"高级搜索 '{search}': 找到 {len(foods)} 个结果 (阈值: {threshold})")
            else:
                # 保持简单搜索作为备选
                search_lower = search.lower()
                foods = [food for food in foods if search_lower in food['name'].lower()]
                print(f"简单搜索 '{search}': 找到 {len(foods)} 个结果")
        
        # 保存过滤后的总数
        total_count = len(foods)
        
        # 排序 - 使用部分排序算法获取前K个
        if sort_by == 'popularity':
            # 使用快速选择算法
            foods = partial_sort_by_popularity(foods, limit)
        
        return jsonify({
            'success': True,
            'data': foods[:limit],
            'total': total_count,
            'searchInfo': {
                'mode': search_mode,
                'threshold': threshold,
                'query': search
            } if search else None
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

def partial_sort_by_popularity(foods, k):
    """
    Top-K算法：使用快速选择(QuickSelect)找出前k个最热门的美食
    平均时间复杂度：O(n)，最坏情况：O(n²)，但实际表现很好
    空间复杂度：O(1)
    """
    if len(foods) <= k:
        return sorted(foods, key=lambda x: x['popularity'], reverse=True)
    
    # 创建副本避免修改原数据
    foods_copy = foods.copy()
    
    def quickselect_top_k(arr, k):
        """快速选择算法找前k个最大值"""
        if k >= len(arr):
            return sorted(arr, key=lambda x: x['popularity'], reverse=True)
        
        def partition(low, high):
            """分区函数，以最后一个元素为基准"""
            pivot_popularity = arr[high]['popularity']
            i = low - 1
            
            for j in range(low, high):
                # 降序排列：如果当前元素比基准大，则交换
                if arr[j]['popularity'] >= pivot_popularity:
                    i += 1
                    arr[i], arr[j] = arr[j], arr[i]
            
            arr[i + 1], arr[high] = arr[high], arr[i + 1]
            return i + 1
        
        def quickselect(low, high, k):
            """快速选择递归函数"""
            if low < high:
                pi = partition(low, high)
                
                if pi == k - 1:
                    # 找到了第k个位置，前k个就是我们要的
                    return
                elif pi > k - 1:
                    # 第k个在左半部分
                    quickselect(low, pi - 1, k)
                else:
                    # 第k个在右半部分
                    quickselect(pi + 1, high, k)
        
        arr = arr.copy()
        quickselect(0, len(arr) - 1, k)
        
        # 返回前k个元素，并对这k个元素进行排序
        top_k = arr[:k]
        return sorted(top_k, key=lambda x: x['popularity'], reverse=True)
    
    return quickselect_top_k(foods_copy, k)

@app.route('/api/foods/cuisines', methods=['GET'])
def get_cuisines():
    """获取所有菜系类型"""
    try:
        with open('data/foods.json', 'r', encoding='utf-8') as f:
            foods = json.load(f)
        
        cuisines = list(set(food['cuisine'] for food in foods))
        
        return jsonify({
            'success': True,
            'data': cuisines
        })
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== 室内导航相关API ====================

@app.route('/api/indoor/building', methods=['GET'])
def get_building_info():
    """获取建筑物信息"""
    if not indoor_nav_algo:
        return jsonify({
            'success': False,
            'message': '室内导航系统未初始化'
        }), 500
    
    building_info = indoor_nav_algo.get_building_info()
    
    return jsonify({
        'success': True,
        'data': building_info
    })


@app.route('/api/indoor/rooms', methods=['GET'])
def get_all_rooms():
    """获取所有房间信息"""
    if not indoor_nav_algo:
        return jsonify({
            'success': False,
            'message': '室内导航系统未初始化'
        }), 500
    
    floor = request.args.get('floor', type=int)
    
    if floor:
        rooms = indoor_nav_algo.get_floor_rooms(floor)
    else:
        rooms = indoor_nav_algo.get_all_rooms()
    
    return jsonify({
        'success': True,
        'data': rooms
    })


@app.route('/api/indoor/navigate', methods=['POST'])
def indoor_navigate():
    """室内导航API"""
    try:
        data = request.get_json()
        room_id = data.get('roomId')
        avoid_congestion = data.get('avoidCongestion', True)
        use_time_weight = data.get('useTimeWeight', True)  # 新增参数
        
        if not room_id:
            return jsonify({
                'success': False,
                'message': '请提供房间ID'
            }), 400
        
        # 使用室内导航算法
        navigator = IndoorNavigationAlgorithm('data/indoor_navigation.json')
        result = navigator.navigate_to_room(room_id, avoid_congestion, use_time_weight)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'导航计算失败: {str(e)}'
        }), 500


# ==================== 错误处理 ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'message': '接口不存在'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': '服务器内部错误'
    }), 500


@app.route('/api/diaries/search-title-hash', methods=['POST'])
def search_diaries_title_hash():
    """使用哈希表优化的日记标题查找API"""
    data = request.get_json()
    query = data.get('query', '').strip()
    search_mode = data.get('mode', 'exact')  # exact: 精准查找, fuzzy: 模糊查找
    use_cache = data.get('useCache', True)
    
    if not query:
        return jsonify({
            'success': False,
            'message': '查询字符串不能为空'
        }), 400
    
    # 解压缩日记内容
    decompressed_diaries = []
    for diary in data_cache['diaries']:
        if 'compressedContent' in diary:
            decompressed_diaries.append(compression_manager.decompress_diary(diary))
        else:
            decompressed_diaries.append(diary)
    
    import time
    start_time = time.time()
    
    if search_mode == 'exact':
        # 精准查找 - O(1)时间复杂度
        results = search_algo.search_diary_by_title_hash(decompressed_diaries, query, use_cache)
        search_method = 'Hash Table Exact Search (O(1))'
    else:
        # 模糊查找 - 基于哈希表的优化模糊查找
        results = search_algo.search_diary_by_title_hash_fuzzy(decompressed_diaries, query, use_cache)
        search_method = 'Hash Table Fuzzy Search'
    
    end_time = time.time()
    search_time = round((end_time - start_time) * 1000, 4)  # 转换为毫秒
    
    return jsonify({
        'success': True,
        'data': results,
        'meta': {
            'query': query,
            'search_mode': search_mode,
            'search_method': search_method,
            'use_cache': use_cache,
            'search_time_ms': search_time,
            'total_results': len(results),
            'total_diaries': len(decompressed_diaries)
        }
    })


if __name__ == '__main__':
    # 清理端口5001上的进程
    clear_port(5001)
    
    # 启动时加载数据
    load_data()
    
    print("旅游系统后端服务启动中...")
    print("API文档: http://localhost:5001/api/")
    print("已启用多线程支持，可处理并发请求")
    
    app.run(debug=True, host='0.0.0.0', port=5001, threaded=True) 