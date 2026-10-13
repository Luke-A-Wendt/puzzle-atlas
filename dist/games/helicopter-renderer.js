/* The uncolored inner core closes the gaps exposed by legal jumbling. */
(function(root){
'use strict';
root.HelicopterRenderer={render(ctx,model,options){
 const visual=Object.create(model);
 visual.pieces=[...model.pieces,...model.hiddenPieces,model.core];
 // Center slots use a capital face and two lower-case corner directions (Ufl).
 // A sign-only cube name would mislabel that center as the UFL corner.
 const cubeShape=model.isCubeShape();
 visual.positionName=position=>cubeShape?(model.pieces.find(piece=>piece.home.every((v,i)=>Math.abs(v-position[i])<1e-7))?.name||'unassigned'):'jumbled';
 return root.ShapeRenderer.render(ctx,visual,options);
}};
if(typeof module!=='undefined'&&module.exports)module.exports=root.HelicopterRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
