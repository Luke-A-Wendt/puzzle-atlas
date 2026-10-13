'use strict';
const http=require('node:http');
const {listModels,solveRequest}=require('../src/service.cjs');
// Deliberately local-only. This is a backend harness, not a public deployment.
function createServer(){
 let busy=false;
 return http.createServer(async(req,res)=>{
  const send=(code,value)=>{if(res.destroyed)return;res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  if(req.headers.origin){send(403,{status:'invalid',reason:'Browser origins are disabled in this standalone harness'});return;}
  if(req.method==='GET'&&req.url==='/models'){send(200,listModels());return;}
  if(req.method!=='POST'||req.url!=='/solve'){send(404,{status:'invalid',reason:'Use GET /models or POST /solve'});return;}
  if(busy){send(429,{status:'unknown',reason:'solver_busy'});return;}
  busy=true;
  try{
   const chunks=[];let bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>2*1024*1024){send(413,{status:'invalid',reason:'Input exceeds 2 MiB'});return;}chunks.push(chunk);}
   const result=await solveRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
   send(result.status==='invalid'?400:200,result);
  }catch(e){send(400,{status:'invalid',reason:e.message});}
  finally{busy=false;}
 });
}
if(require.main===module){
 const port=Number(process.env.PUZZLE_BACKEND_PORT??8787);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PUZZLE_BACKEND_PORT');
 const server=createServer();server.requestTimeout=10000;server.headersTimeout=10000;
 server.listen(port,'127.0.0.1',()=>console.log(`Puzzle backend listening on http://127.0.0.1:${port}`));
}
module.exports={createServer};
