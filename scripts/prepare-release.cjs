#!/usr/bin/env node
'use strict';
// Stamp a complete static export, then record every deployed file's bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../dist'),manifest='release-manifest.json';
function files(dir=root){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.relative(root,path.join(dir,e.name)).split(path.sep).join('/')]).filter(n=>n!==manifest).sort();}
function versioned(value,revision){
 if(/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value))return value;
 const url=new URL(value,'https://release.invalid/');
 if(!/\.(?:html|js|css|png|svg|jpg|jpeg|webp|ico)$/i.test(url.pathname))return value;
 const hash=value.includes('#')?value.slice(value.indexOf('#')):'';
 const base=value.split(/[?#]/)[0],params=new URLSearchParams(value.split('#')[0].split('?')[1]||'');
 params.delete('v');if(revision)params.set('v',revision);
 return base+(params.size?'?'+params:'')+hash;
}
function normalizeHTML(text){return text.replace(/<meta name="atlas-release" content="[^"]*">/g,'').replace(/\b(src|href)="([^"]+)"/g,(_,attr,value)=>attr+'="'+versioned(value,null)+'"');}
fs.writeFileSync(path.join(root,'.nojekyll'),'');
const list=files(),digest=crypto.createHash('sha256');
for(const name of list){const bytes=fs.readFileSync(path.join(root,name));digest.update(name+'\0');digest.update(name.endsWith('.html')?normalizeHTML(bytes.toString('utf8')):bytes);}
const release=digest.digest('hex').slice(0,20);
for(const name of list.filter(n=>n.endsWith('.html'))){
 const file=path.join(root,name),plain=normalizeHTML(fs.readFileSync(file,'utf8'));
 const stamped=plain.replace(/\b(src|href)="([^"]+)"/g,(_,attr,value)=>attr+'="'+versioned(value,release)+'"').replace('</head>','<meta name="atlas-release" content="'+release+'"></head>');
 fs.writeFileSync(file,stamped);
}
const assets=Object.fromEntries(files().map(name=>{const b=fs.readFileSync(path.join(root,name));return [name,{bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}];}));
fs.writeFileSync(path.join(root,manifest),JSON.stringify({schemaVersion:1,release,files:assets},null,2)+'\n');
console.log('Prepared portable release '+release+' ('+Object.keys(assets).length+' files).');
