'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCanvas}=require('@napi-rs/canvas');
const Painter=require('../dist/games/puzzle-selection-3d.js');
const project=p=>[200+p[0]*100,200-p[1]*100];
function fixture(options={}){
 const canvas=createCanvas(400,400),ctx=canvas.getContext('2d'),records={strokes:[],letters:[],arcs:[]};
 ctx.fillStyle='#282832';ctx.fillRect(0,0,400,400);
 const stroke=ctx.stroke.bind(ctx),fillText=ctx.fillText.bind(ctx),arc=ctx.arc.bind(ctx);
 ctx.stroke=()=>{records.strokes.push({alpha:ctx.globalAlpha,dash:ctx.getLineDash(),width:ctx.lineWidth,color:ctx.strokeStyle});return stroke();};
 ctx.fillText=(label,x,y)=>{records.letters.push({label,x,y,alpha:ctx.globalAlpha});return fillText(label,x,y);};
 ctx.arc=(x,y,r,...args)=>{records.arcs.push({x,y,r,alpha:ctx.globalAlpha});return arc(x,y,r,...args);};
 const painter=Painter.begin(ctx,{project,radius:1,width:400,height:400,state:{active:true,held:[],pair:['one','two']},...options});
 return{canvas,ctx,painter,records};
}
test('number badges follow the outward normal with a five-pixel gap after the shorter stem',()=>{
 const f=fixture(),normal=[.6,.8,0],center=[0,0,0];
 f.painter.track({id:'one',center,normal});f.painter.finish();
 const badge=f.records.arcs.find(a=>a.r===11.5),tail=project(normal.map(n=>n*.28)),tip=project(center);
 assert.equal(f.records.letters[0].label,'1');
 const unit=[.6,-.8],delta=[badge.x-tail[0],badge.y-tail[1]];
 assert(Math.abs(delta[0]*unit[1]-delta[1]*unit[0])<1e-8,'badge center stays on the projected arrow axis');
 assert(Math.abs(Math.hypot(...delta)-badge.r-5)<1e-8,'the badge edge is five pixels beyond the stem');
 assert(Math.abs(Math.hypot(tail[0]-tip[0],tail[1]-tip[1])-28)<1e-8,'nominal shaft is .28 puzzle radii');
});
test('a rear-facing tile retains the part of its arrow outside the puzzle silhouette',()=>{
 const occluder={points:[[-.55,-.6,0],[.55,-.6,0],[.55,.6,0],[-.55,.6,0]],normal:[0,0,1]},f=fixture({occluders:[occluder]});
 f.painter.track({id:'one',center:[.45,0,-1],normal:[1,0,-.3]});f.painter.finish();
 const pixels=f.ctx.getImageData(0,0,400,400).data;
 for(let x=245;x<253;x++)assert.equal(pixels[(200*400+x)*4],40,'hidden shaft does not paint through the nearer face');
 assert(pixels[(200*400+270)*4]>200,'visible shaft outside the silhouette is retained');assert.equal(f.records.letters.length,1);
});
test('fully occluded selections are hidden while a visible view-aligned normal stays finite',()=>{
 const hidden=fixture({isVisible:()=>false});hidden.painter.track({id:'one',center:[0,0,-1],normal:[0,0,-1]});hidden.painter.finish();
 assert(hidden.ctx.getImageData(0,0,400,400).data.every((v,i)=>v===[40,40,50,255][i%4]),'fully occluded arrow contributes no painted pixels');
 const f=fixture({isVisible:()=>true});f.painter.track({id:'one',center:[0,0,0],normal:[0,0,1]});f.painter.finish();
 assert.deepEqual(f.records.letters.map(l=>l.label),['1']);assert(f.records.arcs.every(a=>[a.x,a.y,a.r].every(Number.isFinite)));
 const badge=f.records.arcs.find(a=>a.r===11.5);assert.equal(badge.x,200);assert.equal(badge.y,165.5);
});
test('colliding number badges separate along their own normal without losing the gap',()=>{
 const f=fixture();f.painter.track({id:'one',center:[0,0,0],normal:[1,0,0]});f.painter.track({id:'two',center:[.02,0,0],normal:[1,0,0]});f.painter.finish();
 const badges=f.records.arcs.filter(a=>a.r===11.5);
 assert.deepEqual(f.records.letters.map(l=>l.label),['1','2']);
 assert(Math.hypot(badges[1].x-badges[0].x,badges[1].y-badges[0].y)>=26);
 assert(badges.every(b=>b.y===200),'collision avoidance does not displace tags sideways from the arrow line');
});
test('outward badge remains collinear at the edge of the canvas',()=>{
 const f=fixture();f.painter.track({id:'one',center:[1.65,.2,0],normal:[1,.2,0]});f.painter.finish();
 const badge=f.records.arcs.find(a=>a.r===11.5),tip=project([1.65,.2,0]),delta=[badge.x-tip[0],badge.y-tip[1]];
 assert(badge.x+badge.r<=398.01);assert(Math.abs(delta[1]+delta[0]*.2)<1e-8);
});

test('no-label mode hides swap arrows while tile outlines remain available',()=>{
 const previous=global.PuzzleAxisDisplay;
 try{
  global.PuzzleAxisDisplay={labelMode:()=> 'none',highlights3D:()=>true};
  const f=fixture({state:{active:true,held:['one'],pair:['one','two']}});
  f.painter.face({id:'one',center:[0,0,0],normal:[1,0,0],points:[[-.3,-.3,0],[.3,-.3,0],[.3,.3,0],[-.3,.3,0]],selected:true});f.painter.finish();
  assert.equal(f.records.letters.length,0);assert.equal(f.records.arcs.length,0);
  assert(f.records.strokes.some(s=>s.color==='#ffffff'&&s.dash.length),'held face still has its dashed border');
  assert(f.records.strokes.some(s=>s.color==='#ffffff'&&!s.dash.length),'selected face still has its solid border');
 }finally{global.PuzzleAxisDisplay=previous;}
});
test('3D outline toggle suppresses all tile outlines but preserves numbered arrows',()=>{
 const previous=global.PuzzleAxisDisplay;
 try{
  global.PuzzleAxisDisplay={labelMode:()=> 'all',highlights3D:()=>false};
  const f=fixture({state:{active:true,held:['one'],pair:['one','two']}});
  f.painter.face({id:'one',center:[0,0,0],normal:[1,0,0],points:[[-.3,-.3,0],[.3,-.3,0],[.3,.3,0],[-.3,.3,0]],selected:true});
  f.painter.stroke([[10,10],[20,20]],{held:true,selected:true});
  assert.equal(f.records.strokes.length,0,'neither renderer metadata nor direct stroke calls bypass the display preference');
  f.painter.finish();assert.deepEqual(f.records.letters.map(l=>l.label),['1']);
  assert.equal(f.painter.style('one',true).held,false);assert.equal(f.painter.style('one',true).selected,false);
 }finally{global.PuzzleAxisDisplay=previous;}
});


test('automatic solving shows swap markers with More labels and preserves held outlines',()=>{
 const previous=global.PuzzleAxisDisplay;
 try{
  global.PuzzleAxisDisplay={labelMode:()=> 'all',highlights3D:()=>true};
  const f=fixture({state:{active:true,auto:true,held:['one'],pair:['one','two']}});
  f.painter.face({id:'one',center:[0,0,0],normal:[1,0,0],points:[[-.3,-.3,0],[.3,-.3,0],[.3,.3,0],[-.3,.3,0]],selected:true});f.painter.finish();
  assert.deepEqual(f.records.letters.map(l=>l.label),['1']);
  assert(f.records.strokes.some(s=>s.color==='#ffffff'&&s.dash.length),'held faces remain dashed in auto solve');
 }finally{global.PuzzleAxisDisplay=previous;}
});

test('Some labels hides numbered arrows during manual and automatic solving',()=>{
 const previous=global.PuzzleAxisDisplay;
 try{global.PuzzleAxisDisplay={labelMode:()=> 'some',highlights3D:()=>true};
  for(const auto of [false,true]){const f=fixture({state:{active:true,auto,held:[],pair:['one','two']}});f.painter.track({id:'one',center:[0,0,0],normal:[1,0,0]});f.painter.finish();assert.equal(f.records.letters.length,0);assert.equal(f.records.arcs.length,0);}
 }finally{global.PuzzleAxisDisplay=previous;}
});
