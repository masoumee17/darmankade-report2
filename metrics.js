globalThis.MilestoneMetrics = {
  percent(done,total) { return Number.isFinite(done)&&Number.isFinite(total)&&total>0 ? done/total*100 : null; },
  remaining(task) { return Number.isFinite(task.total)&&Number.isFinite(task.done) ? Math.max(0,task.total-task.done) : null; },
  platform(data) {
    const tasks=data.tasks.filter(t=>t.project==='platform'&&t.pageMetric);
    const total=tasks.reduce((s,t)=>s+(t.total||0),0);
    const allocated=tasks.every(t=>Number.isFinite(t.done));
    const done=allocated?tasks.reduce((s,t)=>s+t.done,0):data.platformSummary.done;
    const denominator=data.platformSummary.breakdownConfirmed?total:data.platformSummary.total;
    return {total:denominator,done,breakdownTotal:total,allocated,percent:this.percent(done,denominator),remaining:Number.isFinite(done)?denominator-done:null};
  },
  pages(data) {
    const tasks=data.tasks.filter(t=>t.project!=='platform'&&t.pageMetric&&Number.isFinite(t.total)&&Number.isFinite(t.done));
    const platform=this.platform(data);
    const total=tasks.reduce((s,t)=>s+t.total,0)+platform.total;
    const done=tasks.reduce((s,t)=>s+t.done,0)+(platform.done||0);
    return {total,done,remaining:total-done,percent:this.percent(done,total)};
  },
  forecast(task,capacity,months) {
    if(!Number.isInteger(capacity)||capacity<=0||!Number.isInteger(months)||months<=0)return null;
    if(task.status==='recurring')return {possible:capacity*months,recurring:true};
    const remaining=this.remaining(task);if(remaining===null)return null;
    const possible=Math.min(remaining,capacity*months);
    return {possible,left:remaining-possible,monthsToFinish:Math.ceil(remaining/capacity),recurring:false};
  },
  campaigns(data) {
    const total=data.campaigns.records.length,done=data.campaigns.records.filter(r=>r.completed).length;
    return {total,done,remaining:total-done,percent:this.percent(done,total)};
  }
};
