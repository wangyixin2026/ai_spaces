const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all payment settings (public - for students to see QR codes)
router.get('/settings', (req, res) => {
  try {
    const settings = db.all(`
      SELECT id, payment_type, qr_code, account_name, is_active 
      FROM payment_settings 
      WHERE is_active = 1
    `);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('获取支付设置错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取支付设置失败' 
    });
  }
});

// Get all payment settings including inactive (admin only)
router.get('/settings/all', authenticate, requireAdmin, (req, res) => {
  try {
    const settings = db.all(`
      SELECT * FROM payment_settings ORDER BY payment_type
    `);

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('获取支付设置错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取支付设置失败' 
    });
  }
});

// Update payment setting (admin only)
router.put('/settings/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { qr_code, account_name, is_active } = req.body;
    const { id } = req.params;

    const setting = db.get('SELECT id FROM payment_settings WHERE id = ?', [id]);
    if (!setting) {
      return res.status(404).json({ 
        success: false, 
        message: '支付设置不存在' 
      });
    }

    db.run(`
      UPDATE payment_settings 
      SET qr_code = ?, account_name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [qr_code, account_name, is_active ? 1 : 0, id]);

    const updatedSetting = db.get('SELECT * FROM payment_settings WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '支付设置更新成功',
      data: updatedSetting
    });
  } catch (error) {
    console.error('更新支付设置错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新支付设置失败' 
    });
  }
});

// Upload QR code image (admin only) - stores base64 image
router.post('/settings/:id/qrcode', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { qr_code } = req.body;

    if (!qr_code) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供二维码图片' 
      });
    }

    const setting = db.get('SELECT id FROM payment_settings WHERE id = ?', [id]);
    if (!setting) {
      return res.status(404).json({ 
        success: false, 
        message: '支付设置不存在' 
      });
    }

    db.run(`
      UPDATE payment_settings 
      SET qr_code = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [qr_code, id]);

    const updatedSetting = db.get('SELECT * FROM payment_settings WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '二维码上传成功',
      data: updatedSetting
    });
  } catch (error) {
    console.error('上传二维码错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '上传二维码失败' 
    });
  }
});

// Get payment QR code for specific payment method (public)
router.get('/qrcode/:type', (req, res) => {
  try {
    const { type } = req.params;
    
    const setting = db.get(`
      SELECT payment_type, qr_code, account_name 
      FROM payment_settings 
      WHERE payment_type = ? AND is_active = 1
    `, [type]);

    if (!setting) {
      return res.status(404).json({ 
        success: false, 
        message: '支付方式不存在或未启用' 
      });
    }

    if (!setting.qr_code) {
      return res.status(404).json({ 
        success: false, 
        message: '该支付方式暂未配置收款码' 
      });
    }

    res.json({
      success: true,
      data: setting
    });
  } catch (error) {
    console.error('获取支付二维码错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取支付二维码失败' 
    });
  }
});

module.exports = router;