'use strict';
/* ui.js: Komponen tampilan bersama: top bar, jam, notifikasi, QR, modal */
function qrSvg(code,size){
  const n=21;let h=2166136261;for(const ch of code)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
  const rnd=()=>{h^=h<<13;h>>>=0;h^=h>>>17;h^=h<<5;h>>>=0;return h/4294967296};
  const inF=(x,y)=>(x<8&&y<8)||(x>=n-8&&y<8)||(x<8&&y>=n-8);let cells='';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){if(inF(x,y))continue;if(rnd()>.5)cells+='<rect x="'+x+'" y="'+y+'" width="1" height="1"/>'}
  const f=(x,y)=>'<g transform="translate('+x+','+y+')"><rect width="7" height="7"/><rect x="1" y="1" width="5" height="5" fill="#fff"/><rect x="2" y="2" width="3" height="3"/></g>';
  return '<svg viewBox="-1 -1 '+(n+2)+' '+(n+2)+'" width="'+size+'" height="'+size+'" fill="#111" role="img" aria-label="QR voucher '+code+' (simulasi)"><rect x="-1" y="-1" width="'+(n+2)+'" height="'+(n+2)+'" fill="#fff"/>'+cells+f(0,0)+f(n-7,0)+f(0,n-7)+'</svg>';
}
function impactCard(uid){
  const im=impact(uid),ach=[['🌱 Penyelamat Pemula',1],['🌿 Pahlawan Sisa',10],['🌳 Jagoan Anti-Waste',25]];
  return '<div class="card impact"><h2>Dampakmu 🌍</h2><div class="grid g3"><div><b>'+im.porsi+'</b><div class="muted">porsi diselamatkan</div></div><div><b>'+rp(im.hemat)+'</b><div class="muted">total hemat</div></div><div><b>'+im.merchants+'</b><div class="muted">merchant terbantu</div></div></div><div style="margin-top:10px">'+ach.map(a=>'<span class="badge-ach '+(im.porsi>=a[1]?'':'off')+'">'+a[0]+' <small class="muted">'+a[1]+' porsi</small></span>').join('')+'</div></div>';
}
const statusTag=s=>({active:'<span class="tag warn">Menunggu pickup</span>',completed:'<span class="tag">Selesai</span>',expired:'<span class="tag gray">Expired</span>'}[s]);
const mStatusTag=s=>({active:'<span class="tag">Aktif</span>',review:'<span class="tag warn">Review</span>',rejected:'<span class="tag red">Ditolak</span>'}[s]);
function avgRating(mid){const r=S.res.filter(x=>x.merchantId===mid&&x.rating);return r.length?(r.reduce((a,x)=>a+x.rating.score,0)/r.length).toFixed(1):null}
function shell(items,title,body,foot){
  return '<div class="app-shell"><aside class="sidebar"><div class="sidebar-title">'+title+'</div><nav class="side-nav" aria-label="Menu '+title+'">'+items.map(i=>'<button class="'+(route===i[0]?'active':'')+'" onclick="go(\''+i[0]+'\')"><span aria-hidden="true">'+i[2]+'</span><span class="label">'+i[1]+'</span></button>').join('')+'</nav><div class="sidebar-footer">'+foot+'</div></aside><div class="content"><div class="content-inner">'+body+'</div></div></div>';
}
function bellPanel(){
  const ns=myNotifs().slice(0,8),icon={voucher:'🎟️',diskon:'🏷️',rating:'⭐',admin:'🛡️',info:'🔔'};
  return '<div class="bellpanel"><header><span>Notifikasi</span><button class="linkbtn" onclick="markRead()">Tandai dibaca</button></header>'+(ns.length?ns.map(n=>'<div class="nitem '+(n.read?'':'unread')+'"><span>'+(icon[n.type]||'🔔')+'</span><div>'+esc(n.text)+'<small>'+T(n.time)+'</small></div></div>').join(''):'<div class="nitem"><span></span><div class="muted">Belum ada notifikasi.</div></div>')+'</div>';
}
function renderTop(){
  const u=cur();let nav='',acts='';
  const brand='<button class="brand" onclick="go(\''+(u?homeOf(u.role):'landing')+'\')" aria-label="ngeWARteg, ke beranda"><span class="brand-mark">🍱</span><span>ngeWARteg</span></button>';
  if(!u){
    nav='<nav class="topnav" aria-label="Navigasi utama"><button onclick="go(\'landing\')">Beranda</button><button onclick="go(\'explore\')">Penawaran</button><button onclick="goSection(\'cara\')">Cara kerja</button></nav>';
    acts='<div class="top-actions"><button class="primary" onclick="go(\'login\')">Masuk</button></div>';
  }else{
    if(u.role==='consumer'){
      const nv=resOf(u.id).filter(r=>r.status==='active').length;
      const tabs=[['c:home','Home'],['explore','Explore'],['c:voucher','Voucher'+(nv?'<span class="nbadge">'+nv+'</span>':'')],['c:history','Riwayat'],['c:profile','Profil']];
      nav='<nav class="topnav" aria-label="Navigasi pembeli">'+tabs.map(t=>'<button class="'+(route===t[0]?'active':'')+'" onclick="go(\''+t[0]+'\')">'+t[1]+'</button>').join('')+'</nav>';
    }else nav='<span class="rolepill">'+(u.role==='merchant'?'Merchant':'Admin')+'</span>';
    const un=myNotifs().filter(n=>!n.read).length;
    acts='<div class="top-actions">'+(u.role==='merchant'?'<button class="soft" onclick="toggleBig()" aria-pressed="'+(!!S.big)+'">'+(S.big?'Teks normal':'Teks besar')+'</button>':'')+'<div class="bellwrap"><button class="bell" onclick="bellOpen=!bellOpen;renderTop()" aria-label="Notifikasi">🔔'+(un?'<span class="dot">'+un+'</span>':'')+'</button>'+(bellOpen?bellPanel():'')+'</div><div class="profile-chip"><div class="avatar">'+esc(u.name.slice(0,2).toUpperCase())+'</div><span>'+esc(u.name)+'</span></div><button class="ghost" onclick="logout()">Keluar</button></div>';
  }
  $('#topbar').innerHTML='<header class="topbar">'+brand+nav+acts+'</header>';
}
function renderClock(){
  const modeLine=API.on?'🟢 Terhubung ke server · jam server (WIB)':(API.base?'🟠 Server tidak tersedia · mode demo lokal':'Mode demo lokal');
  if(API.on&&!API.dev){
    $('#clock').innerHTML=clockOpen?'<div class="clock"><div class="clock-h"><strong>🕐 Jam server</strong><button class="mini" onclick="clockOpen=false;renderClock()" aria-label="Kecilkan">−</button></div><div class="clock-t">'+T(S.now)+'</div><div class="clock-sub">'+modeLine+'</div></div>':'<button class="clock-mini" onclick="clockOpen=true;renderClock()" aria-label="Buka jam server">🕐 '+T(S.now)+'</button>';
    return;
  }
  $('#clock').innerHTML=clockOpen?'<div class="clock"><div class="clock-h"><strong>🕐 Kontrol waktu</strong><button class="mini" onclick="clockOpen=false;renderClock()" aria-label="Kecilkan">−</button></div><div class="clock-t">'+T(S.now)+'</div><div class="clock-sub">'+modeLine+'<br>Atur waktu untuk menguji aturan listing, diskon, dan voucher.</div><div class="clock-b"><button class="soft" onclick="toggleRun()">'+(S.running?'⏸ Jeda':'▶ Jalan')+'</button><button class="soft" onclick="advance(5)">+5 mnt</button><button class="soft" onclick="advance(15)">+15 mnt</button></div><div class="clock-set"><input id="clockInput" type="time" value="'+T24(dayMinute())+'" aria-label="Atur waktu"><button class="soft" onclick="setClockTime(val(\'clockInput\'))">Atur</button></div><div class="clock-presets"><button onclick="setClockPreset(\'18:00\')">18:00 terkunci</button><button onclick="setClockPreset(\'19:00\')">19:00 aktif</button><button onclick="setClockPreset(\'23:55\')">23:55</button></div><button class="linkbtn" onclick="resetDemo()">Reset data</button></div>':'<button class="clock-mini" onclick="clockOpen=true;renderClock()" aria-label="Buka kontrol waktu">🕐 '+T(S.now)+'</button>';
}
function modalDetail(){
  const l=listing(M.id);if(!l){M=null;return ''}
  const m=merch(l.merchantId),i=info(l),u=cur(),live=i.state==='live';
  const stepper=n=>'<div class="stepper">'+['Detail dan porsi','Booking fee','Voucher'].map((s,k)=>'<span class="step '+(k<=n?'on':'')+'">'+(k+1)+'. '+s+'</span>').join('')+'</div>';
  if(M.step==='voucher'){
    const r=S.res.find(x=>x.id===M.resId);
    return stepper(2)+'<h2 style="text-align:center">Reservasi berhasil 🎉</h2><div class="qrbox">'+qrSvg(r.id,190)+'<div class="muted" style="font-size:11px">QR (simulasi untuk prototype)</div><div class="code">'+r.id+'</div><p><b>'+r.emoji+' '+esc(r.name)+'</b> x'+r.qty+'<br>'+esc(m.name)+'</p><p><span class="tag warn">Berlaku sampai '+T(r.expiresAt)+' · sisa '+dur(r.expiresAt-S.now)+'</span></p><p class="muted">Tunjukkan voucher ke merchant, lalu bayar sisa '+rp(Math.max(0,r.unit*r.qty-r.fee))+' langsung di tempat.</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="primary" onclick="go(\'c:voucher\')">Lihat Voucher Saya</button><button class="soft" onclick="closeModal()">Cari lagi</button></div></div>';
  }
  if(M.step==='fee'){
    const total=i.price*M.qty;
    return stepper(1)+'<h2>Booking fee</h2><p class="muted">Booking fee menjamin porsimu. Sisa harga dibayar langsung ke merchant saat pengambilan.</p><div class="sumrow"><span>'+l.emoji+' '+esc(l.name)+' x'+M.qty+' @ '+rp(i.price)+'</span><b>'+rp(total)+'</b></div><div class="sumrow"><span>Booking fee / DP (bayar sekarang)</span><b>'+rp(BOOKING_FEE)+'</b></div><div class="sumrow total"><span>Sisa dibayar ke merchant</span><b>'+rp(Math.max(0,total-BOOKING_FEE))+'</b></div><div class="rulebox"><strong>⚠️ Perhatikan sebelum membayar</strong>Setelah voucher diterbitkan, pesanan harus diambil maksimal 30 menit atau sebelum merchant tutup. Jika tidak diambil sampai batas waktu, booking fee/DP hangus dan porsi dikembalikan ke stok merchant. Pada pukul 00.00 seluruh voucher yang masih aktif juga diakhiri dan DP hangus.</div><label class="ack"><input id="feeAck" type="checkbox" onchange="document.getElementById(\'payBtn\').disabled=!this.checked"><span>Saya sudah membaca dan memahami aturan booking fee/DP di atas.</span></label><div class="info">Pembayaran menggunakan payment sandbox untuk kebutuhan alur pembayaran.</div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="soft" onclick="M.step=\'detail\';renderModal()">Kembali</button><button id="payBtn" class="primary big-btn" disabled onclick="pay()">Bayar '+rp(BOOKING_FEE)+'</button></div>';
  }
  const urg=live?(i.rem<=30?'<span class="tag red">⏰ Tutup '+dur(i.rem)+' lagi</span>':'<span class="tag gray">Tutup '+T(l.close)+' · '+dur(i.rem)+' lagi</span>'):'';
  const max=Math.max(1,Math.min(3,l.stock));
  return stepper(0)+'<div class="grid g2" style="align-items:start"><div class="food-thumb" style="height:200px;font-size:80px" aria-hidden="true">'+l.emoji+'</div><div><div class="badges">'+urg+(live?'<span class="tag '+(l.stock<=2?'red':'')+'">'+(l.stock<=2?'Tinggal ':'Sisa ')+l.stock+' porsi</span>':'<span class="tag red">Tidak tersedia</span>')+'</div><h2 style="margin:8px 0 2px">'+esc(l.name)+'</h2><div class="muted">'+esc(m.name)+' • '+km(dist(m))+'</div><div class="muted">📍 '+esc(m.address)+'</div><div class="price-row" style="margin:10px 0"><div><span class="old">'+rp(l.normal)+'</span><div class="price">'+rp(i.price)+'</div></div>'+(live?'<span class="disc">-'+i.pct+'%</span>':'')+'</div><p>'+esc(l.note||'')+'</p>'+(i.next?'<div class="hint">📈 Diskon naik jadi '+i.next.pct+'% dalam '+dur(i.next.inMin)+'</div>':live?'<div class="hint">🔥 Diskon sudah maksimal</div>':'')+'</div></div>'
  +(live?'<div class="qtyrow"><b>Jumlah porsi</b><button class="mini" onclick="setQty(-1)" aria-label="Kurangi">−</button><b style="font-size:20px">'+Math.min(M.qty,max)+'</b><button class="mini" onclick="setQty(1)" aria-label="Tambah">+</button><span class="muted">Total '+rp(i.price*Math.min(M.qty,max))+' · maks. '+max+' porsi</span></div><button class="primary big-btn" style="width:100%" onclick="toFee()">'+(u?'Lanjut ke booking fee':'Masuk untuk reservasi')+'</button>':'<div class="warnbox" style="margin-top:12px">Penawaran ini sudah tidak tersedia (habis, dijeda, atau lewat jam tutup).</div>');
}
function modalAddressReview(){
  const m=merch(M.merchantId);if(!m){M=null;return ''}
  return '<h2>Validasi alamat merchant</h2><p class="muted">Cek alamat yang dikirim merchant pada Google Maps sebelum akun disetujui.</p><div class="map-review"><b>'+esc(m.name)+'</b><div style="margin-top:6px">Alamat dari merchant:</div><div style="font-size:16px;font-weight:700;margin-top:4px">📍 '+esc(m.submittedAddress||m.address)+'</div><div style="margin-top:12px"><button class="soft" onclick="openMapsForMerchant(\''+m.id+'\')">↗ Buka di Google Maps</button></div></div><div class="field"><label for="verifiedAddr">Alamat yang dikonfirmasi admin</label><input id="verifiedAddr" value="'+esc(m.verifiedAddress||m.submittedAddress||m.address)+'"><span class="help">Admin dapat menyesuaikan penulisan alamat setelah mengecek lokasi pada Google Maps.</span></div><div class="rulebox"><strong>Aturan persetujuan</strong>Tombol Setujui Merchant baru aktif setelah alamat ditandai valid.</div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="danger" onclick="verifyMerchantAddress(\''+m.id+'\',false)">Perlu perbaikan</button><button class="okbtn" onclick="verifyMerchantAddress(\''+m.id+'\',true)">✓ Konfirmasi alamat valid</button></div>';
}
function modalRate(){
  const r=S.res.find(x=>x.id===M.resId);
  return '<h2>Beri rating</h2><p class="muted">'+esc(r.name)+' · '+esc(merch(r.merchantId).name)+'</p><div class="stars" role="radiogroup" aria-label="Rating bintang">'+[1,2,3,4,5].map(n=>'<button class="'+(n<=M.score?'on':'')+'" onclick="setStar('+n+')" aria-label="'+n+' bintang">★</button>').join('')+'</div><div class="field"><label for="rt">Feedback (opsional)</label><textarea id="rt" rows="3" placeholder="Ceritakan pengalamanmu"></textarea></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="soft" onclick="closeModal()">Batal</button><button class="primary" onclick="submitRating()">Kirim rating</button></div>';
}
function renderModal(){
  const el=$('#modal');if(!M){el.innerHTML='';return}
  el.innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal" role="dialog" aria-modal="true"><button class="x" onclick="closeModal()" aria-label="Tutup">×</button>'+(M.type==='rate'?modalRate():M.type==='address'?modalAddressReview():modalDetail())+'</div></div>';
}
