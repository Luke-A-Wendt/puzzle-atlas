#!/usr/bin/env node
'use strict';
// Dependency-free pre-deployment check. Fail closed on missing or mixed files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../dist'),manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let count=0;
for(const [name,expected]of Object.entries(manifest.files)){
 if(name.startsWith('/')||name.split('/').includes('..'))throw Error('Unsafe release path');
 const b=fs.readFileSync(path.join(root,name));
 if(b.length!==expected.bytes||sha(b)!==expected.sha256)throw Error('Release file missing, altered or from another version: '+name);
 count++;
}
let checked=0;
const catalog=JSON.parse(fs.readFileSync(path.join(root,'games/constrained-solver-models/manifest.json'),'utf8'));
const modelIds=catalog.models.map(model=>model.id).sort();
if(!modelIds.length||new Set(modelIds).size!==modelIds.length)throw Error('Invalid solver catalog');
for(const file of ['constrained-solver-core.js','constrained-solver-worker.js']){
 const code=fs.readFileSync(path.join(root,'games',file),'utf8');
 for(const [variable,folder]of [['fingerprints','constrained-solver-models'],['fullCacheFingerprints','constrained-solver-caches'],['colorCacheFingerprints','color-solver-caches']]){
  const match=new RegExp('const '+variable+'=(\\{[^;]+\\});').exec(code);if(!match)throw Error('Missing '+variable+' in '+file);
  const values=JSON.parse(match[1]);if(JSON.stringify(Object.keys(values).sort())!==JSON.stringify(modelIds))throw Error('Expected the complete puzzle catalog in '+variable);
  for(const [id,expected]of Object.entries(values)){
   if(sha(fs.readFileSync(path.join(root,'games',folder,id+'.json')))!==expected)throw Error('Mismatched solver data: '+file+' / '+folder+'/'+id+'.json');
   checked++;
  }
 }
}
console.log('Verified release '+manifest.release+': '+count+' website files and '+checked+' solver-data fingerprints.');
