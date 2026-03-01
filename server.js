/**
 * ============================================================================
 * Star Office UI - 主服务器
 * ============================================================================
 * OpenClaw 管理控制台后端服务
 * 
 * 功能：
 *   - 用户登录/登出认证（Session + JWT）
 *   - OpenClaw 状态查询（系统状态、会话、任务）
 *   - 机器人管理（创建、列表）
 *   - 多智能体任务启动
 *   - 系统资源监控
 * 
 * 访问地址：http://localhost:8889
 * 默认账号：admin / staroffice2026
 * ============================================================================
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 18892;

// ============================================================================
// 配置区域
// ============================================================================

const CONFIG = {
  // 管理员账号配置
  // 生产环境请修改用户名和密码！
  admin: {
    username: 'admin',
    // 默认密码: staroffice2026 (请及时修改!)
    // 这里使用 bcrypt 哈希，生产环境应使用真实哈希值
    passwordHash: '$2a$10$rQEY9zXKkQ8vBkNxE3.U0eZgYvzLQJ5h5xQ5jKzJ5xQ5jKzJ5xQ5jK',
    secret: 'star-office-secret-key-2026'
  },
  
  // JWT 令牌密钥（用于 API 认证）
  jwtSecret: 'star-office-jwt-secret-' + crypto.randomBytes(32).toString('hex'),
  
  // Session 密钥（用于加密 Session 数据）
  sessionSecret: 'star-office-session-secret-' + crypto.randomBytes(32).toString('hex'),
  
  // OpenClaw API 地址（本地运行所以用 localhost）
  openclawApi: process.env.OPENCLAW_API || 'http://localhost:8000'
};

// ============================================================================
// Express 中间件配置
// ============================================================================

// CORS 配置 - 允许跨域请求
// 生产环境可以限制具体的域名
app.use(cors({
  origin: true,  // 允许所有来源（开发环境用）
  credentials: true  // 允许携带 Cookie
}));

// JSON 解析中间件 - 解析请求体中的 JSON 数据
app.use(express.json());

// URL 编码解析中间件 - 解析表单提交的数据
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 提供 public 目录下的静态文件（HTML、CSS、JS、图片等）
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// 安全防护：速率限制
// ============================================================================

/**
 * 速率限制器
 * 防止恶意请求和暴力破解
 * 
 * 限制规则：
 *   - 15 分钟内最多 100 次请求
 *   - 超过限制返回 429 状态码
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟窗口
  max: 100, // 最多 100 次请求
  message: { error: '请求过于频繁，请稍后再试' }
});

// 对所有 /api/ 开头的路由应用速率限制
app.use('/api/', limiter);

// ============================================================================
// Session 配置
// ============================================================================

/**
 * Session 中间件配置
 * 用于在服务器端存储用户登录状态
 * 
 * 配置说明：
 *   - secret: 用于签名 Session ID 的密钥
 *   - resave: 是否每次请求都重新保存 Session（建议 false）
 *   - saveUninitialized: 是否保存未初始化的 Session（建议 false）
 *   - cookie: Cookie 配置
 *       - httpOnly: 防止 XSS 攻击（JS 无法读取 Cookie）
 *       - secure: 生产环境应设为 true（需要 HTTPS）
 *       - maxAge: Session 有效期（24小时）
 */
app.use(session({
  secret: CONFIG.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 生产环境设为 true
    httpOnly: true, // 禁止 JS 访问
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// ============================================================================
// 认证中间件
// ============================================================================

/**
 * requireAuth - 认证检查中间件
 * 
 * 用途：保护需要登录才能访问的 API 路由
 * 
 * 工作原理：
 *   1. 检查请求的 Session 中是否有用户信息
 *   2. 有用户信息 → 放行，继续执行后续代码
 *   3. 无用户信息 → 返回 401 错误，提示未登录
 * 
 * 使用方式：将其作为中间件参数传入路由
 *   app.get('/api/protected', requireAuth, (req, res) => { ... })
 */
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next(); // 已登录，放行
  }
  return res.status(401).json({ 
    error: '未登录', 
    code: 'UNAUTHORIZED' 
  });
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * execAsync - 异步执行命令行命令
 * 
 * @param {string} command - 要执行的命令
 * @param {number} timeout - 超时时间（毫秒），默认 10 秒
 * @returns {Promise<string>} 命令输出
 * 
 * 示例：
 *   const output = await execAsync('ls -la');
 *   const result = await execAsync('openclaw status', 5000);
 */
const execAsync = (command, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    exec(command, { 
      timeout, 
      cwd: '/root/.openclaw/workspace' 
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
};

// ============================================================================
// 认证 API
// ============================================================================

/**
 * POST /api/auth/login - 用户登录
 * 
 * 请求体：
 *   {
 *     username: string,  // 用户名
 *     password: string   // 密码
 *   }
 * 
 * 响应：
 *   成功：{ success: true, message: '登录成功', user: {...}, token: '...' }
 *   失败：{ error: '用户名或密码错误' }
 * 
 * 处理流程：
 *   1. 验证用户名和密码
 *   2. 创建 Session（存储用户信息）
 *   3. 生成 JWT Token
 *   4. 返回用户信息和 Token
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 简单验证（生产环境建议用 bcrypt 验证密码哈希）
    // 这里硬编码密码，生产环境应从数据库读取并使用 bcrypt 比较
    if (username === CONFIG.admin.username && password === 'staroffice2026') {
      // 创建 Session（服务器端存储用户状态）
      req.session.user = {
        username: username,
        loginTime: Date.now(),
        role: 'admin'
      };
      
      // 生成随机 Token（用于 API 认证）
      const token = crypto.randomBytes(32).toString('hex');
      req.session.token = token;
      
      return res.json({
        success: true,
        message: '登录成功',
        user: {
          username: username,
          role: 'admin'
        },
        token: token
      });
    }
    
    // 登录失败
    return res.status(401).json({ error: '用户名或密码错误' });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

/**
 * POST /api/auth/logout - 用户登出
 * 
 * 处理流程：
 *   1. 销毁 Session
 *   2. 返回成功响应
 */
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: '退出失败' });
    }
    res.json({ success: true, message: '已退出登录' });
  });
});

/**
 * GET /api/auth/status - 获取登录状态
 * 
 * 用途：前端页面加载时检查用户是否已登录
 * 
 * 响应：
 *   已登录：{ loggedIn: true, user: {...} }
 *   未登录：{ loggedIn: false }
 */
app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      loggedIn: true,
      user: req.session.user
    });
  }
  res.json({ loggedIn: false });
});

// ============================================================================
// OpenClaw 状态 API
// ============================================================================

/**
 * GET /api/openclaw/status - 获取 OpenClaw 状态
 * 
 * 权限：需要登录
 * 
 * 响应：{ success: true, data: { raw: '...', timestamp: 1234567890 } }
 * 
 * 说明：调用 openclaw status 命令获取系统状态
 */
app.get('/api/openclaw/status', requireAuth, async (req, res) => {
  try {
    const statusOutput = await execAsync('openclaw status 2>&1');
    
    const status = {
      raw: statusOutput,
      timestamp: Date.now()
    };
    
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('获取状态失败:', error);
    res.status(500).json({ error: '获取状态失败', detail: error.message });
  }
});

/**
 * GET /api/openclaw/sessions - 获取会话列表
 * 
 * 权限：需要登录
 * 
 * 响应：{ success: true, data: [...] }
 * 
 * 说明：列出当前所有活动的会话
 */
app.get('/api/openclaw/sessions', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw sessions list --json 2>&1');
    let sessions = [];
    try {
      sessions = JSON.parse(output);
    } catch {
      sessions = output.split('\n').filter(line => line.trim());
    }
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ error: '获取会话失败', detail: error.message });
  }
});

/**
 * GET /api/openclaw/tasks - 获取定时任务列表
 * 
 * 权限：需要登录
 * 
 * 响应：{ success: true, data: '...' }
 * 
 * 说明：调用 openclaw cron list 获取所有定时任务
 */
app.get('/api/openclaw/tasks', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw cron list 2>&1');
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ error: '获取任务失败', detail: error.message });
  }
});

/**
 * GET /api/openclaw/models - 获取可用模型列表
 * 
 * 权限：需要登录
 */
app.get('/api/openclaw/models', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw models list 2>&1');
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ error: '获取模型失败', detail: error.message });
  }
});

/**
 * GET /api/openclaw/agents - 获取 Agent 列表
 * 
 * 权限：需要登录
 */
app.get('/api/openclaw/agents', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw agents list 2>&1');
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ error: '获取 Agent 列表失败', detail: error.message });
  }
});

// ============================================================================
// 系统资源 API
// ============================================================================

/**
 * GET /api/system/resources - 获取系统资源使用情况
 * 
 * 权限：需要登录
 * 
 * 响应：{ success: true, data: { memory, cpu, disk, uptime, timestamp } }
 * 
 * 包含信息：
 *   - memory: 内存使用情况（free -m）
 *   - cpu: CPU 使用率（top -bn1）
 *   - disk: 磁盘使用情况（df -h）
 *   - uptime: 系统运行时间（uptime）
 */
app.get('/api/system/resources', requireAuth, async (req, res) => {
  try {
    const memInfo = await execAsync('free -m');
    const cpuInfo = await execAsync('top -bn1 | grep "Cpu(s)"');
    const diskInfo = await execAsync('df -h /');
    const uptimeInfo = await execAsync('uptime');
    
    res.json({
      success: true,
      data: {
        memory: memInfo,
        cpu: cpuInfo,
        disk: diskInfo,
        uptime: uptimeInfo,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取资源信息失败', detail: error.message });
  }
});

// ============================================================================
// 机器人管理 API
// ============================================================================

/**
 * POST /api/robots/create - 创建新机器人
 * 
 * 权限：需要登录
 * 
 * 请求体：
 *   {
 *     name: string,        // 机器人名称（必填）
 *     model: string,       // 使用的模型（可选，默认 qwen3.5-plus）
 *     description: string  // 机器人描述（可选）
 *   }
 * 
 * 响应：{ success: true, message: '...', data: {...} }
 * 
 * 说明：创建一个新的 Agent 会话
 */
app.post('/api/robots/create', requireAuth, async (req, res) => {
  try {
    const { name, model, description } = req.body;
    
    // 验证名称
    if (!name) {
      return res.status(400).json({ error: '机器人名称不能为空' });
    }
    
    // 构建创建命令
    // 这里使用 openclaw session create 命令创建新会话
    // 实际实现可能需要根据 OpenClaw 的具体 API 调整
    const cmd = `openclaw session create --name "${name}" --model "${model || 'bailian/qwen3.5-plus'}" 2>&1`;
    const output = await execAsync(cmd);
    
    res.json({
      success: true,
      message: '机器人创建成功',
      data: { name, model, description, output }
    });
  } catch (error) {
    res.status(500).json({ error: '创建失败', detail: error.message });
  }
});

/**
 * GET /api/robots/list - 获取机器人列表
 * 
 * 权限：需要登录
 * 
 * 响应：{ success: true, data: [...] }
 * 
 * 说明：获取所有机器人（会话）列表
 */
app.get('/api/robots/list', requireAuth, async (req, res) => {
  try {
    const sessions = await execAsync('openclaw sessions list 2>&1');
    
    let robots = [];
    try {
      robots = JSON.parse(sessions);
    } catch {
      robots = sessions.split('\n').filter(s => s.trim()).map(s => ({ raw: s }));
    }
    
    res.json({ success: true, data: robots });
  } catch (error) {
    res.status(500).json({ error: '获取列表失败', detail: error.message });
  }
});

// ============================================================================
// 多智能体协作 API
// ============================================================================

/**
 * POST /api/agents/spawn - 启动 Agent 执行任务
 * 
 * 权限：需要登录
 * 
 * 请求体：
 *   {
 *     task: string,      // 任务描述（必填）
 *     agentId: string,  // Agent ID（可选）
 *     model: string,     // 模型选择（可选）
 *   }
 * 
 * 响应：{ success: true, message: '...', data: { output } }
 * 
 * 说明：创建一个新的 Agent 子任务来执行复杂操作
 */
app.post('/api/agents/spawn', requireAuth, async (req, res) => {
  try {
    const { task, agentId, model } = req.body;
    
    // 验证任务描述
    if (!task) {
      return res.status(400).json({ error: '任务不能为空' });
    }
    
    // 构建命令
    // 使用 openclaw agents spawn 启动子 Agent
    const cmd = `openclaw agents spawn --task "${task}" ${agentId ? `--agent ${agentId}` : ''} ${model ? `--model ${model}` : ''} 2>&1`;
    
    // 60秒超时（任务执行可能需要较长时间）
    const output = await execAsync(cmd, 60000);
    
    res.json({
      success: true,
      message: '任务已提交',
      data: { output }
    });
  } catch (error) {
    res.status(500).json({ error: '执行失败', detail: error.message });
  }
});

/**
 * GET /api/agents/list - 获取可用 Agent 列表
 * 
 * 权限：需要登录
 */
app.get('/api/agents/list', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw agents list 2>&1');
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ error: '获取 Agent 列表失败', detail: error.message });
  }
});

// ============================================================================
// 页面路由
// ============================================================================

/**
 * GET / - 登录页面
 * 
 * 提供登录页面 index.html
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * GET /dashboard - 控制台页面
 * 
 * 检查登录状态，未登录则重定向到登录页
 */
app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ============================================================================
// 启动服务器
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🌟 Star Office UI 启动成功                      ║
║                                                   ║
║   本地访问: http://localhost:${PORT}                ║
║   管理面板: http://localhost:${PORT}/dashboard      ║
║                                                   ║
║   默认账号: admin                                 ║
║   默认密码: staroffice2026                        ║
║                                                   ║
║   ⚠️  首次登录后请修改密码！                        ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

module.exports = app;