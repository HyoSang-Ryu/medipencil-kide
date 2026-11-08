export async function seed(db:D1Database){
 const patients=[
 ['p1','김순자',82,'여성','302호','뇌경색 회복기, 당뇨, 고혈압','이민우 과장 · 재활의학과','이지은 수간호사','김혜진','안정'],
 ['p2','최영숙',89,'여성','305호','알츠하이머, 고혈압','정진우 과장 · 신경과','이지은 수간호사','최민혁','집중 관찰'],
 ['p3','박정호',76,'남성','301호','뇌경색 후유 회복기','김재환 과장 · 재활의학과','김미래 간호사','박상욱','안정'],
 ['p4','윤순옥',85,'여성','303호','퇴행성 관절염, 골다공증','김재환 과장 · 내과','이지은 수간호사','강태욱','안정']
 ];
 const statements=patients.map(p=>db.prepare('INSERT OR IGNORE INTO patients (id,name,age,sex,room,diagnosis,doctor,nurse,guardian,status) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(...p));
 for(let p=0;p<4;p++){
  for(let day=0;day<7;day++){
   const d=new Date();d.setUTCDate(d.getUTCDate()-6+day);d.setUTCHours(1,30,0,0);const ts=d.toISOString();
   statements.push(db.prepare('INSERT OR IGNORE INTO care_logs (id,patient_id,category,note,temperature,systolic,diastolic,glucose,meal,rehab,status,author,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(`seed-${p}-${day}`,`p${p+1}`,'종합 케어',p===1?'체온 변화 관찰 중입니다. 수분 섭취와 휴식을 도왔으며 담당 간호사가 경과를 확인하고 있습니다.':'아침 복약 확인, 점심 식사와 보행 재활을 마쳤습니다. 편안하게 휴식 중입니다.',p===1&&day===6?37.8:36.4+(day%3)*0.1,120+p*3+(day%3)*2,76+p,108+p*8+day*2,80+(day%3)*10,20+(day%3)*10,'published','이지은 수간호사',ts));
  }
 }
 const ts=new Date().toISOString();
 statements.push(db.prepare('INSERT OR IGNORE INTO messages (id,patient_id,kind,sender_role,sender_name,body,created_at) VALUES (?,?,?,?,?,?,?)').bind('seed-news-1','p1','news','staff','이지은 수간호사','오늘 김순자 어르신은 점심 식사를 잘 드시고 재활 운동에도 참여하셨습니다. 편안한 하루를 보내고 계십니다.',ts));
 statements.push(db.prepare('INSERT OR IGNORE INTO messages (id,patient_id,kind,sender_role,sender_name,body,created_at) VALUES (?,?,?,?,?,?,?)').bind('seed-inquiry-1','p1','inquiry','family','김혜진','이번 주 면회 때 편한 운동화를 가져가도 될까요?',ts));
 statements.push(db.prepare('INSERT OR IGNORE INTO messages (id,patient_id,kind,sender_role,sender_name,body,created_at) VALUES (?,?,?,?,?,?,?)').bind('seed-news-2','p2','news','staff','이지은 수간호사','최영숙 어르신은 담당 간호사가 체온 변화를 확인하며 휴식을 돕고 있습니다.',ts));
 await db.batch(statements);
}
