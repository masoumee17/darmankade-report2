export function makeVercelHandler(app){
  return async function handler(req,res){
    const url=new URL(req.url,'https://'+(req.headers.host||'localhost'));
    const route=req.query?.route??url.searchParams.get('route');
    if(route!==null&&route!==undefined){
      if(typeof route!=='string'||route.length>300||route.split('/').some(part=>part==='.'||part==='..')){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Invalid API route'}));return;}
      req.url='/api/'+route;
    }
    const server=await app;
    return server.listeners('request')[0](req,res);
  };
}
