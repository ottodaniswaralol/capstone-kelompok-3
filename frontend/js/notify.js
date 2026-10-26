'use strict';
/* notify.js: Notifikasi, log aktivitas, toast */
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(window.__t);window.__t=setTimeout(()=>t.classList.add('hidden'),3200)}
function notify(uid,text,type){if(!uid)return;S.notifs.unshift({id:S.seq.n++,userId:uid,text,time:S.now,read:false,type:type||'info'});S.notifs=S.notifs.slice(0,200);if(uid===S.session)toast(text)}
function logEv(text){S.log.unshift({t:S.now,text});S.log=S.log.slice(0,60)}
const myNotifs=()=>S.notifs.filter(n=>n.userId===S.session);
function markRead(){S.notifs.forEach(n=>{if(n.userId===S.session)n.read=true});save();render()}
