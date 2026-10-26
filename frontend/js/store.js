'use strict';
/* store.js: Data layer: data awal (seed), simpan/muat, akses data, aturan diskon. Diganti api.js pada langkah 5 */
function seed(){
  const pw='12345678';
  const U=(id,name,email,role,area)=>({id,name,email,pass:pw,role,area:area||'',active:true});
  const users=[U('u1','Ghefari Marva','ghefa@gmail.com','consumer','Jakarta Selatan'),U('u2','Rafli Pradana','rafli@gmail.com','consumer','Jakarta Selatan'),
    U('u3','Bu Lastri','bahari@merchant.com','merchant'),U('u4','Bu Sari','sari@merchant.com','merchant'),U('u5','Pak Wahyu','melati@merchant.com','merchant'),
    U('u6','Pak Anto','nusantara@merchant.com','merchant'),U('u7','Bu Rina','rina@merchant.com','merchant'),U('u8','Pak Slamet','sederhana@merchant.com','merchant'),
    U('u9','Administrator','ghefa@admin.com','admin'),U('u10','Bu Maya','maya@merchant.com','merchant')];
  const Mr=(id,userId,name,address,open,close,x,y)=>({id,userId,name,address,submittedAddress:address,verifiedAddress:address,addressStatus:'verified',mapChecked:true,open:open*60,close,status:'active',x,y});
  const merchants=[Mr('m1','u3','Warteg Bahari','Jl. Bahari No. 12, Jakarta Selatan',7,21*60,.9,-.8),Mr('m2','u4','Dapur Bu Sari','Jl. Kemang Raya No. 5, Jakarta Selatan',8,20*60+30,-1.6,1.2),
    Mr('m3','u5','Warteg Melati','Jl. Melati No. 3, Jakarta Selatan',7,21*60+30,2.2,1.8),Mr('m4','u6','Warung Nusantara','Jl. Nusantara No. 21, Jakarta Selatan',8,21*60+15,-3.1,-2.4),
    Mr('m5','u7','Katering Ibu Rina','Jl. Cempaka No. 8, Jakarta Selatan',9,22*60,4,3),Mr('m6','u8','Warteg Sederhana','Jl. Sederhana No. 2, Jakarta Selatan',7,20*60+45,-5.5,4.5)];
  merchants.push({id:'m7',userId:'u10',name:'Dapur Bu Maya',address:'Jl. Tebet Raya No. 18, Jakarta Selatan',submittedAddress:'Jl. Tebet Raya No. 18, Jakarta Selatan',verifiedAddress:'',addressStatus:'pending',mapChecked:false,open:8*60,close:21*60,status:'review',x:1.2,y:2.1});
  const L=(id,merchantId,name,emoji,normal,stock,close,note)=>({id,merchantId,name,emoji,normal,stock,initial:stock,close,note,active:true});
  const listings=[L('l1','m1','Paket Nasi Ayam','🍗',25000,5,21*60,'Nasi, ayam goreng, sambal, lalapan'),L('l2','m2','Nasi Telur Balado','🍳',20000,3,20*60+30,'Telur balado, sayur, sambal'),
    L('l3','m3','Paket Sayur & Tempe','🥬',18000,4,21*60+30,'Sayur asem, tempe orek, nasi'),L('l4','m4','Nasi Rames Komplit','🍛',22000,6,21*60+15,'Nasi rames dengan 3 lauk'),
    L('l5','m5','Soto Ayam + Nasi','🍲',24000,4,22*60,'Soto ayam kuah bening'),L('l6','m6','Gado-gado Porsi Besar','🥗',17000,2,20*60+45,'Gado-gado, lontong, kerupuk'),
    L('l7','m1','Tempe Orek + Nasi','🍱',15000,4,21*60+30,'Tempe orek, sayur, nasi')];
  const R=(id,userId,listingId,merchantId,name,emoji,qty,unit,normal,createdAt,expiresAt,status,extra)=>Object.assign({id,userId,listingId,merchantId,name,emoji,qty,unit,normal,fee:BOOKING_FEE,createdAt,expiresAt,status,warned:false,rating:null,completedAt:null},extra||{});
  const res=[R('NW-1042','u1','l1','m1','Paket Nasi Ayam','🍗',1,18000,25000,19*60+30,20*60+30,'active'),
    R('NW-1041','u2','l2','m2','Nasi Telur Balado','🍳',2,14000,20000,18*60+10,18*60+40,'completed',{completedAt:18*60+25}),
    R('NW-1038','u1','l2','m2','Nasi Telur Balado','🍳',1,14000,20000,17*60+5,17*60+35,'completed',{completedAt:17*60+20}),
    R('NW-1035','u1','l1','m1','Paket Nasi Ayam','🍗',2,18000,25000,12*60+10,12*60+40,'completed',{completedAt:12*60+25,rating:{score:5,text:'Porsi banyak, rasanya enak!'}}),
    R('NW-1029','u1','l3','m3','Paket Sayur & Tempe','🥬',1,12000,18000,10*60,10*60+30,'expired')];
  const now=19*60+45;
  return {v:4,now,session:null,big:false,seq:{tr:1043,n:100,u:11,m:8,l:8},users,merchants,listings,res,
    notifs:[{id:1,userId:'u1',text:'Voucher NW-1042 aktif sampai 20.30',time:19*60+30,read:false,type:'voucher'},{id:2,userId:'u3',text:'Pesanan baru NW-1042: Paket Nasi Ayam x1',time:19*60+30,read:false,type:'voucher'}],
    log:[{t:19*60+30,text:'Reservasi NW-1042 dibuat oleh Ghefari Marva'},{t:19*60+15,text:'Listing Paket Nasi Ayam diperbarui oleh Warteg Bahari'}]};
}
const storeKey=()=>API.on?KEY+'_api':KEY;
function load(){try{const j=JSON.parse(localStorage.getItem(storeKey()));if(j&&j.v===4)return j}catch(e){}return null}
function save(){try{localStorage.setItem(storeKey(),JSON.stringify(S))}catch(e){}}
/* Mode API: state lokal hanya menyimpan cache server + fitur yang belum punya endpoint (reservasi, voucher, rating) */
function seedApi(){return {v:4,now:19*60+45,session:null,big:false,running:false,apiDate:null,seq:{tr:1001,n:100,u:1,m:1,l:1},users:[],merchants:[],listings:[],res:[],notifs:[],log:[]}}
const user=id=>S.users.find(u=>u.id===id);
const merch=id=>S.merchants.find(m=>m.id===id);
const listing=id=>S.listings.find(l=>l.id===id);
const cur=()=>S.session?user(S.session):null;
const myMerchant=()=>S.merchants.find(m=>m.userId===S.session);
const dist=m=>Math.hypot(m.x,m.y);
const homeOf=r=>r==='merchant'?'m:dashboard':r==='admin'?'a:dashboard':'c:home';
const dayMinute=()=>((S.now%1440)+1440)%1440;
const canCreateListing=()=>{const t=dayMinute();return t<60||t>=19*60};
const addrStatusLabel=m=>m.addressStatus==='verified'?'<span class="addr-status addr-ok">✓ Alamat terverifikasi</span>':m.addressStatus==='needs_revision'?'<span class="addr-status addr-bad">Perlu perbaikan</span>':'<span class="addr-status addr-pending">Menunggu validasi alamat</span>';

/* tingkat diskon sesuai Tabel 1.6 laporan Minggu 1-4 */
function info(l){
  const rem=l.close-S.now;let state,pct=null;
  if(API.on&&l.srv){ // mode API: diskon dan status berasal dari database (dihitung scheduler server)
    const s=l.srv;state=s.state==='live'&&l.stock<=0?'soldout':s.state;pct=s.discountPct;
    let nx=null;if(state==='live'&&pct&&pct<50){const th=pct===20?90:pct===30?60:30;nx={pct:pct+10,inMin:rem-th}}
    return {rem,pct,price:s.price,state,next:nx};
  }
  if(!l.active)state='paused';else if(rem<=0)state='closed';else if(l.stock<=0)state='soldout';else if(rem>120)state='upcoming';else state='live';
  if(rem>0&&rem<=120)pct=rem>90?20:rem>60?30:rem>30?40:50;
  const price=pct?Math.round(l.normal*(1-pct/100)):l.normal;
  let next=null;if(pct&&pct<50){const th=pct===20?90:pct===30?60:30;next={pct:pct+10,inMin:rem-th}}
  return {rem,pct,price,state,next};
}
function liveList(){
  return S.listings.filter(l=>{const m=merch(l.merchantId);return m&&m.status==='active'&&info(l).state==='live'}).sort((a,b)=>dist(merch(a.merchantId))-dist(merch(b.merchantId)));
}
const resOf=uid=>S.res.filter(r=>r.userId===uid);
function impact(uid){
  const d=resOf(uid).filter(r=>r.status==='completed');
  return {porsi:d.reduce((a,r)=>a+r.qty,0),hemat:d.reduce((a,r)=>a+(r.normal-r.unit)*r.qty,0),merchants:new Set(d.map(r=>r.merchantId)).size};
}
