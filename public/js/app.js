/**
 * ============================================================================
 * Star Office UI - 前端脚本
 * ============================================================================
 * 管理控制台前端逻辑
 * 
 * 功能：
 *   - 登录认证（检查状态、提交登录、处理登出）
 *   - 页面导航和内容切换
 *   - 数据加载和展示（系统状态、机器人、任务等）
 *   - 表单提交和数据交互
 * 
 * 依赖：无（纯原生 JavaScript）
 * ============================================================================
 */

const API_BASE = '';  // API 基础路径（空字符串表示同源）

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取存储的认证令牌
 * 
 * @returns {string|null} Token 字符串或 null
 * 
 * 说明：从 localStorage 读取登录时保存的 Token
 */
function getToken() {
  return localStorage.getItem('star_token');
}

/**
 * 获取当前登录用户信息
 * 
 * @returns {object|null} 用户对象或 null
 * 
 * 说明：从 localStorage 读取登录时保存的用户信息
 */
function getUser() {
  const user = localStorage.getItem('star_user');
  return user ? JSON.parse(user) : null;
}

/**
 * API 请求封装
 * 
 * @param {string} url - 请求 URL
 * @param {object} options - 请求选项
 * @returns {Promise<object>} 响应数据
 * 
 * 功能：
 *   - 自动添加认证头
 *   - 处理 401 错误（未登录时跳转登录页）
 *   - 统一错误处理
 * 
 * 示例：
 *   const data = await apiCall('/api/user/info');
 *   const result = await apiCall('/api/data/save', { 
 *     method: 'POST', 
 *     body: JSON.stringify({ name: 'test' }) 
 *   });
 */
async function apiCall(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // 添加认证令牌（如果已登录）
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(API_BASE + url, {
    ...options,
    headers,
    credentials: 'include'  // 包含 Cookie
  });
  
  const data = await res.json();
  
  // 处理未授权错误（Session 过期）
  if (res.status === 401 && data.code === 'UNAUTHORIZED') {
    alert('登录已过期，请重新登录');
    logout();
    throw new Error('Unauthorized');
  }
  
  return data;
}

// ============================================================================
// 认证相关函数
// ============================================================================

/**
 * 检查用户是否已登录
 * 
 * @returns {Promise<boolean>} 是否已登录
 * 
 * 处理流程：
 *   1. 检查 localStorage 中是否有用户信息
 *   2. 无用户信息 → 跳转登录页
 *   3. 有用户信息 → 更新页面显示用户名
 */
async function checkAuth() {
  const user = getUser();
  if (!user) {
    window.location.href = '/';
    return false;
  }
  // 更新页面显示的用户名
  document.getElementById('currentUser').textContent = user.username || 'Admin';
  return true;
}

/**
 * 用户登出
 * 
 * 功能：
 *   1. 调用后端登出 API（清除 Session）
 *   2. 清除 localStorage 中的 Token 和用户信息
 *   3. 跳转回登录页
 * 
 * 说明：确保清理所有登录状态
 */
async function logout() {
  try {
    // 调用后端登出接口
    await apiCall('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // 忽略错误，强制登出
  }
  // 清除本地存储
  localStorage.removeItem('star_token');
  localStorage.removeItem('star_user');
  // 跳转登录页
  window.location.href = '/';
}

// ============================================================================
// 页面导航
// ============================================================================

/**
 * 初始化导航菜单
 * 
 * 说明：为侧边栏的每个导航项绑定点击事件
 * 处理点击时：
 *   1. 更新导航项的激活状态
 *   2. 切换显示对应的页面
 *   3. 加载页面数据
 */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    
    // 更新导航状态 - 高亮当前选中的导航项
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    // 切换页面显示 - 隐藏所有页面，显示目标页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    
    // 加载页面数据 - 根据页面类型加载相应数据
    loadPageData(page);
  });
});

/**
 * 根据页面类型加载数据
 * 
 * @param {string} page - 页面标识（overview/status/robots/agents/tasks/settings）
 * 
 * 每个页面对应的数据：
 *   - overview: 概览数据（资源、任务、会话数）
 *   - status: OpenClaw 状态、当前会话列表
 *   - robots: 机器人列表
 *   - tasks: 定时任务列表
 *   - agents: 无需加载（静态页面）
 *   - settings: 无需加载（静态页面）
 */
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

// ============================================================================
// 概览页面
// ============================================================================

/**
 * 加载概览页面数据
 * 
 * 包含内容：
 *   - 系统资源信息（CPU、内存、磁盘、运行时间）
 *   - 定时任务数量
 *   - 活跃会话/机器人数量
 */
async function loadOverview() {
  try {
    // 1. 加载系统资源信息
    const res = await apiCall('/api/system/resources');
    if (res.success && res.data) {
      // 解析内存信息：free -m 输出格式 "Mem: 总内存 已用 空闲..."
      const memMatch = res.data.memory.match(/Mem:\s+(\d+)\s+(\d+)/);
      // 解析 CPU 信息：top 输出格式 "Cpu(s): x% us, y% sy..."
      const cpuMatch = res.data.cpu.match(/(\d+\.\d+)\s*us/);
      // 解析磁盘信息：df -h 输出格式 "文件系统 大小 已用 可用 使用率 挂载点"
      const diskMatch = res.data.disk.match(/(\d+)%/);
      // 解析运行时间：uptime 输出格式 "... up x days, HH:MM, ..."
      const upMatch = res.data.uptime.match(/up\s+(.+?,\s*\d+:\d+)/);
      
      // 更新内存使用率显示
      if (memMatch) {
        const used = memMatch[2];
        const total = memMatch[1];
        const pct = Math.round(used / total * 100);
        document.getElementById('memUsage').textContent = pct + '%';
      }
      
      // 更新 CPU 使用率显示
      if (cpuMatch) {
        const cpuPct = cpuMatch[1];
        document.getElementById('cpuUsage').textContent = cpuPct + '%';
        document.getElementById('statCPU').textContent = cpuPct + '%';
      }
      
      // 更新磁盘使用率显示
      if (diskMatch) {
        document.getElementById('diskUsage').textContent = diskMatch[1] + '%';
      }
      
      // 更新运行时间显示
      if (upMatch) {
        document.getElementById('uptime').textContent = upMatch[1].trim();
      }
    }
    
    // 2. 加载定时任务数量
    const tasksRes = await apiCall('/api/openclaw/tasks');
    if (tasksRes.success) {
      const taskCount = (tasksRes.data || '').split('\n').filter(t => t.trim()).length;
      document.getElementById('statTasks').textContent = taskCount || '0';
    }
    
    // 3. 加载活跃会话/机器人数量
    const sessionsRes = await apiCall('/api/openclaw/sessions');
    if (sessionsRes.success) {
      const sessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
      document.getElementById('statRobots').textContent = sessions.length;
    }
    
  } catch (e) {
    console.error('加载概览数据失败:', e);
  }
}

// ============================================================================
// 系统状态页面
// ============================================================================

/**
 * 加载 OpenClaw 状态
 * 
 * 显示内容：openclaw status 命令的原始输出
 */
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

/**
 * 加载当前会话列表
 * 
 * 显示内容：所有活跃的 OpenClaw 会话
 */
async function loadSessions() {
  const el = document.getElementById('sessionsList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  
  try {
    const res = await apiCall('/api/openclaw/sessions');
    if (res.success) {
      const sessions = res.data;
      if (Array.isArray(sessions) && sessions.length > 0) {
        // 构建表格 HTML
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

// ============================================================================
// 机器人管理
// ============================================================================

/**
 * 加载机器人列表
 * 
 * 显示内容：所有已创建的机器人（会话）
 */
async function loadRobots() {
  const el = document.getElementById('robotsList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';
  
  try {
    const res = await apiCall('/api/robots/list');
    if (res.success) {
      let html = '<table class="data-table"><thead><tr><th>名称</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      // 示例：显示一个 Main Agent
      html += '<tr><td>Main Agent</td><td><span class="status-badge running">运行中</span></td><td>-</td></tr>';
      html += '</tbody></table>';
      el.innerHTML = html;
    }
  } catch (e) {
    el.innerHTML = '<p style="color: red;">加载失败</p>';
  }
}

/**
 * 显示创建机器人对话框
 * 
 * 说明：打开 Modal 对话框
 */
function showCreateRobot() {
  document.getElementById('createRobotModal').classList.add('active');
}

/**
 * 关闭对话框
 * 
 * @param {string} id - 对话框元素 ID
 */
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

/**
 * 创建机器人
 * 
 * 获取表单输入，调用后端 API 创建新机器人
 */
async function createRobot() {
  // 获取表单数据
  const name = document.getElementById('robotName').value;
  const model = document.getElementById('robotModel').value;
  const desc = document.getElementById('robotDesc').value;
  
  // 验证名称
  if (!name) {
    alert('请输入机器人名称');
    return;
  }
  
  try {
    const res = await apiCall('/api/robots/create', {
      method: 'POST',
      body: JSON.stringify({ 
        name, 
        model, 
        description: desc 
      })
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

// ============================================================================
// 多智能体
// ============================================================================

/**
 * 跳转到多智能体页面
 * 
 * 说明：模拟点击导航项
 */
function showSpawnAgent() {
  document.querySelectorAll('.nav-item')[3].click();
}

/**
 * 启动 Agent 任务
 * 
 * 获取任务描述和配置，调用后端 API 启动子 Agent 执行任务
 */
async function spawnAgent() {
  // 获取表单数据
  const task = document.getElementById('agentTask').value;
  const agentId = document.getElementById('agentSelect').value;
  const model = document.getElementById('modelSelect').value;
  
  // 验证任务描述
  if (!task) {
    alert('请输入任务描述');
    return;
  }
  
  const outputEl = document.getElementById('agentOutput');
  outputEl.textContent = '正在执行...';
  
  try {
    const res = await apiCall('/api/agents/spawn', {
      method: 'POST',
      body: JSON.stringify({ 
        task, 
        agentId, 
        model 
      })
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

// ============================================================================
// 定时任务
// ============================================================================

/**
 * 加载定时任务列表
 * 
 * 显示内容：OpenClaw 所有定时任务
 */
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

// ============================================================================
// 设置
// ============================================================================

/**
 * 修改密码
 * 
 * 说明：获取新密码并调用后端 API
 * 目前为演示功能，生产环境需要完善
 */
async function changePassword() {
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmPassword').value;
  
  // 验证密码长度
  if (!newPass || newPass.length < 6) {
    alert('密码长度至少6位');
    return;
  }
  
  // 验证两次密码一致
  if (newPass !== confirmPass) {
    alert('两次密码不一致');
    return;
  }
  
  alert('密码修改功能开发中...');
}

/**
 * 初始化 Git 并推送
 * 
 * 说明：初始化本地 Git 仓库并推送到远程
 */
async function initGit() {
  if (!confirm('确定要初始化 Git 并推送到远程仓库吗？这将强制推送所有文件。')) {
    return;
  }
  
  try {
    // TODO: 实现 Git 初始化 API
    const initRes = await apiCall('/api/git/init', { method: 'POST' });
    alert('Git 初始化成功！');
  } catch (e) {
    alert('初始化失败: ' + e.message);
  }
}

// ============================================================================
// 刷新功能
// ============================================================================

/**
 * 刷新当前页面数据
 * 
 * 说明：根据当前激活的导航项刷新对应页面数据
 */
async function refreshAll() {
  const page = document.querySelector('.nav-item.active').dataset.page;
  loadPageData(page);
}

// ============================================================================
// 初始化
// ============================================================================

/**
 * 页面初始化
 * 
 * 执行流程：
 *   1. 检查用户是否已登录
 *   2. 加载概览页面数据
 *   3. 设置定时刷新（每30秒刷新概览数据）
 */
(async function() {
  const authorized = await checkAuth();
  if (authorized) {
    // 加载概览数据
    loadOverview();
    
    // 设置定时刷新 - 每30秒刷新一次概览数据
    // 确保实时显示最新的系统资源信息
    setInterval(() => {
      const currentPage = document.querySelector('.nav-item.active').dataset.page;
      if (currentPage === 'overview') {
        loadOverview();
      }
    }, 30000);
  }
})();