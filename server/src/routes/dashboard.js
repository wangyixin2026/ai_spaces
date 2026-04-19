const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Admin dashboard stats
router.get('/admin', authenticate, requireAdmin, (req, res) => {
  try {
    // Total students
    const totalStudents = db.get('SELECT COUNT(*) as count FROM students');

    // Total courses
    const totalCourses = db.get('SELECT COUNT(*) as count FROM courses WHERE status = "active"');

    // Total appointments this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartStr = monthStart.toISOString().slice(0, 19).replace('T', ' ');

    const appointmentsThisMonth = db.get(`
      SELECT COUNT(*) as count FROM appointments 
      WHERE created_at >= ?
    `, [monthStartStr]);

    // Completed appointments this month
    const completedThisMonth = db.get(`
      SELECT COUNT(*) as count FROM appointments 
      WHERE status = 'completed' AND created_at >= ?
    `, [monthStartStr]);

    // Revenue this month (应收课时费：所有未取消的预约)
    const revenueThisMonth = db.get(`
      SELECT SUM(amount) as total FROM appointments
      WHERE status != 'cancelled' AND created_at >= ?
    `, [monthStartStr]);

    // Pending appointments
    const pendingAppointments = db.get(`
      SELECT COUNT(*) as count FROM appointments WHERE status = 'pending'
    `);

    // Unpaid appointments
    const unpaidAppointments = db.get(`
      SELECT COUNT(*) as count FROM appointments WHERE payment_status = 'unpaid' AND status != 'cancelled'
    `);

    // Recent appointments
    const recentAppointments = db.all(`
      SELECT a.*, 
        s.name as student_name, s.grade as student_grade,
        c.name as course_name, c.subject as course_subject,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    // Upcoming classes (next 7 days)
    const upcomingClasses = db.all(`
      SELECT ts.*, c.name as course_name, c.subject,
        s.name as student_name
      FROM time_slots ts
      LEFT JOIN courses c ON ts.course_id = c.id
      LEFT JOIN appointments a ON ts.id = a.time_slot_id AND a.status != 'cancelled'
      LEFT JOIN students s ON a.student_id = s.id
      WHERE ts.start_time >= datetime('now', 'localtime') 
        AND ts.start_time <= datetime('now', '+7 days', 'localtime')
        AND ts.current_booked > 0
      ORDER BY ts.start_time ASC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: {
        stats: {
          totalStudents: totalStudents.count,
          totalCourses: totalCourses.count,
          appointmentsThisMonth: appointmentsThisMonth.count,
          completedThisMonth: completedThisMonth.count,
          revenueThisMonth: revenueThisMonth.total || 0,
          pendingAppointments: pendingAppointments.count,
          unpaidAppointments: unpaidAppointments.count
        },
        recentAppointments,
        upcomingClasses
      }
    });
  } catch (error) {
    console.error('获取管理员仪表盘错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取仪表盘数据失败' 
    });
  }
});

// Student dashboard stats
router.get('/student', authenticate, (req, res) => {
  try {
    // Get student
    const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.json({
        success: true,
        data: {
          stats: {
            totalAppointments: 0,
            completedAppointments: 0,
            upcomingAppointments: 0,
            pendingHomework: 0
          },
          upcomingAppointments: [],
          pendingHomework: []
        }
      });
    }

    // Total appointments
    const totalAppointments = db.get(`
      SELECT COUNT(*) as count FROM appointments WHERE student_id = ?
    `, [student.id]);

    // Completed appointments
    const completedAppointments = db.get(`
      SELECT COUNT(*) as count FROM appointments WHERE student_id = ? AND status = 'completed'
    `, [student.id]);

    // Upcoming appointments
    const upcomingAppointments = db.get(`
      SELECT COUNT(*) as count FROM appointments a
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.student_id = ? AND a.status != 'cancelled' AND ts.start_time > datetime('now', 'localtime')
    `, [student.id]);

    // Pending homework
    const pendingHomework = db.get(`
      SELECT COUNT(*) as count FROM homework h
      LEFT JOIN courses c ON h.course_id = c.id
      WHERE c.status = 'active' AND h.deadline > datetime('now', 'localtime')
        AND NOT EXISTS (
          SELECT 1 FROM homework_submissions hs
          WHERE hs.homework_id = h.id AND hs.student_id = ?
        )
    `, [student.id]);

    // Average homework score (已批改作业的平均得分)
    const averageScoreResult = db.get(`
      SELECT AVG(score) as average FROM homework_submissions
      WHERE student_id = ? AND status = 'graded' AND score IS NOT NULL
    `, [student.id]);

    // Recent reports
    const recentReports = db.all(`
      SELECT * FROM learning_reports
      WHERE student_id = ?
      ORDER BY created_at DESC
      LIMIT 3
    `, [student.id]);

    // Upcoming appointments details
    const upcomingList = db.all(`
      SELECT a.*, 
        c.name as course_name, c.subject as course_subject,
        ts.start_time, ts.end_time
      FROM appointments a
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.student_id = ? AND a.status != 'cancelled' AND ts.start_time > datetime('now', 'localtime')
      ORDER BY ts.start_time ASC
      LIMIT 5
    `, [student.id]);

    // Pending homework details
    const pendingHomeworkList = db.all(`
      SELECT h.*, c.name as course_name, c.subject as course_subject
      FROM homework h
      LEFT JOIN courses c ON h.course_id = c.id
      WHERE c.status = 'active' AND h.deadline > datetime('now', 'localtime')
        AND NOT EXISTS (
          SELECT 1 FROM homework_submissions hs 
          WHERE hs.homework_id = h.id AND hs.student_id = ?
        )
      ORDER BY h.deadline ASC
      LIMIT 5
    `, [student.id]);

    res.json({
      success: true,
      data: {
        stats: {
          totalAppointments: totalAppointments.count,
          completedAppointments: completedAppointments.count,
          upcomingAppointments: upcomingAppointments.count,
          pendingHomework: pendingHomework.count,
          averageScore: averageScoreResult.average ? Math.round(averageScoreResult.average * 10) / 10 : 0,
          recentReports: recentReports
        },
        upcomingAppointments: upcomingList,
        pendingHomework: pendingHomeworkList
      }
    });
  } catch (error) {
    console.error('获取学生仪表盘错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取仪表盘数据失败' 
    });
  }
});

// Get schedule calendar data
router.get('/schedule', authenticate, (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供日期范围' 
      });
    }

    let sql;
    let params = [];

    if (req.user.role === 'admin') {
      sql = `
        SELECT ts.id, ts.course_id, ts.start_time, ts.end_time, ts.status, ts.current_booked, ts.max_capacity,
          c.name as course_name, c.subject,
          s.name as student_name, s.grade as student_grade
        FROM time_slots ts
        LEFT JOIN courses c ON ts.course_id = c.id
        LEFT JOIN appointments a ON ts.id = a.time_slot_id AND a.status != 'cancelled'
        LEFT JOIN students s ON a.student_id = s.id
        WHERE ts.start_time >= ? AND ts.end_time <= ?
        ORDER BY ts.start_time ASC
      `;
      params = [start_date, end_date];
    } else {
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student) {
        return res.json({ success: true, data: [] });
      }
      sql = `
        SELECT ts.id, ts.course_id, ts.start_time, ts.end_time, ts.status,
          c.name as course_name, c.subject,
          a.id as appointment_id, a.status as appointment_status
        FROM time_slots ts
        LEFT JOIN courses c ON ts.course_id = c.id
        LEFT JOIN appointments a ON ts.id = a.time_slot_id AND a.student_id = ? AND a.status != 'cancelled'
        WHERE ts.start_time >= ? AND ts.end_time <= ?
        ORDER BY ts.start_time ASC
      `;
      params = [student.id, start_date, end_date];
    }

    const schedule = db.all(sql, params);

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('获取日程错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取日程失败' 
    });
  }
});

module.exports = router;