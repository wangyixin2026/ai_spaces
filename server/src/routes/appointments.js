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

// Get all appointments (admin: all, student: own)
router.get('/', authenticate, (req, res) => {
  try {
    let sql;
    let params = [];

    if (req.user.role === 'admin') {
      sql = `
        SELECT a.*,
          s.name as student_name, s.grade as student_grade,
          c.name as course_name, c.subject as course_subject,
          ts.start_time, ts.end_time
        FROM appointments a
        LEFT JOIN students s ON a.student_id = s.id
        LEFT JOIN courses c ON a.course_id = c.id
        LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
        ORDER BY a.created_at DESC
      `;
    } else {
      // Get student's appointments
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student) {
        return res.json({ success: true, data: [] });
      }
      sql = `
        SELECT a.*,
          c.name as course_name, c.subject as course_subject,
          ts.start_time, ts.end_time
        FROM appointments a
        LEFT JOIN courses c ON a.course_id = c.id
        LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
        WHERE a.student_id = ?
        ORDER BY a.created_at DESC
      `;
      params = [student.id];
    }

    let appointments = db.all(sql, params);
    
    // Parse dynamic time_slot_id for appointments without start_time
    appointments = appointments.map(appointment => {
      if (!appointment.start_time && appointment.time_slot_id) {
        const parsedSlot = parseDynamicTimeSlot(appointment.time_slot_id);
        if (parsedSlot) {
          appointment.start_time = parsedSlot.start_time;
          appointment.end_time = parsedSlot.end_time;
        }
      }
      return appointment;
    });

    res.json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('获取预约列表错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取预约列表失败' 
    });
  }
});

// Get single appointment
router.get('/:id', authenticate, (req, res) => {
  try {
    let sql = `
      SELECT a.*, 
        s.name as student_name, s.grade as student_grade, s.school as student_school,
        c.name as course_name, c.subject as course_subject, c.price as course_price,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.id = ?
    `;
    
    const appointment = db.get(sql, [req.params.id]);

    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: '预约不存在' 
      });
    }

    // Check permission
    if (req.user.role !== 'admin') {
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student || appointment.student_id !== student.id) {
        return res.status(403).json({ 
          success: false, 
          message: '无权查看此预约' 
        });
      }
    }

    res.json({
      success: true,
      data: appointment
    });
  } catch (error) {
    console.error('获取预约详情错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取预约详情失败' 
    });
  }
});

// Create appointment (student)
router.post('/', authenticate, (req, res) => {
  try {
    const { course_id, time_slot_id, notes, payment_method, total_amount, class_count, start_time, end_time } = req.body;

    if (!course_id) {
      return res.status(400).json({
        success: false,
        message: '课程不能为空'
      });
    }

    // Get student info
    const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: '请先完善学生信息'
      });
    }

    // Get course info
    const course = db.get('SELECT id, price, name, subject, max_students FROM courses WHERE id = ?', [course_id]);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    // Handle dynamic time slot (format: courseId-date-index)
    let actualTimeSlotId = time_slot_id;
    let slotStartTime = start_time;
    let slotEndTime = end_time;

    // Check if this is a dynamic slot ID
    if (time_slot_id && typeof time_slot_id === 'string' && time_slot_id.includes('-')) {
      // Parse dynamic slot: courseId-date-index
      const parts = time_slot_id.split('-');
      if (parts.length >= 3) {
        // This is a dynamic slot, we need to create or find the actual time_slot
        const slotDate = parts[1];
        const slotIndex = parseInt(parts[2]);
        
        // Default time slots mapping
        const defaultSlots = [
          { start: '09:00:00', end: '10:00:00' },
          { start: '14:00:00', end: '15:00:00' },
          { start: '18:00:00', end: '19:00:00' }
        ];
        
        if (slotIndex >= 0 && slotIndex < defaultSlots.length) {
          slotStartTime = `${slotDate} ${defaultSlots[slotIndex].start}`;
          slotEndTime = `${slotDate} ${defaultSlots[slotIndex].end}`;
          
          // Check if time slot already exists
          const existingSlot = db.get(`
            SELECT id, current_booked, max_capacity, status
            FROM time_slots
            WHERE course_id = ? AND start_time = ? AND end_time = ?
          `, [course_id, slotStartTime, slotEndTime]);
          
          if (existingSlot) {
            // Use existing slot
            actualTimeSlotId = existingSlot.id;
            
            if (existingSlot.status !== 'available' && existingSlot.status !== 'full') {
              return res.status(400).json({
                success: false,
                message: '该时间段不可预约'
              });
            }
            
            if (existingSlot.current_booked >= existingSlot.max_capacity) {
              return res.status(400).json({
                success: false,
                message: '该时间段已满'
              });
            }
          } else {
            // Create new time slot
            const slotResult = db.run(`
              INSERT INTO time_slots (course_id, start_time, end_time, max_capacity, current_booked, status)
              VALUES (?, ?, ?, ?, 0, 'available')
            `, [course_id, slotStartTime, slotEndTime, course.max_students || 5]);
            actualTimeSlotId = slotResult.lastId;
          }
        }
      }
    }

    // If we have start_time and end_time directly, create/find slot
    if (!actualTimeSlotId && start_time && end_time) {
      const existingSlot = db.get(`
        SELECT id, current_booked, max_capacity, status
        FROM time_slots
        WHERE course_id = ? AND start_time = ? AND end_time = ?
      `, [course_id, start_time, end_time]);
      
      if (existingSlot) {
        actualTimeSlotId = existingSlot.id;
        if (existingSlot.current_booked >= existingSlot.max_capacity) {
          return res.status(400).json({
            success: false,
            message: '该时间段已满'
          });
        }
      } else {
        const slotResult = db.run(`
          INSERT INTO time_slots (course_id, start_time, end_time, max_capacity, current_booked, status)
          VALUES (?, ?, ?, ?, 0, 'available')
        `, [course_id, start_time, end_time, course.max_students || 5]);
        actualTimeSlotId = slotResult.lastId;
      }
    }

    if (!actualTimeSlotId) {
      return res.status(400).json({
        success: false,
        message: '时间段信息不完整'
      });
    }

    // Check if student already booked this slot
    const existingAppointment = db.get(`
      SELECT id FROM appointments
      WHERE student_id = ? AND time_slot_id = ? AND status != 'cancelled'
    `, [student.id, actualTimeSlotId]);

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: '您已预约过该时间段'
      });
    }

    // Validate payment method
    const validPaymentMethods = ['cash', 'wechat', 'alipay', 'bank', 'unpaid'];
    const paymentMethodValue = payment_method || 'unpaid';

    // Create appointment with payment info
    const result = db.run(`
      INSERT INTO appointments (student_id, course_id, time_slot_id, amount, notes, payment_method, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, 'unpaid')
    `, [student.id, course_id, actualTimeSlotId, course.price, notes, paymentMethodValue]);

    // Update time slot booking count
    db.run(`
      UPDATE time_slots
      SET current_booked = current_booked + 1,
          status = CASE WHEN current_booked + 1 >= max_capacity THEN 'full' ELSE 'available' END
      WHERE id = ?
    `, [actualTimeSlotId]);

    const newAppointment = db.get(`
      SELECT a.*,
        c.name as course_name, c.subject as course_subject,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.id = ?
    `, [result.lastId]);

    res.json({
      success: true,
      message: '预约成功',
      data: {
        appointment: newAppointment,
        payment_method: paymentMethodValue,
        total_amount: total_amount || course.price,
        class_count: class_count || 1
      }
    });
  } catch (error) {
    console.error('创建预约错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建预约失败' 
    });
  }
});

// Update appointment status (admin)
router.put('/:id/status', authenticate, requireAdmin, (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: '无效的状态' 
      });
    }

    const appointment = db.get('SELECT a.*, ts.id as time_slot_id FROM appointments a LEFT JOIN time_slots ts ON a.time_slot_id = ts.id WHERE a.id = ?', [req.params.id]);
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: '预约不存在' 
      });
    }

    // If cancelling, update time slot
    if (status === 'cancelled' && appointment.status !== 'cancelled') {
      db.run(`
        UPDATE time_slots 
        SET current_booked = current_booked - 1,
            status = CASE WHEN current_booked - 1 < max_capacity THEN 'available' ELSE 'full' END
        WHERE id = ?
      `, [appointment.time_slot_id]);
    }

    db.run('UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);

    const updatedAppointment = db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '状态更新成功',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('更新预约状态错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新预约状态失败' 
    });
  }
});

// Cancel appointment (student)
router.put('/:id/cancel', authenticate, (req, res) => {
  try {
    // Get student info
    const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(400).json({ 
        success: false, 
        message: '学生信息不存在' 
      });
    }

    const appointment = db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: '预约不存在' 
      });
    }

    // Check permission
    if (appointment.student_id !== student.id) {
      return res.status(403).json({ 
        success: false, 
        message: '无权取消此预约' 
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: '预约已取消' 
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: '已完成的预约无法取消' 
      });
    }

    // Update appointment
    db.run('UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['cancelled', req.params.id]);

    // Update time slot
    db.run(`
      UPDATE time_slots 
      SET current_booked = current_booked - 1,
          status = CASE WHEN current_booked - 1 < max_capacity THEN 'available' ELSE 'full' END
      WHERE id = ?
    `, [appointment.time_slot_id]);

    res.json({
      success: true,
      message: '预约已取消'
    });
  } catch (error) {
    console.error('取消预约错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '取消预约失败' 
    });
  }
});


// Get appointments by date range (admin)
router.get('/range', authenticate, requireAdmin, (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供日期范围' 
      });
    }

    const appointments = db.all(`
      SELECT a.*, 
        s.name as student_name, s.grade as student_grade,
        c.name as course_name, c.subject as course_subject,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE ts.start_time >= ? AND ts.end_time <= ?
      ORDER BY ts.start_time ASC
    `, [start_date, end_date]);

    res.json({
      success: true,
      data: appointments
    });
  } catch (error) {
    console.error('获取日期范围预约错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取预约失败' 
    });
  }
});

// Get available slots for booking
router.get('/available-slots', authenticate, (req, res) => {
  try {
    const { course_id, start_date, end_date } = req.query;

    let sql = `
      SELECT ts.*, c.name as course_name, c.subject, c.duration
      FROM time_slots ts
      JOIN courses c ON ts.course_id = c.id
      WHERE ts.status = 'available' AND ts.start_time > datetime('now', 'localtime')
    `;
    const params = [];

    if (course_id) {
      sql += ' AND ts.course_id = ?';
      params.push(course_id);
    }
    if (start_date) {
      sql += ' AND ts.start_time >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND ts.end_time <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY ts.start_time ASC';

    const slots = db.all(sql, params);

    res.json({
      success: true,
      data: slots
    });
  } catch (error) {
    console.error('获取可用时间段错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取可用时间段失败' 
    });
  }
});

// Update payment status (student can mark as paid, admin can confirm)
router.put('/:id/payment', authenticate, (req, res) => {
  try {
    const { payment_status } = req.body;
    const { id } = req.params;

    if (!payment_status) {
      return res.status(400).json({
        success: false,
        message: '请提供支付状态'
      });
    }

    // Validate payment status
    const validStatuses = ['unpaid', 'pending', 'paid', 'confirmed'];
    if (!validStatuses.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        message: '无效的支付状态'
      });
    }

    const appointment = db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: '预约不存在'
      });
    }

    // Check permission
    if (req.user.role !== 'admin') {
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student || appointment.student_id !== student.id) {
        return res.status(403).json({
          success: false,
          message: '无权更新此预约'
        });
      }
      // Student can only mark as paid, not confirmed
      if (payment_status === 'confirmed') {
        return res.status(403).json({
          success: false,
          message: '学生无法确认支付，请联系老师'
        });
      }
    }

    // Update payment status
    db.run(`
      UPDATE appointments
      SET payment_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [payment_status, id]);

    const updatedAppointment = db.get(`
      SELECT a.*,
        s.name as student_name,
        c.name as course_name, c.subject as course_subject,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.id = ?
    `, [id]);

    res.json({
      success: true,
      message: '支付状态已更新',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('更新支付状态错误:', error);
    res.status(500).json({
      success: false,
      message: '更新支付状态失败'
    });
  }
});

// Confirm payment (admin only)
router.put('/:id/confirm-payment', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;

    const appointment = db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: '预约不存在'
      });
    }

    // Update payment status to confirmed
    db.run(`
      UPDATE appointments
      SET payment_status = 'confirmed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    const updatedAppointment = db.get(`
      SELECT a.*,
        s.name as student_name,
        c.name as course_name, c.subject as course_subject,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.id = ?
    `, [id]);

    res.json({
      success: true,
      message: '支付已确认',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('确认支付错误:', error);
    res.status(500).json({
      success: false,
      message: '确认支付失败'
    });
  }
});

// Change appointment time slot (student)
router.put('/:id/change-time', authenticate, (req, res) => {
  try {
    const { new_time_slot_id, change_reason } = req.body;
    
    // Get student info
    const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: '学生信息不存在'
      });
    }

    const appointment = db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: '预约不存在'
      });
    }

    // Check permission
    if (appointment.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: '无权修改此预约'
      });
    }

    // Check if appointment can be modified
    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: '已取消或已完成的预约无法修改时间'
      });
    }

    if (!new_time_slot_id) {
      return res.status(400).json({
        success: false,
        message: '请选择新的上课时间'
      });
    }

    // Parse old and new time slot
    const oldParsedSlot = parseDynamicTimeSlot(appointment.time_slot_id);
    const newParsedSlot = parseDynamicTimeSlot(new_time_slot_id);

    // Get old start time for logging
    const oldStartTime = appointment.start_time || (oldParsedSlot ? oldParsedSlot.start_time : null);
    const newStartTime = newParsedSlot ? newParsedSlot.start_time : null;

    // Update appointment time_slot_id
    db.run(`
      UPDATE appointments
      SET time_slot_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [new_time_slot_id, req.params.id]);

    // Log the change
    db.run(`
      INSERT INTO appointment_change_logs
      (appointment_id, old_time_slot_id, new_time_slot_id, old_start_time, new_start_time, change_reason, changed_by, changed_by_role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.params.id, appointment.time_slot_id, new_time_slot_id, oldStartTime, newStartTime, change_reason || '学生修改时间', req.user.id, 'student']);

    const updatedAppointment = db.get(`
      SELECT a.*,
        c.name as course_name, c.subject as course_subject
      FROM appointments a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.id = ?
    `, [req.params.id]);

    // Add parsed time to response
    if (newParsedSlot) {
      updatedAppointment.start_time = newParsedSlot.start_time;
      updatedAppointment.end_time = newParsedSlot.end_time;
    }

    res.json({
      success: true,
      message: '预约时间已修改',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('修改预约时间错误:', error);
    res.status(500).json({
      success: false,
      message: '修改预约时间失败'
    });
  }
});

// Get appointment change logs
router.get('/:id/change-logs', authenticate, (req, res) => {
  try {
    // Check permission
    if (req.user.role !== 'admin') {
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student) {
        return res.status(400).json({
          success: false,
          message: '学生信息不存在'
        });
      }
      
      const appointment = db.get('SELECT student_id FROM appointments WHERE id = ?', [req.params.id]);
      if (!appointment || appointment.student_id !== student.id) {
        return res.status(403).json({
          success: false,
          message: '无权查看此预约记录'
        });
      }
    }

    const logs = db.all(`
      SELECT acl.*, u.username as changed_by_name
      FROM appointment_change_logs acl
      LEFT JOIN users u ON acl.changed_by = u.id
      WHERE acl.appointment_id = ?
      ORDER BY acl.created_at DESC
    `, [req.params.id]);

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取修改记录错误:', error);
    res.status(500).json({
      success: false,
      message: '获取修改记录失败'
    });
  }
});

// Request leave for appointment (student)
router.put('/:id/leave', authenticate, (req, res) => {
  try {
    const { leave_reason } = req.body;
    
    // Get student info
    const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: '学生信息不存在'
      });
    }

    const appointment = db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: '预约不存在'
      });
    }

    // Check permission
    if (appointment.student_id !== student.id) {
      return res.status(403).json({
        success: false,
        message: '无权对此预约请假'
      });
    }

    // Check if appointment can be leave
    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: '已取消或已完成的预约无法请假'
      });
    }

    // Check if already has leave request
    if (appointment.leave_status === 'pending' || appointment.leave_status === 'approved') {
      return res.status(400).json({
        success: false,
        message: '该预约已有请假申请'
      });
    }

    // Update leave status
    db.run(`
      UPDATE appointments
      SET leave_status = 'pending', leave_reason = ?, leave_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [leave_reason || '', req.params.id]);

    const updatedAppointment = db.get(`
      SELECT a.*,
        c.name as course_name, c.subject as course_subject
      FROM appointments a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      message: '请假申请已提交',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('请假申请错误:', error);
    res.status(500).json({
      success: false,
      message: '请假申请失败'
    });
  }
});

// Approve/Reject leave request (admin)
router.put('/:id/leave-approve', authenticate, requireAdmin, (req, res) => {
  try {
    const { approved } = req.body;
    const appointment = db.get('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: '预约不存在'
      });
    }

    if (appointment.leave_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '该预约没有待处理的请假申请'
      });
    }

    const newLeaveStatus = approved ? 'approved' : 'rejected';
    const newAppointmentStatus = approved ? 'cancelled' : appointment.status;

    db.run(`
      UPDATE appointments
      SET leave_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newLeaveStatus, newAppointmentStatus, req.params.id]);

    const updatedAppointment = db.get(`
      SELECT a.*,
        s.name as student_name,
        c.name as course_name, c.subject as course_subject
      FROM appointments a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      message: approved ? '请假已批准' : '请假已拒绝',
      data: updatedAppointment
    });
  } catch (error) {
    console.error('处理请假申请错误:', error);
    res.status(500).json({
      success: false,
      message: '处理请假申请失败'
    });
  }
});

module.exports = router;