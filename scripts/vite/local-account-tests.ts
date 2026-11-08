import type { Plugin } from 'vite';
// Loopback-only development identities. This Vite middleware is never part of the Worker build.
export function localAccountTests():Plugin{return {name:'local-account-tests',configureServer(server){server.middlewares.use((req,res,next)=>{
 const host=(req.headers.host||'').split(':')[0];if(!['localhost','127.0.0.1'].includes(host)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'')){next();return}
 const identities:Record<string,{id:string;email:string;name:string}>={admin:{id:'local_seedy',email:'seedy@sites.test',name:'Seedy'},staff:{id:'local_staff',email:'staff@sites.test',name:'테스트 의료진'},family1:{id:'local_family1',email:'family1@sites.test',name:'김순자 보호자'},family2:{id:'local_family2',email:'family2@sites.test',name:'최영숙 보호자'},pending:{id:'local_pending',email:'pending@sites.test',name:'승인 대기 계정'}};
 const url=new URL(req.url||'/',`http://${req.headers.host}`);
 if(url.pathname==='/__test/signin'){
  const key=url.searchParams.get('user')||'';if(!identities[key]){res.statusCode=400;res.end();return}
  res.statusCode=302;res.setHeader('Set-Cookie',[`mp_local_identity=${key}; HttpOnly; SameSite=Lax; Path=/`,'__sites_local_auth=1; HttpOnly; SameSite=Lax; Path=/']);res.setHeader('Location','/login.html');res.end();return
 }
 const key=req.headers.cookie?.match(/(?:^|;\s*)mp_local_identity=([^;]+)/)?.[1],identity=key&&identities[key];
 if(identity&&req.headers['oai-authenticated-user-id']){const h={'oai-authenticated-user-id':identity.id,'oai-authenticated-user-email':identity.email,'oai-authenticated-user-full-name':encodeURIComponent(identity.name),'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'};for(const [k,v]of Object.entries(h)){req.headers[k]=v;for(let i=req.rawHeaders.length-2;i>=0;i-=2){if(req.rawHeaders[i].toLowerCase()===k)req.rawHeaders.splice(i,2)}req.rawHeaders.push(k,v)}}
 next();
 })}}}
