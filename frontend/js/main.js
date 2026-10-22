'use strict';
/* main.js: Titik masuk aplikasi */
function init(){
  S=load()||seed();S.running=false;
  if(S.session&&!user(S.session))S.session=null;
  document.body.classList.toggle('big',!!S.big);
  const u=cur();route=u?homeOf(u.role):(/admin/.test(location.hash)?'login':'landing');
  document.addEventListener('click',e=>{if(bellOpen&&!e.target.closest('.bellwrap')){bellOpen=false;renderTop()}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&M)closeModal()});
  render();
}
init();
