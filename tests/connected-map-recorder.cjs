'use strict';
// Canvas path recorder used independently of the map's own distance/drag helpers.
function recorder(){
 let state={matrix:[1,0,0,1,0,0],fillStyle:'#000',strokeStyle:'#000',globalAlpha:1,lineWidth:1},stack=[],path=[],filled=false;
 const out={fills:[],strokes:[],texts:[]},point=(x,y)=>({x:state.matrix[0]*x+state.matrix[2]*y+state.matrix[4],y:state.matrix[1]*x+state.matrix[3]*y+state.matrix[5]}),last=()=>path.at(-1)?.points.at(-1),add=(x,y)=>{if(!path.length)path.push({points:[],closed:false});path.at(-1).points.push(point(x,y));};
 const methods={save(){stack.push({...state,matrix:state.matrix.slice()});},restore(){state=stack.pop();},setTransform(a,b,c,d,e,f){state.matrix=[a,b,c,d,e,f];},translate(x,y){const p=point(x,y);state.matrix[4]=p.x;state.matrix[5]=p.y;},scale(x,y){state.matrix[0]*=x;state.matrix[1]*=x;state.matrix[2]*=y;state.matrix[3]*=y;},clearRect(){out.fills=[];out.strokes=[];out.texts=[];},beginPath(){path=[];filled=false;},moveTo(x,y){path.push({points:[point(x,y)],closed:false});},lineTo:add,
 rect(x,y,w,h){path.push({points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]].map(p=>point(...p)),closed:true});},
 fillRect(x,y,w,h){out.fills.push({color:state.fillStyle,alpha:state.globalAlpha,path:[{points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]].map(p=>point(...p)),closed:true}]});},
 arc(x,y,r,a,b,ccw){let delta=b-a;if(ccw&&delta>0)delta-=2*Math.PI;if(!ccw&&delta<0)delta+=2*Math.PI;const steps=Math.max(17,Math.ceil(Math.abs(delta)*r/2)),points=Array.from({length:steps+1},(_,i)=>point(x+r*Math.cos(a+delta*i/steps),y+r*Math.sin(a+delta*i/steps)));path.push({points,closed:Math.abs(delta)>=2*Math.PI-1e-8,arc:{...point(x,y),r:r*Math.hypot(state.matrix[0],state.matrix[1]),sweep:delta}});},
 quadraticCurveTo(cx,cy,x,y){const a=last(),b=point(cx,cy),c=point(x,y);if(!a)return;for(let i=1;i<=32;i++){const t=i/32;path.at(-1).points.push({x:(1-t)**2*a.x+2*(1-t)*t*b.x+t*t*c.x,y:(1-t)**2*a.y+2*(1-t)*t*b.y+t*t*c.y});}},
 bezierCurveTo(x1,y1,x2,y2,x,y){const a=last(),b=point(x1,y1),c=point(x2,y2),d=point(x,y);if(!a)return;for(let i=1;i<=48;i++){const t=i/48;path.at(-1).points.push({x:(1-t)**3*a.x+3*(1-t)**2*t*b.x+3*(1-t)*t*t*c.x+t**3*d.x,y:(1-t)**3*a.y+3*(1-t)**2*t*b.y+3*(1-t)*t*t*c.y+t**3*d.y});}},
 closePath(){if(path.length){path.at(-1).closed=true;path.at(-1).points.push({...path.at(-1).points[0]});}},fill(){out.fills.push({color:state.fillStyle,alpha:state.globalAlpha,path:path.map(p=>({...p,points:p.points.slice()}))});filled=true;},stroke(){out.strokes.push({color:state.strokeStyle,alpha:state.globalAlpha,width:state.lineWidth*Math.hypot(state.matrix[0],state.matrix[1]),filled,path:path.map(p=>({...p,points:p.points.slice()}))});},fillText(text,x,y){out.texts.push({text:String(text),...point(x,y)});},measureText(text){return{width:String(text).length*6};},createLinearGradient(){return{addColorStop(){}};},createRadialGradient(){return{addColorStop(){}};},setLineDash(){},getLineDash(){return[];}};
 out.context=new Proxy({}, {get(_,k){return k in methods?methods[k]:k in state?state[k]:()=>{};},set(_,k,v){state[k]=v;return true;}});return out;
}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function pathDistance(p,path){let d=Infinity;for(const sub of path)for(let i=1;i<sub.points.length;i++)d=Math.min(d,segmentDistance(p,sub.points[i-1],sub.points[i]));return d;}
function colorOpacity(color){if(typeof color!=='string')return 1;if(color==='transparent')return 0;if(/^#[\da-f]{8}$/i.test(color))return parseInt(color.slice(-2),16)/255;if(/^#[\da-f]{4}$/i.test(color))return parseInt(color.at(-1),16)/15;const alpha=/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/i.exec(color);return alpha?Number(alpha[1]):1;}
function visiblePaths(capture){return capture.strokes.filter(s=>!s.filled&&s.alpha*colorOpacity(s.color)>.025&&s.path.some(p=>p.points.length>8));}
function circleNodes(capture,palette){return capture.fills.filter(f=>palette.has(f.color)).map(f=>{if(f.path.length!==1||!f.path[0].arc)return{...f,invalid:true};return{...f,...f.path[0].arc,invalid:Math.abs(Math.abs(f.path[0].arc.sweep)-2*Math.PI)>1e-6};});}
function stickerMarks(capture,palette){const outlines=new Map(capture.strokes.filter(s=>s.filled).map(s=>[JSON.stringify(s.path.map(p=>p.points)),s]));return capture.fills.filter(f=>palette.has(f.color)).map(f=>{
 const result={...f,kind:'unknown',invalid:true};
 if(f.path.length===1&&f.path[0].arc){Object.assign(result,f.path[0].arc,{kind:'circle',invalid:Math.abs(Math.abs(f.path[0].arc.sweep)-2*Math.PI)>1e-6});}
 else if(f.path.length===1){
  const pts=f.path[0].points.slice();while(pts.length>1&&Math.hypot(pts[0].x-pts.at(-1).x,pts[0].y-pts.at(-1).y)<1e-8)pts.pop();
  if(pts.length===4){const edges=pts.map((p,i)=>({x:pts[(i+1)%4].x-p.x,y:pts[(i+1)%4].y-p.y})),lengths=edges.map(e=>Math.hypot(e.x,e.y));
   if(lengths[0]>0&&lengths.every(l=>Math.abs(l-lengths[0])<1e-6)&&edges.every((e,i)=>Math.abs(e.x*edges[(i+1)%4].x+e.y*edges[(i+1)%4].y)<1e-6))Object.assign(result,{kind:'square',invalid:false,x:pts.reduce((s,p)=>s+p.x,0)/4,y:pts.reduce((s,p)=>s+p.y,0)/4,r:lengths[0]/Math.SQRT2,halfSize:lengths[0]/2});
  }
 }
 const signature=JSON.stringify(f.path.map(p=>p.points)),outline=outlines.get(signature);
 if(outline)Object.assign(result,{outlineColor:outline.color,outlineWidth:outline.width,outlineAlpha:outline.alpha});
 return result;
});}
function pathIndex(paths,cell=12){const cells=new Map();for(const path of paths)for(const sub of path)for(let i=1;i<sub.points.length;i++){const a=sub.points[i-1],b=sub.points[i];for(let x=Math.floor((Math.min(a.x,b.x)-2)/cell);x<=Math.floor((Math.max(a.x,b.x)+2)/cell);x++)for(let y=Math.floor((Math.min(a.y,b.y)-2)/cell);y<=Math.floor((Math.max(a.y,b.y)+2)/cell);y++){const k=x+','+y;if(!cells.has(k))cells.set(k,[]);cells.get(k).push([a,b]);}}return p=>{let d=Infinity;for(const [a,b]of cells.get(Math.floor(p.x/cell)+','+Math.floor(p.y/cell))||[])d=Math.min(d,segmentDistance(p,a,b));return d;};}
module.exports={recorder,segmentDistance,pathDistance,visiblePaths,circleNodes,stickerMarks,pathIndex};
