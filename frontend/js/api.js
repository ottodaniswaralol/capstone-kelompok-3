'use strict';
/* api.js: klien REST ke backend (Minggu 7: auth, listing, scheduler).
   Jika server tidak tersedia, aplikasi otomatis memakai mode demo lokal (store.js).
   Yang sudah memakai server : login/registrasi, profil, listing merchant (CRUD), daftar listing pembeli,
                               diskon (dihitung scheduler server), jam server, verifikasi merchant oleh admin.
   Masih lokal (demo)         : reservasi, voucher, rating, notifikasi, pengguna/transaksi admin. */
const REF={lat:-6.26,lng:106.81};          // titik acuan lokasi pembeli (Jakarta Selatan)
const KM_PER_LNG=110.657, KM_PER_LAT=111.19;
const TOKEN_KEY='ngewarteg_token';
const hhmmMin=t=>{const a=String(t).split(':');return (+a[0])*60+(+a[1]||0)};
const rid=id=>String(id).slice(1);          // 'l12' -> '12'
const xyOf=(lat,lng)=>({x:+((lng-REF.lng)*KM_PER_LNG).toFixed(3),y:+(-(lat-REF.lat)*KM_PER_LAT).toFixed(3)});

async function apiFetch(path,opt){
  const o=opt||{},auth=o.auth!==false,headers={};
  if(o.body!==undefined)headers['Content-Type']='application/json';
  if(auth&&API.token)headers.Authorization='Bearer '+API.token;
  let res;
  try{res=await fetch(API.base+path,{method:o.method||'GET',headers,body:o.body!==undefined?JSON.stringify(o.body):undefined})}
  catch(e){const err=new Error('Server tidak dapat dihubungi. Pastikan backend berjalan.');err.network=true;throw err}
  if(res.status===204)return null;
  let data=null;try{data=await res.json()}catch(e){}
  if(!res.ok){
    const err=new Error((data&&data.error&&data.error.message)||('Permintaan gagal ('+res.status+')'));
    err.status=res.status;err.code=data&&data.error&&data.error.code;
    if(res.status===401&&auth&&API.token)apiForgetSession('Sesi berakhir, silakan masuk lagi.');
    throw err;
  }
  return data;
}
function apiForgetSession(msg){
  API.token=null;try{localStorage.removeItem(TOKEN_KEY)}catch(e){}
  if(S){S.session=null;route='login';if(msg)toast(msg);save();render()}
}
async function detectApi(){
  if(!API.base)return false;
  try{
    const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),2500);
    const r=await fetch(API.base+'/health',{signal:ctl.signal});clearTimeout(t);
    if(!r.ok&&r.status!==503)return false;
    const d=await r.json();API.dev=!!(d.time&&d.time.devTools);return true;
  }catch(e){return false}
}

/* ---------- pemetaan data server -> bentuk data frontend ---------- */
const mapUser=u=>({id:'u'+u.id,name:u.name,email:u.email,role:u.role,area:u.area||'',active:true});
function mapMerchant(m,userId){
  const o={id:'m'+m.id,name:m.name,address:m.address,status:m.status||'active'};
  if(m.lat!=null){const p=xyOf(m.lat,m.lng);o.x=p.x;o.y=p.y;o.lat=m.lat;o.lng=m.lng}
  if(m.openTime)o.open=hhmmMin(m.openTime);if(m.closeTime)o.close=hhmmMin(m.closeTime);
  if(m.addressStatus){o.addressStatus=m.addressStatus;o.mapChecked=!!m.mapChecked;o.submittedAddress=m.submittedAddress||m.address;o.verifiedAddress=m.verifiedAddress||''}
  if(userId!=null)o.userId='u'+userId;else if(m.userId!=null)o.userId='u'+m.userId;
  return o;
}
function upsertMerchant(o){
  const cur=S.merchants.find(m=>m.id===o.id);
  if(cur)return Object.assign(cur,o);
  const n=Object.assign({userId:null,addressStatus:'verified',mapChecked:true,submittedAddress:o.address,verifiedAddress:o.address,open:0,close:1439,x:0,y:0},o);
  S.merchants.push(n);return n;
}
function upsertUser(o){const c=S.users.find(u=>u.id===o.id);if(c)return Object.assign(c,o);S.users.push(o);return o}
function mapListing(d,merchantId){
  return {id:'l'+d.id,merchantId,name:d.name,emoji:d.emoji,normal:d.normalPrice,stock:d.stock,_srvStock:d.stock,initial:d.initialStock,close:hhmmMin(d.closeTime),note:d.note||'',active:d.isActive,
    srv:{state:d.state,discountPct:d.discountPct,price:d.price}};
}
/* stok yang tampil = stok server dikurangi voucher lokal yang masih aktif (reservasi belum ada di server sampai Minggu 9) */
function applyLocalStock(){
  S.listings.forEach(l=>{
    const reserved=S.res.filter(r=>r.status==='active'&&r.listingId===l.id).reduce((a,r)=>a+r.qty,0);
    l.stock=Math.max(0,(l._srvStock!=null?l._srvStock:l.stock)-reserved);
  });
}
function localMidnightVouchers(){
  S.res.filter(r=>r.status==='active').forEach(r=>{
    r.status='expired';
    notify(r.userId,'Voucher '+r.id+' berakhir pada pergantian hari. Booking fee/DP hangus.','voucher');
    const m=merch(r.merchantId);if(m&&m.userId)notify(m.userId,'Voucher '+r.id+' berakhir pukul 00.00. Stok harian dikembalikan ke kondisi awal.','voucher');
  });
}
function tickLocalVouchers(){
  S.res.filter(r=>r.status==='active').forEach(r=>{
    if(r.expiresAt<=S.now){
      r.status='expired';
      notify(r.userId,'Voucher '+r.id+' kedaluwarsa. Booking fee tidak dikembalikan.','voucher');
      const m=merch(r.merchantId);if(m&&m.userId)notify(m.userId,'Voucher '+r.id+' kedaluwarsa, '+r.qty+' porsi kembali ke stok','voucher');
    }else if(r.expiresAt-S.now<=10&&!r.warned){r.warned=true;notify(r.userId,'Voucher '+r.id+' kedaluwarsa dalam '+(r.expiresAt-S.now)+' menit','voucher')}
  });
}
/* notifikasi perubahan diskon untuk pengguna yang sedang masuk (server belum mengirim notifikasi) */
function diffNotify(prev){
  const u=cur();if(!u||u.role==='admin')return;
  S.listings.forEach(l=>{
    const a=prev[l.id];if(!a)return;const b=info(l),m=merch(l.merchantId);if(!m)return;
    const mine=u.role==='merchant'&&m.userId===u.id;if(u.role==='merchant'&&!mine)return;
    if(a.state==='upcoming'&&b.state==='live')notify(u.id,(mine?'Listing "'+l.name+'" mulai tayang dengan diskon ':'Listing baru: '+l.name+' di '+m.name+', diskon ')+b.pct+'%','diskon');
    else if(a.state==='live'&&b.state==='live'&&b.pct>a.pct)notify(u.id,(mine?'Diskon "'+l.name+'" naik jadi ':'Diskon '+l.name+' ('+m.name+') naik jadi ')+b.pct+'%','diskon');
    else if(mine&&a.state==='live'&&b.state==='closed')notify(u.id,'Listing "'+l.name+'" ditutup otomatis (lewat jam tutup)','info');
  });
}

/* ---------- sinkronisasi dengan server ---------- */
async function apiHydrate(){
  const prev={};S.listings.forEach(l=>{prev[l.id]=info(l)});
  const t=await apiFetch('/time',{auth:false});
  API.dev=!!t.devTools;
  const dayChanged=S.apiDate&&S.apiDate!==t.date;
  S.now=t.minuteOfDay;S.apiDate=t.date;
  if(dayChanged)localMidnightVouchers();
  const u=cur(),calls=[apiFetch('/listings?state=all',{auth:false})];
  if(u&&u.role==='merchant'){calls.push(apiFetch('/merchant/listings'));calls.push(apiFetch('/auth/me'))}
  if(u&&u.role==='admin')calls.push(apiFetch('/admin/merchants'));
  const out=await Promise.all(calls),fresh={};
  out[0].items.forEach(d=>{upsertMerchant(mapMerchant(d.merchant));fresh['l'+d.id]=mapListing(d,'m'+d.merchant.id)});
  if(u&&u.role==='merchant'){
    const me=out[2];let mid=null;
    if(me.merchant){upsertMerchant(mapMerchant(me.merchant,me.user.id));mid='m'+me.merchant.id}
    out[1].items.forEach(d=>{fresh['l'+d.id]=mapListing(d,mid)});
  }
  if(u&&u.role==='admin')out[1].items.forEach(m=>{upsertMerchant(mapMerchant(m));upsertUser({id:'u'+m.userId,name:m.ownerName,email:m.ownerEmail,role:'merchant',area:'',active:true})});
  const old=S.listings;S.listings=Object.values(fresh);
  old.forEach(l=>{if(!fresh[l.id]&&S.res.some(r=>r.listingId===l.id)){l.srv={state:'closed',discountPct:null,price:l.normal};l.gone=true;S.listings.push(l)}});
  tickLocalVouchers();applyLocalStock();diffNotify(prev);save();
}
async function apiSyncAndRender(okMsg){await apiHydrate();render();if(okMsg)toast(okMsg)}
function apiGuard(fn,errPrefix){return fn().catch(e=>{if(e.status!==401)toast((errPrefix||'')+e.message)})}

/* ---------- sesi ---------- */
async function apiStartSession(r){
  API.token=r.token;try{localStorage.setItem(TOKEN_KEY,r.token)}catch(e){}
  const u=upsertUser(mapUser(r.user));
  if(r.merchant)upsertMerchant(mapMerchant(r.merchant,r.user.id));
  S.session=u.id;save();
  await apiHydrate();
  return u;
}
async function apiRestoreSession(){
  try{API.token=localStorage.getItem(TOKEN_KEY)}catch(e){API.token=null}
  if(!API.token){S.session=null;return}
  try{
    const r=await apiFetch('/auth/me');
    const u=upsertUser(mapUser(r.user));if(r.merchant)upsertMerchant(mapMerchant(r.merchant,r.user.id));
    S.session=u.id;
  }catch(e){API.token=null;try{localStorage.removeItem(TOKEN_KEY)}catch(x){}S.session=null}
}
async function apiLogin(email,pass){
  try{
    const r=await apiFetch('/auth/login',{method:'POST',body:{email,password:pass},auth:false});
    const u=await apiStartSession(r);afterLogin(u);
  }catch(e){showErr(e.message)}
}
async function apiRegisterConsumer(name,email,p,area){
  try{
    const r=await apiFetch('/auth/register/consumer',{method:'POST',body:{name,email,password:p,area},auth:false});
    await apiStartSession(r);route='c:home';render();toast('Akun dibuat. Selamat datang, '+name);
  }catch(e){showErr(e.message)}
}
async function apiRegisterMerchant(d){
  try{
    const r=await apiFetch('/auth/register/merchant',{method:'POST',body:d,auth:false});
    await apiStartSession(r);route='m:dashboard';render();toast('Pendaftaran terkirim. Alamat akan dicek admin melalui Google Maps sebelum akun disetujui.');
  }catch(e){showErr(e.message)}
}

/* ---------- jam server (alat demo) ---------- */
async function apiClock(body,msg){
  try{await apiFetch('/dev/clock',{method:'POST',body,auth:false});await apiHydrate();refresh();if(msg)toast(msg)}
  catch(e){if(S.running)toggleRun();toast(e.status===404?'Alat demo jam dimatikan di server (DEV_TOOLS=0)':e.message)}
}
async function apiResetDemo(){
  try{
    await apiFetch('/dev/reset',{method:'POST',body:{},auth:false});
    S.res=[];S.notifs=[];S.log=[];S.merchants=[];S.listings=[];S.apiDate=null;
    await apiHydrate();route='landing';M=null;VAL=null;
    if(S.session){try{await apiFetch('/auth/me')}catch(e){}}
    render();toast('Data server direset ke kondisi awal');
  }catch(e){toast(e.message)}
}

/* ---------- mulai polling agar perubahan scheduler server terlihat ---------- */
function startApiPolling(){
  clearInterval(window.__apiPoll);
  window.__apiPoll=setInterval(()=>{if(document.hidden)return;apiHydrate().then(refresh).catch(()=>{})},30000);
}
