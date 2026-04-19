const express = require('express');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const courseRoutes = require('./routes/courses');
const appointmentRoutes = require('./routes/appointments');
const studentRoutes = require('./routes/students');
const homeworkRoutes = require('./routes/homework');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payment');
const uploadRoutes = require('./routes/upload');

// Import database
const db = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/upload', uploadRoutes);

// Root path
app.get('/', (req, res) => {
  res.json({
    message: '课外培训约课系统 API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      courses: '/api/courses',
      appointments: '/api/appointments',
      students: '/api/students',
      homework: '/api/homework',
      reports: '/api/reports',
      dashboard: '/api/dashboard',
      payment: '/api/payment'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database and start server
db.initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 文档: http://localhost:${PORT}/api/health`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

module.exports = app;