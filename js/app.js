
'use strict';
const API='https://api.mail.tm';
const $=id=>document.getElementById(id);
let session=load('daniel_mail_session',null), pollTimer=null, busy=false, toastTimer=null;
function load(k,f){try{const v=localStorage.getItem(k);return v?JSON.parse(v):f}catch{return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function notify(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function setBusy(b,on){b.disabled=on;if(on){b.dataset.old=b.innerHTML;b.innerHTML='Memproses...'}else if(b.dataset.old){b.innerHTML=b.dataset.old;delete b.dataset.old}}
async function api(path,options={}){const headers={...(options.headers||{})};if(session?.token)headers.Authorization='Bearer '+session.token;const r=await fetch(API+path,{...options,headers});let d={};try{d=await r.json()}catch{}if(!r.ok){const e=new Error(d['hydra:description']||d.message||'HTTP '+r.status);e.status=r.status;throw e}return d}
function randomPassword(){const a=new Uint8Array(24);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')+'Aa9!'}
function randomName(){const a=new Uint8Array(12);crypto.getRandomValues(a);return 'daniel'+Array.from(a,b=>b.toString(16).padStart(2,'0')).join('')}
function safeText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showInbox(){const active=!!session?.token;$('createCard').classList.toggle('hidden',active);$('inboxCard').classList.toggle('hidden',!active);$('messagesCard').classList.toggle('hidden',!active);$('serviceStatus').textContent=active?'Active':'Standby';$('emailAddress').value=active?session.address:'';if(active)startPolling();else stopPolling()}
async function createEmail(button){if(busy)return;busy=true;setBusy(button,true);$('serviceStatus').textContent='Connecting';try{
const d=await fetch(API+'/domains?page=1').then(r=>{if(!r.ok)throw Error('Gagal mengambil domain');return r.json()});
const domains=(d['hydra:member']||[]).filter(x=>x.isActive&&x.isPrivate===false);
if(!domains.length)throw Error('Domain email tidak tersedia saat ini.');
const address=randomName()+'@'+domains[Math.floor(Math.random()*domains.length)].domain,password=randomPassword();
const account=await fetch(API+'/accounts',{method:'POST',headers:{'Content-Type':'application/ld+json'},body:JSON.stringify({address,password})});
if(!account.ok)throw Error('Gagal membuat email. Coba lagi.');
const r=await fetch(API+'/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address,password})});
if(!r.ok)throw Error('Gagal login ke inbox.');
const t=await r.json();session={address,token:t.token,createdAt:Date.now()};save('daniel_mail_session',session);
const h=load('daniel_mail_history',[]);h.unshift({address,createdAt:session.createdAt});save('daniel_mail_history',h.slice(0,15));
showInbox();await refreshMessages();notify('Email berhasil dibuat!');
}catch(e){notify(e.message);$('serviceStatus').textContent='Offline'}finally{busy=false;setBusy(button,false)}}
async function refreshMessages(){if(!session?.token)return;try{$('syncLabel').textContent='Syncing...';const d=await api('/messages?page=1'),list=d['hydra:member']||[];$('messageCount').textContent=list.length;$('messageList').innerHTML='';
if(!list.length){$('messageList').innerHTML='<div class="empty"><i class="fa-regular fa-envelope-open"></i><strong>Belum ada pesan</strong><p>Pesan masuk akan muncul di sini.</p></div>'}
else list.forEach(m=>{const b=document.createElement('button');b.className='message';b.innerHTML='<div class="avatar"><i class="fa-regular fa-envelope"></i></div><div class="msg-copy"><div class="msg-from">'+safeText(m.from?.address||'Pengirim')+'</div><div class="msg-subject">'+safeText(m.subject||'(Tanpa subjek)')+'</div></div><div class="msg-date">'+safeText(m.createdAt?new Date(m.createdAt).toLocaleDateString('id-ID'):'')+'</div>';b.addEventListener('click',()=>readMessage(m.id));$('messageList').appendChild(b)});
$('syncLabel').textContent='Updated '+new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
}catch(e){$('syncLabel').textContent='Gagal sync';if(e.status===401){stopPolling();notify('Sesi berakhir. Buat email baru.')}}}
async function readMessage(id){$('readModal').classList.add('open');$('detailBody').textContent='Memuat pesan...';try{const m=await api('/messages/'+encodeURIComponent(id));$('detailFrom').textContent=m.from?.address||'-';$('detailSubject').textContent=m.subject||'(Tanpa subjek)';$('detailDate').textContent=m.createdAt?new Date(m.createdAt).toLocaleString('id-ID'):'-';$('detailBody').textContent=m.text?.join('\n\n')||m.intro||'Pesan tidak memiliki versi teks.'}catch(e){$('detailBody').textContent='Gagal membuka pesan: '+e.message}}
function startPolling(){stopPolling();refreshMessages();pollTimer=setInterval(refreshMessages,20000)}
function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
function resetSession(){stopPolling();session=null;localStorage.removeItem('daniel_mail_session');$('messageCount').textContent='0';showInbox();notify('Inbox diganti.')}
function showHistory(){const list=load('daniel_mail_history',[]);$('historyList').innerHTML='';if(!list.length)$('historyList').textContent='Belum ada riwayat.';else list.forEach(x=>{const row=document.createElement('div');row.className='history-item';const s=document.createElement('span');s.textContent=x.address;const d=document.createElement('small');d.textContent=new Date(x.createdAt).toLocaleDateString('id-ID');row.append(s,d);$('historyList').appendChild(row)});$('historyModal').classList.add('open')}
$('createBtn').addEventListener('click',()=>createEmail($('createBtn')));
$('newEmailBtn').addEventListener('click',()=>{if(confirm('Ganti email sekarang? Inbox lama tidak bisa dibuka lagi dari sesi ini.')){resetSession();createEmail($('createBtn'))}});
$('refreshBtn').addEventListener('click',refreshMessages);
$('copyBtn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(session.address);notify('Email disalin!')}catch{$('emailAddress').select();notify('Pilih lalu salin alamat email')}});
$('historyBtn').addEventListener('click',showHistory);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',() => $(b.dataset.close).classList.remove('open')));
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('open')}));
$('year').textContent=new Date().getFullYear();showInbox();
