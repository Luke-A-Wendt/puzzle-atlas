const S=require('../../dist/games/skewb-engine.js'),F=require('../../dist/games/fto-engine.js'),B=require('../../dist/games/balanced-ring-projection.js');
for(const m of [S.create('ultimate'),S.create('diamond'),F.create()]){
 let ranked=[];
 for(let i=0;i<12000;i++){
  const y=1-2*(i+.5)/12000,r=Math.sqrt(1-y*y),a=i*2.399963229728653,pole=[r*Math.cos(a),y,r*Math.sin(a)],P=B.create({pole}),pts=m.slots.map(s=>({...P.raw(s.center),face:s.faceIndex}));
  const near=pts.map((p,i)=>Math.min(...pts.filter((_,j)=>i!==j).map(q=>Math.hypot(p.x-q.x,p.y-q.y)))),min=Math.min(...near),avg=near.reduce((a,b)=>a+b)/near.length,cv=Math.sqrt(near.reduce((a,b)=>a+(b-avg)**2,0)/near.length)/avg;
  const diameter=Math.max(...m.faces.map(f=>{const ps=pts.filter(p=>p.face===f.index);return Math.max(...ps.flatMap(p=>ps.map(q=>Math.hypot(p.x-q.x,p.y-q.y))))}));
  const score=min-.07*cv-.018*diameter;ranked.push({pole,min,cv,diameter,score});
 }
 ranked.sort((a,b)=>b.score-a.score);console.log(m.type,JSON.stringify(ranked.slice(0,3)));
}
