#!/usr/bin/env node
'use strict';
const {listModels,solveRequest}=require('./src/service.cjs');
const modelId=process.argv[2];
if(modelId==='--list'){console.log(JSON.stringify(listModels(),null,2));}
else if(!modelId){console.error('Usage: node cli.cjs MODEL_ID < request.json\n       node cli.cjs --list');process.exitCode=2;}
else{
 let body='';
 process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>2*1024*1024){console.error('Input exceeds 2 MiB');process.exit(2);}});
 process.stdin.on('end',async()=>{
  try{const input=JSON.parse(body),payload=input.request!==undefined||input.snapshot!==undefined?{...input,modelId}:{modelId,request:input};const result=await solveRequest(payload);console.log(JSON.stringify(result,null,2));if(result.status==='invalid')process.exitCode=2;}
  catch(e){console.error(e.message);process.exitCode=2;}
 });
}
