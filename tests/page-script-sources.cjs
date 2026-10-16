'use strict';
// A bundle keeps its component inventory for dependency-order assertions.
module.exports=function scriptSources(html){return [...html.matchAll(/<script\b([^>]*)>/g)].flatMap(match=>{
 const src=/\bsrc="([^"]+)"/.exec(match[1]);if(!src)return [];
 const components=/\bdata-sources="([^"]+)"/.exec(match[1]);
 return components?components[1].split(' '):[src[1].split(/[?#]/)[0]];
});};
