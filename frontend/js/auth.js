'use strict';
/* auth.js: Akun: login, registrasi, profil (FR-01 sampai FR-04) */
const emailOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function showErr(msg){const e=$('#authErr');if(e){e.textContent=msg;e.classList.remove('hidden')}}
function login(){
  const email=val('le').trim().toLowerCase(),pass=val('lp');
  if(!emailOk(email))return showErr('Format email belum benar.');
  const u=S.users.find(x=>x.email===email&&x.pass===pass);
  if(!u)return showErr('Email atau kata sandi salah.');
  if(!u.active)return showErr('Akun ini dinonaktifkan. Hubungi administrator.');
  if(u.role==='merchant'){const m=S.merchants.find(x=>x.userId===u.id);if(m&&m.status==='rejected')return showErr('Pendaftaran merchant Anda ditolak. Hubungi administrator.')}
  S.session=u.id;save();
  route=homeOf(u.role);
  if(pendingDetail&&u.role==='consumer'){const id=pendingDetail;pendingDetail=null;route='explore';render();toast('Selamat datang, '+u.name);openDetail(id);return}
  render();toast('Selamat datang, '+u.name+'. Anda masuk sebagai '+({consumer:'pembeli',merchant:'merchant',admin:'admin'}[u.role]));
}
function checkAcc(name,email,p,p2){
  if(!name.trim())return 'Nama wajib diisi.';
  if(!emailOk(email))return 'Format email belum benar.';
  if(S.users.some(u=>u.email===email))return 'Email sudah terdaftar.';
  if(p.length<8)return 'Kata sandi minimal 8 karakter.';
  if(p!==p2)return 'Konfirmasi kata sandi tidak sama.';
  return '';
}
function regConsumer(){
  const name=val('rn').trim(),email=val('re').trim().toLowerCase(),p=val('rp'),p2=val('rp2'),area=val('ra');
  const err=checkAcc(name,email,p,p2);if(err)return showErr(err);
  const u={id:'u'+(S.seq.u++),name,email,pass:p,role:'consumer',area,active:true};
  S.users.push(u);S.session=u.id;logEv('Pembeli baru mendaftar: '+name);save();route='c:home';render();toast('Akun dibuat. Selamat datang, '+name);
}
function regMerchant(){
  const owner=val('rn').trim(),email=val('re').trim().toLowerCase(),p=val('rp'),p2=val('rp2');
  const biz=val('rb').trim(),addr=val('rad').trim(),open=P(val('ro')||'07:00'),close=P(val('rc')||'21:00');
  const err=checkAcc(owner,email,p,p2)||(!biz?'Nama usaha wajib diisi.':!addr?'Alamat usaha wajib diisi.':close<=open?'Jam tutup harus setelah jam buka.':'');
  if(err)return showErr(err);
  const u={id:'u'+(S.seq.u++),name:owner,email,pass:p,role:'merchant',area:'',active:true};S.users.push(u);
  const pos=[[1.5,1.0],[-2.0,-1.5],[3.0,-2.0],[-1.0,3.5],[.5,-3.0],[2.5,2.5]][S.merchants.length%6];
  S.merchants.push({id:'m'+(S.seq.m++),userId:u.id,name:biz,address:addr,submittedAddress:addr,verifiedAddress:'',addressStatus:'pending',mapChecked:false,open,close,status:'review',x:pos[0],y:pos[1]});
  S.users.filter(x=>x.role==='admin').forEach(a=>notify(a.id,'Merchant baru mendaftar: '+biz+'. Cek alamat di Google Maps sebelum menyetujui akun.','admin'));
  logEv('Merchant baru mendaftar: '+biz+' (Review alamat & akun)');S.session=u.id;save();route='m:dashboard';render();toast('Pendaftaran terkirim. Alamat akan dicek admin melalui Google Maps sebelum akun disetujui.');
}
function saveProfileC(){
  const u=cur(),name=val('pn').trim();if(!name)return toast('Nama tidak boleh kosong');
  u.name=name;u.area=val('pa');save();render();toast('Profil disimpan');
}
function changePass(){
  const u=cur(),o=val('po'),n=val('pnew');
  if(o!==u.pass)return toast('Kata sandi lama salah');if(n.length<8)return toast('Kata sandi baru minimal 8 karakter');
  u.pass=n;save();render();toast('Kata sandi diubah');
}
function saveProfileM(){
  const m=myMerchant(),name=val('mn').trim(),addr=val('mad').trim(),open=P(val('mo')),close=P(val('mc'));
  if(!name||!addr)return toast('Nama usaha dan alamat wajib diisi');if(close<=open)return toast('Jam tutup harus setelah jam buka');
  m.name=name;
  if(m.address!==addr){m.address=addr;m.submittedAddress=addr;if(m.status==='review'){m.addressStatus='pending';m.mapChecked=false;m.verifiedAddress=''}}
  m.open=open;m.close=close;save();render();toast(m.status==='review'?'Profil disimpan. Perubahan alamat akan divalidasi admin.':'Profil usaha disimpan');
}
