const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Helper function to parse dynamic time_slot_id
function parseDynamicTimeSlot(timeSlotId) {
  if (!timeSlotId || typeof timeSlotId !== 'string') {
    return null;
  }
  
  // Check if this is a dynamic slot ID (format: courseId-year-month-day-index)
  if (timeSlotId.includes('-')) {
    const parts = timeSlotId.split('-');
    if (parts.length >= 5) {
      const courseId = parts[0];
      const year = parts[1];
      const month = parts[2];
      const day = parts[3];
      const index = parseInt(parts[4]);
      const date = `${year}-${month}-${day}`;
      
      // Default time slots mapping
      const defaultSlots = [
        { start: '09:00:00', end: '10:00:00' },
        { start: '14:00:00', end: '15:00:00' },
        { start: '18:00:00', end: '19:00:00' }
      ];
      
      if (index >= 0 && index < defaultSlots.length) {
        return {
          start_time: `${date} ${defaultSlots[index].start}`,
          end_time: `${date} ${defaultSlots[index].end}`
        };
      }
    }
  }
  
  return null;
}

// Get all students (admin only)
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { search, grade } = req.query;
    let sql = `
      SELECT s.*, u.username, u.phone, u.email, u.avatar
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ' AND (s.name LIKE ? OR u.username LIKE ? OR u.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (grade) {
      sql += ' AND s.grade = ?';
      params.push(grade);
    }

    sql += ' ORDER BY s.created_at DESC';

    const students = db.all(sql, params);

    res.json({
      success: true,
      data: students
    });
  } catch (error) {
    console.error('获取学生列表错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取学生列表失败' 
    });
  }
});

// Get single student
router.get('/:id', authenticate, (req, res) => {
  try {
    let sql = `
      SELECT s.*, u.username, u.phone, u.email, u.avatar, u.created_at as user_created_at
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `;
    
    const student = db.get(sql, [req.params.id]);

    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: '学生不存在' 
      });
    }

    // Check permission
    if (req.user.role !== 'admin') {
      const currentStudent = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!currentStudent || student.id !== currentStudent.id) {
        return res.status(403).json({ 
          success: false, 
          message: '无权查看此学生信息' 
        });
      }
    }

    // Get appointment stats
    const stats = db.get(`
      SELECT
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_appointments,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_appointments,
        SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END) as total_paid
      FROM appointments
      WHERE student_id = ?
    `, [student.id]);

    // Get recent appointments with course and time info
    const appointmentsRaw = db.all(`
      SELECT a.id, a.time_slot_id, a.status, a.payment_status, a.amount,
        c.name as course_name, c.subject as course_subject,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.student_id = ? AND a.status != 'cancelled'
      ORDER BY a.created_at DESC
      LIMIT 10
    `, [student.id]);

    // Process appointments to handle dynamic time slots
    const appointments = appointmentsRaw.map(apt => {
      if (!apt.start_time && apt.time_slot_id) {
        const parsed = parseDynamicTimeSlot(apt.time_slot_id);
        if (parsed) {
          apt.start_time = parsed.start_time;
          apt.end_time = parsed.end_time;
        }
      }
      return apt;
    });

    // Get homework submissions
    const homeworkSubmissions = db.all(`
      SELECT hs.id, hs.score, hs.status, hs.submitted_at, hs.is_late,
        h.title as homework_title, h.deadline as homework_deadline,
        c.name as course_name
      FROM homework_submissions hs
      LEFT JOIN homework h ON hs.homework_id = h.id
      LEFT JOIN courses c ON h.course_id = c.id
      WHERE hs.student_id = ?
      ORDER BY hs.submitted_at DESC
      LIMIT 10
    `, [student.id]);

    res.json({
      success: true,
      data: {
        ...student,
        stats,
        appointments,
        homeworkSubmissions
      }
    });
  } catch (error) {
    console.error('获取学生详情错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取学生详情失败' 
    });
  }
});

// Update student profile
router.put('/profile', authenticate, (req, res) => {
  try {
    const { name, gender, grade, school, parent_name, parent_phone, notes } = req.body;

    // Get current student
    const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: '学生信息不存在'
      });
    }

    db.run(`
      UPDATE students
      SET name = ?, gender = ?, grade = ?, school = ?, parent_name = ?, parent_phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, gender, grade, school, parent_name, parent_phone, notes, student.id]);

    const updatedStudent = db.get(`
      SELECT s.*, u.username, u.phone, u.email, u.avatar
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [student.id]);

    res.json({
      success: true,
      message: '更新成功',
      data: updatedStudent
    });
  } catch (error) {
    console.error('更新学生信息错误:', error);
    res.status(500).json({
      success: false,
      message: '更新失败'
    });
  }
});

// Update student (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, gender, grade, school, parent_name, parent_phone, notes } = req.body;

    const student = db.get('SELECT id FROM students WHERE id = ?', [req.params.id]);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: '学生不存在'
      });
    }

    db.run(`
      UPDATE students
      SET name = ?, gender = ?, grade = ?, school = ?, parent_name = ?, parent_phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, gender, grade, school, parent_name, parent_phone, notes, req.params.id]);

    const updatedStudent = db.get(`
      SELECT s.*, u.username, u.phone, u.email, u.avatar
      FROM students s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      message: '更新成功',
      data: updatedStudent
    });
  } catch (error) {
    console.error('更新学生信息错误:', error);
    res.status(500).json({
      success: false,
      message: '更新失败'
    });
  }
});

// Get student's appointments
router.get('/:id/appointments', authenticate, (req, res) => {
  try {
    // Check permission
    if (req.user.role !== 'admin') {
      const currentStudent = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!currentStudent || parseInt(req.params.id) !== currentStudent.id) {
        return res.status(403).json({ 
          success: false, 
          message: '无权查看' 
        });
      }
    }

    const appointments = db.all(`
      SELECT a.*, 
        c.name as course_name, c.subject as course_subject,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.student_id = ?
      ORDER BY ts.start_time DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('获取学生预约错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取预约失败' 
    });
  }
});

// Get student's homework submissions
router.get('/:id/homework', authenticate, (req, res) => {
  try {
    // Check permission
    if (req.user.role !== 'admin') {
      const currentStudent = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!currentStudent || parseInt(req.params.id) !== currentStudent.id) {
        return res.status(403).json({ 
          success: false, 
          message: '无权查看' 
        });
      }
    }

    const submissions = db.all(`
      SELECT hs.*, 
        h.title as homework_title, h.deadline,
        c.name as course_name, c.subject as course_subject
      FROM homework_submissions hs
      LEFT JOIN homework h ON hs.homework_id = h.id
      LEFT JOIN courses c ON h.course_id = c.id
      WHERE hs.student_id = ?
      ORDER BY h.deadline DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('获取学生作业错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取作业失败' 
    });
  }
});

// Get student's reports
router.get('/:id/reports', authenticate, (req, res) => {
  try {
    // Check permission
    if (req.user.role !== 'admin') {
      const currentStudent = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!currentStudent || parseInt(req.params.id) !== currentStudent.id) {
        return res.status(403).json({ 
          success: false, 
          message: '无权查看' 
        });
      }
    }

    const reports = db.all(`
      SELECT * FROM learning_reports 
      WHERE student_id = ?
      ORDER BY created_at DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('获取学生报告错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取报告失败' 
    });
  }
});

module.exports = router;