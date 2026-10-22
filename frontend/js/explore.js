'use strict';
/* explore.js: Explore pembeli: pencarian, filter radius, kartu makanan, peta (FR-07) */
function foodCard(l){
  const m=merch(l.merchantId),i=info(l);
  const urg=i.rem<=30?'<span class="tag red">⏰ Tutup '+dur(i.rem)+' lagi</span>':'<span class="tag gray">Tutup '+T(l.close)+' · '+dur(i.rem)+' lagi</span>';
  const stk=l.stock<=2?'<span class="tag red">Tinggal '+l.stock+' porsi!</span>':'<span class="tag">Sisa '+l.stock+' porsi</span>';
  const nx=i.next?'<div class="hint">📈 Diskon naik jadi '+i.next.pct+'% dalam '+dur(i.next.inMin)+'</div>':'<div class="hint">🔥 Diskon sudah maksimal</div>';
  return '<div class="card food-card"><div class="food-thumb" aria-hidden="true">'+l.emoji+'</div><div class="badges">'+urg+stk+'</div><div><strong>'+esc(l.name)+'</strong><div class="muted">'+esc(m.name)+' • '+km(dist(m))+'</div></div><div class="price-row"><div><span class="old">'+rp(l.normal)+'</span><div class="price">'+rp(i.price)+'</div></div><span class="disc">-'+i.pct+'%</span></div>'+nx+'<button class="primary" onclick="openDetail(\''+l.id+'\')">Detail dan reservasi</button></div>';
}
function mapSvg(list){
  const c=170,R=E.radius,sc=140/R;let pins='';const seen={};
  const ring=r=>'<circle cx="'+c+'" cy="'+c+'" r="'+(r*sc)+'" fill="none" stroke="#9ca3af" stroke-dasharray="4 4"/>';
  list.forEach(l=>{if(seen[l.merchantId])return;seen[l.merchantId]=1;const m=merch(l.merchantId),px=c+m.x*sc,py=c+m.y*sc;
    pins+='<g class="pin" onclick="openDetail(\''+l.id+'\')"><title>'+esc(m.name)+' ('+km(dist(m))+')</title><circle cx="'+px+'" cy="'+py+'" r="14" fill="#a61f2d"/><text x="'+px+'" y="'+(py+5)+'" text-anchor="middle" font-size="14">'+l.emoji+'</text><text x="'+px+'" y="'+(py+28)+'" text-anchor="middle" font-size="10" fill="#374151">'+esc(m.name)+'</text></g>'});
  return '<svg viewBox="0 0 340 340" class="map" role="img" aria-label="Peta penawaran di sekitar Anda"><rect width="340" height="340" fill="#eef6ee"/>'+ring(R)+ring(R/2)+'<text x="'+c+'" y="'+(c-R*sc-4)+'" text-anchor="middle" font-size="10" fill="#6b7280">'+R+' km</text><text x="'+c+'" y="'+(c-R*sc/2-4)+'" text-anchor="middle" font-size="10" fill="#6b7280">'+(R/2)+' km</text><circle cx="'+c+'" cy="'+c+'" r="7" fill="#2563eb" stroke="#fff" stroke-width="3"/><text x="'+c+'" y="'+(c+22)+'" text-anchor="middle" font-size="11" font-weight="700" fill="#1d4ed8">Anda</text>'+pins+'</svg><div class="muted" style="margin-top:8px">Radius '+R+' km · klik pin untuk melihat detail</div>';
}
function exploreRes(){
  const q=E.q.trim().toLowerCase();
  let list=liveList().filter(l=>dist(merch(l.merchantId))<=E.radius&&(!q||(l.name+' '+merch(l.merchantId).name).toLowerCase().includes(q)));
  if(E.sort==='disc')list.sort((a,b)=>info(b).pct-info(a).pct);else if(E.sort==='close')list.sort((a,b)=>info(a).rem-info(b).rem);
  const up=S.listings.filter(l=>{const m=merch(l.merchantId);return m&&m.status==='active'&&info(l).state==='upcoming'&&dist(m)<=E.radius});
  return '<div class="explore-grid"><div>'+(list.length?'<div class="grid g2">'+list.map(foodCard).join('')+'</div>':'<div class="empty">Belum ada penawaran yang cocok dalam radius '+E.radius+' km. Coba perbesar radius atau majukan waktu simulasi.</div>')
   +(up.length?'<div class="card" style="margin-top:16px"><h2>Segera tayang</h2><p class="muted" style="margin:0 0 8px">Listing tayang otomatis 2 jam sebelum jam tutup.</p>'+up.map(l=>'<div class="sumrow"><span>'+l.emoji+' '+esc(l.name)+' · '+esc(merch(l.merchantId).name)+'</span><b>tayang '+T(l.close-120)+'</b></div>').join('')+'</div>':'')+'</div><div class="card mapcard">'+mapSvg(list)+'</div></div>';
}
function updExplore(){const el=$('#exploreRes');if(el)el.innerHTML=exploreRes()}
function vExplore(){
  return '<div class="wrap"><div class="page-head"><div><h1>Explore makanan</h1><p>Temukan penawaran berdasarkan lokasi dan waktu tutup.</p></div></div><div class="searchbar"><input id="eq" placeholder="Cari makanan atau merchant" aria-label="Cari makanan atau merchant" value="'+esc(E.q)+'" oninput="E.q=this.value;updExplore()"><select aria-label="Urutkan" onchange="E.sort=this.value;updExplore()"><option value="near"'+(E.sort==='near'?' selected':'')+'>Terdekat</option><option value="disc"'+(E.sort==='disc'?' selected':'')+'>Diskon terbesar</option><option value="close"'+(E.sort==='close'?' selected':'')+'>Hampir tutup</option></select><select aria-label="Radius" onchange="E.radius=+this.value;updExplore()">'+[3,5,10].map(r=>'<option value="'+r+'"'+(E.radius===r?' selected':'')+'>≤ '+r+' km</option>').join('')+'</select></div><div id="exploreRes">'+exploreRes()+'</div></div>';
}
