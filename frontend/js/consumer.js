'use strict';
/* consumer.js: Pembeli: reservasi, voucher, rating, dan halaman pembeli (FR-08 sampai FR-13) */
function openDetail(id){M={type:'detail',id,step:'detail',qty:1};renderModal()}
function closeModal(){M=null;renderModal()}
function setQty(d){const l=listing(M.id);const max=Math.max(1,Math.min(3,l.stock));M.qty=Math.min(max,Math.max(1,M.qty+d));renderModal()}
function toFee(){
  const u=cur();
  if(!u){pendingDetail=M.id;M=null;route='login';render();toast('Masuk dulu untuk melanjutkan reservasi');return}
  if(u.role!=='consumer')return toast('Reservasi hanya untuk akun pembeli');
  M.step='fee';renderModal();
}
function pay(){
  const l=listing(M.id),i=info(l),u=cur();
  if(!l||i.state!=='live'||l.stock<M.qty){toast('Maaf, stok atau waktu penawaran sudah berubah');M.step='detail';renderModal();render();return}
  const id='NW-'+(S.seq.tr++),m=merch(l.merchantId);
  S.res.push({id,userId:u.id,listingId:l.id,merchantId:m.id,name:l.name,emoji:l.emoji,qty:M.qty,unit:i.price,normal:l.normal,fee:BOOKING_FEE,createdAt:S.now,expiresAt:Math.min(S.now+30,l.close),status:'active',warned:false,rating:null,completedAt:null});
  l.stock-=M.qty;
  notify(m.userId,'Pesanan baru '+id+': '+l.name+' x'+M.qty+' oleh '+u.name,'voucher');
  S.notifs.unshift({id:S.seq.n++,userId:u.id,text:'Reservasi '+id+' berhasil. Voucher berlaku sampai '+T(Math.min(S.now+30,l.close)),time:S.now,read:false,type:'voucher'});
  logEv('Reservasi '+id+' dibuat oleh '+u.name);
  M.step='voucher';M.resId=id;save();render();
}
function openRate(id){M={type:'rate',resId:id,score:0};renderModal()}
function setStar(n){M.score=n;renderModal()}
function submitRating(){
  if(!M.score)return toast('Pilih jumlah bintang dulu');
  const r=S.res.find(x=>x.id===M.resId);r.rating={score:M.score,text:val('rt').trim()};
  const m=merch(r.merchantId);notify(m.userId,'Rating baru '+r.rating.score+' bintang untuk '+r.name,'rating');
  logEv('Rating '+r.rating.score+' bintang untuk '+m.name);M=null;save();render();toast('Terima kasih atas ratingnya');
}
function vCHome(){
  const u=cur(),lv=liveList(),act=resOf(u.id).filter(r=>r.status==='active'),soon=lv.filter(l=>info(l).rem<=30).slice(0,3);
  return '<div class="wrap"><div class="card" style="padding:26px;margin-bottom:18px;background:linear-gradient(135deg,#fff7ee,#fff)"><span class="tag">'+esc(u.area||'Jakarta')+'</span><h1 style="font-size:32px;margin:8px 0 4px">Halo, '+esc(u.name.split(' ')[0])+'! Mau makan hemat apa hari ini?</h1><p class="muted" style="margin:0">Cari makanan surplus di sekitarmu sebelum merchant tutup.</p><div class="herosearch" style="border:1px solid var(--line)"><input id="hq" placeholder="Cari makanan atau nama warteg" aria-label="Cari makanan" onkeydown="if(event.key===\'Enter\')heroSearch()"><select id="hr" aria-label="Radius"><option value="3">Radius 3 km</option><option value="5" selected>Radius 5 km</option><option value="10">Radius 10 km</option></select><button class="primary" onclick="heroSearch()">Cari makanan</button></div></div>'
  +'<div class="grid g2" style="margin-bottom:18px">'+(act.length?'<div class="card" style="border-color:#fde68a;background:#fffbeb"><h2>🎟️ Voucher aktif</h2>'+act.map(r=>'<div class="sumrow"><span><b>'+r.id+'</b> · '+esc(r.name)+' x'+r.qty+'</span><span class="tag '+(r.expiresAt-S.now<=10?'red':'warn')+'">sisa '+dur(r.expiresAt-S.now)+'</span></div>').join('')+'<button class="primary" style="margin-top:10px" onclick="go(\'c:voucher\')">Buka voucher</button></div>':'<div class="card"><h2>🎟️ Belum ada voucher aktif</h2><p class="muted">Reservasi makanan diskon dan vouchermu muncul di sini.</p><button class="primary" onclick="go(\'explore\')">Cari makanan</button></div>')+impactCard(u.id)+'</div>'
  +'<div class="page-head"><div><h1 style="font-size:24px">Penawaran terdekat</h1><p>Pilihan makanan yang masih tersedia hari ini.</p></div><button class="soft" onclick="go(\'explore\')">Lihat semua</button></div>'
  +(lv.length?'<div class="grid g3">'+lv.slice(0,3).map(foodCard).join('')+'</div>':'<div class="empty">Belum ada penawaran tayang. Coba majukan waktu simulasi.</div>')
  +(soon.length?'<div class="page-head" style="margin-top:28px"><div><h1 style="font-size:24px">⏰ Hampir tutup</h1><p>Diskon terbesar, tapi waktunya tinggal sebentar.</p></div></div><div class="grid g3">'+soon.map(foodCard).join('')+'</div>':'')+'</div>';
}
function vCVoucher(){
  const u=cur(),list=resOf(u.id).filter(r=>r.status==='active');
  return '<div class="wrap"><div class="page-head"><div><h1>Voucher Saya</h1><p>Tunjukkan kode atau QR ke merchant saat mengambil makanan.</p></div></div>'+(list.length?list.map(r=>{const m=merch(r.merchantId),left=r.expiresAt-S.now;
    return '<div class="card voucher-card" style="margin-bottom:14px"><div class="qrbox">'+qrSvg(r.id,170)+'<div class="muted" style="font-size:11px">QR (simulasi)</div></div><div><span class="tag '+(left<=10?'red':'warn')+'">Berlaku sampai '+T(r.expiresAt)+' · sisa '+dur(left)+'</span><h2 style="margin-top:8px">'+r.emoji+' '+esc(r.name)+' x'+r.qty+'</h2><div class="muted">'+esc(m.name)+' · '+esc(m.address)+'</div><div class="code" style="margin:8px 0">'+r.id+'</div><div class="sumrow"><span>Booking fee dibayar</span><b>'+rp(r.fee)+'</b></div><div class="sumrow total"><span>Sisa dibayar ke merchant</span><b>'+rp(Math.max(0,r.unit*r.qty-r.fee))+'</b></div></div></div>'}).join(''):'<div class="empty">Belum ada voucher aktif.<br><br><button class="primary" onclick="go(\'explore\')">Cari makanan diskon</button></div>')+'</div>';
}
function vCHistory(){
  const u=cur(),list=resOf(u.id).slice().reverse();
  return '<div class="wrap"><div class="page-head"><div><h1>Riwayat Transaksi</h1><p>Transaksi selesai dan voucher yang kedaluwarsa.</p></div></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Merchant</th><th>Item</th><th>Porsi</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+list.map(r=>'<tr><td>'+r.id+'</td><td>'+esc(merch(r.merchantId).name)+'</td><td>'+esc(r.name)+'</td><td>'+r.qty+'</td><td>'+rp(r.unit*r.qty)+'</td><td>'+statusTag(r.status)+'</td><td>'+(r.status==='completed'?(r.rating?'<span class="star-static" aria-label="Rating '+r.rating.score+' dari 5">'+stars(r.rating.score)+'</span>':'<button class="soft" onclick="openRate(\''+r.id+'\')">Beri rating</button>'):r.status==='active'?'<button class="soft" onclick="go(\'c:voucher\')">Lihat voucher</button>':'-')+'</td></tr>').join('')+'</tbody></table></div></div>';
}
function vCProfile(){
  const u=cur();
  return '<div class="wrap"><div class="page-head"><div><h1>Profil</h1><p>Kelola informasi akun dan lokasi utama Anda.</p></div></div><div class="grid g2"><div class="card"><h2>Informasi akun</h2><div class="field"><label for="pn">Nama</label><input id="pn" value="'+esc(u.name)+'"></div><div class="field"><label for="pe">Email</label><input id="pe" value="'+esc(u.email)+'" disabled></div><div class="field"><label for="pa">Lokasi utama</label><select id="pa">'+AREAS.map(a=>'<option'+(a===u.area?' selected':'')+'>'+a+'</option>').join('')+'</select></div><button class="primary" onclick="saveProfileC()">Simpan perubahan</button></div><div><div class="card" style="margin-bottom:16px"><h2>Keamanan akun</h2><div class="field"><label for="po">Kata sandi lama</label><input id="po" type="password"></div><div class="field"><label for="pnew">Kata sandi baru</label><input id="pnew" type="password"></div><button class="soft" onclick="changePass()">Ubah kata sandi</button></div>'+impactCard(u.id)+'</div></div></div>';
}
