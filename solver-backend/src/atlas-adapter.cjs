'use strict';
/* Pure bridge: reads supplied model/snapshot values only. Never invokes UI,
 * makes moves, fetches files, or edits the website. */
const key=v=>{if(!Array.isArray(v)||v.length!==3||v.some(x=>!Number.isFinite(x)))throw Error('A node pose needs three finite coordinates');return v.map(x=>Math.round(x*1e7)||0).join(',');};
const pose=s=>key(s.center||s.p)+'/'+key(s.normal||s.n);
const shape=s=>key(s.pos)+'/'+pose(s);
function mapSnapshot(model,snapshot){
 if(!model.supported||!model.fixedPermutation)throw Error('Unsupported permutation model');
 if(snapshot?.animating)throw Error('Wait for the current move to finish before selecting nodes');
 if(model.id==='helicopter'){
  const history=snapshot?.history||[];
  if(snapshot?.advanced||['jumble','jumbling'].includes(snapshot?.mode)||Object.values(snapshot?.axisStops||{}).some(x=>![0,3].includes(x))||history.some(m=>m.fromStop!==undefined||m.toStop!==undefined||m.turns!==undefined&&m.turns!==1))throw Error('Helicopter jumbling is not supported; use a normal half-turn-only state');
 }
 const stickers=Array.isArray(snapshot)?snapshot:snapshot?.stickers||snapshot?.stickerState;
 if(!Array.isArray(stickers)||stickers.length!==model.stickerCount)throw Error('Snapshot does not have the expected actual sticker count');
 const expanded=!!model.requiresOccupiedState;
 const nodesById=new Map(model.nodes.map(n=>[String(n.engineSlotId??n.id),n.index]));
 const nodesByPose=new Map(model.nodes.map(n=>[expanded?shape(n):n.center&&n.normal?pose(n):String(n.engineSlotId??n.id),n.index]));
 const stickerToNode=Object.create(null),nodeToSticker=Object.create(null),occupiedNodes=[];
 for(const sticker of stickers){
  const node=expanded?nodesByPose.get(shape(sticker)):(sticker.normal||sticker.n)?nodesByPose.get(pose(sticker)):nodesById.get(String(sticker.slot));
  if(node===undefined)throw Error('Sticker '+sticker.id+' has no supported fixed/pose address');
  if(Object.hasOwn(stickerToNode,String(sticker.id)))throw Error('Duplicate sticker identity');
  if(Object.hasOwn(nodeToSticker,node))throw Error('Two stickers occupy the same node');
  stickerToNode[String(sticker.id)]=node;nodeToSticker[node]=String(sticker.id);occupiedNodes.push(node);
 }
 return{stickerToNode,nodeToSticker,occupiedNodes,requiresOccupiedState:expanded};
}
/** Convert user-selected physical sticker IDs to protected spatial addresses.
 * select exact_swap to protect all other CURRENT physical stickers; empty pose
 * addresses must remain free. The returned request is ready for core swap.
 */
function colorsFromSnapshot(model,snapshot,mapping=mapSnapshot(model,snapshot)){
 const stickers=Array.isArray(snapshot)?snapshot:snapshot?.stickers||snapshot?.stickerState;
 const colors=new Array(model.degree).fill(null);
 for(const sticker of stickers){
  const id=String(sticker.id),color=model.colorBySticker?.[id]??sticker.color;
  if(typeof color!=='string'&&typeof color!=='number')throw Error('Snapshot does not identify every sticker color');
  colors[mapping.stickerToNode[id]]=String(color);
 }
 return colors;
}
function requestFromSnapshot(model,snapshot,{protectedStickerIds=[],swapStickerIds,mode='protected_swap',protection='endpoint',holdSemantics='sticker'}={}){
 if(!Array.isArray(swapStickerIds)||swapStickerIds.length!==2)throw Error('Choose two sticker IDs');
 if(!['protected_swap','exact_swap'].includes(mode))throw Error('Unknown swap semantics');
 if(!['sticker','color'].includes(holdSemantics))throw Error('Unknown hold semantics');
 if(holdSemantics==='color'&&(mode!=='protected_swap'||protection!=='endpoint'))throw Error('Color holds require protected_swap mode with endpoint protection');
 const mapping=mapSnapshot(model,snapshot),index=id=>{const n=mapping.stickerToNode[String(id)];if(n===undefined)throw Error('Unknown current sticker '+id);return n;};
 const swap=swapStickerIds.map(index);if(swap[0]===swap[1])throw Error('Swap endpoints must be different');
 let protectedNodes=protectedStickerIds.map(index);if(protectedNodes.some(n=>swap.includes(n)))throw Error('A protected node cannot be a swap endpoint');
 if(mode==='exact_swap')protectedNodes=mapping.occupiedNodes.filter(n=>!swap.includes(n));
 return{swap,protected:[...new Set(protectedNodes)],occupiedNodes:mapping.occupiedNodes,mode:'protected_swap',protection,requestedMode:mode,selectionMapping:mapping,...(holdSemantics==='color'?{holdSemantics,colorByNode:colorsFromSnapshot(model,snapshot,mapping)}:{})};
}
module.exports={mapSnapshot,requestFromSnapshot,colorsFromSnapshot};
