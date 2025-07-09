const path = require('path');
const ExcelJs = require('exceljs');
const pool = require('./bdd');
const { error } = require('console');

const makeReportClassCard = async (student_id, quarter_id, reportModel, gradeRow, coeffTotalCell, coeffSumCell, coeffSumCell2, definitiveNotesCell1
  , definitiveNotesCell2, averageCell, studentCounterCell, maxAverageCell, classAverageCell, averageWriting, rankingCell
 ) => {
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
  const fileUrl = reportModel;

  const workbook = new ExcelJs.Workbook();
  await workbook.xlsx.readFile(fileUrl);
  const worksheet = workbook.getWorksheet('MATRICE'); 


  // Remplir les cellules avec les informations de l'élève
  worksheet.getCell('K2').value = student.rows[0].last_name;
  worksheet.getCell('K3').value = student.rows[0].first_name;
  worksheet.getCell('K4').value = student.rows[0].class_name;
  worksheet.getCell('K6').value = student.rows[0].id;

  // Remplir les cellules avec les notes
  for (let row = 12; row <= gradeRow; row++) {
    for (let col of ['L','M', 'N']) {
      const cell = worksheet.getCell(`${col}${row}`);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8CBAD' } // Orange accent 6, clair 40%
      };
    }
  };

  for (let row = 12; row <= gradeRow; row++) {
   
      const cell = worksheet.getCell(`K${row}`);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FCE4D6' } // Orange accent 6, clair 60%
      };
    
  };

  for (let col of ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']) {
   
      const cell = worksheet.getCell(`${col}${gradeRow}`);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FDE9D9' } // Orange accent 6, clair 60%
      };
    
  }const cell = worksheet.getCell(`A${gradeRow}`);
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' } 
  };


  // Ajouter des données de grades dans le bulletin
  for (let i = 0; i < grades.rows.length -1 && i < 12; i++) {
    const row = 12 + i; 
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

  worksheet.getCell(coeffTotalCell).value = `/ ${coeffTotal.rows[0].sum}`;
  worksheet.getCell(coeffSumCell).value = coeffSum.rows[0].sum;
  worksheet.getCell(coeffSumCell2).value = coeffSum.rows[0].sum;

  let totalNotesDefinitives = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) { // Ignorer la première ligne d'en-tête
      const noteDefinitive = row.getCell(12).value;  // La colonne 12 correspond à la colonne "NOTES DEFINITIVES" (colonne L)

      if (noteDefinitive && !isNaN(noteDefinitive)) {
        totalNotesDefinitives += noteDefinitive;
      }
    }
  });


  worksheet.getCell(definitiveNotesCell1).value = totalNotesDefinitives;
  worksheet.getCell(definitiveNotesCell2).value = totalNotesDefinitives;
  let average = await pool.query(`SELECT average FROM Report_info WHERE student_id = $1 AND quarter_id = $2`, [student_id, quarter_id]);
  average = average.rows[0].average;

  
    
  worksheet.getCell(averageCell).value = average;

  const studentNumber = await pool.query(`SELECT count(*) FROM students WHERE class_id = $1`, [studentClass.rows[0].class_id]);
  const maxAvg = await pool.query(`SELECT max(average) FROM Report_info where class_id = $1`, [studentClass.rows[0].class_id]);
  const classAvg = await pool.query(`SELECT sum(average) FROM Report_info WHERE class_id=$1`, [studentClass.rows[0].class_id]);
  worksheet.getCell(studentCounterCell).value = studentNumber.rows[0].count;
  worksheet.getCell(maxAverageCell).value = maxAvg.rows[0].max;
  worksheet.getCell(classAverageCell).value = (classAvg.rows[0].sum /studentNumber.rows[0].count).toFixed(2);

  const conduite = await pool.query(`SELECT grade FROM grade 
    WHERE student_id = $1 AND subject_id =100 AND quarter_id = $2`
    , [student_id, quarter_id]);
  if(conduite.rows.length > 0){
    worksheet.getCell(`L${gradeRow}`).value = conduite.rows[0].grade || 0;
  }



  let quarter = '';
  let nextQuarter = '';
  if (Number(quarter_id) === 1) {
    quarter = '1ER ';
    nextQuarter = '2ème';
    worksheet.getCell(`A${Number(maxAverageCell.slice(1))+20}`).value =`Ose toujours avancer ! Elimine tes faiblesses, maximise tes forces; objectif au ${nextQuarter} Trim : MOYENNE DE________`
  } else if (Number(quarter_id) === 2) {
    quarter = '2EME ';
    nextQuarter = '3ème';

    worksheet.getCell(`A${Number(maxAverageCell.slice(1))+20}`).value =`Ose toujours avancer ! Elimine tes faiblesses, maximise tes forces; objectif au ${nextQuarter} Trim : MOYENNE DE________`
  } else if (Number(quarter_id) === 3) {
    quarter = '3EME ';
    worksheet.getCell(`A${Number(maxAverageCell.slice(1))+20}`).value =``
  }

  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const academicYear = `${year}-${year + 1}`;

  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0'); 
  const createYear = now.getFullYear();

const dateFormatee = `${day}/${month}/${createYear}`;

worksheet.getCell(`G${Number(rankingCell.slice(1))+10}`).value = dateFormatee;

  worksheet.getCell(averageWriting).value = `MOYENNE DU ${quarter} TRIMESTRE SUR 20`;
  worksheet.getCell('A8').value = `BULLETIN D'EVALUATION_ANNEE SCOLAIRE : ${academicYear} ${quarter} TRIMESTRE`;
  

  const studentList = await pool.query(`SELECT * FROM Report_info WHERE class_id = $1 order by average desc`, [studentClass.rows[0].class_id]);
  const studentRank = studentList.rows.findIndex(s => s.student_id === student_id) + 1;

  worksheet.getCell(rankingCell).value = studentRank;

  // Sauvegarder le fichier généré
  workbook.calcProperties.fullCalcOnLoad = true;
  const reportPath = path.resolve(__dirname, 'reportCards', `${student.rows[0].last_name}-ReportCard.xlsx`);
  await workbook.xlsx.writeFile(reportPath);

  return reportPath;  // Retourne le chemin du fichier généré
};

const generateClassReport = async(student_id, quarter_id) =>{
  if(student_id && quarter_id) {
    const class_id = await pool.query(`SELECT class_id FROM students WHERE id = $1`, [student_id]);
    if(class_id.rows[0].class_id <=3){
      console.log('Terminale');
      let reportModel = path.resolve(__dirname, 'assets', 'Terminale_report.xlsx');
      
      return makeReportClassCard(student_id, quarter_id, reportModel, 22, 'M23', 'F26', 'K23', 'L23', 'F25', 'F27', 'L25', 'L26', 
        'L27','A27', 'F28');

    }else{
      if(class_id.rows[0].class_id <=7){
        let reportModel = path.resolve(__dirname, 'assets', 'HighSchool_report.xlsx');

        return makeReportClassCard(student_id, quarter_id, reportModel, 23, 'M24', 'F27', 'K24', 'L24', 'F26', 'F28', 'L26', 'L27', 
        'L28','A28', 'F29');
      }else{
        if(class_id.rows[0].class_id == 8){
        let reportModel = path.resolve(__dirname, 'assets', 'Third_report.xlsx');
        return makeReportClassCard(student_id, quarter_id, reportModel, 20, 'M21', 'F24', 'K21', 'L21', 'F23', 'F25', 'L23', 'L24', 
        'L25','A25', 'F26');

      }else{
        if(class_id.rows[0].class_id <= 11){
        let reportModel = path.resolve(__dirname, 'assets', 'College_report.xlsx');
        return makeReportClassCard(student_id, quarter_id, reportModel, 23, 'M22', 'F25', 'K22', 'L22', 'F24', 'F26', 'L24', 'L25', 
        'L24','A26', 'F27');
        }else{
        if(class_id.rows[0].class_id ==12){
        let reportModel = path.resolve(__dirname, 'assets', 'CM2_report.xlsx');
        return makeReportClassCard(student_id, quarter_id, reportModel, 18, 'M19', 'F22', 'K19', 'L19', 'F21', 'F23', 'L21', 'L22', 
        'L23','A23', 'F24');
        }else{
          if(class_id.rows[0].class_id <= 14){
            let reportModel = path.resolve(__dirname, 'assets', 'Primaire_mid_report.xlsx');
      
      return makeReportClassCard(student_id, quarter_id, reportModel, 29, 'M30', 'F33', 'K30', 'L30', 'F32', 'F34', 'L32', 'L33', 
        'L34','A34', 'F35');
          }else{
            if(class_id.rows[0].class_id == 15){
              let reportModel = path.resolve(__dirname, 'assets', 'CE1_report.xlsx');

              return makeReportClassCard(student_id, quarter_id, reportModel, 25, 'M26', 'F29', 'K26', 'L26', 'F28', 'F30', 'L28', 'L29', 
        'L30','A30', 'F31');
              
            };
          }if(class_id.rows[0].class_id ==16){
            let reportModel = path.resolve(__dirname, 'assets', 'CP_report.xlsx');
      
      return makeReportClassCard(student_id, quarter_id, reportModel, 26, 'M27', 'F31', 'K27', 'L27', 'F30', 'F32', 'L30', 'L31', 
        'L32','A32', 'F33');
          }else{
            if(class_id.rows[0].class_id ==17){
              let reportModel = path.resolve(__dirname, 'assets', 'MGS_report.xlsx');
      
      return makeReportClassCard(student_id, quarter_id, reportModel, 31, 'M32', 'F35', 'K32', 'L32', 'F34', 'F36', 'L34', 'L35', 
        'L36','A36', 'F37');
            }else{
              if(class_id.rows[0].class_id <=19){
                let reportModel = path.resolve(__dirname, 'assets', 'Presco_report.xlsx');

                return makeReportClassCard(student_id, quarter_id, reportModel, 23, 'M24', 'F28', 'K24', 'L24', 'F27', 'F29', 'L27', 'L28', 
        'L29','A29', 'F30');
                }else{
                  if(class_id.rows[0].class_id ==20){
                    let reportModel = path.resolve(__dirname, 'assets', 'TPS_report.xlsx');

                    return makeReportClassCard(student_id, quarter_id, reportModel, 20, 'M21', 'F25', 'K21', 'L21', 'F24', 'F26', 'L24', 'L25', 
        'L26','A26', 'F27'); 
                }else{
                  throw error('Invalid class_id');

                }
              }

            }
          }
        }
      }
      }
      }

      }
  }else{
throw error('Missing student_id or quarter_id');
  }
};

module.exports = {generateClassReport, makeReportClassCard};
