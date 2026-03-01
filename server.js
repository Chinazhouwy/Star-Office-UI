/**
 * Star Office UI - 主服务器
 * OpenClaw 管理控制台
 */

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8889;

// ============== 配置 ==============
const CONFIG = {
  // 管理员账号（首次部署请修改密码！）
  admin: {
    username: 'admin',
    // 默认密码: staroffice2026 (请及时修改!)
    passwordHash: '$2a$10$rQEY9zXKkQ8vBkNxE3.U0eZgYvzLQJ5h5xQ5jKzJ5xQ5jKzJ5xQ5jK', // staroffice2026
    secret: 'star-office-secret-key-2026'
  },
  // JWT 密钥
  jwtSecret: 'star-office-jwt-secret-' + crypto.randomBytes(32).toString('hex'),
  // Session 密钥
  sessionSecret: 'star-office-session-secret-' + crypto.randomBytes(32).toString('hex'),
  // OpenClaw API 地址
  openclawApi: process.env.OPENCLAW_API || 'http://localhost:8000'
};

// ============== 中间件 ==============
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 速率限制（安全防护）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 100次请求
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// Session 配置
app.use(session({
  secret: CONFIG.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 生产环境设为 true（需要 HTTPS）
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// ============== 认证中间件 ==============
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
};

// ============== 工具函数 ==============
const execAsync = (command, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    exec(command, { timeout, cwd: '/root/.openclaw/workspace' }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
};

// ============== 登录 API ==============
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 简单验证（生产环境建议用 bcrypt 验证密码哈希）
    if (username === CONFIG.admin.username && password === 'staroffice2026') {
      req.session.user = {
        username: username,
        loginTime: Date.now(),
        role: 'admin'
      };
      
      // 生成 token
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
    
    return res.status(401).json({ error: '用户名或密码错误' });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: '退出失败' });
    }
    res.json({ success: true, message: '已退出登录' });
  });
});

app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      loggedIn: true,
      user: req.session.user
    });
  }
  res.json({ loggedIn: false });
});

// ============== OpenClaw 状态 API ==============
app.get('/api/openclaw/status', requireAuth, async (req, res) => {
  try {
    // 获取 OpenClaw 状态
    const statusOutput = await execAsync('openclaw status 2>&1');
    
    // 解析状态
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

app.get('/api/openclaw/sessions', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw sessions list --json 2>&1');
    let sessions = [];
    try {
      sessions = JSON.parse(output);
    } catch {
      // 如果不是 JSON，尝试解析文本格式
      sessions = output.split('\n').filter(line => line.trim());
    }
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ error: '获取会话失败', detail: error.message });
  }
});

app.get('/api/openclaw/tasks', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw cron list 2>&1');
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ error: '获取任务失败', detail: error.message });
  }
});

app.get('/api/openclaw/models', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw models list 2>&1');
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ error: '获取模型失败', detail: error.message });
  }
});

app.get('/api/openclaw/agents', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw agents list 2>&1');
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ error: '获取 Agent 列表失败', detail: error.message });
  }
});

// ============== 系统资源 API ==============
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

// ============== 机器人管理 API ==============
app.post('/api/robots/create', requireAuth, async (req, res) => {
  try {
    const { name, model, description } = req.body;
    
    // 创建新的 Agent/会话
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

app.get('/api/robots/list', requireAuth, async (req, res) => {
  try {
    const sessions = await execAsync('openclaw sessions list 2>&1');
    
    // 解析会话列表
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

// ============== 多智能体协作 API ==============
app.post('/api/agents/spawn', requireAuth, async (req, res) => {
  try {
    const { task, agentId, model } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: '任务不能为空' });
    }
    
    const cmd = `openclaw agents spawn --task "${task}" ${agentId ? `--agent ${agentId}` : ''} ${model ? `--model ${model}` : ''} 2>&1`;
    const output = await execAsync(cmd, 60000); // 60秒超时
    
    res.json({
      success: true,
      message: '任务已提交',
      data: { output }
    });
  } catch (error) {
    res.status(500).json({ error: '执行失败', detail: error.message });
  }
});

app.get('/api/agents/list', requireAuth, async (req, res) => {
  try {
    const output = await execAsync('openclaw agents list 2>&1');
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ error: '获取 Agent 列表失败', detail: error.message });
  }
});

// ============== 页面路由 ==============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ============== 启动服务器 ==============
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