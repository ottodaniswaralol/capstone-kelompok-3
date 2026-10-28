'use strict';
/* main.js: Titik masuk aplikasi. Mode API bila server tersedia, jika tidak otomatis mode demo lokal */
function bootCommon(){
  document.body.classList.toggle('big',!!S.big);
  const u=cur();route=u?homeOf(u.role):(/admin/.test(location.hash)?'login':'landing');
  document.addEventListener('click',e=>{if(bellOpen&&!e.target.closest('.bellwrap')){bellOpen=false;renderTop()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&M)closeModal()});
  render();
}
function bootDemo(){
  S=load()||seed();S.running=false;
  if(S.session&&!user(S.session))S.session=null;
  bootCommon();
}
async function init(){
  if(!API.base){bootDemo();return}
  $('#app').innerHTML='<div class="wrap"><div class="empty">Menghubungkan ke server…</div></div>';
  API.on=await detectApi();
  if(!API.on){bootDemo();setTimeout(()=>toast('Server API tidak tersedia, memakai data demo lokal'),300);return}
  S=load()||seedApi();S.running=false;
  await apiRestoreSession();
  try{await apiHydrate()}catch(e){toast(e.message)}
  bootCommon();startApiPolling();
}
init();
