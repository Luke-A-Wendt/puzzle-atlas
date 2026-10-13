'use strict';
const buttons=[...document.querySelectorAll('[data-filter]')];
const cards=[...document.querySelectorAll('[data-family]')];
const allowed=new Set(buttons.map(b=>b.dataset.filter));
function filterFamily(family){if(!allowed.has(family))family='all';buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===family)));let count=0;cards.forEach(card=>{card.hidden=family!=='all'&&card.dataset.family!==family;if(!card.hidden)count++;});document.getElementById('filter-status').textContent=`Showing ${count} puzzle choices.`;}
buttons.forEach(button=>button.addEventListener('click',()=>filterFamily(button.dataset.filter)));
