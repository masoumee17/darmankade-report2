import {copyFile,mkdir,readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('public/',root),{recursive:true});
for(const name of ['index.html','styles.css','data.js','metrics.js','task-links.js','app.js'])await copyFile(new URL(name,root),new URL('public/'+name,root));
const config=JSON.parse(await readFile(new URL('supabase.config.json',root),'utf8'));
if(!config.url||!config.publishableKey)throw Error('Supabase configuration is missing.');
console.log('Built report assets for Vercel; server files, accounts, logs, and session data are excluded from public output.');
