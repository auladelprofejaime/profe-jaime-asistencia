/* Corrige títulos antiguos almacenados en caché local de la app docente. */
(function(){
 const WRONG='Flor de papel chuna', RIGHT='Flor de papel china';
 function correct(){
  const root=document.getElementById('materialList');
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())if(walker.currentNode.nodeValue.includes(WRONG))nodes.push(walker.currentNode);
  nodes.forEach(n=>{n.nodeValue=n.nodeValue.replaceAll(WRONG,RIGHT)});
 }
 function start(){
  const root=document.getElementById('materialList');
  if(!root)return;
  correct();
  new MutationObserver(correct).observe(root,{subtree:true,childList:true,characterData:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();