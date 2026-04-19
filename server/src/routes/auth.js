const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/init');
const { authenticate, generateToken } = require('../middleware/auth');

// Register
router.post('/register', (req, res) => {
  try {
    const { username, password, phone, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名和密码不能为空' 
      });
    }

    // Check if username exists
    const existingUser = db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名已存在' 
      });
    }

    // Check if phone exists (if provided)
    if (phone) {
      const existingPhone = db.get('SELECT id FROM users WHERE phone = ?', [phone]);
      if (existingPhone) {
        return res.status(400).json({ 
          success: false, 
          message: '手机号已被注册' 
        });
      }
    }

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user
    db.run(`
      INSERT INTO users (username, password, phone, email, role)
      VALUES (?, ?, ?, ?, 'student')
    `, [username, hashedPassword, phone || null, email || null]);

    // Get the new user
    const newUser = db.get('SELECT id, username, role FROM users WHERE username = ?', [username]);

    // Create student record
    db.run(`
      INSERT INTO students (user_id, name)
      VALUES (?, ?)
    `, [newUser.id, username]);

    // Generate token
    const token = generateToken(newUser);

    res.json({
      success: true,
      message: '注册成功',
      data: {
        user: newUser,
        token
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '注册失败，请稍后重试' 
    });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名和密码不能为空' 
      });
    }

    // Find user
    const user = db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }

    // Verify password
    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名或密码错误' 
      });
    }

    // Get student info if role is student
    let studentInfo = null;
    if (user.role === 'student') {
      studentInfo = db.get('SELECT * FROM students WHERE user_id = ?', [user.id]);
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          phone: user.phone,
          email: user.email,
          role: user.role,
          avatar: user.avatar
        },
        student: studentInfo,
        token
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '登录失败，请稍后重试' 
    });
  }
});

// Get current user info
router.get('/me', authenticate, (req, res) => {
  try {
    const user = db.get('SELECT id, username, phone, email, role, avatar, created_at FROM users WHERE id = ?', [req.user.id]);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    let studentInfo = null;
    if (user.role === 'student') {
      studentInfo = db.get('SELECT * FROM students WHERE user_id = ?', [user.id]);
    }

    res.json({
      success: true,
      data: {
        user,
        student: studentInfo
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取用户信息失败' 
    });
  }
});

// Update profile
router.put('/profile', authenticate, (req, res) => {
  try {
    const { phone, email, avatar } = req.body;
    
    db.run(`
      UPDATE users 
      SET phone = ?, email = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [phone, email, avatar, req.user.id]);

    const updatedUser = db.get('SELECT id, username, phone, email, role, avatar FROM users WHERE id = ?', [req.user.id]);

    res.json({
      success: true,
      message: '更新成功',
      data: updatedUser
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新失败' 
    });
  }
});

// Change password
router.put('/password', authenticate, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '请填写完整信息' 
      });
    }

    // Verify old password
    const user = db.get('SELECT password FROM users WHERE id = ?', [req.user.id]);
    const isValidPassword = bcrypt.compareSync(oldPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '原密码错误' 
      });
    }

    // Update password
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, req.user.id]);

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '修改密码失败' 
    });
  }
});

module.exports = router;