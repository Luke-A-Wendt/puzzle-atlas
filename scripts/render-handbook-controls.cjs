'use strict';
// Reproducible captures of the production canvas renderer, not browser-page
// screenshots. Only the explanatory callouts below are added to the image.
const fs=require('node:fs'),path=require('node:path');
const {createCanvas}=require('@napi-rs/canvas');
const {createPage,Element}=require('../tests/solver-dom.cjs');
const root=path.resolve(__dirname,'..'),games=path.join(root,'dist/games');
const native=new WeakMap(),original=Element.prototype.getContext;
Element.prototype.getContext=function(kind){
 if(this.tagName!=='CANVAS')return original.call(this,kind);
 if(!native.has(this)){const b=this.getBoundingClientRect(),canvas=createCanvas(b.width||500,b.height||500);canvas.ownerDocument={createElement:()=>createCanvas(1,1)};native.set(this,canvas);}
 return native.get(this).getContext(kind);
};
class QuietWorker{postMessage(){} addEventListener(){} removeEventListener(){} terminate(){}}
const fetchFile=async url=>{const file=path.join(games,new URL(String(url),'https://atlas.test/games/').pathname.replace(/^\/games\//,''));return{ok:fs.existsSync(file),text:async()=>fs.readFileSync(file,'utf8')};};
function capture(app,id,file,annotations=[]){
 const original=native.get(app.element(id)),out=createCanvas(500,500),ctx=out.getContext('2d');
 ctx.fillStyle='#13131c';ctx.fillRect(0,0,500,500);
 const y=id==='cube'?50:0;ctx.drawImage(original,0,y);
 if(id==='rings'&&app.context.ConstrainedSolverUI.state().active){for(const name of ['csAnchorBackdrop','csNodeOverlay']){const canvas=app.element(name),image=canvas&&native.get(canvas);if(image&&!canvas.hidden)ctx.drawImage(image,0,0);}}
 for(const a of annotations){ctx.strokeStyle='#eeeeef';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.to[0],a.to[1]+y);ctx.stroke();ctx.beginPath();ctx.arc(a.to[0],a.to[1]+y,3,0,Math.PI*2);ctx.fillStyle='#eeeeef';ctx.fill();ctx.beginPath();ctx.arc(a.x,a.y,15,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#111116';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#101017';ctx.font='700 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(a.letter,a.x,a.y+.5);}
 fs.writeFileSync(path.join(root,'dist/assets',file),out.toBuffer('image/png'));
}
(async()=>{
 const app=createPage('cube3',{globals:{Worker:QuietWorker,fetch:fetchFile}}),c=app.context;
 c.PUZZLE_API.select('U');app.frame();
 const nodes=c.PUZZLE_SOLVER_BRIDGE.nodes(),chosen=nodes.find(n=>n.highlighted);
 capture(app,'rings','help-turn-rings.png',[{letter:'A',x:50,y:55,to:[chosen.x,chosen.y]}]);
 capture(app,'cube','help-turn-3d.png');
 c.ConstrainedSolverUI.setActive(true);
 for(let i=0;i<80&&c.ConstrainedSolverUI.state().phase==='loading';i++)await app.advance(0);
 if(c.ConstrainedSolverUI.state().phase!=='selecting')throw Error('Model failed to load');
 const model=JSON.parse(fs.readFileSync(path.join(games,'constrained-solver-models/cube3.json'),'utf8'));
 const mapping=c.ConstrainedSolverCore.mapSnapshot(model,app.snapshot());
 const f=model.nodes.filter(n=>n.face==='F'),u=model.nodes.filter(n=>n.face==='U');
 c.ConstrainedSolverUI.setTool('hold');
 for(const n of [f[0],f[1],f[3],u[4]])c.ConstrainedSolverUI.selectNode(mapping.nodeToSticker[n.index]);
 c.ConstrainedSolverUI.setTool('swap');
 for(const n of [f[2],f[8]])c.ConstrainedSolverUI.selectNode(mapping.nodeToSticker[n.index]);
 app.document.activeElement=app.document.body;c.PUZZLE_SOLVER_BRIDGE.requestRender();app.frame();
 const held=c.PUZZLE_SOLVER_BRIDGE.nodes().find(n=>String(n.stickerId)===String(mapping.nodeToSticker[f[0].index]));
 capture(app,'rings','help-hold-rings.png',[{letter:'B',x:50,y:55,to:[held.x,held.y]}]);
 c.PuzzleAxisDisplay?.setLabelMode('all');app.frame();
 capture(app,'cube','help-hold-3d.png');
 console.log('Captured actual Cube 3×3×3 canvases for the illustrated handbook.');
})().catch(e=>{console.error(e);process.exitCode=1;});
