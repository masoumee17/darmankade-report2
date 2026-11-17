import http from 'node:http';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {randomBytes,randomUUID} from 'node:crypto';
import './task-links.js';
const root=process.env.VERCEL==='1'?process.cwd():dirname(fileURLToPath(import.meta.url));
const statics=new Set(['index.html','app.js','styles.css','data.js','metrics.js','task-links.js','supabase/setup.sql']);
const statuses=new Set(['active','recurring','planned','dependency','unreported','completed']);
const fail=(status,message)=>Object.assign(Error(message),{status});
const clone=value=>JSON.parse(JSON.stringify(value));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.sql':'text/plain; charset=utf-8'};
async function seed(){const ctx={};runInNewContext(await readFile(join(root,'data.js'),'utf8'),ctx);return clone(ctx.MILESTONE);}
export async function createReportServer(options={}){
  const config=options.config||(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY?{url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY}:JSON.parse(await readFile(join(root,'supabase.config.json'),'utf8')));
  const serverless=options.serverless??process.env.VERCEL==='1';
  const cookieName=serverless?'__Host-milestone_session':'milestone_session';
  const persist=options.persistCache??!serverless;
  const cacheDir=options.cacheDir||join(root,'.local');
  const fetcher=options.fetcher||fetch;
  let report=await seed();
  if(persist)try{const cached=JSON.parse(await readFile(join(cacheDir,'report-cache.json'),'utf8'));if(cached.schemaVersion===report.schemaVersion)report=cached;}catch{}
  const sessions=new Map(),attempts=new Map();
  let mutationQueue=Promise.resolve();
  async function cloud(path,access,method='GET',body,extra={}){
    let res;try{res=await fetcher(config.url+path,{method,headers:{apikey:config.publishableKey,...(access?{Authorization:'Bearer '+access}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw fail(503,'ارتباط با Supabase برقرار نشد. اتصال اینترنت یا وضعیت پروژه را بررسی کنید.');}
    let data;try{data=await res.json();}catch{data=null;}
    if(!res.ok){
      if(res.status===401||res.status===403)throw fail(res.status,'ورود یا دسترسی به این بخش تأیید نشد.');
      if(res.status===429)throw fail(429,'تعداد تلاش‌ها زیاد شده است؛ کمی بعد دوباره تلاش کنید.');
      if(data?.code==='PGRST205'||res.status===404)throw fail(424,'جدول‌های پنل هنوز ساخته نشده‌اند؛ فایل راه‌اندازی Supabase را اجرا کنید.');
      throw fail(502,'درخواست Supabase کامل نشد. تنظیمات پروژه و دسترسی حساب را بررسی کنید.');
    }
    return data;
  }
  function token(req){const raw=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='));return raw?raw.slice(cookieName.length+1):null;}
  function sessionCookie(s){
    const value=serverless?Buffer.from(JSON.stringify({access:s.access,refresh:s.refresh,csrfToken:s.csrfToken,tokenExpiresAt:s.tokenExpiresAt,expiresAt:s.expiresAt})).toString('base64url'):null;
    if(value&&value.length>3800)throw fail(500,'حجم نشست ورود بیش از حد مجاز است.');
    return value;
  }
  const cookieHeader=value=>`${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value?43200:0}${serverless?'; Secure':''}`;
  async function sessionOf(req){
    if(req._milestoneSession!==undefined)return req._milestoneSession;
    const key=token(req);
    if(!serverless){const s=key?sessions.get(key):null;if(s&&s.expiresAt>Date.now())return s;if(key)sessions.delete(key);return null;}
    if(!key||key.length>3800)return null;
    let payload;try{payload=JSON.parse(Buffer.from(key,'base64url').toString('utf8'));}catch{return null;}
    if(typeof payload.access!=='string'||typeof payload.refresh!=='string'||typeof payload.csrfToken!=='string'||!/^[a-f0-9]{48}$/.test(payload.csrfToken)||!Number.isFinite(payload.expiresAt)||payload.expiresAt<=Date.now())return null;
    const s={access:payload.access,refresh:payload.refresh,csrfToken:payload.csrfToken,tokenExpiresAt:payload.tokenExpiresAt,expiresAt:payload.expiresAt,member:null,databaseReady:false};
    let user;
    try{user=await cloud('/auth/v1/user',s.access);}catch(e){
      if(e.status!==401)throw e;
      try{s.tokenExpiresAt=0;await refresh(s);user=await cloud('/auth/v1/user',s.access);}catch{return null;}
    }
    if(!user||typeof user.id!=='string'||typeof user.email!=='string')return null;
    s.user={id:user.id,email:user.email};req._milestoneSession=s;return s;
  }
  function publicSession(s){return {configured:true,defaultUsername:'',user:s?{id:s.user.id,username:s.user.email,displayName:s.member?.display_name||s.user.email,role:s.member?.role||'no-access',sections:s.member?.sections||[]}:null,csrfToken:s?.csrfToken||null,databaseReady:s?.databaseReady??null};}
  async function membership(s){
    try{const rows=await cloud('/rest/v1/milestone_members?select=*&user_id=eq.'+encodeURIComponent(s.user.id),s.access);s.member=rows?.[0]||null;s.databaseReady=true;}
    catch(e){if(e.status===424){s.member=null;s.databaseReady=false;}else throw e;}
    return s.member;
  }
  async function refresh(s){if(s.tokenExpiresAt>Date.now()+30000)return;const a=await cloud('/auth/v1/token?grant_type=refresh_token',null,'POST',{refresh_token:s.refresh});s.access=a.access_token;s.refresh=a.refresh_token;s.tokenExpiresAt=Date.now()+a.expires_in*1000;}
  async function requireMember(req,project=null){
    const s=await sessionOf(req);if(!s)throw fail(401,'برای ثبت تغییرات ابتدا وارد پنل شوید.');
    if(req.headers['x-csrf-token']!==s.csrfToken)throw fail(403,'نشست معتبر نیست؛ صفحه را تازه کنید و دوباره وارد شوید.');
    await refresh(s);const member=await membership(s);
    if(!s.databaseReady)throw fail(424,'برای فعال‌سازی ذخیره اطلاعات، فایل راه‌اندازی Supabase را اجرا کنید.');
    if(!member||project!==null&&!(member.role==='admin'||member.role==='editor'&&member.sections.includes(project)))throw fail(403,'حساب شما اجازه ویرایش این بخش را ندارد.');
    return s;
  }
  function sectionOf(data,id){return {tasks:data.tasks.filter(t=>t.project===id),...(id==='platform'?{platformSummary:data.platformSummary,campaigns:data.campaigns}:{})};}
  function normalizeSection(id,content){
    if(id!=='platform'||!content.platformSummary?.breakdownConfirmed)return content;
    const pages=content.tasks.filter(t=>t.pageMetric);
    if(!pages.every(t=>Number.isFinite(t.total)))return content;
    const total=pages.reduce((s,t)=>s+t.total,0),done=pages.every(t=>Number.isFinite(t.done))?pages.reduce((s,t)=>s+t.done,0):content.platformSummary.done;
    const number=v=>new Intl.NumberFormat('fa-IR').format(v);
    const details=pages.map(t=>`${t.title}: ${number(t.done)} انجام‌شده از ${number(t.total)}`).join('؛ ');
    return {...content,platformSummary:{...content.platformSummary,total,done,note:details}};
  }
  function applySection(id,content){
    if(!Array.isArray(content?.tasks)||content.tasks.some(t=>t.project!==id))throw fail(502,'ساختار اطلاعات این بخش معتبر نیست.');
    content=normalizeSection(id,content);
    report.tasks=report.tasks.filter(t=>t.project!==id).concat(content.tasks);
    report.tasks.sort((a,b)=>report.projects.findIndex(p=>p.id===a.project)-report.projects.findIndex(p=>p.id===b.project));
    if(id==='platform'){if(content.platformSummary)report.platformSummary=content.platformSummary;if(content.campaigns)report.campaigns=content.campaigns;}
  }
  async function persistCache(){if(!persist)return;await mkdir(cacheDir,{recursive:true});const dest=join(cacheDir,'report-cache.json');await writeFile(dest+'.tmp',JSON.stringify(report,null,2));await rename(dest+'.tmp',dest);}
  async function loadRemote(s){if(!s.member)return;const rows=await cloud('/rest/v1/milestone_sections?select=id,content,revision',s.access);for(const row of rows||[])applySection(row.id,row.content);if(rows?.length)await persistCache();}
  async function mutate(s,id,fn){
    const prior=await cloud('/rest/v1/milestone_sections?select=id,content,revision&id=eq.'+encodeURIComponent(id),s.access);
    if(prior.length!==1)throw fail(424,'داده اولیه این بخش در Supabase وجود ندارد؛ راه‌اندازی را کامل کنید.');
    const old=prior[0];let content=clone(old.content);fn(content);content=normalizeSection(id,content);
    const rows=await cloud('/rest/v1/milestone_sections?id=eq.'+encodeURIComponent(id)+'&revision=eq.'+old.revision,s.access,'PATCH',{content,revision:old.revision+1,updated_by:s.user.id},{Prefer:'return=representation'});
    if(rows?.length!==1)throw fail(409,'این بخش هم‌زمان تغییر کرده است؛ صفحه را تازه کنید و دوباره ذخیره کنید.');
    applySection(id,rows[0].content);await persistCache();return {report};
  }
  function numeric(value,name,max=10000000){if(value===null)return null;if(!Number.isInteger(value)||value<0||value>max)throw fail(400,'مقدار «'+name+'» باید عدد صحیح و نامنفی باشد.');return value;}
  function editTask(t,body){
    const allowed=new Set(['title','total','done','monthlyCapacity','status','documentUrl']);
    if(Object.keys(body).some(k=>!allowed.has(k)))throw fail(400,'فیلد ویرایش معتبر نیست.');
    const updated={...t};
    if(body.documentUrl!==undefined){
      if(!['blog','platform'].includes(t.project))throw fail(400,'لینک فایل برای فعالیت‌های بلاگ و پلتفرم قابل ثبت است.');
      try{updated.documentUrl=globalThis.TaskLinks.normalize(body.documentUrl);}catch(e){throw fail(400,e.message);}
    }
    if(body.title!==undefined){if(typeof body.title!=='string'||!body.title.trim()||body.title.length>160)throw fail(400,'عنوان فعالیت معتبر نیست.');updated.title=body.title.trim();}
    for(const k of ['total','done','monthlyCapacity'])if(body[k]!==undefined){if(t.status==='recurring'&&k!=='monthlyCapacity')throw fail(400,'آمار فعالیت مستمر باید به‌صورت ماهانه ثبت شود.');updated[k]=numeric(body[k],k,k==='monthlyCapacity'?100000:10000000);}
    if(updated.monthlyCapacity===0)throw fail(400,'ظرفیت باید مثبت باشد یا خالی بماند.');
    if(Number.isFinite(updated.total)&&Number.isFinite(updated.done)&&updated.done>updated.total)throw fail(400,'انجام‌شده نمی‌تواند از حجم کل بیشتر باشد.');
    if(body.status!==undefined){if(!statuses.has(body.status)||t.status==='recurring'&&body.status!=='recurring'||t.status!=='recurring'&&body.status==='recurring')throw fail(400,'وضعیت انتخاب‌شده معتبر نیست.');updated.status=body.status;}
    if(updated.status==='completed'&&(!Number.isFinite(updated.total)||updated.total!==updated.done))throw fail(400,'برای وضعیت تکمیل‌شده، انجام‌شده باید با حجم کل برابر باشد.');
    return updated;
  }
  async function readBody(req){
    let supplied;try{supplied=req.body;}catch{throw fail(400,'اطلاعات درخواست معتبر نیست.');}
    let buf='';if(supplied!==undefined)buf=typeof supplied==='string'?supplied:JSON.stringify(supplied);
    else for await(const chunk of req){buf+=chunk;if(buf.length>64000)throw fail(413,'حجم درخواست بیش از حد مجاز است.');}
    if(buf.length>64000)throw fail(413,'حجم درخواست بیش از حد مجاز است.');
    try{const body=JSON.parse(buf||'{}');if(!body||Array.isArray(body)||typeof body!=='object')throw Error();return body;}catch{throw fail(400,'اطلاعات درخواست معتبر نیست.');}
  }
  function send(res,status,body,headers={}){
    const active=res.req?._milestoneSession;
    if(serverless&&active&&!headers['Set-Cookie'])headers['Set-Cookie']=cookieHeader(sessionCookie(active));
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body));
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(!path.startsWith('/api/')){
        const file=decodeURIComponent(path==='/'?'index.html':path.slice(1));if(!statics.has(file))throw fail(404,'صفحه پیدا نشد.');
        const body=await readFile(join(root,file));res.writeHead(200,{'Content-Type':mime[extname(file)]||'text/plain','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});res.end(body);return;
      }
      if(req.method!=='GET'){
        const origin=req.headers.origin;
        const port=server.address()?.port;
        const expected=serverless?['https://'+req.headers.host]:['http://127.0.0.1:'+port,'http://localhost:'+port];
        if(origin&&!expected.includes(origin))throw fail(403,'مبدأ درخواست معتبر نیست.');
        if(!req.headers['content-type']?.startsWith('application/json'))throw fail(415,'درخواست باید JSON باشد.');
      }
      if(path==='/api/session'&&req.method==='GET'){const s=await sessionOf(req);if(s){try{await refresh(s);await membership(s);}catch{sessions.delete(token(req));req._milestoneSession=null;send(res,200,publicSession(null),{'Set-Cookie':cookieHeader('')});return;}}send(res,200,publicSession(s));return;}
      if(path==='/api/report'&&req.method==='GET'){const s=await sessionOf(req);if(s){await refresh(s);await membership(s);if(s.member)await loadRemote(s);}send(res,200,{...report,dataSource:s?.member?'supabase':'snapshot'});return;}
      if(path==='/api/login'&&req.method==='POST'){
        const ip=req.socket.remoteAddress||'local',now=Date.now();let rate=attempts.get(ip);if(!rate||rate.until<now){rate={count:0,until:now+15*60*1000};attempts.set(ip,rate);}if(++rate.count>10)throw fail(429,'تعداد تلاش‌ها زیاد شده؛ ۱۵ دقیقه بعد دوباره امتحان کنید.');
        const b=await readBody(req);if(typeof b.username!=='string'||typeof b.password!=='string'||b.username.length>254||b.password.length>256||!b.password)throw fail(400,'ایمیل حساب و رمز عبور را وارد کنید.');
        let auth;try{auth=await cloud('/auth/v1/token?grant_type=password',null,'POST',{email:b.username.trim(),password:b.password});}catch(e){if([401,403,502].includes(e.status))throw fail(401,'ایمیل یا رمز عبور صحیح نیست، یا حساب هنوز تأیید نشده است.');throw e;}
        const s={user:auth.user,access:auth.access_token,refresh:auth.refresh_token,tokenExpiresAt:now+auth.expires_in*1000,expiresAt:now+12*60*60*1000,csrfToken:randomBytes(24).toString('hex'),member:null,databaseReady:false};
        await membership(s);if(s.member)await loadRemote(s);
        let key;if(serverless){req._milestoneSession=s;key=sessionCookie(s);}else{key=randomBytes(32).toString('hex');const old=token(req);if(old)sessions.delete(old);sessions.set(key,s);}attempts.delete(ip);
        send(res,200,publicSession(s),{'Set-Cookie':cookieHeader(key)});return;
      }
      if(path==='/api/logout'&&req.method==='POST'){const s=await sessionOf(req);if(s&&req.headers['x-csrf-token']!==s.csrfToken)throw fail(403,'نشست معتبر نیست.');if(serverless&&s)try{await cloud('/auth/v1/logout?scope=local',s.access,'POST',{});}catch{}const key=token(req);if(key)sessions.delete(key);req._milestoneSession=null;send(res,200,{ok:true},{'Set-Cookie':cookieHeader('')});return;}
      if(path.startsWith('/api/tasks/')&&['PATCH','DELETE'].includes(req.method)){
        const id=decodeURIComponent(path.slice('/api/tasks/'.length));let task=report.tasks.find(t=>t.id===id);
        const s=await requireMember(req,task?.project??null);
        if(!task){await loadRemote(s);task=report.tasks.find(t=>t.id===id);}
        if(!task)throw fail(404,'فعالیت پیدا نشد.');
        if(!(s.member.role==='admin'||s.member.role==='editor'&&s.member.sections.includes(task.project)))throw fail(403,'حساب شما اجازه ویرایش این بخش را ندارد.');
        const b=await readBody(req);
        const run=async()=>mutate(s,task.project,content=>{const i=content.tasks.findIndex(t=>t.id===id);if(i<0)throw fail(404,'فعالیت پیدا نشد.');if(req.method==='DELETE')content.tasks.splice(i,1);else content.tasks[i]=editTask(content.tasks[i],b);});
        const action=mutationQueue.then(run);mutationQueue=action.catch(()=>{});send(res,200,await action);return;
      }
      if(path==='/api/tasks'&&req.method==='POST'){
        const b=await readBody(req);if(!['blog','platform','health'].includes(b.project))throw fail(400,'بخش انتخاب‌شده معتبر نیست.');
        const s=await requireMember(req,b.project);
        if(!['blog','platform'].includes(b.project)&&b.documentUrl!==undefined)throw fail(400,'لینک فایل برای فعالیت‌های بلاگ و پلتفرم قابل ثبت است.');
        for(const [key,max]of [['title',160],['type',80],['unit',30]])if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>max)throw fail(400,'عنوان، نوع و واحد فعالیت را تکمیل کنید.');
        const task=editTask({id:randomUUID(),project:b.project,title:b.title.trim(),description:'فعالیت تعریف‌شده توسط تیم',type:b.type.trim(),unit:b.unit.trim(),status:'planned',monthlyGoal:null,pageMetric:false,total:null,done:null,monthlyCapacity:null},{total:b.total??null,done:b.done??null,monthlyCapacity:b.monthlyCapacity??null,...(['blog','platform'].includes(b.project)?{documentUrl:b.documentUrl??null}:{})});
        const action=mutationQueue.then(()=>mutate(s,b.project,content=>content.tasks.push(task)));mutationQueue=action.catch(()=>{});send(res,201,{...await action,task});return;
      }
      if(path.startsWith('/api/campaigns/')&&req.method==='PATCH'){
        const month=path.slice('/api/campaigns/'.length),s=await requireMember(req,'platform'),b=await readBody(req);if(typeof b.completed!=='boolean')throw fail(400,'وضعیت ماه معتبر نیست.');
        const action=mutationQueue.then(()=>mutate(s,'platform',content=>{const r=content.campaigns.records.find(r=>r.month===month);if(!r)throw fail(404,'ماه گزارش پیدا نشد.');r.completed=b.completed;}));mutationQueue=action.catch(()=>{});send(res,200,await action);return;
      }
      throw fail(404,'مسیر درخواست پیدا نشد.');
    }catch(e){send(res,e.status||500,{error:e.status?e.message:'درخواست کامل نشد؛ دوباره تلاش کنید.'});}
  });
  return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const server=await createReportServer();server.listen(Number(process.env.PORT)||4317,'127.0.0.1',()=>process.stdout.write(`Local: http://127.0.0.1:${server.address().port}\n`));
}
