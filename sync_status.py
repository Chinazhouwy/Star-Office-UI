#!/usr/bin/env python3
"""
OpenClaw 状态同步脚本
将 OpenClaw 的工作状态同步到 Star Office UI
"""
import os
import sys
import json
import time
import requests
from datetime import datetime

# 配置
OFFICE_API = os.environ.get('OFFICE_API', 'http://localhost:18888')
TOKEN = os.environ.get('OFFICE_TOKEN', 'ho5pYTw05HORrrl0hDF2Jg==')
STATE_FILE = '/root/.openclaw/workspace/star-office-ui/state.json'
MEMORY_DIR = '/root/.openclaw/workspace/memory'

# 状态映射：OpenClaw 状态 -> Star Office 状态
STATUS_MAP = {
    'idle': 'idle',
    'thinking': 'researching',
    'executing': 'executing',
    'executing_tool': 'executing',
    'writing': 'writing',
    'reading': 'researching',
    'error': 'error',
}

def get_current_status():
    """获取 OpenClaw 当前状态"""
    # 读取 state.json
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    return {'status': 'idle', 'message': 'Ready'}

def update_office_status(status, message=''):
    """更新 Star Office UI 状态"""
    url = f"{OFFICE_API}/set_state_get"
    params = {
        'token': TOKEN,
        'status': status,
        'message': message
    }
    try:
        resp = requests.get(url, params=params, timeout=5)
        if resp.status_code == 200:
            print(f"✅ 状态已更新: {status} - {message}")
            return True
        else:
            print(f"❌ 更新失败: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        return False

def main():
    """主函数"""
    if len(sys.argv) > 1:
        # 命令行参数指定状态
        status = sys.argv[1]
        message = sys.argv[2] if len(sys.argv) > 2 else ''
        update_office_status(status, message)
    else:
        # 自动检测状态
        state = get_current_status()
        update_office_status(state.get('status', 'idle'), state.get('message', ''))

if __name__ == '__main__':
    main()