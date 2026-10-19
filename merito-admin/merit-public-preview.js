(function(){
 document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.querySelector('#meritPublicPreviewBtn');
  if(!btn)return;
  btn.textContent='🌐 Abrir página del ranking público';
  btn.addEventListener('click',()=>{window.location.href='./ranking-publico-admin.html'});
 });
})();