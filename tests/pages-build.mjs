import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const app=await readFile('pages-dist/app.js','utf8');
for(const fragment of ["(asset?'/'+encodeURIComponent(asset):'')","id=pid+'/'+asset",'href="/medipencil-kide/7.html#inquiry"',"location.href='/medipencil-kide/login.html'","'/api/photos/'"]){assert.ok(app.includes(fragment),`Missing working Pages fragment: ${fragment}`)}
for(const file of ['9.html','4.html','3.html']){const html=await readFile('pages-dist/'+file,'utf8');assert.ok(html.includes('/medipencil-kide/pages-runtime.js'));assert.ok(html.includes('/medipencil-kide/app.js'));assert.ok(html.includes('/medipencil-kide/mobile.css'));}
await assert.rejects(access('pages-dist/assets/generated/activities/p1.png'));
console.log('PASS: Pages navigation, authenticated photo URL composition, runtime loading, and private image packaging.');

for(const screen of [1,2,3,6]){const html=await readFile('pages-dist/'+screen+'.html','utf8');assert.ok(html.includes('/medipencil-kide/staff.css'));assert.ok(html.includes('/medipencil-kide/staff-charts.js'));assert.ok(html.indexOf('/medipencil-kide/staff-charts.js')<html.indexOf('/medipencil-kide/app.js'));}
await access('pages-dist/staff-charts.js');
console.log('PASS: all four staff routes include styled controls and chart runtime before the app.');
const activity=await readFile('pages-dist/activities.html','utf8');
assert.ok(activity.includes('window.PAGE=11'));
assert.ok(activity.includes('/medipencil-kide/pages-runtime.js'));
assert.ok(app.includes('href="/medipencil-kide/activities.html"'));
assert.ok(app.includes("'/api/activities/'"));
console.log('PASS: activity management route, scoped upload transport and Pages navigation.');
const voice=await readFile('pages-dist/voice.html','utf8');
assert.ok(voice.includes('window.PAGE=12'));
assert.ok(voice.includes('/medipencil-kide/voice.js'));
assert.ok(app.includes('href="/medipencil-kide/voice.html"'));
await access('pages-dist/voice-recorder.worklet.js');
assert.ok(!(await readFile('pages-dist/voice.js','utf8')).includes('X-API-Key'));
console.log('PASS: voice chart route, recorder runtime and server-only provider credential use.');
