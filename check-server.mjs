import assert from 'node:assert/strict';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {createReportServer} from './server.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const context={};runInNewContext(await readFile(join(root,'data.js'),'utf8'),context);
const data=JSON.parse(JSON.stringify(context.MILESTONE));
const userId='11111111-1111-4111-8111-111111111111';
let role='admin',assigned=['blog','platform','health'];
const rows=data.projects.map(p=>({id:p.id,revision:0,content:{tasks:data.tasks.filter(t=>t.project===p.id),...(p.id==='platform'?{platformSummary:data.platformSummary,campaigns:data.campaigns}:{})}}));
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});}
async function fakeCloud(url,options={}){
  const u=new URL(url);
  if(u.pathname==='/auth/v1/token'){
    const v=JSON.parse(options.body);
    if(v.email==='admin@example.test'&&v.password==='synthetic-test-password-only')return response({user:{id:userId,email:v.email},access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600});
    return response({message:'invalid'},400);
  }
  if(u.pathname==='/rest/v1/milestone_members')return response([{user_id:userId,display_name:'عضو آزمایشی',role,sections:assigned}]);
  if(u.pathname==='/rest/v1/milestone_sections'){
    const id=u.searchParams.get('id')?.replace('eq.','');
    const matching=rows.filter(r=>!id||r.id===id);
    if(options.method==='PATCH'){
      const r=matching[0],revision=Number(u.searchParams.get('revision').slice(3));if(r.revision!==revision)return response([]);
      Object.assign(r,JSON.parse(options.body));return response([r]);
    }
    return response(matching);
  }
  throw Error('Unexpected mock request');
}
const cacheDir=await mkdtemp(join(root,'test-cache-'));
const server=await createReportServer({config:{url:'https://example.test',publishableKey:'synthetic-public',adminEmail:'admin@example.test'},cacheDir,fetcher:fakeCloud});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let cookie='',csrf='';
async function call(path,method='GET',body,extra={}){
  const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {res:r,body:await r.json()};
}
try{
  assert.equal((await call('/api/tasks/blog-update','PATCH',{done:20})).res.status,401);
  assert.equal((await call('/supabase.config.json')).res.status,404);
  assert.equal((await call('/api/login','POST',{username:'admin@example.test',password:'wrong'})).res.status,401);
  const auth=await call('/api/login','POST',{username:'admin@example.test',password:'synthetic-test-password-only'});
  assert.equal(auth.res.status,200);assert.ok(auth.res.headers.get('set-cookie').includes('HttpOnly'));assert.ok(auth.res.headers.get('set-cookie').includes('SameSite=Strict'));
  cookie=auth.res.headers.get('set-cookie').split(';')[0];csrf=auth.body.csrfToken;
  assert.equal((await call('/api/session')).body.user.role,'admin');
  assert.equal((await call('/api/session')).body.user.displayName,'عضو آزمایشی');
  assert.equal((await call('/api/session')).body.defaultUsername,'');
  assert.equal((await call('/api/tasks/blog-update','PATCH',{done:20},{Origin:'https://untrusted.example'})).res.status,403);
  assert.equal((await call('/api/tasks/blog-update','PATCH',{done:20},{'X-CSRF-Token':'wrong'})).res.status,403);
  assert.equal((await call('/api/tasks/blog-update','PATCH',{done:2001})).res.status,400);
  const saved=await call('/api/tasks/blog-update','PATCH',{done:20});assert.equal(saved.res.status,200);assert.equal(saved.body.report.tasks.find(t=>t.id==='blog-update').done,20);
  const documentUrl='https://docs.google.com/spreadsheets/d/synthetic-test/edit';
  assert.equal((await call('/api/tasks/blog-update','PATCH',{documentUrl})).res.status,200);
  assert.equal((await call('/api/report')).body.tasks.find(t=>t.id==='blog-update').documentUrl,documentUrl);
  assert.equal((await call('/api/tasks/blog-update','PATCH',{monthlyCapacity:12})).body.report.tasks.find(t=>t.id==='blog-update').documentUrl,documentUrl);
  for(const url of ['javascript:alert(1)','/relative','data:text/html,unsafe','https://user:pass@example.test/file'])assert.equal((await call('/api/tasks/blog-update','PATCH',{documentUrl:url})).res.status,400);
  for(const id of ['platform-d','platform-z','platform-b','blog-features']){
    assert.equal((await call('/api/tasks/'+id,'PATCH',{documentUrl})).res.status,200);
    assert.equal((await call('/api/report')).body.tasks.find(t=>t.id===id).documentUrl,documentUrl);
  }
  assert.equal((await call('/api/tasks/health-debug','PATCH',{documentUrl})).res.status,400);
  assert.equal((await call('/api/tasks/blog-update','PATCH',{documentUrl:''})).body.report.tasks.find(t=>t.id==='blog-update').documentUrl,null);
  assert.equal((await call('/api/campaigns/1405-05','PATCH',{completed:true})).res.status,200);
  assert.equal((await call('/api/report')).body.campaigns.records[0].completed,true);
  const created=await call('/api/tasks','POST',{project:'blog',title:'Synthetic test task',type:'Test',unit:'item',total:10,done:0,monthlyCapacity:2,documentUrl});assert.equal(created.res.status,201);
  assert.equal(created.body.report.tasks.find(t=>t.title==='Synthetic test task').documentUrl,documentUrl);
  assert.equal(created.body.task.id,created.body.report.tasks.find(t=>t.title==='Synthetic test task').id);
  assert.equal((await call('/api/tasks/'+created.body.task.id,'DELETE',{}, {'X-CSRF-Token':'wrong'})).res.status,403);
  assert.equal((await call('/api/tasks/'+created.body.task.id,'DELETE',{}, {Origin:'https://untrusted.example'})).res.status,403);
  role='editor';assigned=['blog'];assert.equal((await call('/api/tasks/platform-d','PATCH',{done:110})).res.status,403);
  assert.equal((await call('/api/campaigns/1405-05','PATCH',{completed:false})).res.status,403);
  assert.equal((await call('/api/tasks/blog-update','PATCH',{done:21})).res.status,200);
  assert.equal((await call('/api/tasks/platform-d','DELETE',{})).res.status,403);
  assert.equal((await call('/api/tasks/'+created.body.task.id,'DELETE',{})).res.status,200);
  assert.ok(!(await call('/api/report')).body.tasks.some(t=>t.id===created.body.task.id));
  assert.equal((await call('/api/tasks/'+created.body.task.id,'DELETE',{})).res.status,404);
  const scopedTasks={blog:'blog-update',platform:'platform-d',health:'health-debug'};
  for(const allowed of ['blog','platform','health']){
    role='editor';assigned=[allowed];
    for(const project of ['blog','platform','health']){
      const result=await call('/api/tasks/'+scopedTasks[project],'PATCH',{monthlyCapacity:20});
      assert.equal(result.res.status,project===allowed?200:403,allowed+' editor must only edit its own section');
      if(project===allowed&&project==='platform'){
        assert.equal(result.body.report.platformSummary.total,1426);
        assert.equal(result.body.report.platformSummary.done,215);
      }
    }
    assert.equal((await call('/api/campaigns/1405-05','PATCH',{completed:true})).res.status,allowed==='platform'?200:403);
    assert.equal((await call('/api/tasks','POST',{project:allowed==='blog'?'platform':'blog',title:'Forbidden',type:'test',unit:'item'})).res.status,403);
  }
  // Deleting the last baseline task leaves an empty but valid section.
  role='editor';assigned=['health'];
  for(const t of data.tasks.filter(t=>t.project==='health'))assert.equal((await call('/api/tasks/'+t.id,'DELETE',{})).res.status,200);
  assert.equal((await call('/api/report')).body.tasks.filter(t=>t.project==='health').length,0);
  role='editor';assigned=['blog'];
  assert.equal((await call('/api/tasks/blog-update','DELETE',{})).res.status,200);
  assert.ok(!(await call('/api/report')).body.tasks.some(t=>t.id==='blog-update'));
  role='editor';assigned=['platform'];
  for(const id of ['platform-d','platform-z','platform-b'])assert.equal((await call('/api/tasks/'+id,'DELETE',{})).res.status,200);
  const emptyPlatform=(await call('/api/report')).body;
  assert.equal(emptyPlatform.platformSummary.total,0);assert.equal(emptyPlatform.platformSummary.done,0);
  assert.equal(emptyPlatform.campaigns.records.length,4);
  const plp=await call('/api/tasks','POST',{project:'platform',title:'Custom PLP',type:'PLP',unit:'page',documentUrl});
  assert.equal(plp.res.status,201);assert.equal(plp.body.task.documentUrl,documentUrl);
  role='viewer';assigned=['blog','platform','health'];
  assert.equal((await call('/api/tasks/blog-features','PATCH',{done:22})).res.status,403);
  assert.equal((await call('/api/tasks/blog-features','DELETE',{})).res.status,403);
  const cache=await readFile(join(cacheDir,'report-cache.json'),'utf8');assert.ok(!cache.includes('synthetic-test-password'));assert.ok(!cache.includes('synthetic-access'));
  assert.equal((await call('/api/logout','POST',{})).res.status,200);
  assert.equal((await call('/api/tasks/blog-features','PATCH',{done:22})).res.status,401);
  console.log('Verified with mocked Supabase: password login, session cookie, CSRF, origin checks, role scopes, task validation, persisted edits, monthly ticks, PLP/feature links, scoped deletion, empty sections, and logout.');
}finally{
  await new Promise(resolve=>server.close(resolve));
  try{await unlink(join(cacheDir,'report-cache.json'));}catch{}
  await rmdir(cacheDir);
}
