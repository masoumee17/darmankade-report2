import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createReportServer} from './server.mjs';
import {makeVercelHandler} from './lib/vercel-handler.mjs';
const ctx={};runInNewContext(await readFile(new URL('data.js',import.meta.url),'utf8'),ctx);
const data=JSON.parse(JSON.stringify(ctx.MILESTONE));
const identities=[
  {id:'11111111-1111-4111-8111-111111111111',email:'admin@example.test',access:'test-access-admin',refresh:'test-refresh-admin',role:'admin',sections:['blog','platform','health']},
  {id:'22222222-2222-4222-8222-222222222222',email:'editor@example.test',access:'test-access-editor',refresh:'test-refresh-editor',role:'editor',sections:['blog']}
];
const rows=data.projects.map(p=>({id:p.id,revision:0,content:{tasks:data.tasks.filter(t=>t.project===p.id),...(p.id==='platform'?{platformSummary:data.platformSummary,campaigns:data.campaigns}:{})}}));
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
let revoked=new Set();
async function fakeCloud(url,options={}){
  const u=new URL(url),bearer=options.headers.Authorization?.replace('Bearer ','');
  const who=identities.find(i=>i.access===bearer&&!revoked.has(i.id));
  if(u.pathname==='/auth/v1/token'){
    const b=JSON.parse(options.body);
    const i=u.searchParams.get('grant_type')==='refresh_token'?identities.find(i=>i.refresh===b.refresh_token&&!revoked.has(i.id)):identities.find(i=>i.email===b.email&&b.password==='synthetic-password');
    return i?reply({user:{id:i.id,email:i.email},access_token:i.access,refresh_token:i.refresh,expires_in:3600}):reply({},401);
  }
  if(u.pathname==='/auth/v1/user')return who?reply({id:who.id,email:who.email}):reply({},401);
  if(u.pathname==='/auth/v1/logout'){if(who)revoked.add(who.id);return reply({});}
  if(!who)return reply({},401);
  if(u.pathname==='/rest/v1/milestone_members')return reply(u.searchParams.get('user_id')==='eq.'+who.id?[{user_id:who.id,role:who.role,sections:who.sections,display_name:'عضو آزمایشی'}]:[]);
  if(u.pathname==='/rest/v1/milestone_sections'){
    const id=u.searchParams.get('id')?.replace('eq.',''),selected=rows.filter(r=>!id||r.id===id);
    if(options.method==='PATCH'){
      if(who.role!=='admin'&&!who.sections.includes(id))return reply({},403);
      const row=selected[0];if(row.revision!==Number(u.searchParams.get('revision').slice(3)))return reply([]);
      Object.assign(row,JSON.parse(options.body));return reply([row]);
    }
    return reply(selected);
  }
  throw Error('Unexpected mock request');
}
const cacheDir=fileURLToPath(new URL('serverless-cache-must-not-be-created/',import.meta.url));
const options={config:{url:'https://example.test',publishableKey:'test-public'},fetcher:fakeCloud,serverless:true,persistCache:false,cacheDir};
const instances=await Promise.all([createReportServer(options),createReportServer(options)]);
const servers=[];
for(const instance of instances){
  const handler=makeVercelHandler(Promise.resolve(instance));
  const front=http.createServer(async(req,res)=>{
    if(req.method!=='GET'){let body='';for await(const chunk of req)body+=chunk;req.body=JSON.parse(body||'{}');}
    await handler(req,res);
  });
  await new Promise(resolve=>front.listen(0,'127.0.0.1',resolve));servers.push(front);
}
async function call(index,route,method='GET',body,auth={},extra={}){
  const r=await fetch('http://127.0.0.1:'+servers[index].address().port+'/api/index?route='+encodeURIComponent(route),{method,headers:{...(body?{'Content-Type':'application/json',Origin:'https://127.0.0.1:'+servers[index].address().port}:{}),...(auth.cookie?{Cookie:auth.cookie}:{}),...(auth.csrf?{'X-CSRF-Token':auth.csrf}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
  return {res:r,body:await r.json()};
}
try{
  assert.equal((await call(0,'../supabase.config.json')).res.status,400);
  const login=await call(0,'login','POST',{username:identities[0].email,password:'synthetic-password'});
  assert.equal(login.res.status,200,JSON.stringify(login.body));
  const cookie=login.res.headers.get('set-cookie');assert.ok(cookie.startsWith('__Host-milestone_session='));assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('Secure'));assert.ok(cookie.length<4096);
  const admin={cookie:cookie.split(';')[0],csrf:login.body.csrfToken};
  assert.ok(!JSON.stringify(login.body).includes('test-access-admin'));
  assert.equal((await call(1,'session','GET',undefined,admin)).body.user.role,'admin','session must work across isolated instances');
  assert.equal((await call(1,'report','GET',undefined,admin)).body.dataSource,'supabase');
  const doc='https://docs.google.com/document/d/synthetic-test/edit';
  assert.equal((await call(1,'tasks/blog-update','PATCH',{documentUrl:doc},admin)).res.status,200);
  assert.equal((await call(0,'report','GET',undefined,admin)).body.tasks.find(t=>t.id==='blog-update').documentUrl,doc);
  const custom=await call(1,'tasks','POST',{project:'health',title:'Synthetic custom health task',type:'test',unit:'item',total:10,done:0},admin);
  assert.equal(custom.res.status,201);
  const customTask=custom.body.report.tasks.find(t=>t.title==='Synthetic custom health task');
  assert.ok(customTask?.id);
  // The other instance has never loaded this new task into its local snapshot.
  const coldEdit=await call(0,'tasks/'+customTask.id,'PATCH',{done:1},admin);
  assert.equal(coldEdit.res.status,200);
  assert.equal(coldEdit.body.report.tasks.find(t=>t.id===customTask.id).done,1);
  assert.equal((await call(1,'tasks/blog-update','PATCH',{done:19},admin,{Origin:'https://other.example'})).res.status,403);
  assert.equal((await call(1,'tasks/blog-update','PATCH',{done:19},admin,{'X-CSRF-Token':'wrong'})).res.status,403);
  const second=await call(0,'login','POST',{username:identities[1].email,password:'synthetic-password'});
  const editor={cookie:second.res.headers.get('set-cookie').split(';')[0],csrf:second.body.csrfToken};
  const payload=JSON.parse(Buffer.from(editor.cookie.split('=')[1],'base64url').toString());
  payload.user={id:identities[0].id,email:identities[0].email};payload.role='admin';payload.sections=['blog','platform','health'];
  const forged={cookie:'__Host-milestone_session='+Buffer.from(JSON.stringify(payload)).toString('base64url'),csrf:editor.csrf};
  const identity=await call(1,'session','GET',undefined,forged);
  assert.equal(identity.body.user.id,identities[1].id);assert.equal(identity.body.user.role,'editor');
  assert.equal((await call(1,'tasks/platform-d','PATCH',{done:103},forged)).res.status,403);
  assert.equal((await call(1,'tasks/blog-update','PATCH',{documentUrl:doc},editor)).res.status,200);
  payload.access='invalid';payload.refresh='invalid';
  assert.equal((await call(1,'session','GET',undefined,{cookie:'__Host-milestone_session='+Buffer.from(JSON.stringify(payload)).toString('base64url')})).body.user,null);
  assert.equal((await call(1,'logout','POST',{},editor)).res.status,200);
  assert.equal((await call(0,'session','GET',undefined,editor)).body.user,null);
  await assert.rejects(access(cacheDir));
  console.log('Verified: serverless routing, parsed request bodies, session portability, Supabase-verified identity, role forgery rejection, CSRF, document persistence, logout, and no filesystem writes.');
}finally{await Promise.all(servers.map(s=>new Promise(resolve=>s.close(resolve))));}
