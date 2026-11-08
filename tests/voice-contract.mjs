import assert from 'node:assert/strict';
import {hasEndCommand,removeEndCommand,normalizeNote,cleanFrame,validateNote,serializedText} from '../lib/voice-contract.ts';
for(const end of ['KIDE, 정리해줘.','키데 정리해 주세요','KIDE, summarize!','Kide tee yhteenveto.']){assert.ok(hasEndCommand('아직 산책 전. '+end));assert.equal(removeEndCommand('아직 산책 전. '+end),'아직 산책 전.')}
for(const s of ['정리해줘','KIDE is the assistant','KIDE, 정리해줘라고 말하면 됩니다'])assert.equal(hasEndCommand(s),false);
const note=normalizeNote({charting:[{topic:'산책',value_ko:'오후에 산책할 계획이다.',value_fi:'',source_ko:'아직 산책 전',claim_type:'plan'},{topic:'누락',claim_type:'missing'}],missing_questions:[{question_ko:'통증이 있나요?'}]});
assert.equal(note.items.length,1);assert.equal(note.items[0].type,'plan');assert.equal(note.items[0].source,'아직 산책 전');assert.equal(note.language,'ko');assert.equal(note.warnings[0],'통증이 있나요?');
assert.equal(normalizeNote({nursing_note:{yleistila:'Vointi on hyvä.',kipu:null}}).language,'fi');
assert.throws(()=>normalizeNote({nursing_note:{x:'{"secret":"payload"}'}}));assert.throws(()=>normalizeNote({charting:[]}));
assert.equal(serializedText('ordinary prose'),false);assert.equal(serializedText('```json\n{}'),true);
assert.equal(cleanFrame('{"type":"ready"}').type,'ready');assert.equal(cleanFrame('{"type":"done"}').type,'done');
assert.equal(cleanFrame('{"type":"transcript","segments":[{"text":"계획입니다"}],"partial":""}').segments[0].text,'계획입니다');
assert.throws(()=>cleanFrame('{"type":"transcript","segments":"bad","partial":""}'));assert.throws(()=>cleanFrame('{"type":"error","message":"secret"}'));
assert.throws(()=>validateNote({items:[]}));assert.equal(validateNote(note).items[0].type,'plan');
console.log('PASS: terminal-only KIDE commands, plan preservation, legacy/v4 adapters, prose guard, strict frames and draft validation');
