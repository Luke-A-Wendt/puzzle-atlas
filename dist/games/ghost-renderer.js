/* Animate the genuine Ghost alignment offsets around the ordinary turn phase. */
(function(root){
 'use strict';
 const shared=root.ShapeRenderer;
 function render(ctx,model,options={}){
  if(model.type!=='ghost')return shared.render(ctx,model,options);
  const proxy=Object.create(model);
  proxy.mesh=piece=>model.renderMesh(piece,options.animation||null);
  return shared.render(ctx,proxy,{...options,animation:null});
 }
 root.ShapeRenderer=Object.freeze({...shared,render});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.ShapeRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
