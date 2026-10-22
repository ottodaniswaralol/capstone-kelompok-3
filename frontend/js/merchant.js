'use strict';
/* merchant.js: Merchant: validasi voucher, transaksi, profil usaha (FR-11, FR-12) */
function validateCode(code){
  const mm=myMerchant();code=(code||val('vcode')).trim().toUpperCase();
  if(!code){VAL={ok:false,msg:'Masukkan kode voucher dulu'}}
  else{
    const r=S.res.find(x=>x.id===code);
    if(!r)VAL={ok:false,msg:'Kode tidak ditemukan'};
    else if(r.merchantId!==mm.id)VAL={ok:false,msg:'Voucher ini milik merchant lain'};
    else if(r.status==='completed')VAL={ok:false,msg:'Voucher sudah dipakai'};
    else if(r.status==='expired')VAL={ok:false,msg:'Voucher sudah kedaluwarsa'};
    else VAL={ok:true,id:r.id};
  }
  VAL.code=code;renderVal();
}
function scanSim(){
  const mm=myMerchant(),r=S.res.find(x=>x.merchantId===mm.id&&x.status==='active');
  if(!r)return toast('Belum ada voucher menunggu pickup');
  const e=document.getElementById('vcode');if(e)e.value=r.id;validateCode(r.id);
}
function confirmPickup(id){
  const r=S.res.find(x=>x.id===id);if(!r||r.status!=='active')return;
  r.status='completed';r.completedAt=S.now;const m=merch(r.merchantId);
  notify(r.userId,'Pickup '+r.id+' selesai di '+m.name+'. Beri rating pengalamanmu!','voucher');
  logEv('Transaksi '+r.id+' selesai di '+m.name);VAL=null;save();render();toast('Transaksi '+r.id+' selesai');
}
const mItems=[['m:dashboard','Dashboard','🏠'],['m:listing','Listing','🍱'],['m:validate','Validasi Voucher','▣'],['m:transactions','Transaksi','🧾'],['m:profile','Profil Usaha','👤']];
function mShell(body){const m=myMerchant();return shell(mItems,'Merchant',body,'<b>'+esc(m.name)+'</b><br>'+mStatusTag(m.status))}
function reviewBanner(m){if(m.status!=='review')return '';const msg=m.addressStatus==='verified'?'Alamat sudah terverifikasi. Menunggu persetujuan akhir admin.':m.addressStatus==='needs_revision'?'Alamat belum dapat diverifikasi. Perbaiki alamat pada Profil Usaha agar admin dapat mengecek ulang.':'Alamat usaha sedang menunggu pengecekan admin melalui Google Maps.';return '<div class="warnbox">⏳ '+msg+' Listing baru bisa dibuat setelah akun disetujui.</div>'}
function vMDash(){
  const m=myMerchant(),ls=S.listings.filter(l=>l.merchantId===m.id),live=ls.filter(l=>info(l).state==='live'),low=live.filter(l=>l.stock<=2).length;
  const pend=S.res.filter(r=>r.merchantId===m.id&&r.status==='active').length,done=S.res.filter(r=>r.merchantId===m.id&&r.status==='completed').length;
  const left=live.reduce((a,l)=>a+l.stock,0),avg=avgRating(m.id);
  return mShell(reviewBanner(m)+'<div class="page-head"><div><h1>Dashboard Merchant</h1><p>Ringkasan operasional '+esc(m.name)+' hari ini.</p></div><div class="page-actions"><button class="primary big-btn" onclick="go(\'m:validate\')">Validasi voucher</button><button class="soft big-btn" onclick="go(\'m:listing\')">+ Tambah listing</button></div></div>'
  +'<div class="grid g5" style="margin-bottom:16px"><div class="card"><span class="muted">Listing tayang</span><div class="kpi">'+live.length+'</div><span class="tag warn">'+low+' hampir habis</span></div><div class="card"><span class="muted">Menunggu pickup</span><div class="kpi">'+pend+'</div></div><div class="card"><span class="muted">Transaksi selesai</span><div class="kpi">'+done+'</div></div><div class="card"><span class="muted">Porsi tersisa</span><div class="kpi">'+left+'</div></div><div class="card"><span class="muted">Rating rata-rata</span><div class="kpi">'+(avg?'⭐ '+avg:'-')+'</div></div></div>'
  +'<div class="card" style="margin-bottom:16px"><h2>Panduan singkat</h2><div class="guide"><div>1. Tambah listing sisa makanan</div><div>2. Pembeli reservasi, pesanan muncul di sini</div><div>3. Minta kode voucher, lalu Validasi</div></div></div>'
  +'<h2 style="margin-bottom:10px">Listing saya</h2>'+listingTable(ls,false));
}
function vMValidate(){
  const m=myMerchant(),pend=S.res.filter(r=>r.merchantId===m.id&&r.status==='active');
  return mShell('<div class="page-head"><div><h1>Validasi Voucher</h1><p>Minta pembeli menunjukkan kode atau QR, lalu masukkan di sini.</p></div></div><div class="card"><div class="vbig"><input id="vcode" placeholder="NW-0000" aria-label="Kode voucher" autocomplete="off" onkeydown="if(event.key===\'Enter\')validateCode()"><button class="primary big-btn" onclick="validateCode()">Validasi</button></div><div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="soft" onclick="scanSim()">📷 Simulasi scan QR</button><span class="muted">Di versi final, tombol ini membuka kamera.</span></div><div id="vres" class="vres"></div></div>'
  +'<div class="card" style="margin-top:16px"><h2>Menunggu pickup ('+pend.length+')</h2>'+(pend.length?pend.map(r=>'<div class="sumrow"><span><b>'+r.id+'</b> · '+esc(r.name)+' x'+r.qty+' · '+esc(user(r.userId).name)+'</span><span><span class="tag warn">sampai '+T(r.expiresAt)+'</span> <button class="soft" onclick="document.getElementById(\'vcode\').value=\''+r.id+'\';validateCode()">Pakai kode</button></span></div>').join(''):'<p class="muted">Belum ada pesanan menunggu pickup.</p>')+'</div>');
}
function renderVal(){
  const el=document.getElementById('vres');if(!el)return;
  if(!VAL){el.innerHTML='';return}
  if(!VAL.ok){el.innerHTML='<div class="card" style="border-color:#fecaca;margin-top:14px"><span class="tag red">✖ '+esc(VAL.msg)+'</span><p class="muted">Periksa kembali kode pada voucher pembeli.</p></div>';return}
  const r=S.res.find(x=>x.id===VAL.id),b=user(r.userId);
  el.innerHTML='<div class="card" style="border-color:#bbf7d0;margin-top:14px"><span class="tag">✔ Voucher valid</span><h2 style="margin-top:10px">'+r.emoji+' '+esc(r.name)+'</h2><p>'+r.qty+' porsi · '+esc(b.name)+' · berlaku sampai '+T(r.expiresAt)+'</p><div class="sumrow"><span>Booking fee sudah dibayar</span><b>'+rp(r.fee)+'</b></div><div class="sumrow total"><span>Tagih sisa pembayaran</span><b>'+rp(Math.max(0,r.unit*r.qty-r.fee))+'</b></div><button class="primary big-btn" style="margin-top:12px;width:100%" onclick="confirmPickup(\''+r.id+'\')">Konfirmasi pickup</button></div>';
}
function vMTrans(){
  const m=myMerchant();let list=S.res.filter(r=>r.merchantId===m.id).slice().reverse();if(MF.status!=='all')list=list.filter(r=>r.status===MF.status);
  return mShell('<div class="page-head"><div><h1>Transaksi</h1><p>Reservasi, pickup, transaksi selesai, dan voucher expired.</p></div></div><div class="toolbar"><select aria-label="Filter status" onchange="MF.status=this.value;render()">'+[['all','Semua status'],['active','Menunggu pickup'],['completed','Selesai'],['expired','Expired']].map(o=>'<option value="'+o[0]+'"'+(MF.status===o[0]?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Makanan</th><th>Porsi</th><th>Pembeli</th><th>Status</th><th>Waktu</th><th>Rating</th></tr></thead><tbody>'+list.map(r=>'<tr><td>'+r.id+'</td><td>'+esc(r.name)+'</td><td>'+r.qty+'</td><td>'+esc(user(r.userId).name)+'</td><td>'+statusTag(r.status)+'</td><td>'+(r.status==='completed'?'selesai '+T(r.completedAt):'sampai '+T(r.expiresAt))+'</td><td>'+(r.rating?'<span class="star-static">'+stars(r.rating.score)+'</span>':'-')+'</td></tr>').join('')+'</tbody></table></div>');
}
function vMProfile(){
  const m=myMerchant(),avg=avgRating(m.id);
  return mShell(reviewBanner(m)+'<div class="page-head"><div><h1>Profil Usaha</h1><p>Informasi merchant yang tampil ke pembeli.</p></div></div><div class="grid g2"><div class="card"><div class="field"><label for="mn">Nama usaha</label><input id="mn" value="'+esc(m.name)+'"></div><div class="field"><label for="mad">Alamat</label><input id="mad" value="'+esc(m.address)+'"></div><div class="formgrid"><div class="field"><label for="mo">Jam buka</label><input id="mo" type="time" value="'+T24(m.open)+'"></div><div class="field"><label for="mc">Jam tutup</label><input id="mc" type="time" value="'+T24(m.close)+'"></div></div><button class="primary" onclick="saveProfileM()">Simpan perubahan</button></div><div class="card"><h2>Status akun</h2><p>'+mStatusTag(m.status)+'</p><p>'+addrStatusLabel(m)+'</p><p class="muted">'+(m.status==='active'?'Merchant dapat membuat listing dan menerima reservasi sesuai aturan jam listing.':m.status==='review'?'Menunggu validasi alamat dan persetujuan admin.':'Pendaftaran ditolak.')+'</p><h2 style="margin-top:14px">Rating pembeli</h2><p style="font-size:24px">'+(avg?'<span class="star-static">★</span> '+avg+' / 5':'Belum ada rating')+'</p></div></div>');
}
