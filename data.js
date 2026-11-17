/* Only user-reported figures. Null is unreported, never zero. */
globalThis.MILESTONE = {
  schemaVersion: 2,
  period: { startLabel: 'مرداد ۱۴۰۵', reportDate: '2026-11-16', startYear: 1405 },
  forecastMonths: 3,
  projects: [
    { id:'blog', title:'بلاگ', english:'BLOG', icon:'book', color:'green', description:'به‌روزرسانی محتوا، انتشار مستمر و تکمیل فیچرها', note:'آپدیت مقالات و درج فیچر، دو فعالیت مستقل روی مقالات بلاگ هستند و تعداد آن‌ها با هم جمع نمی‌شود.' },
    { id:'platform', title:'پلتفرم', english:'PLATFORM', icon:'layers', color:'blue', description:'بهبود صفحات D، Z و B و پیگیری ماهانه کمپین‌های Off-page', note:'پیشرفت صفحات و تحقق کمپین‌های ماهانه به‌صورت جداگانه محاسبه می‌شوند.' },
    { id:'health', title:'هلث بانک', english:'HEALTH BANK', icon:'heart', color:'amber', description:'دیباگ طراحی، توسعه دسته‌ها و صفحات و ایمپورت مراکز جدید', note:'هلث بانک در حال ریدیزاین است؛ حجم کل و میزان انجام‌شده فعالیت‌ها هنوز گزارش نشده است.' }
  ],
  platformSummary: { total:1426, done:215, breakdownConfirmed:true, note:'دامنه کل: ۴۹۰ صفحه D، ۷۵۸ صفحه Z و ۱۷۸ صفحه B. انجام‌شده: به‌ترتیب ۱۰۲، ۶۹ و ۴۴ صفحه؛ باقی‌مانده: به‌ترتیب ۳۸۸، ۶۸۹ و ۱۳۴ صفحه.' },
  tasks: [
    { id:'blog-update', project:'blog', title:'آپدیت مقالات', description:'به‌روزرسانی مقالات موجود بلاگ', type:'به‌روزرسانی محتوا', unit:'مقاله', total:2000, done:18, status:'active', monthlyCapacity:11, monthlyGoal:null, pageMetric:true },
    { id:'blog-publish', project:'blog', title:'انتشار ماهانه محتوا', description:'هدف ماهانه طبق اعلام تیم محقق شده است؛ مجموع انتشار بازه ثبت نشده است.', type:'انتشار محتوا', unit:'محتوا', total:null, done:null, status:'recurring', monthlyCapacity:11, monthlyGoal:11, monthlyAchieved:11, pageMetric:false },
    { id:'blog-features', project:'blog', title:'درج فیچر در مقالات قدیمی', description:'درج فیچر برای ۲٬۰۰۰ مقاله؛ ظرفیت ماهانه ۲۰۰ مقاله', type:'توسعه فیچر', unit:'مقاله', total:2000, done:3, status:'active', monthlyCapacity:200, monthlyGoal:null, pageMetric:false },
    { id:'platform-d', project:'platform', title:'بهبود صفحات D', description:'لینک‌سازی، توسعه و بهبود محتوایی و اقدامات سئویی صفحات D', type:'بهبود صفحات', unit:'صفحه', total:490, done:102, status:'active', monthlyCapacity:20, monthlyGoal:null, pageMetric:true },
    { id:'platform-z', project:'platform', title:'بهبود صفحات Z', description:'لینک‌سازی، توسعه و بهبود محتوایی و اقدامات سئویی صفحات Z', type:'بهبود صفحات', unit:'صفحه', total:758, done:69, status:'active', monthlyCapacity:20, monthlyGoal:null, pageMetric:true },
    { id:'platform-b', project:'platform', title:'بهبود صفحات B', description:'لینک‌سازی، توسعه و بهبود محتوایی و اقدامات سئویی صفحات B', type:'بهبود صفحات', unit:'صفحه', total:178, done:44, status:'active', monthlyCapacity:30, monthlyGoal:null, pageMetric:true },
    { id:'health-debug', project:'health', title:'دیباگ طراحی جدید', description:'وابسته به روند ریدیزاین؛ حجم کار هنوز ثبت نشده است.', type:'رفع ایراد', unit:'ایراد', total:null, done:null, status:'dependency', monthlyCapacity:null, monthlyGoal:null, pageMetric:false },
    { id:'health-content', project:'health', title:'ایجاد دسته‌های جدید و توسعه صفحات پرجستجو', description:'ایجاد دسته‌ها و توسعه صفحات مرتبط در قالب یک جریان کاری', type:'توسعه ساختار و محتوا', unit:'مورد', total:null, done:null, status:'dependency', monthlyCapacity:null, monthlyGoal:null, pageMetric:false },
    { id:'health-crawl', project:'health', title:'کرال دیتا و ایمپورت مراکز جدید', description:'گردآوری داده‌ها و ایمپورت مراکز جدید در هلث بانک', type:'گردآوری و ورود داده', unit:'مرکز', total:null, done:null, status:'dependency', monthlyCapacity:null, monthlyGoal:null, pageMetric:false }
  ],
  campaigns: { scopeCount:18, monthlyGoal:1, records:[
    { month:'1405-05', label:'مرداد ۱۴۰۵', completed:false },
    { month:'1405-06', label:'شهریور ۱۴۰۵', completed:false },
    { month:'1405-07', label:'مهر ۱۴۰۵', completed:false },
    { month:'1405-08', label:'آبان ۱۴۰۵', completed:false }
  ] }
};
