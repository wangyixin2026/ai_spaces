const express = require('express');
const router = express.Router();
const db = require('../database/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all homework (admin: all, student: own course's)
router.get('/', authenticate, (req, res) => {
  try {
    let sql;
    let params = [];

    if (req.user.role === 'admin') {
      sql = `
        SELECT h.*, c.name as course_name, c.subject as course_subject,
          (SELECT COUNT(*) FROM homework_submissions hs WHERE hs.homework_id = h.id) as submission_count,
          (SELECT COUNT(*) FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.status = 'graded') as graded_count
        FROM homework h
        LEFT JOIN courses c ON h.course_id = c.id
        ORDER BY h.deadline DESC
      `;
    } else {
      // Get student's enrolled courses homework
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (!student) {
        return res.json({ success: true, data: [] });
      }
      
      // Show homework that:
      // 1. Is assigned to this student (via homework_assignments table)
      // 2. Or has no specific assignments (show to all students of the course)
      sql = `
        SELECT h.*, c.name as course_name, c.subject as course_subject,
          (SELECT status FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.student_id = ?) as my_status,
          (SELECT score FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.student_id = ?) as my_score,
          (SELECT is_late FROM homework_submissions hs WHERE hs.homework_id = h.id AND hs.student_id = ?) as my_is_late,
          (SELECT COUNT(*) FROM homework_assignments ha2 WHERE ha2.homework_id = h.id) as assigned_count
        FROM homework h
        LEFT JOIN courses c ON h.course_id = c.id
        LEFT JOIN homework_assignments ha ON h.id = ha.homework_id AND ha.student_id = ?
        WHERE c.status = 'active' AND (ha.student_id = ? OR (SELECT COUNT(*) FROM homework_assignments ha2 WHERE ha2.homework_id = h.id) = 0)
        ORDER BY h.deadline DESC
      `;
      params = [student.id, student.id, student.id, student.id, student.id];
    }

    const homework = db.all(sql, params);

    res.json({
      success: true,
      data: homework
    });
  } catch (error) {
    console.error('获取作业列表错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取作业列表失败' 
    });
  }
});

// Get single homework
router.get('/:id', authenticate, (req, res) => {
  try {
    const homework = db.get(`
      SELECT h.*, c.name as course_name, c.subject as course_subject
      FROM homework h
      LEFT JOIN courses c ON h.course_id = c.id
      WHERE h.id = ?
    `, [req.params.id]);

    if (!homework) {
      return res.status(404).json({ 
        success: false, 
        message: '作业不存在' 
      });
    }

    // Get submissions for this homework
    let submissions;
    if (req.user.role === 'admin') {
      submissions = db.all(`
        SELECT hs.*, s.name as student_name, s.grade as student_grade
        FROM homework_submissions hs
        LEFT JOIN students s ON hs.student_id = s.id
        WHERE hs.homework_id = ?
        ORDER BY hs.submitted_at DESC
      `, [req.params.id]);
      
      // 为每个提交添加学生的预约上课时间
      submissions = submissions.map(submission => {
        const appointments = db.all(`
          SELECT a.id, a.status, a.payment_status,
            c.name as course_name, c.subject as course_subject,
            ts.start_time, ts.end_time
          FROM appointments a
          LEFT JOIN courses c ON a.course_id = c.id
          LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
          WHERE a.student_id = ? AND a.status != 'cancelled'
          ORDER BY ts.start_time ASC
          LIMIT 5
        `, [submission.student_id]);
        return { ...submission, appointments };
      });
    } else {
      const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
      if (student) {
        submissions = db.all(`
          SELECT hs.* FROM homework_submissions hs
          WHERE hs.homework_id = ? AND hs.student_id = ?
        `, [req.params.id, student.id]);
      } else {
        submissions = [];
      }
    }

    res.json({
      success: true,
      data: {
        ...homework,
        submissions
      }
    });
  } catch (error) {
    console.error('获取作业详情错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取作业详情失败' 
    });
  }
});

// Create homework (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { course_id, title, content, attachments, deadline, student_ids } = req.body;

    if (!course_id || !title) {
      return res.status(400).json({
        success: false,
        message: '课程和标题不能为空'
      });
    }

    // Check course exists
    const course = db.get('SELECT id FROM courses WHERE id = ?', [course_id]);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    const result = db.run(`
      INSERT INTO homework (course_id, title, content, attachments, deadline)
      VALUES (?, ?, ?, ?, ?)
    `, [course_id, title, content, attachments ? JSON.stringify(attachments) : null, deadline]);

    const homeworkId = result.lastId;

    // If student_ids provided, assign homework to specific students
    if (student_ids && student_ids.length > 0) {
      for (const studentId of student_ids) {
        db.run(`
          INSERT OR IGNORE INTO homework_assignments (homework_id, student_id)
          VALUES (?, ?)
        `, [homeworkId, studentId]);
      }
    }

    const newHomework = db.get('SELECT * FROM homework WHERE id = ?', [homeworkId]);

    res.json({
      success: true,
      message: '作业发布成功',
      data: newHomework
    });
  } catch (error) {
    console.error('发布作业错误:', error);
    res.status(500).json({
      success: false,
      message: '发布作业失败'
    });
  }
});

// Update homework (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { title, content, attachments, deadline } = req.body;

    const homework = db.get('SELECT id FROM homework WHERE id = ?', [req.params.id]);
    if (!homework) {
      return res.status(404).json({ 
        success: false, 
        message: '作业不存在' 
      });
    }

    db.run(`
      UPDATE homework 
      SET title = ?, content = ?, attachments = ?, deadline = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title, content, attachments ? JSON.stringify(attachments) : null, deadline, req.params.id]);

    const updatedHomework = db.get('SELECT * FROM homework WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '作业更新成功',
      data: updatedHomework
    });
  } catch (error) {
    console.error('更新作业错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新作业失败' 
    });
  }
});

// Delete homework (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const homework = db.get('SELECT id FROM homework WHERE id = ?', [req.params.id]);
    if (!homework) {
      return res.status(404).json({ 
        success: false, 
        message: '作业不存在' 
      });
    }

    // Delete submissions first
    db.run('DELETE FROM homework_submissions WHERE homework_id = ?', [req.params.id]);
    db.run('DELETE FROM homework WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: '作业删除成功'
    });
  } catch (error) {
    console.error('删除作业错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除作业失败' 
    });
  }
});

// Submit homework (student)
router.post('/:id/submit', authenticate, (req, res) => {
  try {
    const { content, attachments, images } = req.body;

    // Get student
    const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: '学生信息不存在'
      });
    }

    // Check homework exists
    const homework = db.get('SELECT id, deadline FROM homework WHERE id = ?', [req.params.id]);
    if (!homework) {
      return res.status(404).json({
        success: false,
        message: '作业不存在'
      });
    }

    // Check if already submitted
    const existingSubmission = db.get(`
      SELECT id, is_late FROM homework_submissions
      WHERE homework_id = ? AND student_id = ?
    `, [req.params.id, student.id]);

    // Determine if this is a late submission
    const isLate = req.body.is_late || false;

    if (existingSubmission) {
      // 补交作业不允许修改
      if (existingSubmission.is_late) {
        return res.status(400).json({
          success: false,
          message: '补交作业无法修改'
        });
      }
      
      // Update existing submission
      db.run(`
        UPDATE homework_submissions
        SET content = ?, attachments = ?, images = ?, status = 'submitted', submitted_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [content, attachments ? JSON.stringify(attachments) : null, images || null, existingSubmission.id]);

      const updatedSubmission = db.get('SELECT * FROM homework_submissions WHERE id = ?', [existingSubmission.id]);

      res.json({
        success: true,
        message: '作业已更新',
        data: updatedSubmission
      });
    } else {
      // Create new submission with is_late flag
      const result = db.run(`
        INSERT INTO homework_submissions (homework_id, student_id, content, attachments, images, is_late)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [req.params.id, student.id, content, attachments ? JSON.stringify(attachments) : null, images || null, isLate ? 1 : 0]);

      const newSubmission = db.get('SELECT * FROM homework_submissions WHERE id = ?', [result.lastId]);

      res.json({
        success: true,
        message: isLate ? '作业补交成功' : '作业提交成功',
        data: newSubmission
      });
    }
  } catch (error) {
    console.error('提交作业错误:', error);
    res.status(500).json({
      success: false,
      message: '提交作业失败'
    });
  }
});

// Grade homework submission (admin only)
router.put('/:id/submissions/:submissionId/grade', authenticate, requireAdmin, (req, res) => {
  try {
    const { score, feedback } = req.body;

    if (score === undefined || score === null) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供分数' 
      });
    }

    const submission = db.get(`
      SELECT hs.*, h.id as homework_id
      FROM homework_submissions hs
      LEFT JOIN homework h ON hs.homework_id = h.id
      WHERE hs.id = ? AND h.id = ?
    `, [req.params.submissionId, req.params.id]);

    if (!submission) {
      return res.status(404).json({ 
        success: false, 
        message: '提交记录不存在' 
      });
    }

    db.run(`
      UPDATE homework_submissions 
      SET score = ?, feedback = ?, status = 'graded', graded_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [score, feedback, req.params.submissionId]);

    const updatedSubmission = db.get('SELECT * FROM homework_submissions WHERE id = ?', [req.params.submissionId]);

    res.json({
      success: true,
      message: '批改成功',
      data: updatedSubmission
    });
  } catch (error) {
    console.error('批改作业错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '批改作业失败' 
    });
  }
});

// Get student's submissions
router.get('/my-submissions', authenticate, (req, res) => {
  try {
    const student = db.get('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (!student) {
      return res.json({ success: true, data: [] });
    }

    const submissions = db.all(`
      SELECT hs.*, 
        h.title as homework_title, h.deadline,
        c.name as course_name, c.subject as course_subject
      FROM homework_submissions hs
      LEFT JOIN homework h ON hs.homework_id = h.id
      LEFT JOIN courses c ON h.course_id = c.id
      WHERE hs.student_id = ?
      ORDER BY hs.submitted_at DESC
    `, [student.id]);

    res.json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('获取提交记录错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取提交记录失败' 
    });
  }
});

module.exports = router;