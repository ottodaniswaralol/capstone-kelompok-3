'use strict';
/* utils.js: Fungsi bantu: format rupiah, waktu, jarak, escape HTML */
const $=s=>document.querySelector(s);
const val=id=>{const e=document.getElementById(id);return e?e.value:''};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
const T=m=>{m=Math.max(0,Math.round(m));return String(Math.floor(m/60)%24).padStart(2,'0')+'.'+String(m%60).padStart(2,'0')};
const T24=m=>T(m).replace('.',':');
const P=s=>{const a=String(s||'').split(/[:.]/).map(Number);return (a[0]||0)*60+(a[1]||0)};
const dur=m=>{m=Math.max(0,Math.round(m));if(m<60)return m+' mnt';const h=Math.floor(m/60),r=m%60;return r?h+' j '+r+' mnt':h+' j'};
const km=d=>d.toFixed(1).replace('.',',')+' km';
const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
