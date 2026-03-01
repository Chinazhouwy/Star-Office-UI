# 🦞 Star Office UI

> OpenClaw 管理控制台 - 现代化 Web 管理界面

## ✨ 功能特性

- 🔐 **安全登录** - Session + JWT 双重认证
- 📊 **系统概览** - 实时展示 CPU、内存、磁盘使用情况
- 🤖 **机器人管理** - 创建和管理 AI 机器人
- 🧠 **多智能体协作** - 启动 Agent 执行复杂任务
- ⏰ **定时任务** - 查看和管理定时任务
- 💻 **API 集成** - 直接调用 OpenClaw 接口

## 🚀 快速开始

### 安装依赖

```bash
cd star-office-ui
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:8889` 启动

### 首次登录

- **用户名**: `admin`
- **密码**: `staroffice2026`

> ⚠️ 首次登录后请修改密码！

## 📁 项目结构

```
star-office-ui/
├── server.js           # 主服务器
├── package.json        # 项目配置
├── public/             # 静态资源
│   ├── index.html      # 登录页
│   ├── dashboard.html # 控制台页面
│   ├── css/            # 样式
│   └── js/             # 前端脚本
└── README.md
```

## 🔌 API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录 |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/status` | GET | 登录状态 |
| `/api/openclaw/status` | GET | OpenClaw 状态 |
| `/api/openclaw/sessions` | GET | 会话列表 |
| `/api/openclaw/tasks` | GET | 定时任务 |
| `/api/robots/create` | POST | 创建机器人 |
| `/api/robots/list` | GET | 机器人列表 |
| `/api/agents/spawn` | POST | 启动 Agent |
| `/api/system/resources` | GET | 系统资源 |

## 🔐 安全配置

### 修改默认密码

在 `server.js` 中找到：

```javascript
admin: {
  username: 'admin',
  passwordHash: '...', // 使用 bcrypt 哈希
}
```

使用 bcrypt 生成新密码哈希：

```javascript
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('your_new_password', 10));
```

### 生产环境建议

1. 启用 HTTPS（设置 `cookie.secure = true`）
2. 使用强密码并定期更换
3. 配置防火墙限制访问 IP
4. 定期查看日志

## 📝 更新日志

### v1.0.0 (2026-03-01)
- ✅ 初始版本
- ✅ 登录/登出功能
- ✅ 系统状态监控
- ✅ 机器人管理
- ✅ 多智能体协作
- ✅ 定时任务查看
- ✅ 系统资源展示

## 📄 许可证

MIT License