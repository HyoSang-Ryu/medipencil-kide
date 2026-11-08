import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const app=await readFile('pages-dist/app.js','utf8');
for(const fragment of ["(asset?'/'+encodeURIComponent(asset):'')","id=pid+'/'+asset",'href="/medipencil-kide/7.html"',"location.href='/medipencil-kide/login.html'","'/api/photos/'"]){assert.ok(app.includes(fragment),`Missing working Pages fragment: ${fragment}`)}
for(const file of ['9.html','4.html','3.html']){const html=await readFile('pages-dist/'+file,'utf8');assert.ok(html.includes('/medipencil-kide/pages-runtime.js'));assert.ok(html.includes('/medipencil-kide/app.js'));}
await assert.rejects(access('pages-dist/assets/generated/activities/p1.png'));
console.log('PASS: Pages navigation, authenticated photo URL composition, runtime loading, and private image packaging.');
