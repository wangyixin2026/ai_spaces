const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');

// Get all courses (public)
router.get('/', optionalAuth, (req, res) => {
  try {
    const { subject, grade, status } = req.query;
    let sql = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM time_slots ts WHERE ts.course_id = c.id AND ts.status = 'available') as available_slots
      FROM courses c
      WHERE 1=1
    `;
    const params = [];

    if (subject) {
      sql += ' AND c.subject = ?';
      params.push(subject);
    }
    if (grade) {
      sql += ' AND c.grade_level = ?';
      params.push(grade);
    }
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    } else {
      // Default show active courses for non-admin
      if (!req.user || req.user.role !== 'admin') {
        sql += " AND c.status = 'active'";
      }
    }

    sql += ' ORDER BY c.created_at DESC';

    const courses = db.all(sql, params);

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('获取课程列表错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取课程列表失败' 
    });
  }
});

// Get single course (public)
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const course = db.get(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM time_slots ts WHERE ts.course_id = c.id AND ts.status = 'available') as available_slots
      FROM courses c
      WHERE c.id = ?
    `, [req.params.id]);

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: '课程不存在' 
      });
    }

    // Get time slots for this course
    const timeSlots = db.all(`
      SELECT * FROM time_slots 
      WHERE course_id = ? AND start_time > datetime('now', 'localtime')
      ORDER BY start_time ASC
    `, [req.params.id]);

    res.json({
      success: true,
      data: {
        ...course,
        timeSlots
      }
    });
  } catch (error) {
    console.error('获取课程详情错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取课程详情失败' 
    });
  }
});

// Create course (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, subject, grade_level, description, duration, price, max_students } = req.body;

    if (!name || !subject) {
      return res.status(400).json({ 
        success: false, 
        message: '课程名称和学科不能为空' 
      });
    }

    const result = db.run(`
      INSERT INTO courses (name, subject, grade_level, description, duration, price, max_students)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [name, subject, grade_level, description, duration || 60, price || 0, max_students || 1]);

    const newCourse = db.get('SELECT * FROM courses WHERE id = ?', [result.lastId]);

    res.json({
      success: true,
      message: '课程创建成功',
      data: newCourse
    });
  } catch (error) {
    console.error('创建课程错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建课程失败' 
    });
  }
});

// Update course (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, subject, grade_level, description, duration, price, max_students, status } = req.body;

    const course = db.get('SELECT id FROM courses WHERE id = ?', [req.params.id]);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: '课程不存在' 
      });
    }

    db.run(`
      UPDATE courses 
      SET name = ?, subject = ?, grade_level = ?, description = ?, 
          duration = ?, price = ?, max_students = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, subject, grade_level, description, duration, price, max_students, status, req.params.id]);

    const updatedCourse = db.get('SELECT * FROM courses WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '课程更新成功',
      data: updatedCourse
    });
  } catch (error) {
    console.error('更新课程错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新课程失败' 
    });
  }
});

// Delete course (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const course = db.get('SELECT id FROM courses WHERE id = ?', [req.params.id]);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: '课程不存在' 
      });
    }

    db.run('DELETE FROM courses WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '课程删除成功'
    });
  } catch (error) {
    console.error('删除课程错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除课程失败' 
    });
  }
});

// Get time slots for a course - dynamically generate slots for any date
router.get('/:id/slots', optionalAuth, (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const courseId = req.params.id;
    
    // Get course info
    const course = db.get('SELECT id, name, subject, duration, max_students FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    // If specific date is requested, generate dynamic slots for that date
    if (start_date && start_date === end_date) {
      // Check if date is in the past
      const requestDate = new Date(start_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (requestDate < today) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Default time slots: 9:00-10:00, 14:00-15:00, 18:00-19:00
      const defaultSlots = [
        { start: '09:00:00', end: '10:00:00' },
        { start: '14:00:00', end: '15:00:00' },
        { start: '18:00:00', end: '19:00:00' }  // 晚上6点到7点
      ];

      // Check existing appointments for this date
      const existingAppointments = db.all(`
        SELECT a.time_slot_id, ts.start_time, ts.end_time, ts.max_capacity, ts.current_booked
        FROM appointments a
        JOIN time_slots ts ON a.time_slot_id = ts.id
        WHERE a.course_id = ?
          AND DATE(ts.start_time) = ?
          AND a.status != 'cancelled'
      `, [courseId, start_date]);

      // Generate available slots
      const slots = defaultSlots.map((slot, index) => {
        const start_time = `${start_date} ${slot.start}`;
        const end_time = `${start_date} ${slot.end}`;
        
        // Check if this slot has appointments
        const appointmentsForSlot = existingAppointments.filter(a =>
          a.start_time === start_time
        );
        
        const current_booked = appointmentsForSlot.length;
        const max_capacity = course.max_students || 5;
        const status = current_booked >= max_capacity ? 'full' : 'available';
        
        return {
          id: `${courseId}-${start_date}-${index}`,  // Dynamic ID
          course_id: parseInt(courseId),
          start_time,
          end_time,
          max_capacity,
          current_booked,
          status,
          course_name: course.name,
          subject: course.subject,
          is_dynamic: true  // Mark as dynamically generated
        };
      });

      return res.json({
        success: true,
        data: slots
      });
    }

    // For range queries, get from database
    let sql = `
      SELECT ts.*, c.name as course_name, c.subject
      FROM time_slots ts
      JOIN courses c ON ts.course_id = c.id
      WHERE ts.course_id = ?
    `;
    const params = [courseId];

    if (start_date) {
      sql += ' AND ts.start_time >= ?';
      params.push(start_date + ' 00:00:00');
    }
    if (end_date) {
      sql += ' AND ts.end_time <= ?';
      params.push(end_date + ' 23:59:59');
    } else {
      sql += " AND ts.start_time > datetime('now', 'localtime')";
    }

    sql += ' ORDER BY ts.start_time ASC';

    const dbSlots = db.all(sql, params);

    res.json({
      success: true,
      data: dbSlots
    });
  } catch (error) {
    console.error('获取时间段错误:', error);
    res.status(500).json({
      success: false,
      message: '获取时间段失败'
    });
  }
});

// Create time slot (admin only)
router.post('/:id/slots', authenticate, requireAdmin, (req, res) => {
  try {
    const { start_time, end_time, max_capacity } = req.body;

    if (!start_time || !end_time) {
      return res.status(400).json({ 
        success: false, 
        message: '开始时间和结束时间不能为空' 
      });
    }

    // Check if course exists
    const course = db.get('SELECT id FROM courses WHERE id = ?', [req.params.id]);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: '课程不存在' 
      });
    }

    // Check for overlapping slots
    const overlapping = db.get(`
      SELECT id FROM time_slots 
      WHERE course_id = ? 
        AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))
    `, [req.params.id, start_time, start_time, end_time, end_time]);

    if (overlapping) {
      return res.status(400).json({ 
        success: false, 
        message: '时间段与现有时间段重叠' 
      });
    }

    const result = db.run(`
      INSERT INTO time_slots (course_id, start_time, end_time, max_capacity)
      VALUES (?, ?, ?, ?)
    `, [req.params.id, start_time, end_time, max_capacity || 1]);

    const newSlot = db.get('SELECT * FROM time_slots WHERE id = ?', [result.lastId]);

    res.json({
      success: true,
      message: '时间段创建成功',
      data: newSlot
    });
  } catch (error) {
    console.error('创建时间段错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建时间段失败' 
    });
  }
});

// Update time slot (admin only)
router.put('/:id/slots/:slotId', authenticate, requireAdmin, (req, res) => {
  try {
    const { start_time, end_time, max_capacity, status } = req.body;

    const slot = db.get('SELECT * FROM time_slots WHERE id = ? AND course_id = ?', [req.params.slotId, req.params.id]);
    if (!slot) {
      return res.status(404).json({ 
        success: false, 
        message: '时间段不存在' 
      });
    }

    db.run(`
      UPDATE time_slots 
      SET start_time = ?, end_time = ?, max_capacity = ?, status = ?
      WHERE id = ?
    `, [start_time, end_time, max_capacity, status, req.params.slotId]);

    const updatedSlot = db.get('SELECT * FROM time_slots WHERE id = ?', [req.params.slotId]);

    res.json({
      success: true,
      message: '时间段更新成功',
      data: updatedSlot
    });
  } catch (error) {
    console.error('更新时间段错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新时间段失败' 
    });
  }
});

// Delete time slot (admin only)
router.delete('/:id/slots/:slotId', authenticate, requireAdmin, (req, res) => {
  try {
    const slot = db.get('SELECT * FROM time_slots WHERE id = ? AND course_id = ?', [req.params.slotId, req.params.id]);
    if (!slot) {
      return res.status(404).json({ 
        success: false, 
        message: '时间段不存在' 
      });
    }

    if (slot.current_booked > 0) {
      return res.status(400).json({ 
        success: false, 
        message: '该时间段已有预约，无法删除' 
      });
    }

    db.run('DELETE FROM time_slots WHERE id = ?', [req.params.slotId]);

    res.json({
      success: true,
      message: '时间段删除成功'
    });
  } catch (error) {
    console.error('删除时间段错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除时间段失败' 
    });
  }
});

// Batch create time slots (admin only)
router.post('/:id/slots/batch', authenticate, requireAdmin, (req, res) => {
  try {
    const { slots } = req.body;

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供时间段数据' 
      });
    }

    // Check if course exists
    const course = db.get('SELECT id FROM courses WHERE id = ?', [req.params.id]);
    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: '课程不存在' 
      });
    }

    const createdSlots = [];
    const errors = [];

    for (const slot of slots) {
      try {
        const { start_time, end_time, max_capacity } = slot;

        if (!start_time || !end_time) {
          errors.push({ slot, error: '时间不完整' });
          continue;
        }

        // Check for overlapping
        const overlapping = db.get(`
          SELECT id FROM time_slots 
          WHERE course_id = ? 
            AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))
        `, [req.params.id, start_time, start_time, end_time, end_time]);

        if (overlapping) {
          errors.push({ slot, error: '时间段重叠' });
          continue;
        }

        const slotResult = db.run(`
          INSERT INTO time_slots (course_id, start_time, end_time, max_capacity)
          VALUES (?, ?, ?, ?)
        `, [req.params.id, start_time, end_time, max_capacity || 1]);

        const newSlot = db.get('SELECT * FROM time_slots WHERE id = ?', [slotResult.lastId]);
        createdSlots.push(newSlot);
      } catch (e) {
        errors.push({ slot, error: e.message });
      }
    }

    res.json({
      success: true,
      message: `成功创建 ${createdSlots.length} 个时间段`,
      data: {
        created: createdSlots,
        errors
      }
    });
  } catch (error) {
    console.error('批量创建时间段错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '批量创建时间段失败' 
    });
  }
});

module.exports = router;