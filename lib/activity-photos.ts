// Independent synthetic demo scenes. These are not evidence of real care or treatment.
export const activityPhotos = [
 {id:'p1-art',patient_id:'p1',asset:'activity-art',title:'색으로 채우는 오후',category:'종합 케어',description:'창가에서 꽃 그림을 그리는 미술 활동 장면입니다.',created_at:'2026-11-05T05:00:00.000Z'},
 {id:'p1-garden',patient_id:'p1',asset:'activity-garden',title:'햇살 아래 작은 정원',category:'종합 케어',description:'정원에서 허브 화분을 가꾸는 활동 장면입니다.',created_at:'2026-11-05T01:30:00.000Z'},
 {id:'p1-meal',patient_id:'p1',asset:'activity-meal',title:'함께하는 식사 시간',category:'식사',description:'돌봄 선생님과 이야기를 나누며 식사하는 장면입니다.',created_at:'2026-11-04T03:00:00.000Z'},
 {id:'p2-flowers',patient_id:'p2',asset:'activity-flowers',title:'꽃과 함께하는 시간',category:'종합 케어',description:'밝은 휴게실에서 꽃을 꽂는 원예 활동 장면입니다.',created_at:'2026-11-05T05:00:00.000Z'},
 {id:'p3-exercise',patient_id:'p3',asset:'activity-exercise',title:'천천히, 함께 움직이기',category:'재활',description:'선생님과 함께 앉아서 팔을 움직이는 운동 장면입니다.',created_at:'2026-11-05T01:00:00.000Z'},
 {id:'p4-gardening',patient_id:'p4',asset:'activity-gardening',title:'초록을 돌보는 오후',category:'종합 케어',description:'정원에서 작은 허브 화분을 가꾸는 장면입니다.',created_at:'2026-11-05T05:00:00.000Z'},
].map(photo=>({...photo,synthetic:true}));
