import pool from './bdd.js';
import express, { query } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { generateClassReport } from './reportCard.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_admin';

app.get('/', (req, res) => {
  res.send('Welcome to the Manasoa Backend!');
});

app.post('/admin', async (req, res) => {
  const { first_name, last_name, role, password, phone } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = uuidv4();
  console.log(req.body);
  try {
    const result = await pool.query('INSERT INTO admins (id, first_name, last_name, role, password, phone_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id, first_name, last_name, role, hashedPassword, phone]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


app.post('/login', async (req, res) => {
  const { phone_number, password } = req.body;

  if (!phone_number || !password) {
    return res.status(400).json({ message: 'Nom et mot de passe requis' });
  }

  try {
    const result = await pool.query('SELECT * FROM admins WHERE phone_number = $1', [phone_number]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ message: 'Identifiants incorrects' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Identifiants incorrects' });

    const token = jwt.sign(
      { id: user.id, first_name: user.first_name, last_name: user.last_name, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: user.id, first_name: user.first_name, last_name: user.last_name, role: user.role, phone_number: user.phone_number } });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

export const authenticateUser = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token manquant' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // informations utilisateur
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token invalide' });
  }
};

app.get('/users/check', authenticateUser, (req, res) => {
  res.json({ connected: true, user: req.user });
});



app.get('/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students JOIN class ON students.class_id = class.class_id ORDER BY class.class_id ASC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.post('/students', async (req, res) => {
  const { id, firstName, lastName, birthDate, classId, gender } = req.body;
  try {
    const result = await pool.query('INSERT INTO students (id, first_name, last_name, birthdate, class_id, gender) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', [id, firstName, lastName, birthDate, classId, gender]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM students LEFT JOIN class ON students.class_id = class.class_id WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Student not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.put('/students/:id', async (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    birthdate,
    class_id,
    absence,
    address,
    student_contact,
    father_contact,
    gender
  } = req.body;

  try {
    let sqlBirthdate = null;

    if (birthdate) {
      // Vérifie si birthdate est un timestamp
      if (!isNaN(birthdate)) {
        sqlBirthdate = new Date(Number(birthdate)).toISOString().split('T')[0];
      }
      // Vérifie si c'est déjà une date SQL
      else if (/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
        sqlBirthdate = birthdate;
      }
      // Autre format (ex: ISO string)
      else {
        sqlBirthdate = new Date(birthdate).toISOString().split('T')[0];
      }
    }

    const result = await pool.query(
      `UPDATE students 
       SET first_name = $1, 
           last_name = $2, 
           birthdate = $3, 
           class_id = $4, 
           absence = $5, 
           address = $6, 
           student_contact = $7, 
           father_contact = $8,
           gender = $9
       WHERE id = $10
       RETURNING *`,
      [first_name, last_name, sqlBirthdate, class_id, absence, address, student_contact, father_contact, gender, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Student not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).send('Server error');
  }
});

app.delete('/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Student not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


app.get('/teachers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teachers join subject on teachers.subject_id = subject.subject_id');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


app.post('/teachers', async (req, res) => {
  const { firstName, lastName, subject, phoneNumber } = req.body;
  const id = uuidv4();
  try {
    const result = await pool.query('INSERT INTO teachers (id, first_name, last_name, subject_id, phone_number) VALUES ($1, $2, $3, $4, $5) RETURNING *', [id, firstName, lastName, Number(subject), phoneNumber]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.put('/teachers/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, subject, phone_number } = req.body;
  try {
    const result = await pool.query('UPDATE teachers SET first_name = $1, last_name = $2, subject_id = $3, phone_number = $4 WHERE id = $5 RETURNING *', [first_name, last_name, Number(subject), phone_number, id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Teacher not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.delete('/teachers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM teachers WHERE id=$1 returning *', [id]);
    if (result.rows[0].length === 0) {
      res.status(404).send({ "error": "Teacher not found" })

    }
    res.status(200).send({ "success": "Teacher successfully deleted" })

  } catch (error) {
    console.error('An error as occured while deleting teacher')

  }
});


app.get('/teachers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM teachers WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Teacher not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/subject', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM subject JOIN class_subject ON 
    subject.subject_id = class_subject.subject_id
    JOIN class ON class.class_id = class_subject.class_id
    ORDER BY subject.subject_id ASC`);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.post('/subject', async (req, res) => {
  const { subject_name, class_id, coeff } = req.body;
  const id = await pool.query('SELECT count(*) as max_id FROM subject');
  try {
    const result = await pool.query('INSERT INTO subject (subject_id, subject_name) VALUES ($1, $2) RETURNING *', [Number(id.rows[0].max_id) + 1, subject_name]);
    if (result.rows.length === 0) {
      return res.status(404).send('Subject not created');
    }
    const addCoeff = await pool.query('INSERT INTO class_subject (subject_id, class_id, coeff) VALUES ($1, $2, $3) RETURNING *', [Number(id.rows[0].max_id) + 1, class_id, coeff]);
    if (addCoeff.rows.length === 0) {
      return res.status(404).send('Subject coeff not created');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.put('/subject/:id', async (req, res) => {
  const { id } = req.params;
  const { subject_name, class_id, coeff } = req.body;

  try {
    const subjectName = await pool.query('UPDATE subject SET subject_name = $1 WHERE subject_id = $2 RETURNING *', [subject_name, id]);
    if (subjectName.rows.length === 0) {
      return res.status(404).send('Subject not found');
    }
    const result = await pool.query(
      `UPDATE class_subject 
       SET class_id = $1, coeff = $2
       WHERE subject_id = $3
       RETURNING *`,
      [class_id, coeff, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Subject not found');
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).send('Server error');
  }
});

app.delete('/subject/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM subject WHERE subject_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Subject not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


app.get('/class', async (req, res) => {
  try {
    const result = await pool.query(`SELECT 
    c.class_id,
    c.class_name,
    COUNT(s.id) AS nb_eleves
FROM 
    class c
LEFT JOIN 
    students s ON c.class_id = s.class_id
GROUP BY 
    c.class_id, c.class_name
ORDER BY 
    c.class_id ASC;
`);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.post('/class', async (req, res) => {
  const { className } = req.body;
  const id = await pool.query('SELECT count(*) as max_id FROM class');
  try {
    const result = await pool.query('INSERT INTO class (class_id, class_name) VALUES ($1, $2) RETURNING *', [Number(id.rows[0].max_id) + 1, className]);
    if (result.rows.length === 0) {
      return res.status(404).send('Class not created');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.delete('/class/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM class WHERE class_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Class not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.put('/class/:id', async (req, res) => {
  const { id } = req.params;
  const { className } = req.body;
  try {
    const result = await pool.query('UPDATE class SET class_name = $1 WHERE class_id = $2 RETURNING *', [className, id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Class not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/class/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM class left join students on students.id = class.chef_id WHERE class.class_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Class not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/class/:id/students/', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM students WHERE class_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('No students found for this class');
    }
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/class/:id/subjects/', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM class_subject join subject on subject.subject_id = class_subject.subject_id WHERE class_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).send('No subjects found for this class');
    }
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.post('/class/:id/assign-delegate', async (req, res) => {
  const { id } = req.params;
  const { studentId } = req.body;
  console.log('Assigning student', studentId, 'as delegate for class', id);
  try {
    const result = await pool.query('UPDATE class SET chef_id = $1 WHERE class_id = $2 RETURNING *', [studentId, id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Class not found');
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/tuition/:studentId', async (req, res) => {
  const { studentId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM payment WHERE student_id = $1', [studentId]);
    if (result.rows.length === 0) {
      return res.status(404).send('No tuition records found for this student');
    }
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/grade', async (req, res) => {
  const { studentId, term } = req.query;
  try {
    const result = await pool.query('SELECT * FROM grade WHERE student_id = $1 AND quarter_id = $2', [studentId, term]);
    if (result.rows.length === 0) {
      return res.status(404).send('No grades records found for this student');
    }
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.post('/grade', async (req, res) => {
  const { student_id, subject_id, term, interrogation1, interrogation2, exam, bonus } = req.body;
  const grades = { interrogation1, interrogation2, exam, bonus };

  if (!student_id || !subject_id || !term) {
    return res.status(400).send('Bad request: Important data missing');
  }

  try {
    const note_id = [1, 2, 3, 4];
    for (let i = 0; i <= Object.keys(grades).length - 1; i++) {
      console.log(note_id[i], grades[Object.keys(grades)[i]]);
      const grade = await pool.query(`select * from grade where student_id=$1 and
         subject_id=$2 and
         quarter_id=$3 and type_note_id =$4`, [student_id, subject_id, +term, note_id[i]])
      if (grade.rows.length === 0) {
        const gradeReq = await pool.query(
          `INSERT INTO grade (student_id, subject_id, quarter_id, type_note_id, grade) 
VALUES ($1, $2, $3, $4, $5) 
RETURNING *`,
          [student_id, subject_id, +term, note_id[i], grades[Object.keys(grades)[i]]]
        );
      } else {
        const gradeReq = await pool.query(`update grade set grade=$1 where student_id=$2 and
          subject_id=$3 and
         quarter_id=$4 and type_note_id =$5`, [grades[Object.keys(grades)[i]], student_id, subject_id, +term, note_id[i]]);
      }

    }
    res.status(200).send('Grades saved successfully');


  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/grades/class-subject/', async (req, res) => {
  const { classId, subjectId, term } = req.query;
  try {
    if (!classId && !subjectId && !term) {
      res.status(400).send({ "error": "Bad Request: Missing ClassId or subjectId or Term" })
    }

    const gradeList = await pool.query(`SELECT grade_id,subject_id,quarter_id, student_id, type_note_id, grade FROM grade 
      join students on students.id = grade.student_id where subject_id=$1 and class_id=$2 and quarter_id=$3`,
      [subjectId, classId, term]
    )
    if (!gradeList.rows.length) {
      res.status(404).send({ "error": "No grades found for this class and subject" })
    }

    res.status(200).send(gradeList.rows);

  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');

  }
});


app.get('/admins', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admins');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.get('/reports/class', async (req, res) => {
  const { classId, term } = req.query;
  try {
    const pdfBuffer = await generateClassReport(classId, term);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="class_${classId}_report_term_${term}.pdf"`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');

  }
});

// ============================================
// SYNC ROUTES FOR OFFLINE-FIRST FUNCTIONALITY
// ============================================

// Route 1: Check for modifications (returns last modification timestamps)
app.get('/api/sync/check', async (req, res) => {
  try {
    const timestamps = {};

    // Get last modification time for each table
    const tables = ['students', 'teachers', 'class', 'subject', 'grades'];

    for (const table of tables) {
      // For PostgreSQL, we need to check if there's a timestamp column
      // If not, we'll use the current time as a fallback
      let query;

      if (table === 'students') {
        query = 'SELECT MAX(student_since) as last_modified FROM students';
      } else if (table === 'grades') {
        query = 'SELECT MAX(created_at) as last_modified FROM grades';
      } else {
        // For tables without timestamp, return current time
        timestamps[table] = new Date().toISOString();
        continue;
      }

      const result = await pool.query(query);
      timestamps[table] = result.rows[0]?.last_modified || new Date().toISOString();
    }

    res.json({ success: true, timestamps });
  } catch (error) {
    console.error('Sync check error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route 2: Pull data (get all data or data modified since a timestamp)
app.get('/api/sync/pull', async (req, res) => {
  try {
    const { since } = req.query; // Optional timestamp parameter

    const data = {};

    // Get students
    let studentsQuery = 'SELECT * FROM students';
    if (since) {
      studentsQuery += ` WHERE student_since > $1`;
      const studentsResult = await pool.query(studentsQuery, [since]);
      data.students = studentsResult.rows;
    } else {
      const studentsResult = await pool.query(studentsQuery);
      data.students = studentsResult.rows;
    }

    // Get teachers
    const teachersResult = await pool.query('SELECT * FROM teachers');
    data.teachers = teachersResult.rows;

    // Get classes
    const classesResult = await pool.query('SELECT * FROM class');
    data.classes = classesResult.rows;

    // Get subjects
    const subjectsResult = await pool.query('SELECT * FROM subject');
    data.subjects = subjectsResult.rows;

    // Get grades (if since is provided, filter by created_at)
    let gradesQuery = 'SELECT * FROM grades';
    if (since) {
      gradesQuery += ` WHERE created_at > $1`;
      const gradesResult = await pool.query(gradesQuery, [since]);
      data.grades = gradesResult.rows;
    } else {
      const gradesResult = await pool.query(gradesQuery);
      data.grades = gradesResult.rows;
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Sync pull error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route 3: Push local changes to server
app.post('/api/sync/push', async (req, res) => {
  try {
    const { operations } = req.body; // Array of operations: { table, operation, record_id, data }

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({ success: false, error: 'Invalid operations format' });
    }

    const results = [];

    for (const op of operations) {
      const { table_name, operation, record_id, data } = op;

      try {
        if (operation === 'INSERT') {
          // Handle INSERT
          if (table_name === 'students') {
            await pool.query(
              `INSERT INTO students (id, first_name, last_name, gender, class_id, absence, birthdate, birthplace, address, student_since, student_contact, mother_name, mother_contact, father_name, father_contact, status) 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
               ON CONFLICT (id) DO UPDATE SET
               first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, gender = EXCLUDED.gender,
               class_id = EXCLUDED.class_id, absence = EXCLUDED.absence, birthdate = EXCLUDED.birthdate,
               birthplace = EXCLUDED.birthplace, address = EXCLUDED.address, student_contact = EXCLUDED.student_contact,
               mother_name = EXCLUDED.mother_name, mother_contact = EXCLUDED.mother_contact,
               father_name = EXCLUDED.father_name, father_contact = EXCLUDED.father_contact, status = EXCLUDED.status`,
              [data.id, data.first_name, data.last_name, data.gender, data.class_id, data.absence || 0,
              data.birthdate, data.birthplace, data.address, data.student_since, data.student_contact,
              data.mother_name, data.mother_contact, data.father_name, data.father_contact, data.status]
            );
          } else if (table_name === 'teachers') {
            await pool.query(
              `INSERT INTO teachers (id, first_name, last_name, subject, phone_number)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO UPDATE SET
               first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
               subject = EXCLUDED.subject, phone_number = EXCLUDED.phone_number`,
              [data.id, data.first_name, data.last_name, data.subject, data.phone_number]
            );
          } else if (table_name === 'class') {
            await pool.query(
              `INSERT INTO class (class_id, class_name, chef_id, fee)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (class_id) DO UPDATE SET
               class_name = EXCLUDED.class_name, chef_id = EXCLUDED.chef_id, fee = EXCLUDED.fee`,
              [data.class_id, data.class_name, data.chef_id, data.fee || 0]
            );
          }
          results.push({ record_id, success: true });
        } else if (operation === 'UPDATE') {
          // Handle UPDATE
          if (table_name === 'students') {
            await pool.query(
              `UPDATE students SET first_name = $1, last_name = $2, gender = $3, class_id = $4,
               absence = $5, birthdate = $6, birthplace = $7, address = $8, student_contact = $9,
               mother_name = $10, mother_contact = $11, father_name = $12, father_contact = $13, status = $14
               WHERE id = $15`,
              [data.first_name, data.last_name, data.gender, data.class_id, data.absence || 0,
              data.birthdate, data.birthplace, data.address, data.student_contact,
              data.mother_name, data.mother_contact, data.father_name, data.father_contact,
              data.status, record_id]
            );
          } else if (table_name === 'teachers') {
            await pool.query(
              `UPDATE teachers SET first_name = $1, last_name = $2, subject = $3, phone_number = $4
               WHERE id = $5`,
              [data.first_name, data.last_name, data.subject, data.phone_number, record_id]
            );
          } else if (table_name === 'class') {
            await pool.query(
              `UPDATE class SET class_name = $1, chef_id = $2, fee = $3 WHERE class_id = $4`,
              [data.class_name, data.chef_id, data.fee || 0, record_id]
            );
          }
          results.push({ record_id, success: true });
        } else if (operation === 'DELETE') {
          // Handle DELETE
          if (table_name === 'students') {
            await pool.query('DELETE FROM students WHERE id = $1', [record_id]);
          } else if (table_name === 'teachers') {
            await pool.query('DELETE FROM teachers WHERE id = $1', [record_id]);
          } else if (table_name === 'class') {
            await pool.query('DELETE FROM class WHERE class_id = $1', [record_id]);
          }
          results.push({ record_id, success: true });
        }
      } catch (opError) {
        console.error(`Error processing operation for ${record_id}:`, opError);
        results.push({ record_id, success: false, error: opError.message });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    console.error('Sync push error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});