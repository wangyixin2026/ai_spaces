const jwt = require('jsonwebtoken');
const db = require('../database/init');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: '请先登录' 
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = db.get('SELECT id, username, role, phone, email, avatar FROM users WHERE id = ?', [decoded.userId.id || decoded.userId]);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: '登录已过期，请重新登录' 
      });
    }
    return res.status(401).json({ 
      success: false, 
      message: '无效的认证信息' 
    });
  }
}

// Admin role check middleware
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: '需要管理员权限' 
    });
  }
  next();
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign({ userId: user }, JWT_SECRET, { expiresIn: '7d' });
}

// Optional authentication (doesn't fail if no token)
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = db.get('SELECT id, username, role, phone, email, avatar FROM users WHERE id = ?', [decoded.userId.id || decoded.userId]);
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  next();
}

module.exports = {
  authenticate,
  requireAdmin,
  generateToken,
  optionalAuth
};