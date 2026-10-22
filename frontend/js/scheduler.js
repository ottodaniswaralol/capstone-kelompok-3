'use strict';
/* scheduler.js: Scheduler simulasi (FR-06, FR-10) dan kontrol jam demo. Dipindah ke backend (jobs) pada langkah 4 */
function midnightReset(){
  let expired=0;
  S.res.filter(r=>r.status==='active').forEach(r=>{
    r.status='expired';expired++;
    notify(r.userId,'Voucher '+r.id+' berakhir pada pergantian hari. Booking fee/DP hangus.','voucher');
    const m=merch(r.merchantId);if(m)notify(m.userId,'Voucher '+r.id+' berakhir pukul 00.00. Stok harian dikembalikan ke kondisi awal.','voucher');
  });
  S.listings.forEach(l=>{l.stock=l.initial});
  if(expired)logEv('Reset 00.00: '+expired+' voucher aktif diakhiri dan DP hangus');
  else logEv('Reset 00.00: stok listing dikembalikan ke kondisi awal');
}
function advance(mins){
  const before={};S.listings.forEach(l=>before[l.id]=info(l));
  let target=S.now+mins, crossedMidnight=false;
  while(target>=1440){target-=1440;crossedMidnight=true;midnightReset()}
  S.now=target;let changed=0;
  if(crossedMidnight)changed++;
  S.listings.forEach(l=>{
    const a=before[l.id],b=info(l),m=merch(l.merchantId);if(!m||m.status!=='active')return;
    if(a.state==='upcoming'&&b.state==='live'){changed++;S.users.filter(u=>u.role==='consumer'&&u.active).forEach(u=>notify(u.id,'Listing baru: '+l.name+' di '+m.name+', diskon '+b.pct+'%','diskon'));notify(m.userId,'Listing "'+l.name+'" mulai tayang dengan diskon '+b.pct+'%','diskon')}
    else if(a.state==='live'&&b.state==='live'&&b.pct>a.pct){changed++;S.users.filter(u=>u.role==='consumer'&&u.active).forEach(u=>notify(u.id,'Diskon '+l.name+' ('+m.name+') naik jadi '+b.pct+'%','diskon'));notify(m.userId,'Diskon "'+l.name+'" naik jadi '+b.pct+'%','diskon')}
    else if(a.state==='live'&&b.state==='closed'){changed++;notify(m.userId,'Listing "'+l.name+'" ditutup otomatis (lewat jam tutup)','info')}
  });
  S.res.filter(r=>r.status==='active').forEach(r=>{
    if(r.expiresAt<=S.now){
      r.status='expired';const l=listing(r.listingId);if(l)l.stock+=r.qty;changed++;
      notify(r.userId,'Voucher '+r.id+' kedaluwarsa. Booking fee tidak dikembalikan.','voucher');
      const m=merch(r.merchantId);if(m)notify(m.userId,'Voucher '+r.id+' kedaluwarsa, '+r.qty+' porsi kembali ke stok','voucher');
      logEv('Scheduler: voucher '+r.id+' kedaluwarsa');
    }else if(r.expiresAt-S.now<=10&&!r.warned){r.warned=true;notify(r.userId,'Voucher '+r.id+' kedaluwarsa dalam '+(r.expiresAt-S.now)+' menit','voucher')}
  });
  if(changed)logEv('Scheduler '+T(S.now)+': '+changed+' perubahan harga atau status');
  save();refresh();
}
function toggleRun(){S.running=!S.running;if(S.running){timer=setInterval(()=>advance(1),2000)}else{clearInterval(timer);timer=null}renderClock()}
function setClockTime(v){if(!v)return;const target=P(v),base=Math.floor(S.now/1440)*1440;S.now=base+target;save();refresh();toast('Waktu diatur ke '+T(S.now));}
function setClockPreset(v){setClockTime(v)}
function resetDemo(){if(confirm('Kembalikan semua data demo ke kondisi awal?')){clearInterval(timer);timer=null;const big=S.big;S=seed();S.big=big;S.running=false;route='landing';M=null;VAL=null;document.body.classList.toggle('big',!!big);save();render();toast('Data demo direset ke 19.45')}}
