# 课外培训约课系统

一个完整的课外培训约课网站，支持课程预约、学生管理、作业管理、学习报告等功能。

## 功能特点

- 📚 **课程管理**：创建和管理课程，设置课程信息、价格、时长等
- 📅 **预约系统**：学生可在线选择课程和时间进行预约
- 👥 **学生管理**：管理学生信息，查看学习进度
- 📝 **作业管理**：发布作业、学生提交、在线批改
- 📊 **学习报告**：自动生成周报/月报，追踪学习进度
- 💰 **支付管理**：支持支付状态管理

## 技术栈

### 后端
- Node.js + Express
- SQLite (better-sqlite3)
- JWT 认证

### 前端
- Vue 3 + Vite
- Element Plus UI
- Pinia 状态管理
- Vue Router

## 安装和运行

### 1. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd client
npm install
```

### 2. 启动后端服务

```bash
cd server
npm run dev
```

后端服务将在 http://localhost:3000 运行

### 3. 启动前端服务

```bash
cd client
npm run dev
```

前端服务将在 http://localhost:5173 运行

## 默认账号

系统会自动创建一个管理员账号：

- 用户名：`admin`
- 密码：`admin123`

## 项目结构

```
ai_spaces/
├── plans/                    # 设计文档
│   └── booking-website-plan.md
├── server/                   # 后端代码
│   ├── src/
│   │   ├── database/         # 数据库初始化
│   │   ├── middleware/       # 中间件（认证等）
│   │   ├── routes/           # API路由
│   │   └── index.js          # 入口文件
│   ├── data/                 # 数据库文件（自动生成）
│   └── package.json
├── client/                   # 前端代码
│   ├── src/
│   │   ├── views/            # 页面组件
│   │   │   ├── student/      # 学生端页面
│   │   │   └── admin/        # 管理端页面
│   │   ├── stores/           # Pinia状态管理
│   │   ├── router/           # 路由配置
│   │   ├── utils/            # 工具函数
│   │   ├── styles/           # 样式文件
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## API 接口

### 认证接口
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户信息

### 课程接口
- `GET /api/courses` - 获取课程列表
- `GET /api/courses/:id` - 获取课程详情
- `POST /api/courses` - 创建课程（管理员）
- `PUT /api/courses/:id` - 更新课程（管理员）
- `DELETE /api/courses/:id` - 删除课程（管理员）

### 预约接口
- `GET /api/appointments` - 获取预约列表
- `POST /api/appointments` - 创建预约
- `PUT /api/appointments/:id/cancel` - 取消预约

### 学生接口
- `GET /api/students` - 获取学生列表（管理员）
- `GET /api/students/profile` - 获取当前学生信息
- `PUT /api/students/profile` - 更新学生信息

### 作业接口
- `GET /api/homework` - 获取作业列表
- `POST /api/homework/:id/submit` - 提交作业

### 学习报告接口
- `GET /api/reports` - 获取报告列表
- `POST /api/reports/generate` - 自动生成报告（管理员）

## 使用说明

### 学生端
1. 注册账号并登录
2. 完善个人信息
3. 浏览课程列表，选择课程预约
4. 查看预约记录，按时上课
5. 完成作业提交
6. 查看学习报告

### 管理端
1. 使用admin账号登录
2. 创建课程和时间段
3. 管理学生信息
4. 处理预约请求
5. 发布和批改作业
6. 生成学习报告

## 开发说明

- 数据库使用SQLite，文件位于 `server/data/booking.db`
- 前端开发时API请求会自动代理到后端
- 生产环境需要配置正确的API地址