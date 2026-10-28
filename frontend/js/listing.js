'use strict';
/* listing.js: Listing makanan merchant: CRUD dan jadwal diskon (FR-05, FR-06). Fokus Minggu 7 */
function adjStock(id,d){if(API.on)return apiGuard(()=>apiFetch('/merchant/listings/'+rid(id),{method:'PATCH',body:{stockDelta:d}}).then(()=>apiSyncAndRender()));const l=listing(id);l.stock=Math.max(0,l.stock+d);save();render()}
function toggleActive(id){const l=listing(id);if(API.on)return apiGuard(()=>apiFetch('/merchant/listings/'+rid(id),{method:'PATCH',body:{isActive:!l.active}}).then(()=>apiSyncAndRender(l.active?'Listing dijeda':'Listing diaktifkan')));l.active=!l.active;save();render();toast(l.active?'Listing diaktifkan':'Listing dijeda')}
function soldOut(id){const l=listing(id);if(API.on)return apiGuard(()=>apiFetch('/merchant/listings/'+rid(id),{method:'PATCH',body:{soldOut:true}}).then(()=>apiSyncAndRender('Listing ditandai habis')));l.stock=0;save();render();toast('Listing ditandai habis')}
function previewSched(){
  const el=$('#sched');if(!el)return;const c=P(val('lc')||'21:00'),p=+val('lp')||0;
  el.innerHTML=[[c-120,20],[c-90,30],[c-60,40],[c-30,50]].map(r=>'<li>mulai '+T(r[0])+': diskon '+r[1]+'%'+(p?' ('+rp(Math.round(p*(1-r[1]/100)))+')':'')+'</li>').join('');
}
function addListing(){
  const m=myMerchant();if(m.status!=='active')return toast('Akun belum diverifikasi admin');
  if(!canCreateListing())return toast('Listing baru hanya dapat dibuat pukul 19.00–00.59. Pukul 01.00–18.59 listing dikunci.');
  const name=val('ln').trim(),stock=+val('lq'),close=P(val('lc')||'21:00'),normal=+val('lp'),note=val('lnote').trim(),emoji=val('lemoji')||'🍱';
  if(!name||!(stock>0)||!(normal>0))return toast('Lengkapi nama makanan, jumlah porsi, dan harga normal');
  if(close<=S.now)return toast('Jam tutup harus setelah waktu saat ini ('+T(S.now)+')');
  if(API.on)return apiGuard(async()=>{const r=await apiFetch('/merchant/listings',{method:'POST',body:{name,emoji,note,normalPrice:normal,stock,closeTime:val('lc')}});await apiHydrate();route='m:listing';render();const nl=listing('l'+r.item.id),i=nl?info(nl):null;toast(i&&i.state==='live'?'Listing tayang sekarang dengan diskon '+i.pct+'%':'Listing disimpan, tayang otomatis pukul '+T(close-120))});
  const l={id:'l'+(S.seq.l++),merchantId:m.id,name,emoji,normal,stock,initial:stock,close,note,active:true};
  S.listings.push(l);logEv('Listing '+name+' ditambahkan oleh '+m.name);save();
  const i=info(l);route='m:listing';render();
  toast(i.state==='live'?'Listing tayang sekarang dengan diskon '+i.pct+'%':'Listing disimpan, tayang otomatis pukul '+T(close-120));
}
function listState(l){const i=info(l);return {live:'<span class="tag">Tayang</span>',upcoming:'<span class="tag gray">Tayang '+T(l.close-120)+'</span>',paused:'<span class="tag warn">Dijeda</span>',soldout:'<span class="tag red">Habis</span>',closed:'<span class="tag gray">Tutup</span>'}[i.state]}
function listingTable(ls,actions){
  if(!ls.length)return '<div class="empty">Belum ada listing.</div>';
  return '<div class="table-wrap"><table><thead><tr><th>Makanan</th><th>Harga normal</th><th>Harga sekarang</th><th>Diskon</th><th>Stok</th><th>Tutup</th><th>Status</th>'+(actions?'<th>Aksi</th>':'')+'</tr></thead><tbody>'+ls.map(l=>{const i=info(l);
    return '<tr><td>'+l.emoji+' '+esc(l.name)+'</td><td>'+rp(l.normal)+'</td><td><b>'+rp(i.price)+'</b></td><td>'+(i.pct?'<span class="tag warn">'+i.pct+'%</span>'+(i.next?' <small class="muted">'+i.next.pct+'% dalam '+dur(i.next.inMin)+'</small>':''):'<span class="muted">belum</span>')+'</td><td><span class="stock">'+(actions?'<button class="mini" aria-label="Kurangi stok" onclick="adjStock(\''+l.id+'\',-1)">−</button>':'')+'<b>'+l.stock+'</b>'+(actions?'<button class="mini" aria-label="Tambah stok" onclick="adjStock(\''+l.id+'\',1)">+</button>':'')+'</span></td><td>'+T(l.close)+'</td><td>'+listState(l)+'</td>'+(actions?'<td><button class="soft" onclick="toggleActive(\''+l.id+'\')">'+(l.active?'Jeda':'Aktifkan')+'</button> <button class="danger" onclick="soldOut(\''+l.id+'\')">Tandai habis</button></td>':'')+'</tr>'}).join('')+'</tbody></table></div>';
}
function vMListing(){
  const m=myMerchant(),ls=S.listings.filter(l=>l.merchantId===m.id&&!l.gone),ok=m.status==='active',timeOk=canCreateListing(),formOk=ok&&timeOk;
  return mShell(reviewBanner(m)+'<div class="page-head"><div><h1>Kelola Listing</h1><p>Tambah dan kelola makanan surplus. Harga diskon dihitung otomatis.</p></div></div>'+listingTable(ls,true)
  +(!timeOk?'<div class="rulebox"><strong>⏰ Listing baru sedang dikunci</strong>Merchant tidak dapat membuat listing pukul 01.00–18.59. Listing baru dapat dibuat mulai pukul 19.00 sampai 00.59.</div>':'')
  +'<div class="card" style="margin-top:18px"><h2>Tambah listing baru</h2>'+(ok?(timeOk?'':'<p class="muted">Form dikunci sementara sesuai aturan jam listing.</p>'):'<p class="muted">Form aktif setelah akun disetujui admin.</p>')+'<div class="formgrid"><div class="field"><label for="ln">Nama makanan</label><input id="ln" placeholder="Contoh: Nasi Rames Komplit"></div><div class="field"><label for="lemoji">Ikon</label><select id="lemoji">'+EMOJIS.map(e=>'<option>'+e+'</option>').join('')+'</select></div><div class="field"><label for="lq">Jumlah porsi</label><input id="lq" type="number" min="1" value="5"></div><div class="field"><label for="lp">Harga normal (Rp)</label><input id="lp" type="number" min="1000" step="500" value="20000" oninput="previewSched()"></div><div class="field"><label for="lc">Jam tutup</label><input id="lc" type="time" value="'+T24(Math.max(m.close,S.now+60))+'" oninput="previewSched()"></div><div class="field"><label for="lnote">Catatan</label><input id="lnote" placeholder="Isi paket, level pedas, dan lain-lain"></div></div><div class="info"><b>Jadwal diskon otomatis</b><ul class="timeline" id="sched"></ul></div><button class="primary big-btn" '+(formOk?'':'disabled')+' onclick="addListing()">Simpan listing</button></div>');
}
