const path = require('path');
const ExcelJs = require('exceljs');
const pool = require('./bdd');

const makeReportCard = async (student_id, quarter_id) => {
  const studentClass = await pool.query(`SELECT class_id FROM students WHERE id=$1`, [student_id])
  const student = await pool.query(`
    SELECT id, last_name, first_name, class.class_name 
    FROM students 
    JOIN class ON class.class_id = students.class_id 
    WHERE id=$1
  `, [student_id]);

  const grades = await pool.query(`
    SELECT 
      subject.subject_name,
      class_subject.coeff,
      SUM(CASE WHEN type_note_id = 1 THEN grade ELSE 0 END) AS interro1,
      SUM(CASE WHEN type_note_id = 2 THEN grade ELSE 0 END) AS interro2,
      SUM(CASE WHEN type_note_id = 3 THEN grade ELSE 0 END) AS exam,
      SUM(CASE WHEN type_note_id = 5 THEN grade ELSE 0 END) AS final
    FROM grade
    JOIN subject ON subject.subject_id = grade.subject_id
    JOIN students ON students.id = grade.student_id
    JOIN class_subject ON class_subject.subject_id = grade.subject_id
                AND class_subject.class_id = students.class_id 
    WHERE grade.student_id =$1
      AND quarter_id = $2
    GROUP BY grade.subject_id, subject.subject_name, class_subject.coeff
    ORDER BY grade.subject_id ASC;
  `, [student_id, quarter_id]);

  // Construction du chemin absolu pour le modèle de bulletin
  const fileUrl = path.resolve(__dirname, 'assets', 'bulletin.xlsx');  // Utilisation de path.resolve pour chemin absolu

  const workbook = new ExcelJs.Workbook();
  await workbook.xlsx.readFile(fileUrl);
  const worksheet = workbook.getWorksheet(1); 

  // Remplir les cellules avec les informations de l'élève
  worksheet.getCell('K2').value = student.rows[0].last_name;
  worksheet.getCell('K3').value = student.rows[0].first_name;
  worksheet.getCell('K4').value = student.rows[0].class_name;
  worksheet.getCell('K6').value = student.rows[0].id;

  // Remplir les cellules avec les notes
  for (let row = 12; row <= 22; row++) {
    for (let col of ['L','M', 'N']) {
      const cell = worksheet.getCell(`${col}${row}`);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8CBAD' } // Orange accent 6, clair 40%
      };
    }
  };

  for (let row = 12; row <= 24; row++) {
   
      const cell = worksheet.getCell(`K${row}`);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FCE4D6' } // Orange accent 6, clair 60%
      };
    
  };

  for (let col of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
   
      const cell = worksheet.getCell(`${col}24`);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FDE9D9' } // Orange accent 6, clair 60%
      };
    
  }

  // Ajouter des données de grades dans le bulletin
  for (let i = 0; i < grades.rows.length && i < 12; i++) {
    const row = 12 + i; // ligne 12 à 23
    const grade = grades.rows[i];

    if (grade.subject_name) {
      worksheet.getCell(`B${row}`).value = grade.subject_name;

      const interroAvg = ((+grade.interro1 || 0) + (+grade.interro2 || 0)) / 2;
      const gradeAvg = ((+interroAvg || 0) + (+grade.exam || 0)) / 2 + (+grade.bonus || 0);
      const njd = ((+grade.interro1 || 0) + (+grade.interro2 || 0)) / 2 + (+grade.bonus || 0);

      worksheet.getCell(`C${row}`).value = grade.interro1;
      worksheet.getCell(`D${row}`).value = grade.interro2;
      worksheet.getCell(`E${row}`).value = interroAvg;
      worksheet.getCell(`F${row}`).value = grade.exam;
      worksheet.getCell(`G${row}`).value = grade.bonus;
      worksheet.getCell(`H${row}`).value = njd;
      worksheet.getCell(`J${row}`).value = gradeAvg;
      worksheet.getCell(`K${row}`).value = grade.coeff;
      worksheet.getCell(`L${row}`).value = (+grade.final || 0) * (+grade.coeff || 0);
      worksheet.getCell(`M${row}`).value = (`/ ${+grade.coeff * 20 || 0}`);
    }
  }

  // Calculer la somme des coefficients et la moyenne
  const coeffTotal = await pool.query(`
    SELECT sum(coeff * 20) 
    FROM class_subject 
    WHERE class_id = (SELECT class_id FROM students WHERE id =$1)
  `, [student_id]);

  const coeffSum = await pool.query(`
    SELECT sum(coeff) 
    FROM class_subject 
    WHERE class_id = (SELECT class_id FROM students WHERE id =$1)
  `, [student_id]);

  worksheet.getCell('M24').value = `/ ${coeffTotal.rows[0].sum}`;
  worksheet.getCell('F28').value = coeffSum.rows[0].sum;

  let totalNotesDefinitives = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Ignorer la première ligne d'en-tête
      const noteDefinitive = row.getCell(12).value;  // La colonne 12 correspond à la colonne "NOTES DEFINITIVES" (colonne L)

      if (noteDefinitive && !isNaN(noteDefinitive)) {
        totalNotesDefinitives += noteDefinitive;
      }
    }
  });

  worksheet.getCell('L24').value = totalNotesDefinitives;
  worksheet.getCell('F27').value = totalNotesDefinitives;
  let moyenne = (totalNotesDefinitives / coeffSum.rows[0].sum).toFixed(2);
  const checkNote = await pool.query(`SELECT * FROM Report_info WHERE student_id = $1`, [student_id]);
  if(checkNote.rows.length === 0) {
    await pool.query(`INSERT INTO Report_info (student_id, class_id, quarter_id, average) VALUES ($1, $2, $3, $4)`, [student_id, studentClass.rows[0].class_id, quarter_id, moyenne]);
  }
  else {
    await pool.query(`UPDATE Report_info SET average = $1 WHERE student_id = $2`, [moyenne, student_id]);
  }
    
  worksheet.getCell('F29').value = moyenne;

  const studentNumber = await pool.query(`SELECT count(*) FROM students WHERE class_id = $1`, [studentClass.rows[0].class_id]);
  maxAvg = await pool.query(`SELECT max(average) FROM Report_info`);
  classAvg = await pool.query(`SELECT sum(average) FROM Report_info`);
  worksheet.getCell('L27').value = studentNumber.rows[0].count;
  worksheet.getCell('L28').value = maxAvg.rows[0].max;
  worksheet.getCell('L29').value = (classAvg.rows[0].sum /studentNumber.rows[0].count).toFixed(2);



  let quarter = '';
  if (quarter_id === 1) {
    quarter = '1ER ';
  } else if (quarter_id === 2) {
    quarter = '2EME ';
  } else if (quarter_id === 3) {
    quarter = '3EME ';
  }

  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const academicYear = `${year}-${year + 1}`;

  worksheet.getCell('A29').value = `MOYENNE DU ${quarter} TRIMESTRE SUR 20`;
  worksheet.getCell('A8').value = `BULLETIN D'EVALUATION_ANNEE SCOLAIRE : ${academicYear} ${quarter} TRIMESTRE`;

  const studentList = await pool.query(`SELECT * FROM Report_info WHERE class_id = $1 order by average asc`, [studentClass.rows[0].class_id]);
  const studentRank = studentList.rows.findIndex(s => s.student_id === student_id) + 1;

  worksheet.getCell('F30').value = studentRank;

  // Sauvegarder le fichier généré
  workbook.calcProperties.fullCalcOnLoad = true;
  const reportPath = path.resolve(__dirname, 'reportCards', `${student.rows[0].last_name}-ReportCard.xlsx`);
  await workbook.xlsx.writeFile(reportPath);

  return reportPath;  // Retourne le chemin du fichier généré
};

module.exports = makeReportCard;
