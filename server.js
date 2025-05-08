const pool = require('./bdd.js');
const express = require('express');
const app = express();
const cors = require('cors');
const report = require('./reportCard.js');
const makeReportCard = require('./reportCard.js');

const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());



app.post('/addStudent', async (req, res) => {
  try {
    const { id, last_name, first_name, class_id } = req.body;

    const result = await pool.query(
      'INSERT INTO students (id, last_name, first_name, class_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, last_name, first_name, class_id]
    );

    const subjects = await pool.query(
      'SELECT subject_id FROM class_subject WHERE class_id = $1',
      [class_id]
    );
    const quarters = await pool.query('SELECT quarter_id FROM quarter');
    const types = await pool.query('SELECT type_id FROM note_type');

    for (const subject of subjects.rows) {
      for (const quarter of quarters.rows) {
        for (const type of types.rows) {
          await pool.query(
            `INSERT INTO grade (student_id, subject_id, quarter_id, type_note_id, grade)
             VALUES ($1, $2, $3, $4, 0)`,
            [id, subject.subject_id, quarter.quarter_id, type.type_id]
          );
        }
      }
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Erreur dans /addStudent:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


app.post('/deleteStudent', async (req, res) => {
  try {
    const { id } = req.body;
    const delStudent = await pool.query('DELETE FROM students WHERE id = $1', [id]);
    res.status(200).json({success: 'Élève supprimé'});
  } catch (error) {
    console.error('Erreur dans /deleteStudent:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/updateStudent', async (req, res) => {
  const {
    id, 
    last_name,
    first_name,
    birthdate,
    student_contact,
    address,
    father_name,
    father_contact,
    mother_name,
    mother_contact,
    absence
  } = req.body;

  try {
    if (!id) {
      return res.status(400).json({ message: "ID actuel requis pour retrouver l'élève." });
    }

    // Vérifier que l'élève avec l'ancien id existe
    const checkStudent = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
    if (checkStudent.rowCount === 0) {
      return res.status(404).json({ message: "Élève non trouvé avec cet ID." });
    }

    // Si new_id est envoyé, on met à jour avec, sinon on garde le même id
    const final_id = id;

    // Update de toutes les infos
    const updateStudent = await pool.query(
      `UPDATE students 
       SET 
         id = $1,
         last_name = $2,
         first_name = $3,
         birthdate = $4,
         student_contact = $5,
         address = $6,
         father_name = $7,
         father_contact = $8,
         mother_name = $9,
         mother_contact = $10,
         absence = $11
       WHERE id = $12`,
      [
        final_id,          
        last_name,
        first_name,
        birthdate,
        student_contact,
        address,
        father_name,
        father_contact,
        mother_name,
        mother_contact,
        absence,
        id                 
      ]
    );
      if(updateStudent.rowCount === 0){
        return res.status(404).json({ message: "Élève non trouvé avec cet ID." });
      }else{
        getStudentInfo = await pool.query('SELECT * FROM students WHERE id = $1', [final_id]);
        res.status(200).json(getStudentInfo.rows[0]);
      }

    res.status(200).json({ message: "Élève mis à jour avec succès !" });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'élève:', error);
    res.status(500).json({ message: "Erreur serveur lors de la mise à jour de l'élève." });
  }
});


app.get('/searchStudent', async (req, res) => {
  const { name } = req.query;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Paramètre 'name' manquant" });
  }

  try {
    const search = await pool.query(`
      SELECT * FROM students 
      WHERE LOWER(first_name) LIKE LOWER($1) 
         OR LOWER(last_name) LIKE LOWER($1) 
         OR LOWER(id) LIKE LOWER($1)
    `, [`%${name}%`]);

    if (search.rows.length > 0) {
      res.status(200).json(search.rows);
    } else {
      res.status(404).json({ error: 'Aucun élève trouvé' });
    }

  } catch (err) {
    console.error("Erreur dans /searchStudent:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post('/searchClass', async (req, res) => {
    const {class_name} = req.body;
  try {
      const search = await pool.query(`SELECT class_id FROM class WHERE class_name = $1`, [class_name]);
      if(search.rows.length > 0){
        res.status(200).json(search.rows[0]);
      }else{
        res.status(404).json({ error: 'Classe non trouvée' });
      }
    
  } catch (error) {
    console.error('Erreur dans /searchClass:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get("/getStudentInfo", async (req, res) => {
    const {id} = req.query;
  try {
    const result = await pool.query("SELECT * FROM students INNER JOIN class ON students.class_id = class.class_id WHERE id=$1", [id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error('Erreur dans /getStudentInfo:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


app.get('/getClasses', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM class ORDER BY class_id ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des classes" });
  }
});

app.get('/getSubjects', async (req, res) => {
  const {class_id, quarter_id, student_id} = req.query;
  try {
    const result = await pool.query(`
          SELECT 
      s.subject_id,
      s.subject_name,
      cs.coeff,
      MAX(g.grade) FILTER (WHERE nt.type_note = '1er Interro') AS interrogation1,
      MAX(g.grade) FILTER (WHERE nt.type_note = '2eme Interro') AS interrogation2,
      MAX(g.grade) FILTER (WHERE nt.type_note = 'Examen') AS evaluation,
      MAX(g.grade) FILTER (WHERE nt.type_note = 'Bonus') AS bonus,
      MAX(g.grade) FILTER (WHERE nt.type_note = 'Note finale') AS final
    FROM subject s
    JOIN class_subject cs ON cs.subject_id = s.subject_id
    LEFT JOIN grade g ON g.subject_id = s.subject_id
      AND g.quarter_id = $2
      AND g.student_id = $3
    LEFT JOIN note_type nt ON nt.type_id = g.type_note_id
    WHERE cs.class_id = $1
    GROUP BY s.subject_id, s.subject_name, cs.coeff
    ORDER BY s.subject_id;

`,[class_id, quarter_id, student_id]);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des matières" });
  }
})

app.post('/saveGrades', async (req, res) => {
  const grades = req.body;

  try {
    for (const grade of grades) {
      const interrogation1 = parseFloat(grade.interrogation1) || 0;
      const interrogation2 = parseFloat(grade.interrogation2) || 0;
      const evaluation = parseFloat(grade.evaluation) || 0;
      const bonus = parseFloat(grade.bonus) || 0;

      const finalNote = Math.min(
        Math.round(((interrogation1 + interrogation2 + evaluation) / 3 + bonus) * 100) / 100,
        20 // limite à 20
      );

      const notes = [
        { type_note_id: 1, value: interrogation1 },
        { type_note_id: 2, value: interrogation2 },
        { type_note_id: 3, value: evaluation },
        { type_note_id: 4, value: bonus },
        { type_note_id: 5, value: finalNote } // ici on injecte le calcul
      ];

      for (const note of notes) {
        await pool.query(`
          INSERT INTO grade (student_id, subject_id, grade, quarter_id, type_note_id)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (student_id, subject_id, quarter_id, type_note_id)
          DO UPDATE SET grade = EXCLUDED.grade
        `, [
          grade.student_id,
          grade.subject_id,
          note.value,
          grade.quarter_id,
          note.type_note_id
        ]);
      }
    }

    res.status(200).json({ message: 'Notes enregistrées avec calcul automatique de la note finale.' });
  } catch (error) {
    console.error('Erreur dans /saveGrades:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});






app.get('/getTotalStudents', async (req, res) => {
  try {
    const countStudent = await pool.query('SELECT count(*) FROM students');
    res.status(200).json(countStudent.rows[0].count);
  } catch (err) {
    console.error('Erreur dans /getTotalStudents:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/newStudents', async (req, res) => {
  try {
    const countStudent = await pool.query(`SELECT TO_CHAR(student_since, 'YYYY-MM') as date, count(*) as total_students
    FROM students GROUP BY date ORDER BY date ASC`);
    res.status(200).json(countStudent.rows);
  } catch (err) {
    console.error('Erreur dans /getTotalStudents:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/getAllStudents', async (req, res) => {
    try {
            const allStudents = await pool.query(`SELECT id, last_name, first_name, class_name,
                 absence FROM students inner join class on students.class_id = class.class_id ORDER BY class_name DESC`);
                 res.status(200).json(allStudents.rows);
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/getTotalTeachers', async (req, res) => {
    try {
      const countTeachers = await pool.query('SELECT count(*) FROM teachers');
      res.status(200).json(countTeachers.rows[0].count);
    } catch (err) {
      console.error('Erreur dans /getTotalTeachers:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  });

app.get('/getGradesEvolutions', async(req, res) => {
  try {
    const getCollegeGrades = await pool.query(`
      SELECT quarter_id, quarter_name, niveau, percentage
FROM gradesEvolution
ORDER BY quarter_id, niveau;
`);
      if(getCollegeGrades.length != 0){
        res.status(200).json(getCollegeGrades.rows)
      }
    
  } catch (error) {
    console.error('Erreur dans /getGradesEvolutions:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/generateReport', async(req, res) => {
  try {
    const { id, quarter_id } = req.body;
    const report = await makeReportCard(id, quarter_id);
    
    res.send(report);
    res.status(200).json(generateReport.rows);
    
  } catch (error) {
    console.error('Erreur dans /generateReport:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur Express démarré sur le port ${PORT}`);
});
