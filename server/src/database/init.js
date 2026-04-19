const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../../data/booking.db');

// Database instance and ready state
let db = null;
let dbReady = false;
let initPromise = null;

// Initialize database
async function initializeDatabase() {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    console.log('正在初始化数据库...');
    
    // Initialize SQL.js
    const SQL = await initSqlJs();
    
    // Check if database file exists
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
    
    // Create tables
    createTables();
    
    // Create default admin user
    createDefaultAdmin();
    
    // Save database to file
    saveDatabase();
    
    dbReady = true;
    console.log('数据库初始化完成');
    return true;
  })();
  
  return initPromise;
}

function createTables() {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT,
      role TEXT DEFAULT 'student',
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Students table
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      gender TEXT,
      grade TEXT,
      school TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Courses table
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade_level TEXT,
      description TEXT,
      duration INTEGER DEFAULT 60,
      price DECIMAL(10,2) DEFAULT 0,
      max_students INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Time slots table
  db.run(`
    CREATE TABLE IF NOT EXISTS time_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      max_capacity INTEGER DEFAULT 1,
      current_booked INTEGER DEFAULT 0,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `);

  // Appointments table
  db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      time_slot_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      amount DECIMAL(10,2) DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid',
      payment_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE
    )
  `);

  // Homework table
  db.run(`
    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      attachments TEXT,
      deadline DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
  `);

  // Homework submissions table
  db.run(`
    CREATE TABLE IF NOT EXISTS homework_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      homework_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      content TEXT,
      attachments TEXT,
      images TEXT,
      score DECIMAL(5,2),
      feedback TEXT,
      status TEXT DEFAULT 'submitted',
      is_late INTEGER DEFAULT 0,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      graded_at DATETIME,
      FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // Learning reports table
  db.run(`
    CREATE TABLE IF NOT EXISTS learning_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      report_type TEXT DEFAULT 'weekly',
      title TEXT,
      content TEXT,
      period_start DATE,
      period_end DATE,
      attendance_rate DECIMAL(5,2),
      homework_completion_rate DECIMAL(5,2),
      average_score DECIMAL(5,2),
      teacher_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
  `);

  // Payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_id TEXT,
      status TEXT DEFAULT 'pending',
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    )
  `);

  // Payment settings table (for QR codes)
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_type TEXT NOT NULL UNIQUE,
      qr_code TEXT,
      account_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default payment settings if not exist
  const existingSettings = db.exec("SELECT id FROM payment_settings");
  if (existingSettings.length === 0 || existingSettings[0].values.length === 0) {
    db.run(`INSERT INTO payment_settings (payment_type, account_name, is_active) VALUES ('wechat', '微信支付', 1)`);
    db.run(`INSERT INTO payment_settings (payment_type, account_name, is_active) VALUES ('alipay', '支付宝', 1)`);
  }

  // Add gender column to students table if not exists
  try {
    const studentsTableInfo = db.exec("PRAGMA table_info(students)");
    if (studentsTableInfo.length > 0) {
      const columns = studentsTableInfo[0].values.map(col => col[1]); // col[1] is column name
      if (!columns.includes('gender')) {
        db.run(`ALTER TABLE students ADD COLUMN gender TEXT`);
        console.log('已添加gender列到students表');
      }
    }
  } catch (error) {
    console.log('检查/添加gender列时出错:', error.message);
  }

  // Appointment change logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS appointment_change_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      old_time_slot_id TEXT,
      new_time_slot_id TEXT,
      old_start_time TEXT,
      new_start_time TEXT,
      change_reason TEXT,
      changed_by INTEGER NOT NULL,
      changed_by_role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Add leave_status column to appointments table if not exists
  try {
    const appointmentsTableInfo = db.exec("PRAGMA table_info(appointments)");
    if (appointmentsTableInfo.length > 0) {
      const columns = appointmentsTableInfo[0].values.map(col => col[1]);
      if (!columns.includes('leave_status')) {
        db.run(`ALTER TABLE appointments ADD COLUMN leave_status TEXT DEFAULT NULL`);
        console.log('已添加leave_status列到appointments表');
      }
      if (!columns.includes('leave_reason')) {
        db.run(`ALTER TABLE appointments ADD COLUMN leave_reason TEXT DEFAULT NULL`);
        console.log('已添加leave_reason列到appointments表');
      }
      if (!columns.includes('leave_time')) {
        db.run(`ALTER TABLE appointments ADD COLUMN leave_time DATETIME DEFAULT NULL`);
        console.log('已添加leave_time列到appointments表');
      }
    }
  } catch (error) {
    console.log('检查/添加请假列时出错:', error.message);
  }

  // Homework assignments table (for targeted homework assignment)
  db.run(`
    CREATE TABLE IF NOT EXISTS homework_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      homework_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(homework_id, student_id)
    )
  `);
}

function createDefaultAdmin() {
  const result = db.exec("SELECT id FROM users WHERE role = 'admin'");
  
  if (result.length === 0 || result[0].values.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(`
      INSERT INTO users (username, password, role, phone)
      VALUES (?, ?, ?, ?)
    `, ['admin', hashedPassword, 'admin', '13800138000']);
    
    console.log('默认管理员账户已创建: admin / admin123');
  }
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(dbPath, buffer);
}

// Helper function to ensure db is ready
function ensureDb() {
  if (!dbReady || !db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
}

// Helper function to run queries
function run(sql, params = []) {
  ensureDb();
  db.run(sql, params);
  saveDatabase();
  
  // Get last insert rowid for INSERT statements
  const lastIdResult = db.exec("SELECT last_insert_rowid()");
  const lastId = lastIdResult.length > 0 && lastIdResult[0].values.length > 0
    ? lastIdResult[0].values[0][0]
    : null;
  
  return { changes: db.getRowsModified(), lastId };
}

// Helper function to get single row
function get(sql, params = []) {
  ensureDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// Helper function to get all rows
function all(sql, params = []) {
  ensureDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper function to exec multiple statements
function exec(sql) {
  ensureDb();
  db.exec(sql);
  saveDatabase();
}

// Check if database is ready
function isReady() {
  return dbReady;
}

module.exports = {
  initializeDatabase,
  run,
  get,
  all,
  exec,
  saveDatabase,
  isReady
};