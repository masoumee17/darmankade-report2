(() => {
  let D=globalThis.MILESTONE;
  const M=globalThis.MilestoneMetrics;
  const links=globalThis.TaskLinks;
  let current='overview', horizon=D.forecastMonths||3;
  let session={ready:false,available:false,configured:false,user:null,csrfToken:null};
  const n=(v,d=0)=>v===null||v===undefined?'نامشخص':new Intl.NumberFormat('fa-IR',{maximumFractionDigits:d}).format(v);
  const pct=v=>v===null?'نامشخص':n(v,v>0&&v<10?2:1)+'٪';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={active:'در حال انجام',recurring:'هدف ماهانه محقق شده',planned:'شروع نشده',dependency:'وابسته به ریدیزاین',unreported:'نیازمند ثبت پیشرفت',completed:'تکمیل‌شده'};
  const paths={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',book:'<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z"/><path d="M12 5v15M6 8h3M15 8h3M6 12h3M15 12h3"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M4 11h4l2-4 3 8 2-4h5"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M13 14h4"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',arrow:'<path d="M19 12H5m6-6-6 6 6 6"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',print:'<path d="M6 8V3h12v5M6 17H3V8h18v9h-3"/><path d="M6 14h12v7H6zM17 11h1"/>'};
  const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.grid}</svg>`;
  const period=()=>`از ${D.period.startLabel} تا امروز`;
  const date=()=>new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Tehran'}).format(new Date(D.period.reportDate+'T12:00:00Z'));
  const badge=(status,label)=>`<span class="tag ${esc(status)}"><i></i>${esc(label||labels[status])}</span>`;
  function progress(value,label){
    return value===null?`<div class="indeterminate" role="img" aria-label="${esc(label)}؛ نامشخص"></div>`:`<div class="progress" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,value).toFixed(3)}"><span style="width:${Math.min(100,Math.max(0,value))}%"></span></div>`;
  }
  function title(name,description,english){return `<div class="page-title"><div><div class="eyebrow"><i></i>${english}</div><h1>${esc(name)}</h1><p class="subtitle">${esc(description)}</p></div><div class="period">${icon('calendar')}<div>${period()}<small>تاریخ گزارش: ${date()}</small></div></div></div>`;}
  function hero(label,done,total,description,context){
    const value=M.percent(done,total),left=M.remaining({total,done});
    return `<section class="hero" aria-label="${esc(label)}"><div class="hero-main"><div class="hero-heading"><h2>${esc(label)}</h2><span class="tag">${esc(context)}</span></div><p>${esc(description)}</p>${progress(value,label)}<div class="progress-meta"><strong>${done===null?'انجام‌شده: نامشخص':n(done)+' انجام‌شده از '+n(total)}</strong><span>${left===null?'باقی‌مانده: نامشخص':n(left)+' باقی‌مانده'}</span></div></div><div class="hero-stat"><div class="number">${pct(value)}</div><p>پیشرفت دامنه قابل‌اندازه‌گیری</p><div class="fine">${period()}</div></div></section>`;
  }
  function notice(text,warning=false){return `<div class="notice ${warning?'warning':''}">${icon('info')}<div>${text}</div></div>`;}
  function scopeNotice(){return D.platformSummary.breakdownConfirmed?'':notice(`<strong>دامنه پلتفرم نیازمند تأیید است.</strong> ${esc(D.platformSummary.note)} فعلاً شاخص کلی بر مبنای مجموع قبلی محاسبه می‌شود.`,true);}
  function projectCard(p){
    const t=D.tasks.find(t=>t.id==='blog-update');
    const report=p.id==='blog'?{done:t.done,total:t.total,remaining:M.remaining(t),percent:M.percent(t.done,t.total)}:p.id==='platform'?M.platform(D):{done:null,total:null,remaining:null,percent:null};
    const text=p.id==='blog'?'آپدیت مقالات':p.id==='platform'?'بهبود صفحات':'در انتظار تعیین دامنه';
    return `<a class="project-card ${p.color}" href="#${p.id}" aria-label="مشاهده گزارش ${p.title}"><div class="project-top"><div class="project-name"><span class="project-icon">${icon(p.icon)}</span><div><h3>${p.title}</h3><small lang="en" dir="ltr">${p.english}</small></div></div>${badge(p.id==='health'?'dependency':'active',p.id==='health'?'در حال ریدیزاین':null)}</div><p>${esc(p.description)}</p><div class="project-numbers"><strong>${pct(report.percent)}</strong><span>${report.done===null?'پیشرفت ثبت نشده':n(report.done)+' از '+n(report.total)}</span></div>${progress(report.percent,'پیشرفت '+p.title)}<div class="card-caption">${text}${report.remaining!==null?' · '+n(report.remaining)+' باقی‌مانده':''}</div><div class="card-link">مشاهده گزارش ${p.title}${icon('arrow')}</div></a>`;
  }
  function forecastCell(t){
    const f=M.forecast(t,t.monthlyCapacity,horizon);
    if(!f)return `<span class="muted">${!t.monthlyCapacity?'نیازمند تعیین ظرفیت':'نیازمند ثبت پیشرفت'}</span>`;
    if(f.recurring)return `<strong>${n(f.possible)} ${esc(t.unit)}</strong><small>در ${n(horizon)} ماه آینده · فعالیت مستمر</small>`;
    return `<strong>${n(f.possible)} ${esc(t.unit)}</strong><small>در ${n(horizon)} ماه آینده</small><small>زمان لازم برای باقیمانده: ${n(f.monthsToFinish)} ماه</small>`;
  }
  function documentButton(t){
    const url=t.project==='blog'?links.read(t.documentUrl):null;
    return url?`<a class="document-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="باز کردن فایل مرتبط با ${esc(t.title)}">باز کردن فایل ↗</a>`:'';
  }
  function taskTable(projectId){return `<section class="tasks-section" aria-labelledby="tasks-heading"><div class="section-heading"><div><h2 id="tasks-heading">${projectId?'فعالیت‌های این بخش':'فعالیت‌های پروژه‌ها'}<span class="task-count" id="task-count"></span></h2><p>پیش‌بینی بر اساس ظرفیت ماهانه است؛ داده نامشخص، صفر فرض نمی‌شود.</p></div></div><div class="toolbar"><label class="search-wrap"><span hidden>جستجوی فعالیت</span>${icon('search')}<input id="search" type="search" placeholder="جستجوی فعالیت…" aria-label="جستجوی فعالیت"></label><select id="status-filter" aria-label="فیلتر وضعیت"><option value="all">همه وضعیت‌ها</option>${Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><label class="horizon-label">بازه پیش‌بینی<select id="horizon" aria-label="بازه پیش‌بینی">${[1,3,6,12].map(v=>`<option value="${v}" ${v===horizon?'selected':''}>${n(v)} ماه آینده</option>`).join('')}</select></label></div><div class="table-wrap"><table><thead><tr><th scope="col">فعالیت / نوع کار</th>${!projectId?'<th scope="col">بخش</th>':''}<th scope="col">دامنه کل</th><th scope="col">انجام‌شده</th><th scope="col">باقی‌مانده</th><th scope="col">پیشرفت</th><th scope="col">ظرفیت ماهانه</th><th scope="col" class="forecast-heading">پیش‌بینی ${n(horizon)} ماه آینده</th><th scope="col">وضعیت</th></tr></thead><tbody id="task-rows"></tbody></table></div><p class="table-footnote">پیش‌بینی با فرض ثابت‌ماندن دامنه و ظرفیت، از زمان گزارش به بعد است؛ تعهد زمانی یا سابقه انجام کار نیست.</p></section>`;}
  function renderRows(projectId){
    const q=document.querySelector('#search').value.trim().replace(/ي/g,'ی').replace(/ك/g,'ک'),filter=document.querySelector('#status-filter').value;
    const tasks=D.tasks.filter(t=>(!projectId||t.project===projectId)&&(filter==='all'||t.status===filter)&&(t.title+' '+t.type+' '+t.description).replace(/ي/g,'ی').replace(/ك/g,'ک').includes(q));
    document.querySelector('#task-count').textContent=`(${n(tasks.length)} فعالیت)`;
    document.querySelector('.forecast-heading').textContent=`پیش‌بینی ${n(horizon)} ماه آینده`;
    document.querySelector('#task-rows').innerHTML=tasks.map(t=>{
      const p=D.projects.find(p=>p.id===t.project),value=t.status==='recurring'?M.percent(t.monthlyAchieved,t.monthlyGoal):M.percent(t.done,t.total);
      return `<tr><td class="title-cell"><a class="task-title" href="#${p.id}">${esc(t.title)}</a><small>${esc(t.type)}</small></td>${!projectId?`<td><a href="#${p.id}"><span class="section-dot ${p.id}"></span>${p.title}</a></td>`:''}<td>${t.monthlyGoal?n(t.monthlyGoal)+' '+esc(t.unit)+' / ماه':t.total===null?'تعیین نشده':n(t.total)+' '+esc(t.unit)}</td><td>${t.status==='recurring'?n(t.monthlyAchieved)+' / ماه':t.done===null?'ثبت نشده':n(t.done)}</td><td>${t.status==='recurring'?'مستمر':n(M.remaining(t))}</td><td><div class="mini-progress">${progress(value,t.title)}<div class="progress-meta">${pct(value)}</div>${t.status==='recurring'?'<small>تحقق هدف ماهانه</small>':''}</div></td><td>${t.monthlyCapacity===null?'<span class="muted">تعیین نشده</span>':n(t.monthlyCapacity)+' '+esc(t.unit)}</td><td class="forecast-cell">${forecastCell(t)}</td><td><div class="status-actions">${badge(t.status)}${documentButton(t)}</div></td></tr>`;
    }).join('')||`<tr><td colspan="${projectId?8:9}" class="empty">فعالیتی با این جستجو و وضعیت پیدا نشد.</td></tr>`;
  }
  function campaignSection(editable=false){
    const c=M.campaigns(D);
    return `<section class="campaign-section" aria-labelledby="campaign-heading"><div class="section-heading"><div><h2 id="campaign-heading">کمپین‌های ماهانه Off-page</h2><p>برای هر ماه، اجرای کمپین با یک تیک مستقل ثبت می‌شود.</p></div>${badge('recurring','یک نوبت در هر ماه')}</div><div class="campaign-summary"><div><strong>${n(c.done)} از ${n(c.total)} ماه</strong><span>${pct(c.percent)} تحقق ماه‌های گزارش</span></div><div class="campaign-progress">${progress(c.percent,'تحقق کمپین‌های ماهانه')}</div><div class="campaign-forecast">ظرفیت: یک نوبت در ماه<br><strong>پیش‌بینی: ${n(horizon)} نوبت در ${n(horizon)} ماه آینده</strong></div></div><div class="campaign-months">${D.campaigns.records.map((r,i)=>`<label class="month-tile ${r.completed?'is-complete':''}"><input type="checkbox" ${r.completed?'checked':''} ${editable?'data-campaign="'+esc(r.month)+'"':'disabled'} aria-label="اجرای کمپین ${esc(r.label)}"><span><strong>${esc(r.label)}</strong><small>${r.completed?'انجام شده':i===D.campaigns.records.length-1?'ماه جاری؛ هنوز ثبت نشده':'انجام نشده'}</small></span></label>`).join('')}</div><p class="table-footnote">تیک ماهانه فقط اجرای نوبت کمپین در آن ماه را نشان می‌دهد؛ تعداد تخصص‌های پوشش‌داده‌شده را مشخص نمی‌کند. دامنه اعلام‌شده: ${n(D.campaigns.scopeCount)} تخصص اصلی.${editable?'':' ثبت یا اصلاح تیک‌ها از پنل انجام می‌شود.'}</p><div id="campaign-message" role="status"></div></section>`;
  }
  function overview(){const p=M.pages(D);return `${title('گزارش پیشرفت درمانکده','فعالیت‌های انجام‌شده، ظرفیت تیم و مسیر پیش رو.','MILESTONE REPORT / OVERVIEW')}${hero('پیشرفت صفحات دارای آمار',p.done,p.total,'این شاخص فقط آپدیت مقالات بلاگ و بهبود صفحات پلتفرم را نشان می‌دهد؛ فیچرها، انتشار ماهانه و کمپین‌ها مستقل گزارش می‌شوند.','آپدیت و بهبود صفحات')}${scopeNotice()}<section><div class="section-heading"><div><h2>گزارش بخش‌ها</h2><p>جزئیات هر بخش را از اینجا دنبال کنید.</p></div><button class="text-button" data-dialog="method">مبنای محاسبه</button></div><div class="cards">${D.projects.map(projectCard).join('')}</div></section>${taskTable()}${campaignSection()}${reportFooter()}`;}
  function detail(id){
    const p=D.projects.find(p=>p.id===id),t=D.tasks.find(t=>t.id==='blog-update'),platform=M.platform(D);
    const h=id==='blog'?hero('پیشرفت آپدیت مقالات',t.done,t.total,p.note,'فقط آپدیت مقالات'):id==='platform'?hero('پیشرفت بهبود صفحات پلتفرم',platform.done,platform.total,p.note,'بهبود صفحات؛ مستقل از کمپین‌ها'):hero('هلث بانک در حال ریدیزاین',null,null,p.note,'نیازمند تعیین دامنه');
    return `<a class="back-link" href="#overview">${icon('arrow')}بازگشت به نمای کلی</a>${title('گزارش '+p.title,p.description,'MILESTONE REPORT / '+p.english)}${h}${id==='platform'?scopeNotice():''}${taskTable(id)}${id==='platform'?campaignSection():''}${id==='health'?notice('ایجاد دسته‌ها و توسعه صفحات پرجستجو در یک فعالیت ادغام شده‌اند. «کرال دیتا و ایمپورت مراکز جدید» به‌صورت یک فعالیت مستقل اضافه شده است.'):''}${reportFooter()}`;
  }
  function reportFooter(){return `${notice(`<strong>${period()}؛ بدون سوابق قدیمی‌تر.</strong> اعداد بر اساس اطلاعات اعلام‌شده تیم ثبت شده‌اند. پیشرفت یا ظرفیت نامشخص در جدول مشخص شده است.`)}<div class="section-heading report-actions"><button class="text-button" data-dialog="method">روش محاسبه درصد و پیش‌بینی</button><button class="export" id="export">${icon('download')}دریافت داده‌های گزارش</button></div>`;}
  function openInfo(){
    document.querySelector('#dialog-title').textContent='روش محاسبه گزارش';
    document.querySelector('#dialog-body').innerHTML=`<p>پیشرفت هر فعالیت = انجام‌شده ÷ دامنه کل × ۱۰۰.</p><p>پیش‌بینی = ظرفیت ماهانه × تعداد ماه آینده؛ برای کارهای محدود، حداکثر به اندازه باقیمانده کار محاسبه می‌شود. زمان لازم برای باقیمانده = باقیمانده ÷ ظرفیت ماهانه، با گرد کردن به ماه کامل.</p><p>انتشار محتوای ماهانه، فعالیت مستمر است و زمان پایان ندارد. پیش‌بینی انتشار از ماه‌های آینده است و با آمار انتشار گذشته جمع نمی‌شود.</p><p>فیچرها با مقالات آپدیت‌شده جمع نمی‌شوند. کمپین‌های Off-page بر اساس تیک مستقل هر ماه سنجیده می‌شوند و در پیشرفت صفحات نقشی ندارند.</p><p>${esc(D.platformSummary.note)} پیش‌بینی هر گروه پلتفرم با ظرفیت ثبت‌شده همان گروه محاسبه می‌شود.</p><p>پیشرفت هلث بانک تا تعیین دامنه و ثبت خروجی‌ها، نامشخص می‌ماند.</p>`;
    document.querySelector('#info-dialog').showModal();
  }
  async function api(path,options={}){
    const res=await fetch(path,{...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...(session.csrfToken?{'X-CSRF-Token':session.csrfToken}:{}),...options.headers}});
    let body;try{body=await res.json();}catch{throw Error('ارتباط با پنل برقرار نشد. صفحه را تازه کنید و دوباره تلاش کنید.');}
    if(!res.ok)throw Error(body.error||'ذخیره اطلاعات انجام نشد.');return body;
  }
  function authPage(){
    if(!session.ready)return `${title('پنل تیم درمانکده','در حال بررسی وضعیت ورود…','TEAM WORKSPACE')}<div class="panel">در حال بارگذاری…</div>`;
    if(!session.available){const localFile=location.protocol==='file:';return `${title('ورود به پنل','ارتباط با پنل برقرار نشده است.','TEAM WORKSPACE')}<div class="panel"><p>${localFile?'برای ورود، گزارش را از آدرس پیش‌نمایش محلی باز کنید.':'اتصال به پنل کامل نشد. دوباره تلاش کنید.'}</p>${localFile?'<a class="primary-button" href="http://127.0.0.1:4317/#panel">بازکردن پنل محلی</a>':'<button class="primary-button" id="retry-connection">تلاش دوباره</button>'}</div>`;}
    return `${title('ورود به پنل تیم درمانکده','با ایمیل حساب و رمز عبور همان حساب وارد شوید.','TEAM WORKSPACE')}<section class="auth-card"><span class="auth-symbol">${icon('layers')}</span><h2>خوش آمدید</h2><p>پیشرفت فعالیت‌ها و کمپین‌های ماهانه را از پنل مدیریت کنید.</p><form id="auth-form"><label>نام کاربری (ایمیل حساب)<input name="username" type="email" autocomplete="username" value="${esc(session.defaultUsername||'')}" maxlength="254" required></label><label>رمز عبور<input name="password" type="password" autocomplete="current-password" maxlength="256" required></label><button type="submit" class="primary-button">ورود به پنل</button><p class="form-message" id="auth-message" role="status"></p></form><p class="local-note">ورود از طریق حساب پروژه Supabase انجام می‌شود. رمز عبور در فایل‌های گزارش ذخیره نمی‌شود.</p></section>`;
  }
  function dashboardPanel(){
    if(session.user.role==='no-access'||session.databaseReady===false)return `${title('پنل تیم درمانکده','ورود انجام شد؛ دسترسی ویرایش هنوز فعال نیست.','TEAM WORKSPACE')}<div class="panel-account"><span>${esc(session.user.displayName||session.user.username)}</span><button class="export" id="logout">خروج از پنل</button></div><section class="panel"><h2>دسترسی حساب نیاز به بررسی دارد</h2><p>برای فعال‌شدن دسترسی بخش مربوط، با مدیر کل گزارش هماهنگ کنید.</p><p><a class="primary-button" href="#overview">مشاهده گزارش</a></p></section>`;
    const canEdit=p=>session.user.role==='admin'||session.user.role==='editor'&&session.user.sections.includes(p);
    const editableTasks=D.tasks.filter(t=>canEdit(t.project));
    const ownedProjects=D.projects.filter(p=>canEdit(p.id));
    const person=session.user.displayName||session.user.username;
    const sectionNames=ownedProjects.map(p=>p.title).join(' و ');
    const panelHeading=session.user.role==='admin'?'پنل مدیریت کل — '+person:'پنل '+sectionNames+' — '+person;
    const panelDescription=session.user.role==='admin'?'مدیریت فعالیت‌ها، پیشرفت و ظرفیت هر سه بخش درمانکده.':'ثبت پیشرفت، ظرفیت و فعالیت‌های بخش '+sectionNames+'.';
    const account=`<div class="panel-account"><div><strong>${esc(person)}</strong><small class="account-email">${esc(session.user.username)}</small><span class="account-scope">${session.user.role==='admin'?'مدیر کل · هر سه بخش':'دسترسی ویرایش: '+esc(sectionNames)}</span></div><button class="export" id="logout">خروج از پنل</button></div>`;
    if(!editableTasks.length)return `${title('پنل تیم درمانکده','دسترسی حساب شما برای مشاهده گزارش است.','TEAM WORKSPACE')}${account}${notice('برای ویرایش، صاحب پروژه باید دسترسی بخش مربوط را به حساب شما بدهد.')}<a class="primary-button" href="#overview">مشاهده گزارش</a>`;
    return `${title(panelHeading,panelDescription,'TEAM WORKSPACE')}${account}<section class="panel"><div class="section-heading"><div><h2>ویرایش فعالیت‌ها</h2><p>تغییرات پس از ذخیره در گزارش نمایش داده می‌شوند.</p></div></div><form id="task-edit-form" class="edit-form"><label class="full-width">انتخاب فعالیت<select name="taskId" id="edit-task">${editableTasks.map(t=>`<option value="${esc(t.id)}">${D.projects.find(p=>p.id===t.project).title} — ${esc(t.title)}</option>`).join('')}</select></label><label class="full-width">عنوان فعالیت<input name="title" maxlength="160" required></label><label>حجم کل<input name="total" type="number" min="0" max="10000000" step="1" placeholder="نامشخص"></label><label>انجام‌شده<input name="done" type="number" min="0" max="10000000" step="1" placeholder="ثبت نشده"></label><label>ظرفیت ماهانه<input name="monthlyCapacity" type="number" min="1" max="100000" step="1" placeholder="تعیین نشده"></label><label>وضعیت<select name="status">${Object.entries(labels).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="full-width document-field" id="edit-document-field" hidden>لینک داکیومنت یا شیت مرتبط<input name="documentUrl" type="url" inputmode="url" maxlength="2048" autocomplete="off" placeholder="https://docs.google.com/…"><small>با خالی‌گذاشتن این فیلد، لینک حذف می‌شود. دسترسی فایل از تنظیمات همان فایل تعیین می‌شود.</small></label><div class="full-width"><button class="primary-button" type="submit">ذخیره تغییرات فعالیت</button><p class="form-message" id="edit-message" role="status"></p></div></form></section>${canEdit('platform')?campaignSection(true):''}<section class="panel add-task-panel"><h2>تعریف فعالیت جدید</h2><form id="task-add-form" class="edit-form"><label>بخش<select name="project">${D.projects.filter(p=>canEdit(p.id)).map(p=>`<option value="${p.id}">${p.title}</option>`).join('')}</select></label><label>نوع فعالیت<input name="type" maxlength="80" required></label><label class="full-width">عنوان فعالیت<input name="title" maxlength="160" required></label><label>واحد شمارش<input name="unit" maxlength="30" placeholder="مثلاً مقاله، صفحه، مورد" required></label><label>حجم کل<input name="total" type="number" min="0" max="10000000" step="1" placeholder="نامشخص"></label><label>انجام‌شده<input name="done" type="number" min="0" max="10000000" step="1" placeholder="ثبت نشده"></label><label>ظرفیت ماهانه<input name="monthlyCapacity" type="number" min="1" max="100000" step="1" placeholder="تعیین نشده"></label><label class="full-width document-field" id="add-document-field" hidden>لینک داکیومنت یا شیت مرتبط<input name="documentUrl" type="url" inputmode="url" maxlength="2048" autocomplete="off" placeholder="https://docs.google.com/…"></label><div class="full-width"><button class="primary-button" type="submit">افزودن فعالیت</button><p class="form-message" id="add-message" role="status"></p></div></form></section>`;
  }
  function fillEditForm(id){
    const form=document.querySelector('#task-edit-form'),t=D.tasks.find(t=>t.id===id);
    for(const key of ['title','total','done','monthlyCapacity','status','documentUrl'])form.elements[key].value=t[key]??'';
    document.querySelector('#edit-document-field').hidden=t.project!=='blog';
    form.elements.documentUrl.disabled=t.project!=='blog';
    const recurring=t.status==='recurring';
    form.elements.total.disabled=recurring;form.elements.done.disabled=recurring;
    form.elements.status.disabled=recurring;
    document.querySelector('#edit-message').textContent=recurring?'برای انتشار ماهانه، فقط عنوان و ظرفیت آینده را ویرایش کنید. آمار گذشته ماهانه مستقل است.':'';
  }
  function taskValues(form){const f=new FormData(form),v={};for(const [k,value]of f)v[k]=['total','done','monthlyCapacity'].includes(k)?(value===''?null:Number(value)):value;return v;}
  async function submitForm(form,messageId,action){
    const msg=document.querySelector(messageId),button=form.querySelector('[type="submit"]');msg.textContent='در حال ذخیره…';button.disabled=true;
    try{await action();}catch(e){msg.textContent=e.message;msg.classList.add('is-error');}finally{button.disabled=false;}
  }
  function bindPanel(){
    document.querySelector('#retry-connection')?.addEventListener('click',()=>location.reload());
    const auth=document.querySelector('#auth-form');
    if(auth)auth.addEventListener('submit',async e=>{e.preventDefault();await submitForm(auth,'#auth-message',async()=>{
      const values=Object.fromEntries(new FormData(auth));
      const result=await api('/api/login',{method:'POST',body:JSON.stringify({username:values.username,password:values.password})});
      session={...session,...result,ready:true,available:true};D=await api('/api/report');render();
    });});
    document.querySelector('#logout')?.addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST',body:'{}'});session.user=null;session.csrfToken=null;render();}catch(e){const msg=document.querySelector('#edit-message');if(msg)msg.textContent=e.message;}});
    const edit=document.querySelector('#task-edit-form');if(!edit)return;
    fillEditForm(document.querySelector('#edit-task').value);
    document.querySelector('#edit-task').addEventListener('change',e=>fillEditForm(e.target.value));
    edit.addEventListener('submit',async e=>{e.preventDefault();await submitForm(edit,'#edit-message',async()=>{
      const values=taskValues(edit),id=values.taskId;delete values.taskId;
      const result=await api('/api/tasks/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(values)});D=result.report;
      document.querySelector('#edit-message').textContent='تغییرات ذخیره شد و در گزارش قابل مشاهده است.';document.querySelector('#edit-message').classList.remove('is-error');
    });});
    document.querySelectorAll('[data-campaign]').forEach(input=>input.addEventListener('change',async()=>{
      const previous=!input.checked;input.disabled=true;
      try{const result=await api('/api/campaigns/'+input.dataset.campaign,{method:'PATCH',body:JSON.stringify({completed:input.checked})});D=result.report;render();}
      catch(e){input.checked=previous;document.querySelector('#campaign-message').textContent=e.message;}
      finally{input.disabled=false;}
    }));
    const add=document.querySelector('#task-add-form');const syncDocumentField=()=>{const blog=add.elements.project.value==='blog';document.querySelector('#add-document-field').hidden=!blog;add.elements.documentUrl.disabled=!blog;};syncDocumentField();add.elements.project.addEventListener('change',syncDocumentField);add.addEventListener('submit',async e=>{e.preventDefault();await submitForm(add,'#add-message',async()=>{
      const result=await api('/api/tasks',{method:'POST',body:JSON.stringify(taskValues(add))});D=result.report;render();document.querySelector('#add-message').textContent='فعالیت جدید اضافه شد.';
    });});
  }
  function render(){
    const id=location.hash.slice(1)||'overview';current=['overview','panel',...D.projects.map(p=>p.id)].includes(id)?id:'overview';
    const name=current==='overview'?'نمای کلی':current==='panel'?'پنل تیم درمانکده':D.projects.find(p=>p.id===current).title;
    document.querySelector('#main').innerHTML=current==='panel'?(session.user?dashboardPanel():authPage()):current==='overview'?overview():detail(current);
    document.querySelector('#crumb').textContent=name;document.title=`${name} | گزارش پیشرفت درمانکده`;
    document.querySelector('#account-label').textContent=session.user?'پنل '+(session.user.displayName||session.user.username):'ورود به پنل';
    document.querySelector('.manual').innerHTML='<i></i>'+(session.user?'داده‌های ثبت‌شده تیم':'نسخه ثبت‌شده گزارش');
    document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===current);if(a.dataset.nav===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');if(a.dataset.nav!=='overview')a.querySelector('.nav-count').textContent=n(D.tasks.filter(t=>t.project===a.dataset.nav).length+(a.dataset.nav==='platform'?1:0));});
    document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
    document.querySelectorAll('[data-dialog]').forEach(el=>el.addEventListener('click',openInfo));
    if(current==='panel'){bindPanel();return;}
    const projectId=current==='overview'?null:current;renderRows(projectId);
    document.querySelector('#search').addEventListener('input',()=>renderRows(projectId));
    document.querySelector('#status-filter').addEventListener('change',()=>renderRows(projectId));
    document.querySelector('#horizon').addEventListener('change',e=>{horizon=Number(e.target.value);renderRows(projectId);const c=document.querySelector('.campaign-forecast');if(c)c.innerHTML=`ظرفیت: یک نوبت در ماه<br><strong>پیش‌بینی: ${n(horizon)} نوبت در ${n(horizon)} ماه آینده</strong>`;});
    document.querySelector('#export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(D,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`darmankade-milestone-${D.period.reportDate}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  }
  document.querySelector('#print').addEventListener('click',()=>window.print());
  document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();document.querySelector('#main').focus();});
  document.querySelector('#close-dialog').addEventListener('click',()=>document.querySelector('#info-dialog').close());
  document.querySelector('#info-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);document.querySelector('#main').focus({preventScroll:true});});
  render();
  if(location.protocol!=='file:')Promise.all([api('/api/session'),api('/api/report')]).then(([auth,report])=>{session={...auth,ready:true,available:true};D=report;render();}).catch(()=>{session.ready=true;session.available=false;if(current==='panel')render();});
  else{session.ready=true;if(current==='panel')render();}
})();
