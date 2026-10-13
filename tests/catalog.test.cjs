'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dist=path.resolve(__dirname,'../dist');
const read=f=>fs.readFileSync(path.join(dist,f.split(/[?#]/)[0]),'utf8');
const index=read('index.html'),play=read('play.html');
const choices=[...index.matchAll(/class="puzzle-card"[^>]*data-family="([^"]+)"[^>]*href="([^"]+)"/g)].map(m=>({family:m[1],href:m[2].replaceAll('&amp;','&')}));
assert.equal(choices.length,33);
const families={tetrahedral:4,cubical:18,octahedral:7,dodecahedral:4};
for(const [family,count]of Object.entries(families))assert.equal(choices.filter(c=>c.family===family).length,count);
assert.equal(new Set(choices.map(c=>new URL(c.href,'https://atlas.test').searchParams.get('p'))).size,33);
assert.equal(choices.filter(c=>new URL(c.href,'https://atlas.test').searchParams.get('p')==='mirror').length,1);
assert(index.includes('assets/mirror-color.png'));
assert(!index.includes('assets/mirror.png'));
const secret=/<a class="secret-puzzle" href="([^"]+)"/.exec(index);
assert(secret);const secretURL=new URL(secret[1].replaceAll('&amp;','&'),'https://atlas.test/');assert.equal(secretURL.pathname,'/play.html');assert.equal(secretURL.searchParams.get('p'),'homer');
assert(index.indexOf('class="secret-puzzle"')>index.indexOf('data-filter="dodecahedral"'));
assert(index.includes('🍩</span></a>'));
assert(!index.includes('🍩</span> Secret puzzle'));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?walk(path.join(dir,f.name)):[path.join(dir,f.name)]);
for(const file of walk(dist)){
 const source=fs.readFileSync(file,'utf8');
 if(file.endsWith('.js'))new vm.Script(source,{filename:file});
 if(!file.endsWith('.html'))continue;
 for(const match of source.matchAll(/(?:src|href)="([^"]+)"/g)){
  const url=match[1];if(/^(https?:|about:|data:|#)/.test(url))continue;
  const local=path.resolve(path.dirname(file),url.split(/[?#]/)[0]);assert(fs.existsSync(local),`${file}: missing ${url}`);
 }
 for(const match of source.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:file});
}
function element(classes=''){
 const set=new Set(classes.split(' '));return {value:'',textContent:'',innerHTML:'',listeners:{},attributes:{},style:{setProperty(){}},focus(){},addEventListener(k,f){this.listeners[k]=f;},setAttribute(k,v){this.attributes[k]=v;},classList:{contains:k=>set.has(k),remove:k=>set.delete(k),toggle(k,force){const add=force??!set.has(k);add?set.add(k):set.delete(k);return add;}}};
}
for(const choice of [...choices,{href:secret[1]}]){
 const url=new URL(choice.href.replaceAll('&amp;','&'),'https://atlas.test'),key=url.searchParams.get('p');
 const elements=Object.fromEntries([...play.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element(m[1]==='play-layout'?'guide-hidden':'')]));
 const algorithm=element(),references=element();let algorithmMoved=false;
 elements['solver-guide'].querySelector=s=>s==='.solver-guide-algorithm'?algorithm:null;
 elements['guide-sources'].closest=s=>s==='details'?references:null;
 elements['guide-scroll'].insertBefore=(node,before)=>{assert.equal(node,algorithm);assert.equal(before,references);algorithmMoved=true;};
 const skip=element(),tabs=element(),document={getElementById:id=>{assert(elements[id],`missing element ${id}`);return elements[id];},querySelector:s=>s==='meta[name="atlas-release"]'?{getAttribute:name=>name==='content'?(/<meta name="atlas-release" content="([^"]+)"/.exec(play)?.[1]||''):null}:s==='.skip-link'?skip:tabs,querySelectorAll:()=>[],addEventListener(){}};
 const context={document,location:{search:url.search,origin:url.origin},URLSearchParams,console,addEventListener(){}};context.window=context;vm.createContext(context);
 for(const match of play.matchAll(/<script src="([^"]+)"/g))vm.runInContext(read(match[1]),context,{filename:match[1]});
 assert(algorithmMoved,'algorithm chapter appears immediately before references');
 assert(elements['guide-intro'].innerHTML.includes('<h3>'),`missing guide ${key}`);
 assert(elements['guide-steps'].innerHTML.includes('guide-step'),`missing steps ${key}`);
 const gameURL=new URL(elements['puzzle-frame'].src,'https://atlas.test/');assert.equal(gameURL.pathname,'/games/'+key+'.html');assert.equal(gameURL.searchParams.get('mirror'),url.searchParams.get('mirror')==='1'?'1':null);const release=/<meta name="atlas-release" content="([^"]+)"/.exec(play)?.[1];if(release)assert.equal(gameURL.searchParams.get('v'),release);
 assert.equal(document.title,elements['puzzle-title'].textContent+' — Puzzle Atlas');
 assert(!play.includes('id="puzzle-select"'));
 assert(!elements['puzzle-title'].textContent.includes('axes'));
 assert(elements['play-layout'].classList.contains('guide-hidden'));
 elements['guide-toggle'].listeners.click();assert(!elements['play-layout'].classList.contains('guide-hidden'));assert.equal(elements['guide-toggle'].attributes['aria-expanded'],'true');
 elements['guide-toggle'].listeners.click();assert(elements['play-layout'].classList.contains('guide-hidden'));
 skip.listeners.click({preventDefault(){}});assert(!elements['play-layout'].classList.contains('guide-hidden'));assert(elements['play-layout'].classList.contains('mobile-guide'));
}
const buttons=['all',...Object.keys(families)].map(filter=>Object.assign(element(),{dataset:{filter}}));
const cards=choices.map(c=>Object.assign(element(),{dataset:{family:c.family}})),status=element();
vm.runInNewContext(read('home.js'),{document:{querySelectorAll:s=>s==='[data-filter]'?buttons:cards,getElementById:()=>status}});
for(const button of buttons){button.listeners.click();assert.equal(cards.filter(c=>!c.hidden).length,button.dataset.filter==='all'?33:families[button.dataset.filter]);assert.equal(button.attributes['aria-pressed'],'true');}
console.log('Catalog: 33 main puzzles plus the secret Homer route, all assets/guides, filters, hidden-guide toggle and keyboard skip passed.');
