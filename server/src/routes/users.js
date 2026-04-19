const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { role, search } = req.query;
    let sql = `
      SELECT id, username, phone, email, role, avatar, created_at 
      FROM users 
      WHERE 1=1
    `;
    const params = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (search) {
      sql += ' AND (username LIKE ? OR phone LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const users = db.all(sql, params);

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取用户列表失败' 
    });
  }
});

// Get single user (admin only)
router.get('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const user = db.get(`
      SELECT id, username, phone, email, role, avatar, created_at 
      FROM users 
      WHERE id = ?
    `, [req.params.id]);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // Get student info if role is student
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
    console.error('获取用户详情错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取用户详情失败' 
    });
  }
});

// Update user (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { username, phone, email, role, avatar } = req.body;

    const user = db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // Check if username is taken by another user
    if (username) {
      const existingUser = db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.params.id]);
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: '用户名已被使用' 
        });
      }
    }

    // Check if phone is taken by another user
    if (phone) {
      const existingPhone = db.get('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, req.params.id]);
      if (existingPhone) {
        return res.status(400).json({ 
          success: false, 
          message: '手机号已被使用' 
        });
      }
    }

    db.run(`
      UPDATE users 
      SET username = ?, phone = ?, email = ?, role = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [username, phone, email, role, avatar, req.params.id]);

    const updatedUser = db.get('SELECT id, username, phone, email, role, avatar FROM users WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '用户更新成功',
      data: updatedUser
    });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新用户失败' 
    });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const user = db.get('SELECT id, role FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    // Cannot delete admin user
    if (user.role === 'admin') {
      const adminCount = db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
      if (adminCount.count <= 1) {
        return res.status(400).json({ 
          success: false, 
          message: '不能删除最后一个管理员账户' 
        });
      }
    }

    // Delete student record if exists
    if (user.role === 'student') {
      db.run('DELETE FROM students WHERE user_id = ?', [req.params.id]);
    }

    // Delete user
    db.run('DELETE FROM users WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除用户失败' 
    });
  }
});

// Reset user password (admin only)
router.put('/:id/password', authenticate, requireAdmin, (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供新密码' 
      });
    }

    const user = db.get('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: '用户不存在' 
      });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    db.run('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, req.params.id]);

    res.json({
      success: true,
      message: '密码重置成功'
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '重置密码失败' 
    });
  }
});

module.exports = router;