/**
 * Star Office UI - 前端脚本
 */

const API_BASE = '';

// ============== 工具函数 ==============
function getToken() {
  return localStorage.getItem('star_token');
}

function getUser() {
  const user = localStorage.getItem('star_user');
  return user ? JSON.parse(user) : null;
}

async function apiCall(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(API_BASE + url, {
    ...options,
    headers,
    credentials: 'include'
  });
  
  const data = await res.json();
  
  if (res.status === 401 && data.code === 'UNAUTHORIZED') {
    alert('登录已过期，请重新登录');
    logout();
    throw new Error('Unauthorized');
  }
  
  return data;
}

// ============== 认证相关 ==============
async function checkAuth() {
  const user = getUser();
  if (!user) {
    window.location.href = '/';
    return false;
  }
  document.getElementById('currentUser').textContent = user.username || 'Admin';
  return true;
}

async function logout() {
  try {
    await apiCall('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  localStorage.removeItem('star_token');
  localStorage.removeItem('star_user');
  window.location.href = '/';
}

// ============== 导航 ==============
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    // 更新页面显示
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    
    // 加载页面数据
    loadPageData(page);
  });
});

async function loadPageData(page) {
  switch(page) {
    case 'overview':
      loadOverview();
      break;
    case 'status':
      loadOpenClawStatus();
      loadSessions();
      break;
    case 'robots':
      loadRobots();
      break;
    case 'agents':
      // 页面保持静态
      break;
    case 'tasks':
      loadTasks();
      break;
    case 'settings':
      // 页面保持静态
      break;
  }
}

// ============== 概览页面 ==============
async function loadOverview() {
  try {
    // 加载资源信息
    const res = await apiCall('/api/system/resources');
    if (res.success && res.data) {
      const memMatch = res.data.memory.match(/Mem:\s+(\d+)\s+(\d+)/);
      const cpuMatch = res.data.cpu.match(/(\d+\.\d+)\s*us/);
      const diskMatch = res.data.disk.match(/(\d+)%/);
      const upMatch = res.data.uptime.match(/up\s+(.+?,\s*\d+:\d+)/);
      
      if (memMatch) {
        const used = memMatch[2];
        const total = memMatch[1];
        const pct = Math.round(used / total * 100);
        document.getElementById('memUsage').textContent = pct + '%';
      }
      
      if (cpuMatch) {
        document.getElementById('cpuUsage').textContent = cpuMatch[1] + '%';
        document.getElementById('statCPU').textContent = cpuMatch[1] + '%';
      }
      
      if (diskMatch) {
        document.getElementById('diskUsage').textContent = diskMatch[1] + '%';
      }
      
      if (upMatch) {
        document.getElementById('uptime').textContent = upMatch[1].trim();
      }
    }
    
    // 加载任务数据
    const tasksRes = await apiCall('/api/openclaw/tasks');
    if (tasksRes.success) {
      const taskCount = (tasksRes.data || '').split('\n').filter(t => t.trim()).length;
      document.getElementById('statTasks').textContent = taskCount || '0';
    }
    
    // 机器人数量（会话数）
    const sessionsRes = await apiCall('/api/openclaw/sessions');
    if (sessionsRes.success) {
      const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
      document.getElementById('statRobots').textContent = sessions.length;
    }
    
  } catch (e) {
    console.error('加载概览数据失败:', e);
  }
}

// ============== 系统状态 ==============
async function loadOpenClawStatus() {
  const el = document.getElementById('openclawStatus');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  
  try {
    const res = await apiCall('/api/openclaw/status');
    if (res.success) {
      el.textContent = res.data.raw || '状态获取成功';
    } else {
      el.textContent = '获取失败: ' + res.error;
    }
  } catch (e) {
    el.textContent = '网络错误: ' + e.message;
  }
}

async function loadSessions() {
  const el = document.getElementById('sessionsList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  
  try {
    const res = await apiCall('/api/openclaw/sessions');
    if (res.success) {
      const sessions = res.data;
      if (Array.isArray(sessions) && sessions.length > 0) {
        let html = '<table class="data-table"><thead><tr><th>会话ID</th><th>名称</th><th>状态</th><th>模型</th></tr></thead><tbody>';
        sessions.forEach(s => {
          html += `<tr>
            <td>${s.sessionKey || s.id || '-'}</td>
            <td>${s.label || '-'}</td>
            <td><span class="status-badge running">运行中</span></td>
            <td>${s.model || '-'}</td>
          </tr>`;
        });
        html += '</tbody></table>';
        el.innerHTML = html;
      } else {
        el.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无会话</p>';
      }
    } else {
      el.innerHTML = '<p style="color: red;">获取失败: ' + res.error + '</p>';
    }
  } catch (e) {
    el.innerHTML = '<p style="color: red;">网络错误: ' + e.message + '</p>';
  }
}

// ============== 机器人管理 ==============
async function loadRobots() {
  const el = document.getElementById('robotsList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  
  try {
    const res = await apiCall('/api/robots/list');
    if (res.success) {
      let html = '<table class="data-table"><thead><tr><th>名称</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      html += '<tr><td>Main Agent</td><td><span class="status-badge running">运行中</span></td><td>-</td></tr>';
      html += '</tbody></table>';
      el.innerHTML = html;
    }
  } catch (e) {
    el.innerHTML = '<p style="color: red;">加载失败</p>';
  }
}

function showCreateRobot() {
  document.getElementById('createRobotModal').classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

async function createRobot() {
  const name = document.getElementById('robotName').value;
  const model = document.getElementById('robotModel').value;
  const desc = document.getElementById('robotDesc').value;
  
  if (!name) {
    alert('请输入机器人名称');
    return;
  }
  
  try {
    const res = await apiCall('/api/robots/create', {
      method: 'POST',
      body: JSON.stringify({ name, model, description: desc })
    });
    
    if (res.success) {
      alert('机器人创建成功！');
      closeModal('createRobotModal');
      loadRobots();
    } else {
      alert('创建失败: ' + res.error);
    }
  } catch (e) {
    alert('网络错误: ' + e.message);
  }
}

// ============== 多智能体 ==============
function showSpawnAgent() {
  document.querySelectorAll('.nav-item')[3].click();
}

async function spawnAgent() {
  const task = document.getElementById('agentTask').value;
  const agentId = document.getElementById('agentSelect').value;
  const model = document.getElementById('modelSelect').value;
  
  if (!task) {
    alert('请输入任务描述');
    return;
  }
  
  const outputEl = document.getElementById('agentOutput');
  outputEl.textContent = '正在执行...';
  
  try {
    const res = await apiCall('/api/agents/spawn', {
      method: 'POST',
      body: JSON.stringify({ task, agentId, model })
    });
    
    if (res.success) {
      outputEl.textContent = res.data.output || '任务已提交执行';
    } else {
      outputEl.textContent = '执行失败: ' + res.error;
    }
  } catch (e) {
    outputEl.textContent = '网络错误: ' + e.message;
  }
}

// ============== 定时任务 ==============
async function loadTasks() {
  const el = document.getElementById('tasksList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  
  try {
    const res = await apiCall('/api/openclaw/tasks');
    if (res.success) {
      const tasks = res.data.split('\n').filter(t => t.trim());
      if (tasks.length > 0) {
        let html = '<table class="data-table"><thead><tr><th>任务ID</th><th>状态</th><th>下次执行</th></tr></thead><tbody>';
        tasks.forEach(t => {
          const parts = t.split(/\s+/);
          html += `<tr>
            <td>${parts[0] || '-'}</td>
            <td><span class="status-badge pending">待执行</span></td>
            <td>${parts.slice(1).join(' ') || '-'}</td>
          </tr>`;
        });
        html += '</tbody></table>';
        el.innerHTML = html;
      } else {
        el.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无定时任务</p>';
      }
    }
  } catch (e) {
    el.innerHTML = '<p style="color: red;">加载失败</p>';
  }
}

// ============== 设置 ==============
async function changePassword() {
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmPassword').value;
  
  if (!newPass || newPass.length < 6) {
    alert('密码长度至少6位');
    return;
  }
  
  if (newPass !== confirmPass) {
    alert('两次密码不一致');
    return;
  }
  
  alert('密码修改功能开发中...');
}

async function initGit() {
  if (!confirm('确定要初始化 Git 并推送到远程仓库吗？这将强制推送所有文件。')) {
    return;
  }
  
  const outputEl = document.querySelector('#page-settings .console-output') || document.createElement('div');
  
  try {
    // 初始化 Git
    const initRes = await apiCall('/api/git/init', { method: 'POST' });
    alert('Git 初始化成功！');
  } catch (e) {
    alert('初始化失败: ' + e.message);
  }
}

// ============== 刷新 ==============
async function refreshAll() {
  const page = document.querySelector('.nav-item.active').dataset.page;
  loadPageData(page);
}

// ============== 初始化 ==============
(async function() {
  const authorized = await checkAuth();
  if (authorized) {
    loadOverview();
    
    // 每30秒刷新一次概览数据
    setInterval(() => {
      if (document.querySelector('.nav-item.active').dataset.page === 'overview') {
        loadOverview();
      }
    }, 30000);
  }
})();