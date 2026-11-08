// Adapted from Team_Medipencil poc/remote-validation (666da43), kideCommand,
// kideResultGuard and kide_v4. AI output is a candidate; never an approval.
export const endCommand=/(?:kide|키데|키드)[,，:!\s]*(?:정리해\s*줘|정리해\s*주세요|summari[sz]e(?:\s+please)?|tee\s+yhteenveto)[.!?\s]*$/i;
export const hasEndCommand=(s:string)=>endCommand.test(s.trim());
export const removeEndCommand=(s:string)=>s.trim().replace(endCommand,'').trim();
export type VoiceItem={label:string;text:string;source:string;type:string};
export type VoiceNote={items:VoiceItem[];warnings:string[];language:string};
const str=(v:unknown,max=5000)=>{if(typeof v!=='string'||v.length>max)throw Error('INVALID_PROVIDER_RESULT');return v.trim()};
export function serializedText(v:unknown):boolean{
 if(typeof v==='string'){try{const p=JSON.parse(v);if(p&&typeof p==='object')return true}catch{}return /(?:^|\n)\s*(?:```(?:json)?\s*|[\[{]\s*(?:[\[{]|"[^"]+"\s*:))/.test(v)}
 if(Array.isArray(v))return v.some(serializedText);
 return !!v&&typeof v==='object'&&Object.values(v).some(serializedText);
}
export function normalizeNote(raw:any):VoiceNote{
 if(!raw||typeof raw!=='object'||serializedText(raw))throw Error('INVALID_PROVIDER_RESULT');
 const v=raw.v4||raw,items:VoiceItem[]=[];let warnings:string[]=[];
 if(Array.isArray(v.charting)){
  if(v.charting.length>60)throw Error('INVALID_PROVIDER_RESULT');
  for(const c of v.charting){if(c.claim_type==='missing')continue;items.push({label:str(c.topic||c.area,120),text:str(c.value_ko||c.value_fi),source:str(c.source_ko||''),type:['plan','reported','observation','inference'].includes(c.claim_type)?c.claim_type:'unknown'})}
  warnings=(Array.isArray(v.missing_questions)?v.missing_questions:[]).slice(0,30).map((q:any)=>str(q.question_ko||q.question_fi||''));
 }else if(raw.nursing_note&&typeof raw.nursing_note==='object'&&!Array.isArray(raw.nursing_note)){
  for(const [label,value] of Object.entries(raw.nursing_note).slice(0,20)){if(value)items.push({label:str(label,120),text:str(value),source:'',type:'unknown'})}
 }else throw Error('INVALID_PROVIDER_RESULT');
 if(!items.length)throw Error('EMPTY_PROVIDER_RESULT');
 warnings.push(...(Array.isArray(raw.huomiot_hoitajalle)?raw.huomiot_hoitajalle:[]).slice(0,20).map((v:unknown)=>str(v)));
 if(items.reduce((n,x)=>n+x.text.length,0)>20000)throw Error('INVALID_PROVIDER_RESULT');
 return {items,warnings,language:items.some(i=>/[가-힣]/.test(i.text))?'ko':'fi'};
}
export function validateNote(raw:any):VoiceNote{
 if(!raw||!Array.isArray(raw.items)||!raw.items.length||raw.items.length>60)throw Error('기록 항목을 확인해 주세요.');
 const items=raw.items.map((i:any)=>({label:str(i.label,120),text:str(i.text),source:str(i.source||''),type:['plan','reported','observation','inference','unknown'].includes(i.type)?i.type:'unknown'}));
 if(items.some((i:VoiceItem)=>!i.label||!i.text)||serializedText(items)||items.reduce((n:number,i:VoiceItem)=>n+i.text.length,0)>20000)throw Error('기록 내용을 확인해 주세요.');
 return {items,warnings:Array.isArray(raw.warnings)?raw.warnings.slice(0,50).map((v:unknown)=>str(v)):[],language:raw.language==='fi'?'fi':'ko'};
}
export function cleanFrame(raw:unknown){
 if(typeof raw!=='string'||raw.length>200000)throw Error('INVALID_FRAME');const m=JSON.parse(raw);
 if(m.type==='ready'||m.type==='done')return {type:m.type} as any;
 if(m.type==='error')throw Error('PROVIDER_UNAVAILABLE');
 if(m.type!=='transcript'||!Array.isArray(m.segments)||m.segments.length>1000||typeof m.partial!=='string'||m.partial.length>20000||serializedText(m))throw Error('INVALID_FRAME');
 const segments=m.segments.map((s:any)=>({text:str(s.text,20000)}));if(segments.reduce((n:number,s:any)=>n+s.text.length,0)>20000)throw Error('INVALID_FRAME');
 return {type:'transcript',segments,partial:m.partial};
}
