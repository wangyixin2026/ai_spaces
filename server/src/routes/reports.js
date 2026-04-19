const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all reports (admin: all, student: own)
router.get('/', authenticate, (req, res) => {
  try {
    let sql;
    let params = [];

    if (req.user.role === 'admin') {
      sql = `
        SELECT lr.*, s.name as student_name, s.grade as student_grade
        FROM learning_reports lr
        LEFT JOIN students s ON lr.student_id = s.id
        ORDER BY lr.created_at DESC
      `;
    } else {
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student) {
        return res.json({ success: true, data: [] });
      }
      sql = `
        SELECT lr.*, s.name as student_name, s.grade as student_grade
        FROM learning_reports lr
        LEFT JOIN students s ON lr.student_id = s.id
        WHERE lr.student_id = ?
        ORDER BY lr.created_at DESC
      `;
      params = [student.id];
    }

    const reports = db.all(sql, params);

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('获取报告列表错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取报告列表失败' 
    });
  }
});

// Get single report
router.get('/:id', authenticate, (req, res) => {
  try {
    const report = db.get(`
      SELECT lr.*, s.name as student_name, s.grade as student_grade, s.school as student_school
      FROM learning_reports lr
      LEFT JOIN students s ON lr.student_id = s.id
      WHERE lr.id = ?
    `, [req.params.id]);

    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: '报告不存在' 
      });
    }

    // Check permission
    if (req.user.role !== 'admin') {
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student || report.student_id !== student.id) {
        return res.status(403).json({ 
          success: false, 
          message: '无权查看此报告' 
        });
      }
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('获取报告详情错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取报告详情失败' 
    });
  }
});

// Create report (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { 
      student_id, report_type, title, content, 
      period_start, period_end, 
      attendance_rate, homework_completion_rate, average_score, 
      teacher_comment 
    } = req.body;

    if (!student_id) {
      return res.status(400).json({ 
        success: false, 
        message: '学生不能为空' 
      });
    }

    // Check student exists
    const student = db.get('SELECT id FROM students WHERE id = ?', [student_id]);
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: '学生不存在' 
      });
    }

    const result = db.run(`
      INSERT INTO learning_reports (
        student_id, report_type, title, content,
        period_start, period_end,
        attendance_rate, homework_completion_rate, average_score,
        teacher_comment
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      student_id, report_type || 'weekly', title, content,
      period_start, period_end,
      attendance_rate, homework_completion_rate, average_score,
      teacher_comment
    ]);

    const newReport = db.get('SELECT * FROM learning_reports WHERE id = ?', [result.lastId]);

    res.json({
      success: true,
      message: '报告创建成功',
      data: newReport
    });
  } catch (error) {
    console.error('创建报告错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建报告失败' 
    });
  }
});

// Update report (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { 
      report_type, title, content, 
      period_start, period_end, 
      attendance_rate, homework_completion_rate, average_score, 
      teacher_comment 
    } = req.body;

    const report = db.get('SELECT id FROM learning_reports WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: '报告不存在' 
      });
    }

    db.run(`
      UPDATE learning_reports 
      SET report_type = ?, title = ?, content = ?,
          period_start = ?, period_end = ?,
          attendance_rate = ?, homework_completion_rate = ?, average_score = ?,
          teacher_comment = ?
      WHERE id = ?
    `, [
      report_type, title, content,
      period_start, period_end,
      attendance_rate, homework_completion_rate, average_score,
      teacher_comment, req.params.id
    ]);

    const updatedReport = db.get('SELECT * FROM learning_reports WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '报告更新成功',
      data: updatedReport
    });
  } catch (error) {
    console.error('更新报告错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新报告失败' 
    });
  }
});

// Delete report (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const report = db.get('SELECT id FROM learning_reports WHERE id = ?', [req.params.id]);
    if (!report) {
      return res.status(404).json({ 
        success: false, 
        message: '报告不存在' 
      });
    }

    db.run('DELETE FROM learning_reports WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '报告删除成功'
    });
  } catch (error) {
    console.error('删除报告错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除报告失败' 
    });
  }
});

// Generate auto report (admin or student for themselves)
router.post('/generate', authenticate, (req, res) => {
  try {
    const { student_id, report_type, period_start, period_end } = req.body;

    // For students, use their own student_id
    let targetStudentId = student_id;
    
    if (req.user.role !== 'admin') {
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student) {
        return res.status(403).json({
          success: false,
          message: '学生信息不存在'
        });
      }
      targetStudentId = student.id; // Students can only generate reports for themselves
    }

    if (!targetStudentId || !period_start || !period_end) {
      return res.status(400).json({
        success: false,
        message: '请提供时间范围'
      });
    }

    // Check student exists
    const student = db.get('SELECT id, name, grade FROM students WHERE id = ?', [targetStudentId]);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: '学生不存在'
      });
    }

    // Calculate attendance rate
    // 出勤率 = (预约课数 - 请假) / 预约课数
    // 请假不算出勤
    const appointmentStats = db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN a.leave_status = 'approved' THEN 1 ELSE 0 END) as leave_approved
      FROM appointments a
      LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.student_id = ? AND ts.start_time >= ? AND ts.end_time <= ?
    `, [targetStudentId, period_start, period_end]);

    // 出勤人数 = 总预约课数 - 请假批准的课数
    const attendedCount = (appointmentStats.total || 0) - (appointmentStats.leave_approved || 0);
    const attendanceRate = appointmentStats.total > 0
      ? Math.round((attendedCount / appointmentStats.total) * 100)
      : 0;

    // Calculate homework completion rate - based on all active course homework for this student
    // Get courses the student has appointments with
    const studentCourses = db.all(`
      SELECT DISTINCT c.id, c.name
      FROM courses c
      JOIN appointments a ON a.course_id = c.id
      WHERE a.student_id = ? AND a.status != 'cancelled'
    `, [targetStudentId]);
    
    const courseIds = studentCourses.map(c => c.id);
    
    // Calculate homework completion for student's courses
    let totalHomework = 0;
    let submittedHomework = 0;
    
    if (courseIds.length > 0) {
      const homeworkStats = db.get(`
        SELECT
          COUNT(DISTINCT h.id) as total_homework,
          COUNT(DISTINCT CASE WHEN hs.id IS NOT NULL THEN h.id END) as submitted
        FROM homework h
        LEFT JOIN homework_submissions hs ON h.id = hs.homework_id AND hs.student_id = ?
        WHERE h.course_id IN (${courseIds.map(() => '?').join(',')})
      `, [targetStudentId, ...courseIds]);
      
      totalHomework = homeworkStats.total_homework || 0;
      submittedHomework = homeworkStats.submitted || 0;
    }

    const homeworkCompletionRate = totalHomework > 0
      ? Math.round((submittedHomework / totalHomework) * 100)
      : 0;

    // Calculate average score
    const scoreStats = db.get(`
      SELECT AVG(score) as avg_score
      FROM homework_submissions
      WHERE student_id = ? AND score IS NOT NULL AND graded_at >= ? AND graded_at <= ?
    `, [targetStudentId, period_start, period_end]);

    const averageScore = scoreStats.avg_score || 0;

    // Generate title
    const title = `${student.name} - ${report_type === 'weekly' ? '周报' : report_type === 'monthly' ? '月报' : '学习报告'} (${period_start} ~ ${period_end})`;

    // Create report
    const result = db.run(`
      INSERT INTO learning_reports (
        student_id, report_type, title,
        period_start, period_end,
        attendance_rate, homework_completion_rate, average_score
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      targetStudentId, report_type || 'weekly', title,
      period_start, period_end,
      attendanceRate, homeworkCompletionRate, Math.round(averageScore * 100) / 100
    ]);

    const newReport = db.get('SELECT * FROM learning_reports WHERE id = ?', [result.lastId]);

    res.json({
      success: true,
      message: '报告生成成功',
      data: {
        ...newReport,
        student_name: student.name,
        student_grade: student.grade
      }
    });
  } catch (error) {
    console.error('生成报告错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '生成报告失败' 
    });
  }
});

module.exports = router;