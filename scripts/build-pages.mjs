import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('pages-dist'),base='/medipencil-kide/';
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});await cp('public',out,{recursive:true});
for(const name of await readdir(out)){
 if(!/\.(html|js|css)$/.test(name))continue;
 let s=await readFile(path.join(out,name),'utf8');
 s=s.replace(/(["'`])\/(?!\/|api\/)(?=[a-zA-Z]|\$\{)/g,`$1${base}`);
 if(name.endsWith('.html'))s=s.replace('<head>','<head><script src="'+base+'pages-runtime.js"></script>');
 await writeFile(path.join(out,name),s);
}
await writeFile(path.join(out,'pages-runtime.js'),`(() => {
 const api='https://medipencil-care-demo-hs1105.ryu22620.chatgpt.site',key='medipencil-kide.session',original=window.fetch.bind(window);
 window.fetch=async(input,options={})=>{
  if(typeof input!=='string'||!input.startsWith('/api/'))return original(input,options);
  const headers=new Headers(options.headers),token=sessionStorage.getItem(key);
  headers.set('X-MP-Client','pages');if(token)headers.set('X-MP-Session',token);
  const response=await original(api+input,{...options,headers,credentials:'omit',cache:'no-store',redirect:'error'});
  if(response.ok&&/^\\/api\\/auth\\/(login|register|password)$/.test(input)){
   const data=await response.clone().json();if(data.sessionToken)sessionStorage.setItem(key,data.sessionToken);
  }
  if((input==='/api/auth/logout'&&response.ok)||response.status===401)sessionStorage.removeItem(key);
  return response;
 };
})();\n`);
await writeFile(path.join(out,'index.html'),'<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./login.html"><title>MediPencil</title></head><body><a href="./login.html">MediPencil 열기</a></body></html>');
await writeFile(path.join(out,'.nojekyll'),'');
await writeFile(path.join(out,'build-info.json'),JSON.stringify({commit:process.env.GITHUB_SHA||'local',hosting:'github-pages',api:'https://medipencil-care-demo-hs1105.ryu22620.chatgpt.site',synthetic:true}));
console.log('GitHub Pages files ready:',out);
