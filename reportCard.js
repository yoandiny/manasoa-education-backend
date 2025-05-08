const ExcelJs = require('exceljs');
const pool = require('./bdd');





const makeReportCard = async(student_id, quarter_id) => {
    const student =  await pool.query(`
        select id, last_name, first_name, class.class_name from students join class on class.class_id = students.class_id where id=$1
        `, [student_id])

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

            `, [student_id, quarter_id])

          const fileUrl = 'https://cdn.glitch.global/98ef2b00-ca6c-47a3-97e9-27f6ce35d919/bulletin.xlsx?v=1746730416961';

    const workbook = new ExcelJs.Workbook();
    await workbook.xlsx.readFile(fileUrl);
    const worksheet = workbook.getWorksheet(1); 

    worksheet.getCell('K2').value = student.rows[0].last_name;
    worksheet.getCell('K3').value = student.rows[0].first_name;
    worksheet.getCell('K4').value = student.rows[0].class_name;
   
    worksheet.getCell('K6').value = student.rows[0].id;

    

    for (let row = 12; row <= 22; row++) {
        for (let col of ['L','M', 'N']) {
          const cell = worksheet.getCell(`${col}${row}`);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8CBAD' } // Orange accent 6, clair 40%
          };
        }
      }

    for (let row = 12; row<= 24; row++){
        const cell = worksheet.getCell(`K${row}`);
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFCE4D6' } // Orange accent 6, clair 40%
          };
    }

    for (let col of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
        const cell = worksheet.getCell(`${col}24`);
        cell.fill ={
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFDE9D9' } // Orange accent 6, clair 40%
        }
        
      }

      const gradeCols = ['B', 'C', 'D', 'E','F', 'G', 'H', 'I','J', 'K', 'L', 'M']; // Colonnes valides

for (let i = 0; i < grades.rows.length && i < 12; i++) {
  const row = 12 + i; // ligne 12 à 23
  const grade = grades.rows[i];

  if (grade.subject_name) {
    // Écrit le nom de la matière en colonne B
    worksheet.getCell(`B${row}`).value = grade.subject_name;

    const interroAvg = ((+grade.interro1 || 0) + (+grade.interro2 || 0)) / 2;
    const gradeAvg = ((+interroAvg || 0) + (+grade.exam || 0)) / 2 + (+grade.bonus || 0);
    const njd = ((+grade.interro1 || 0) + (+grade.interro2 || 0)) / 2+ (+grade.bonus || 0);
    


    // Exemple : écrire les notes dans les colonnes C, D, F, G
    worksheet.getCell(`C${row}`).value = grade.interro1;
    worksheet.getCell(`D${row}`).value = grade.interro2;
    worksheet.getCell(`E${row}`).value = interroAvg;
    worksheet.getCell(`F${row}`).value = grade.exam;
    worksheet.getCell(`G${row}`).value = grade.bonus;
    worksheet.getCell(`H${row}`).value = njd;
    worksheet.getCell(`J${row}`).value = gradeAvg;	
    worksheet.getCell(`K${row}`).value = grade.coeff;	
    worksheet.getCell(`L${row}`).value = (+grade.final || 0)*(+grade.coeff || 0);
    worksheet.getCell(`M${row}`).value = (`/ ${+grade.coeff*20 || 0}`);


    // Option : alignement
    gradeCols.forEach(col => {
      const cell = worksheet.getCell(`${col}${row}`);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: 'Tw Cen MT', size: 11 };
    });
  }
}

const coeffTotal = await pool.query(`SELECT sum(coeff*20) FROM class_subject WHERE class_id = (SELECT class_id FROM students WHERE id =$1)`,[student_id]);
const coeffSum = await pool.query(`SELECT sum(coeff) FROM class_subject WHERE class_id = (SELECT class_id FROM students WHERE id =$1)`, [student_id]);


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
    let moyenne = totalNotesDefinitives / coeffSum.rows[0].sum;
    worksheet.getCell('F29').value = moyenne.toFixed(2);



      
      

    workbook.calcProperties.fullCalcOnLoad = true;
    const report = await workbook.xlsx.writeFile(`reportCards/${student.rows[0].last_name}-ReportCard.xlsx`);
    return report;
    

}

module.exports = makeReportCard;