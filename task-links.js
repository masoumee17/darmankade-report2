/* Shared URL validation; links are opened by the viewer, never fetched by the server. */
globalThis.TaskLinks = {
  normalize(value) {
    if(value===null||value===undefined||value==='')return null;
    if(typeof value!=='string'||value.length>2048)throw Error('لینک فایل باید یک آدرس معتبر و حداکثر ۲۰۴۸ کاراکتر باشد.');
    const input=value.trim();if(!input)return null;
    let url;try{url=new URL(input);}catch{throw Error('لینک کامل فایل را با https:// وارد کنید.');}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('فقط لینک کامل http یا https بدون نام کاربری و رمز پذیرفته می‌شود.');
    return url.href;
  },
  read(value) {try{return this.normalize(value);}catch{return null;}}
};
