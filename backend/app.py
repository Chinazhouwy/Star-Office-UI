"""
Star Office UI Backend - 带 Token 验证
"""
import os
import json
import glob
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='../frontend')
CORS(app)

# ====== 配置 ======
PORT = 18888
TOKEN = os.environ.get('OFFICE_TOKEN', 'ho5pYTw05HORrrl0hDF2Jg==')  # 登录密码
STATE_FILE = os.path.join(os.path.dirname(__file__), '..', 'state.json')
MEMORY_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'memory')

# ====== Token 验证装饰器 ======
def require_token(f):
    """Token 验证装饰器"""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('X-Token') or request.args.get('token')
        if token != TOKEN:
            return jsonify({'error': 'Unauthorized', 'message': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated

# ====== 状态管理 ======
def load_state():
    """加载状态"""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'status': 'idle', 'message': 'Ready', 'last_update': datetime.now().isoformat()}

def save_state(data):
    """保存状态"""
    data['last_update'] = datetime.now().isoformat()
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ====== 昨日小记 ======
def get_yesterday_memo():
    """读取昨日记忆"""
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 尝试读取昨日和今日的 memory 文件
    for date in [yesterday, today]:
        memory_file = os.path.join(MEMORY_DIR, f'{date}.md')
        if os.path.exists(memory_file):
            try:
                with open(memory_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # 简单脱敏处理
                    content = content.replace('USER.md', '用户')
                    # 只返回前 500 字符
                    return content[:500] + '...' if len(content) > 500 else content
            except:
                pass
    return '暂无记录'

# ====== API 接口 ======

@app.route('/health')
def health():
    """健康检查"""
    return jsonify({'status': 'ok', 'time': datetime.now().isoformat()})

@app.route('/status')
def get_status():
    """获取主 Agent 状态"""
    return jsonify(load_state())

@app.route('/set_state', methods=['POST'])
@require_token
def set_state():
    """设置主 Agent 状态"""
    data = request.json or {}
    state = load_state()
    
    if 'status' in data:
        state['status'] = data['status']
    if 'message' in data:
        state['message'] = data['message']
    
    save_state(state)
    return jsonify({'success': True, 'state': state})

# 简化版 set_state（支持 GET）
@app.route('/set_state_get')
def set_state_get():
    """通过 GET 设置状态（带 token 参数）"""
    status = request.args.get('status', 'idle')
    message = request.args.get('message', '')
    token = request.args.get('token', '')
    
    if token != TOKEN:
        return jsonify({'error': 'Unauthorized'}), 401
    
    state = load_state()
    state['status'] = status
    state['message'] = message
    save_state(state)
    return jsonify({'success': True, 'state': state})

@app.route('/yesterday_memo')
def yesterday_memo():
    """昨日小记"""
    return jsonify({'memo': get_yesterday_memo()})

# ====== 前端静态文件 ======
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('../frontend', filename)

# ====== 多 Agent 接口（简化版）======
@app.route('/agents')
@require_token
def get_agents():
    return jsonify([])

@app.route('/join-agent', methods=['POST'])
@require_token
def join_agent():
    return jsonify({'success': True})

@app.route('/agent-push', methods=['POST'])
@require_token
def agent_push():
    return jsonify({'success': True})

@app.route('/leave-agent', methods=['POST'])
@require_token
def leave_agent():
    return jsonify({'success': True})

# ====== 主程序 ======
if __name__ == '__main__':
    # 创建状态文件（如果不存在）
    if not os.path.exists(STATE_FILE):
        save_state({'status': 'idle', 'message': 'Ready'})
    
    print(f"🌟 Star Office UI 后端启动中...")
    print(f"   端口: {PORT}")
    print(f"   Token: {TOKEN}")
    print(f"   访问: http://localhost:{PORT}")
    print(f"   公网访问: https://zhouwy.top/office (需配置nginx)")
    
    app.run(host='0.0.0.0', port=PORT, debug=False)