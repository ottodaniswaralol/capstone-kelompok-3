'use strict';
/* config.js: Konfigurasi dan state global aplikasi */
const KEY='ngewarteg_demo_v4', BOOKING_FEE=2000;
const AREAS=['Jakarta Selatan','Jakarta Pusat','Jakarta Barat','Jakarta Timur','Jakarta Utara','Depok','Tangerang Selatan','Bekasi'];
const EMOJIS=['🍛','🍗','🍳','🥬','🍲','🥗','🍱','🍜'];
const API={base:(window.NGEWARTEG_API_BASE||'').replace(/\/$/,''),on:false,dev:false,token:null};
let S=null, route='landing', M=null, E={q:'',sort:'near',radius:5}, AF={status:'all'}, MF={status:'all'}, VAL=null, bellOpen=false, clockOpen=true, pendingDetail=null, timer=null;
