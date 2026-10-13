const fs=require('fs'),path=require('path');
const {createCanvas}=require('@napi-rs/canvas'),{datasets,proj,stats}=require('./compare.cjs'),params=require('./projection-results.json');
const canvas=createCanvas(1500,1770),ctx=canvas.getContext('2d');ctx.fillStyle='#101017';ctx.fillRect(0,0,1500,1770);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=p=>p.map(x=>x/Math.hypot(...p)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function sample(axis,cut){const u=norm(cross(Math.abs(axis[2])<.8?[0,0,1]:[0,1,0],axis)),v=cross(axis,u),r=Math.sqrt(1-cut*cut);return Array.from({length:721},(_,i)=>{const a=i*Math.PI*2/720;return axis.map((n,j)=>n*cut+r*(u[j]*Math.cos(a)+v[j]*Math.sin(a)));});}
for(let k=0;k<datasets.length;k++){const d=datasets[k],p=params.find(p=>p.name===d.name).best,col=k%3,row=Math.floor(k/3),x=col*500,y=row*885;ctx.font='700 24px sans-serif';ctx.fillStyle='#ede8ff';ctx.fillText(d.name.toUpperCase(),x+20,y+34);
 for(let mode=0;mode<2;mode++){const cy=y+245+mode*420,cx=x+250;let points,loops;
 if(!mode){points=d.old;loops=d.G.rings.map(r=>r.points||Array.from({length:361},(_,i)=>({x:r.cx+r.r*Math.cos(i*Math.PI/180),y:r.cy+r.r*Math.sin(i*Math.PI/180)})));}else{points=d.ps.map(q=>proj(q,p.pole,p.alpha));loops=d.G.rings.map(r=>{const axis=r.normal||d.model.configById[r.face].normal,cut=r.cut??(r.tip?d.G.tipCut:d.G.cut);return sample(axis,cut).map(q=>proj(q,p.pole,p.alpha));});}
 const all=[...points,...loops.flat()],xs=all.map(p=>p.x),ys=all.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),scale=360/Math.max(x1-x0,y1-y0),T=q=>({x:cx+(q.x-(x0+x1)/2)*scale,y:cy+(q.y-(y0+y1)/2)*scale});
 ctx.fillStyle='#191921';ctx.fillRect(x+10,cy-195,480,396);for(const loop of loops){ctx.beginPath();loop.forEach((q,i)=>{q=T(q);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.strokeStyle='#7f7290';ctx.lineWidth=.9;ctx.stroke();}
 for(let i=0;i<points.length;i++){const q=T(points[i]),colors=d.stickers[i].colors,r=d.name==='megaminx'?3.8:6.4;ctx.beginPath();ctx.arc(q.x,q.y,r+1,0,2*Math.PI);ctx.fillStyle='#101017';ctx.fill();for(let c=0;c<colors.length;c++){ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.arc(q.x,q.y,r,c*2*Math.PI/colors.length,(c+1)*2*Math.PI/colors.length);ctx.closePath();ctx.fillStyle=colors[c];ctx.fill();}}
 ctx.fillStyle='#b3a6c7';ctx.font='14px sans-serif';ctx.fillText(mode?'Balanced spherical projection':'Existing map',x+23,cy-174);}
}
fs.writeFileSync(path.join(__dirname,'projection-comparison.png'),canvas.toBuffer('image/png'));
