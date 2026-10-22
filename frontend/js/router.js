'use strict';
/* router.js: Navigasi, guard rute, dan render utama */
function go(r){route=r;bellOpen=false;M=null;VAL=null;window.scrollTo(0,0);render()}
function logout(){S.session=null;route='landing';bellOpen=false;M=null;save();render();toast('Anda telah keluar.')}
function toggleBig(){S.big=!S.big;document.body.classList.toggle('big',S.big);save();render()}
function scrollToId(id){setTimeout(()=>{const e=document.getElementById(id);if(e)e.scrollIntoView({behavior:'smooth'})},60)}
function goSection(id){if(route!=='landing'){route='landing';render()}scrollToId(id)}
function guardRoute(){
  const u=cur(),pub=['landing','explore','login','register','register-c','register-m'];
  if(!u){if(!pub.includes(route))route='login';return}
  if(['login','register','register-c','register-m','landing'].includes(route))route=homeOf(u.role);
  if(u.role==='consumer'){if(!(route==='explore'||route.startsWith('c:')))route='c:home'}
  else if(route==='explore'||!route.startsWith(u.role==='merchant'?'m:':'a:'))route=homeOf(u.role);
}
function renderApp(){
  const v={landing:vLanding,login:vLogin,register:vRegister,'register-c':vRegC,'register-m':vRegM,explore:vExplore,'c:home':vCHome,'c:voucher':vCVoucher,'c:history':vCHistory,'c:profile':vCProfile,'m:dashboard':vMDash,'m:listing':vMListing,'m:validate':vMValidate,'m:transactions':vMTrans,'m:profile':vMProfile,'a:dashboard':vADash,'a:users':vAUsers,'a:merchants':vAMerchants,'a:transactions':vATrans}[route]||vLanding;
  $('#app').innerHTML=v();
  if(route==='m:validate')renderVal();
  if(route==='m:listing')previewSched();
}
function render(){guardRoute();renderTop();renderApp();renderModal();renderClock()}
function refresh(){
  const a=document.activeElement;
  if(a&&['INPUT','TEXTAREA','SELECT'].includes(a.tagName)&&a.closest&&a.closest('#app,#modal')){renderTop();renderClock();return}
  render();
}
