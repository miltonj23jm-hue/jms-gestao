/* JMS Gestão Empresarial v2.0 — reconstrução */
const STORAGE_KEY = 'jms_v2_db';
const SESSION_KEY = 'jms_v2_session';
const LAST_USER_KEY = 'jms_v2_lastuser';

const defaultDB = {
  org: { type:'single', groupName:'', createdAt:null },
  users: [], companies: [], accounts: [],
  categories: [
    {id:'c1', name:'Vendas', type:'receita'},
    {id:'c2', name:'Prestação Serviços', type:'receita'},
    {id:'c3', name:'Folha Pagamento', type:'despesa'},
    {id:'c4', name:'Aluguel', type:'despesa'},
    {id:'c5', name:'Combustível', type:'despesa'},
    {id:'c6', name:'Impostos', type:'despesa'}
  ],
  partners: [], entries: [], bids: [], contracts: [], certifications: [], employees: [],
  config: { currency:'BRL' }
};

let DB = loadDB();
let currentUser = null;
let activeCompanyId = null;

function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return JSON.parse(JSON.stringify(defaultDB));
    return Object.assign(JSON.parse(JSON.stringify(defaultDB)), JSON.parse(raw));
  }catch(e){ return JSON.parse(JSON.stringify(defaultDB)); }
}
function saveDB(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); }catch(e){} }
function uid(p){ return p+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtMoney(v){ return 'R$ '+(Number(v||0)).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function parseBRL(s){ if(typeof s==='number') return s; const x = String(s||'').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'); return parseFloat(x)||0; }
function fmtCnpj(v){
  const x = String(v||'').replace(/\D/g,'').slice(0,14);
  return x.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2');
}
function toast(msg, type){
  const t = document.createElement('div');
  t.className = 'toast '+(type||'ok'); t.textContent = msg;
  document.getElementById('toastRoot').appendChild(t);
  setTimeout(()=>t.remove(), 3000);
}

function openModal(title, html, onSave, size){
  const wrap = document.createElement('div');
  wrap.className = 'modal-bg';
  wrap.innerHTML = '<div class="modal '+(size==='lg'?'modal-lg':'')+'">'+
    '<div style="padding:1rem 1.25rem;border-bottom:1px solid var(--line);display:flex;align-items:center"><div style="font-weight:700;flex:1">'+escapeHtml(title)+'</div><button class="btn btn-ghost" onclick="closeModal()">✕</button></div>'+
    '<div style="padding:1.25rem">'+html+'</div>'+
    '<div style="padding:.85rem 1.25rem;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:.5rem;background:#f8fafc">'+
      '<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>'+
      '<button class="btn btn-primary" id="modalSaveBtn">Salvar</button>'+
    '</div></div>';
  document.getElementById('modalRoot').appendChild(wrap);
  document.getElementById('modalSaveBtn').onclick = ()=>{
    if(onSave){ const r = onSave(); if(r === false) return; }
    closeModal();
  };
}
function closeModal(){
  const root = document.getElementById('modalRoot');
  if(root.lastChild) root.removeChild(root.lastChild);
}

async function hashPassword(pwd){
  const enc = new TextEncoder().encode(String(pwd||''));
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function authShowTab(tab){
  document.getElementById('authTabLogin').classList.toggle('active', tab==='login');
  document.getElementById('authTabReg').classList.toggle('active', tab==='register');
  const body = document.getElementById('authBody');
  const hasUsers = (DB.users||[]).some(u=>u.passwordHash);
  if(tab==='login'){
    body.innerHTML = (hasUsers?'':'<div style="padding:.75rem;background:#fef3c7;border:1px solid #fde68a;color:#92400e;border-radius:8px;font-size:.8rem;margin-bottom:.75rem">⚠️ Primeiro acesso — <a onclick="authShowTab(\'register\')" style="text-decoration:underline;cursor:pointer;font-weight:700">criar conta</a></div>')+
      '<input id="liUser" class="input" placeholder="E-mail ou usuário" style="margin-bottom:.5rem">'+
      '<input id="liPwd" type="password" class="input" placeholder="Senha" onkeydown="if(event.key===\'Enter\')doLogin()" style="margin-bottom:.5rem">'+
      '<button class="btn btn-primary" onclick="doLogin()" style="width:100%"'+(hasUsers?'':' disabled')+'>Entrar</button>';
    setTimeout(()=>{ const el=document.getElementById('liUser'); if(el) el.focus(); }, 50);
  } else {
    body.innerHTML = '<div style="padding:.75rem;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;border-radius:8px;font-size:.8rem;margin-bottom:.75rem">👑 Conta de <strong>Administrador</strong>.</div>'+
      '<input id="riName" class="input" placeholder="Nome completo" style="margin-bottom:.5rem">'+
      '<input id="riUser" class="input" placeholder="Nome de usuário" style="margin-bottom:.5rem">'+
      '<input id="riEmail" type="email" class="input" placeholder="E-mail" style="margin-bottom:.5rem">'+
      '<input id="riPwd" type="password" class="input" placeholder="Senha (mín. 4)" style="margin-bottom:.5rem">'+
      '<input id="riPwd2" type="password" class="input" placeholder="Confirmar senha" onkeydown="if(event.key===\'Enter\')doRegister()" style="margin-bottom:.5rem">'+
      '<button class="btn btn-primary" onclick="doRegister()" style="width:100%">Cadastrar</button>';
    setTimeout(()=>{ const el=document.getElementById('riName'); if(el) el.focus(); }, 50);
  }
}

async function doLogin(){
  const ident = (document.getElementById('liUser').value||'').trim().toLowerCase();
  const pwd = document.getElementById('liPwd').value;
  if(!ident||!pwd){ toast('Preencha usuário e senha','err'); return; }
  const u = DB.users.find(x=>x.passwordHash && ((x.email||'').toLowerCase()===ident || (x.username||'').toLowerCase()===ident));
  if(!u){ toast('Usuário não encontrado','err'); return; }
  const h = await hashPassword(pwd);
  if(h !== u.passwordHash){ toast('Senha incorreta','err'); return; }
  sessionStorage.setItem(SESSION_KEY, u.id);
  localStorage.setItem(LAST_USER_KEY, u.id);
  currentUser = u;
  toast('Bem-vindo, '+u.name);
  postAuth();
}

async function doRegister(){
  const name = (document.getElementById('riName').value||'').trim();
  const username = (document.getElementById('riUser').value||'').trim().toLowerCase();
  const email = (document.getElementById('riEmail').value||'').trim().toLowerCase();
  const pwd = document.getElementById('riPwd').value;
  const pwd2 = document.getElementById('riPwd2').value;
  if(!name||!username||!email||!pwd){ toast('Preencha todos os campos','err'); return; }
  if(pwd.length<4){ toast('Senha muito curta','err'); return; }
  if(pwd !== pwd2){ toast('Senhas não conferem','err'); return; }
  if(DB.users.some(u=>(u.email||'').toLowerCase()===email)){ toast('E-mail já cadastrado','err'); return; }
  if(DB.users.some(u=>(u.username||'').toLowerCase()===username)){ toast('Usuário já cadastrado','err'); return; }
  const h = await hashPassword(pwd);
  const newUser = {id:uid('u'), name, username, email, role:'master', passwordHash:h, createdAt:new Date().toISOString()};
  DB.users.push(newUser);
  saveDB();
  sessionStorage.setItem(SESSION_KEY, newUser.id);
  localStorage.setItem(LAST_USER_KEY, newUser.id);
  currentUser = newUser;
  toast('Cadastro realizado ✓');
  postAuth();
}

function logout(){
  sessionStorage.removeItem(SESSION_KEY);
  currentUser = null; activeCompanyId = null;
  showAuth();
}

function showAuth(){
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  authShowTab(((DB.users||[]).some(u=>u.passwordHash))?'login':'register');
}

function postAuth(){
  document.getElementById('authScreen').classList.add('hidden');
  if(!DB.org.createdAt || !(DB.companies||[]).length){ showSetup(); return; }
  showApp();
}

function showSetup(){
  document.getElementById('setupScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('setupBody').innerHTML =
    '<div class="label">Tipo de organização</div>'+
    '<div class="grid-2" style="margin-bottom:1rem">'+
      '<label style="padding:1rem;border:2px solid var(--line);border-radius:10px;cursor:pointer;display:block" onclick="setupSelect(\'single\')"><input type="radio" name="setupType" value="single" checked> <strong>🏪 Empresa Única</strong></label>'+
      '<label style="padding:1rem;border:2px solid var(--line);border-radius:10px;cursor:pointer;display:block" onclick="setupSelect(\'group\')"><input type="radio" name="setupType" value="group"> <strong>🏢 Grupo Empresarial</strong></label>'+
    '</div>'+
    '<div id="setupGroupName" style="display:none;margin-bottom:.85rem"><span class="label">Nome do grupo</span><input id="setupGN" class="input" placeholder="Ex.: Grupo Andrade"></div>'+
    '<div style="margin-bottom:.85rem"><span class="label">Nome da primeira empresa *</span><input id="setupName" class="input" placeholder="Ex.: Andrade Transportes Ltda"></div>'+
    '<div style="margin-bottom:.85rem"><span class="label">CNPJ (opcional)</span><div style="display:flex;gap:.5rem"><input id="setupCnpj" class="input" placeholder="00.000.000/0000-00" style="flex:1" oninput="this.value=fmtCnpj(this.value)" maxlength="18"><button class="btn btn-primary" onclick="setupBuscarCnpj()">🔍 Buscar</button></div><div id="setupCnpjStatus" style="font-size:.75rem;margin-top:.3rem;min-height:1em"></div></div>'+
    '<button class="btn btn-primary" onclick="finishSetup()" style="width:100%;margin-top:1rem">Finalizar ✓</button>';
}
function setupSelect(t){
  document.getElementById('setupGroupName').style.display = t==='group' ? 'block' : 'none';
  document.querySelectorAll('input[name="setupType"]').forEach(r=>r.checked = r.value===t);
}
async function setupBuscarCnpj(){
  const cnpj = document.getElementById('setupCnpj').value.replace(/\D/g,'');
  if(cnpj.length !== 14){ toast('CNPJ inválido','warn'); return; }
  const status = document.getElementById('setupCnpjStatus');
  status.textContent = 'Consultando...'; status.style.color='#64748b';
  try{
    const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/'+cnpj);
    if(!r.ok) throw new Error('CNPJ não encontrado');
    const d = await r.json();
    document.getElementById('setupName').value = d.nome_fantasia || d.razao_social || '';
    status.innerHTML = '✓ '+escapeHtml(d.razao_social||'');
    status.style.color = '#15803d';
    window._setupCnpjData = d;
  }catch(e){ status.textContent = '⚠ '+e.message; status.style.color = '#dc2626'; }
}
function finishSetup(){
  const type = (document.querySelector('input[name="setupType"]:checked')||{}).value || 'single';
  const groupName = (document.getElementById('setupGN')||{}).value || '';
  const name = (document.getElementById('setupName').value||'').trim();
  const cnpj = (document.getElementById('setupCnpj').value||'').trim();
  if(!name){ toast('Informe o nome','err'); return; }
  if(type==='group' && !groupName.trim()){ toast('Informe o nome do grupo','err'); return; }
  DB.org = { type, groupName: groupName.trim(), createdAt: new Date().toISOString() };
  const company = { id:uid('emp'), name, cnpj };
  if(window._setupCnpjData){
    const d = window._setupCnpjData;
    company.razaoSocial = d.razao_social||'';
    company.email = d.email||''; company.phone = d.ddd_telefone_1||'';
    company.address = { zip:d.cep||'', state:d.uf||'', city:d.municipio||'', street:d.logradouro||'', number:d.numero||'', neighborhood:d.bairro||'' };
  }
  DB.companies = [company];
  saveDB();
  toast('Sistema configurado ✓');
  showApp();
}

function showApp(){
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userInfo').innerHTML = '👤 '+escapeHtml(currentUser.name);
  if(DB.org.type === 'single' && DB.companies.length === 1){
    enterCompany(DB.companies[0].id);
  } else {
    activeCompanyId = null;
    updateSidebarBadge();
    navigate('painel');
  }
}
function enterCompany(id){
  activeCompanyId = id;
  updateSidebarBadge();
  navigate('painel');
}
function updateSidebarBadge(){
  const card = document.getElementById('currentCompanyCard');
  const nameEl = document.getElementById('currentCompanyName');
  const kindEl = document.getElementById('currentCompanyKind');
  const btn = document.getElementById('currentCompanySwitchBtn');
  const btnLbl = document.getElementById('currentCompanySwitchLbl');
  const isSingle = DB.org.type === 'single';
  if(activeCompanyId){
    const c = DB.companies.find(x=>x.id===activeCompanyId);
    if(c){
      card.style.display = 'block';
      card.style.background = 'linear-gradient(135deg,#065f46 0%,#10b981 100%)';
      nameEl.textContent = c.name;
      kindEl.textContent = isSingle ? 'Empresa' : 'Empresa atual';
      btn.style.display = isSingle ? 'none' : 'block';
      btnLbl.textContent = 'Trocar empresa';
    }
  } else {
    if(!isSingle && DB.companies.length){
      card.style.display = 'block';
      card.style.background = 'linear-gradient(135deg,#1e293b 0%,#475569 100%)';
      kindEl.textContent = 'Modo Grupo';
      nameEl.textContent = DB.org.groupName || 'Visão Consolidada';
      btn.style.display = 'block';
      btnLbl.textContent = 'Selecionar empresa';
    } else { card.style.display = 'none'; }
  }
}
function onSwitchCompany(){
  if(DB.org.type === 'single') return;
  openCompanySelector();
}
function openCompanySelector(){
  let body = '<div class="grid-2" style="gap:.75rem">';
  DB.companies.forEach(c=>{
    body += '<button onclick="enterCompany(\''+c.id+'\');closeModal()" style="padding:1rem;border:2px solid var(--line);border-radius:10px;background:#fff;cursor:pointer;text-align:left">'+
      '<div style="font-weight:700">'+escapeHtml(c.name)+'</div>'+
      '<div style="font-size:.75rem;color:var(--soft);margin-top:.25rem">'+escapeHtml(c.cnpj||'(sem CNPJ)')+'</div>'+
    '</button>';
  });
  body += '</div>';
  if(currentUser && currentUser.role === 'master'){
    body += '<div style="margin-top:1rem;text-align:center"><button class="btn btn-secondary" onclick="activeCompanyId=null;updateSidebarBadge();navigate(\'painel\');closeModal()">📊 Visão consolidada do grupo</button></div>';
  }
  openModal('Selecionar empresa', body, null, 'lg');
  setTimeout(()=>{ const sb=document.getElementById('modalSaveBtn'); if(sb) sb.style.display='none'; }, 30);
}

function navigate(route){
  document.querySelectorAll('.nav-item').forEach(n=>{
    n.classList.toggle('active', n.dataset.route===route);
    if(n.dataset.route===route){ n.onclick = ()=>navigate(route); }
  });
  const r = ROUTES[route] || renderPainel;
  r();
}
document.addEventListener('click', (e)=>{
  const item = e.target.closest('.nav-item[data-route]');
  if(item){ navigate(item.dataset.route); }
});

function currentCompany(){ return activeCompanyId ? DB.companies.find(c=>c.id===activeCompanyId) : null; }

const ROUTES = {};

/* PAINEL */
function renderPainel(){
  const c = currentCompany();
  const root = document.getElementById('content');
  const totalR = (DB.entries||[]).filter(e=>e.type==='receita' && (!c||e.companyId===c.id)).reduce((s,e)=>s+Number(e.amount||0),0);
  const totalD = (DB.entries||[]).filter(e=>e.type==='despesa' && (!c||e.companyId===c.id)).reduce((s,e)=>s+Number(e.amount||0),0);
  const lucro = totalR - totalD;
  const lics = (DB.bids||[]).filter(b=>!c||b.companyId===c.id).length;
  const cons = (DB.contracts||[]).filter(x=>!c||x.companyId===c.id).length;
  const certs = (DB.certifications||[]).filter(x=>!c||x.companyId===c.id);
  const certsVenc = certs.filter(d=>d.validade && new Date(d.validade) < new Date()).length;
  let html = '<h1 style="font-size:1.75rem;font-weight:800;margin-bottom:.25rem">📋 Painel</h1>';
  html += '<p style="color:var(--soft);margin-bottom:1.5rem">'+(c?escapeHtml(c.name):'Visão consolidada')+'</p>';
  html += '<div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;margin-bottom:1.5rem">'+
    '<div class="kpi" style="border-left-color:#16a34a"><div class="label">Receitas</div><div style="font-size:1.4rem;font-weight:800;color:#16a34a">'+fmtMoney(totalR)+'</div></div>'+
    '<div class="kpi" style="border-left-color:#dc2626"><div class="label">Despesas</div><div style="font-size:1.4rem;font-weight:800;color:#dc2626">'+fmtMoney(totalD)+'</div></div>'+
    '<div class="kpi"><div class="label">Resultado</div><div style="font-size:1.4rem;font-weight:800;color:'+(lucro>=0?'#16a34a':'#dc2626')+'">'+fmtMoney(lucro)+'</div></div>'+
    '<div class="kpi" style="border-left-color:#1e40af"><div class="label">Licitações</div><div style="font-size:1.4rem;font-weight:800;color:#1e40af">'+lics+'</div></div>'+
    '<div class="kpi" style="border-left-color:#7c3aed"><div class="label">Contratos</div><div style="font-size:1.4rem;font-weight:800;color:#7c3aed">'+cons+'</div></div>'+
    '<div class="kpi" style="border-left-color:'+(certsVenc?'#dc2626':'#16a34a')+'"><div class="label">Certidões</div><div style="font-size:1.4rem;font-weight:800">'+certs.length+(certsVenc?' <span style="color:#dc2626;font-size:.8rem">('+certsVenc+' venc)</span>':'')+'</div></div>'+
  '</div>';
  html += '<div class="card"><h2 style="font-weight:700;margin-bottom:1rem">Acesso rápido</h2>'+
    '<div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem">'+
      '<button class="btn btn-secondary" data-route="cadastros" style="padding:1rem;flex-direction:column;cursor:pointer">📁<br>Cadastros</button>'+
      '<button class="btn btn-secondary" data-route="gestao" style="padding:1rem;flex-direction:column;cursor:pointer">⚖️<br>Gestão</button>'+
      '<button class="btn btn-secondary" data-route="financeiro" style="padding:1rem;flex-direction:column;cursor:pointer">💰<br>Financeiro</button>'+
      '<button class="btn btn-secondary" data-route="rh" style="padding:1rem;flex-direction:column;cursor:pointer">👥<br>RH</button>'+
      '<button class="btn btn-secondary" data-route="config" style="padding:1rem;flex-direction:column;cursor:pointer">⚙️<br>Config</button>'+
    '</div></div>';
  root.innerHTML = html;
}
ROUTES.painel = renderPainel;

/* CADASTROS */
let _cadTab = 'empresas';
function setCadTab(t){ _cadTab = t; renderCadastros(); }
function renderCadastros(){
  const root = document.getElementById('content');
  const tab = (id,lbl,icon)=>'<button class="tab-btn '+(_cadTab===id?'active':'')+'" onclick="setCadTab(\''+id+'\')">'+icon+' '+lbl+'</button>';
  let html = '<h1 style="font-size:1.75rem;font-weight:800;margin-bottom:1rem">📁 Cadastros</h1>';
  html += '<div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">'+tab('empresas','Empresas','🏢')+tab('contas','Contas','🏦')+tab('categorias','Categorias','🏷️')+tab('partners','Forn/Clientes','👥')+tab('usuarios','Usuários','👤')+'</div>';
  if(_cadTab==='empresas') html += renderEmpresas();
  else if(_cadTab==='contas') html += renderContas();
  else if(_cadTab==='categorias') html += renderCategorias();
  else if(_cadTab==='partners') html += renderPartners();
  else if(_cadTab==='usuarios') html += renderUsuarios();
  root.innerHTML = html;
}
ROUTES.cadastros = renderCadastros;

function renderEmpresas(){
  let h = '<div class="card"><div style="display:flex;align-items:center;margin-bottom:1rem"><h2 style="font-weight:700;flex:1">Empresas ('+DB.companies.length+')</h2><button class="btn btn-primary" onclick="editEmpresa()">+ Nova empresa</button></div>';
  if(!DB.companies.length){ h += '<div style="padding:2rem;text-align:center;color:var(--soft)">Nenhuma empresa cadastrada</div>'; }
  else {
    h += '<table><thead><tr><th>Empresa</th><th>CNPJ</th><th>Cidade/UF</th><th></th></tr></thead><tbody>';
    DB.companies.forEach(c=>{
      const a = c.address||{};
      h += '<tr><td><strong>'+escapeHtml(c.name)+'</strong>'+(c.razaoSocial?'<div style="font-size:.75rem;color:var(--soft)">'+escapeHtml(c.razaoSocial)+'</div>':'')+'</td><td>'+escapeHtml(c.cnpj||'—')+'</td><td>'+escapeHtml(a.city||'—')+(a.state?'/'+escapeHtml(a.state):'')+'</td><td style="text-align:right;white-space:nowrap"><button class="btn btn-ghost" onclick="editEmpresa(\''+c.id+'\')">✏️</button><button class="btn btn-ghost" onclick="delEmpresa(\''+c.id+'\')">🗑️</button></td></tr>';
    });
    h += '</tbody></table>';
  }
  return h + '</div>';
}
function editEmpresa(id){
  const base = id ? DB.companies.find(c=>c.id===id) : null;
  const c = base || { name:'', cnpj:'', razaoSocial:'', email:'', phone:'', address:{} };
  if(!c.address) c.address = {};
  const html = '<div style="margin-bottom:.75rem"><span class="label">CNPJ</span><div style="display:flex;gap:.5rem"><input id="emCnpj" class="input" placeholder="00.000.000/0000-00" style="flex:1" value="'+escapeHtml(c.cnpj||'')+'" oninput="this.value=fmtCnpj(this.value)" maxlength="18"><button class="btn btn-primary" onclick="emBuscarCnpj()">🔍 Buscar</button></div><div id="emCnpjStatus" style="font-size:.75rem;margin-top:.3rem;min-height:1em"></div></div>'+
    '<div style="margin-bottom:.75rem"><span class="label">Nome Fantasia *</span><input id="emName" class="input" value="'+escapeHtml(c.name||'')+'"></div>'+
    '<div style="margin-bottom:.75rem"><span class="label">Razão Social</span><input id="emRazao" class="input" value="'+escapeHtml(c.razaoSocial||'')+'"></div>'+
    '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">E-mail</span><input id="emEmail" type="email" class="input" value="'+escapeHtml(c.email||'')+'"></div><div><span class="label">Telefone</span><input id="emPhone" class="input" value="'+escapeHtml(c.phone||'')+'"></div></div>'+
    '<div class="grid-2"><div><span class="label">Cidade</span><input id="emCity" class="input" value="'+escapeHtml(c.address.city||'')+'"></div><div><span class="label">UF</span><input id="emUf" class="input" maxlength="2" value="'+escapeHtml(c.address.state||'')+'"></div></div>';
  openModal(id?'Editar empresa':'Nova empresa', html, ()=>{
    const name = document.getElementById('emName').value.trim();
    if(!name){ toast('Informe o nome','err'); return false; }
    const data = { name, cnpj: document.getElementById('emCnpj').value.trim(), razaoSocial: document.getElementById('emRazao').value.trim(), email: document.getElementById('emEmail').value.trim(), phone: document.getElementById('emPhone').value.trim(), address: Object.assign({}, c.address, { city: document.getElementById('emCity').value.trim(), state: document.getElementById('emUf').value.trim().toUpperCase() }) };
    if(id){ Object.assign(base, data); } else { DB.companies.push(Object.assign({id:uid('emp')}, data)); }
    saveDB(); toast('Salvo ✓'); renderCadastros();
  });
}
async function emBuscarCnpj(){
  const cnpj = document.getElementById('emCnpj').value.replace(/\D/g,'');
  if(cnpj.length!==14){ toast('CNPJ inválido','warn'); return; }
  const status = document.getElementById('emCnpjStatus');
  status.textContent = 'Consultando...'; status.style.color='#64748b';
  try{
    const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/'+cnpj);
    if(!r.ok) throw new Error('Não encontrado');
    const d = await r.json();
    document.getElementById('emName').value = d.nome_fantasia || d.razao_social || '';
    document.getElementById('emRazao').value = d.razao_social || '';
    document.getElementById('emEmail').value = d.email || '';
    document.getElementById('emPhone').value = d.ddd_telefone_1 || '';
    document.getElementById('emCity').value = d.municipio || '';
    document.getElementById('emUf').value = d.uf || '';
    status.innerHTML = '✓ '+escapeHtml(d.razao_social||'');
    status.style.color = '#15803d';
  }catch(e){ status.textContent = '⚠ '+e.message; status.style.color='#dc2626'; }
}
function delEmpresa(id){
  if(!confirm('Excluir?')) return;
  if(DB.companies.length === 1){ toast('Não pode excluir a única empresa','warn'); return; }
  DB.companies = DB.companies.filter(c=>c.id!==id);
  if(activeCompanyId === id) activeCompanyId = null;
  saveDB(); toast('Excluída'); renderCadastros();
}

function renderContas(){
  const c = currentCompany();
  const list = (DB.accounts||[]).filter(a=>!c||a.companyId===c.id);
  let h = '<div class="card"><div style="display:flex;align-items:center;margin-bottom:1rem"><h2 style="font-weight:700;flex:1">Contas ('+list.length+')</h2><button class="btn btn-primary" onclick="editConta()">+ Nova conta</button></div>';
  if(!list.length){ h += '<div style="padding:2rem;text-align:center;color:var(--soft)">Nenhuma conta</div>'; }
  else {
    h += '<table><thead><tr><th>Conta</th><th>Tipo</th><th>Saldo</th><th></th></tr></thead><tbody>';
    list.forEach(a=>{ h += '<tr><td><strong>'+escapeHtml(a.name)+'</strong></td><td>'+escapeHtml(a.type||'—')+'</td><td>'+fmtMoney(a.balance||0)+'</td><td style="text-align:right"><button class="btn btn-ghost" onclick="editConta(\''+a.id+'\')">✏️</button><button class="btn btn-ghost" onclick="delConta(\''+a.id+'\')">🗑️</button></td></tr>'; });
    h += '</tbody></table>';
  }
  return h + '</div>';
}
function editConta(id){
  const c = currentCompany();
  const base = id ? DB.accounts.find(a=>a.id===id) : null;
  const a = base || { name:'', type:'corrente', balance:0, companyId: c?c.id:(DB.companies[0]?DB.companies[0].id:'') };
  const compOpts = DB.companies.map(x=>'<option value="'+x.id+'" '+(a.companyId===x.id?'selected':'')+'>'+escapeHtml(x.name)+'</option>').join('');
  const html = '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Empresa</span><select id="acComp" class="input">'+compOpts+'</select></div><div><span class="label">Tipo</span><select id="acType" class="input"><option value="corrente"'+(a.type==='corrente'?' selected':'')+'>Corrente</option><option value="poupanca"'+(a.type==='poupanca'?' selected':'')+'>Poupança</option><option value="caixa"'+(a.type==='caixa'?' selected':'')+'>Caixa</option></select></div></div>'+
    '<div style="margin-bottom:.75rem"><span class="label">Nome *</span><input id="acName" class="input" placeholder="Ex.: Bradesco Cta 12345" value="'+escapeHtml(a.name||'')+'"></div>'+
    '<div><span class="label">Saldo inicial</span><input id="acBal" class="input" value="'+(a.balance||0)+'"></div>';
  openModal(id?'Editar conta':'Nova conta', html, ()=>{
    const name = document.getElementById('acName').value.trim();
    if(!name){ toast('Informe o nome','err'); return false; }
    const data = { name, type:document.getElementById('acType').value, balance:parseBRL(document.getElementById('acBal').value), companyId:document.getElementById('acComp').value };
    if(id){ Object.assign(base, data); } else { DB.accounts.push(Object.assign({id:uid('acc')}, data)); }
    saveDB(); toast('Salvo ✓'); renderCadastros();
  });
}
function delConta(id){ if(!confirm('Excluir?')) return; DB.accounts = DB.accounts.filter(a=>a.id!==id); saveDB(); renderCadastros(); }

function renderCategorias(){
  let h = '<div class="card"><div style="display:flex;align-items:center;margin-bottom:1rem"><h2 style="font-weight:700;flex:1">Categorias ('+DB.categories.length+')</h2><button class="btn btn-primary" onclick="editCategoria()">+ Nova</button></div>';
  h += '<table><thead><tr><th>Nome</th><th>Tipo</th><th></th></tr></thead><tbody>';
  DB.categories.forEach(c=>{ h += '<tr><td>'+escapeHtml(c.name)+'</td><td><span class="badge" style="background:'+(c.type==='receita'?'#dcfce7;color:#15803d':'#fee2e2;color:#dc2626')+'">'+c.type+'</span></td><td style="text-align:right"><button class="btn btn-ghost" onclick="editCategoria(\''+c.id+'\')">✏️</button><button class="btn btn-ghost" onclick="delCategoria(\''+c.id+'\')">🗑️</button></td></tr>'; });
  return h + '</tbody></table></div>';
}
function editCategoria(id){
  const base = id ? DB.categories.find(c=>c.id===id) : null;
  const c = base || { name:'', type:'despesa' };
  const html = '<div style="margin-bottom:.75rem"><span class="label">Nome *</span><input id="ctName" class="input" value="'+escapeHtml(c.name||'')+'"></div><div><span class="label">Tipo</span><select id="ctType" class="input"><option value="receita"'+(c.type==='receita'?' selected':'')+'>Receita</option><option value="despesa"'+(c.type==='despesa'?' selected':'')+'>Despesa</option></select></div>';
  openModal(id?'Editar':'Nova categoria', html, ()=>{
    const name = document.getElementById('ctName').value.trim();
    if(!name){ toast('Informe o nome','err'); return false; }
    const data = { name, type:document.getElementById('ctType').value };
    if(id){ Object.assign(base, data); } else { DB.categories.push(Object.assign({id:uid('cat')}, data)); }
    saveDB(); toast('Salvo ✓'); renderCadastros();
  });
}
function delCategoria(id){ if(!confirm('Excluir?')) return; DB.categories = DB.categories.filter(c=>c.id!==id); saveDB(); renderCadastros(); }

function renderPartners(){
  let h = '<div class="card"><div style="display:flex;align-items:center;margin-bottom:1rem"><h2 style="font-weight:700;flex:1">Fornecedores e Clientes ('+DB.partners.length+')</h2><button class="btn btn-primary" onclick="editPartner()">+ Novo</button></div>';
  if(!DB.partners.length){ h += '<div style="padding:2rem;text-align:center;color:var(--soft)">Nenhum cadastrado</div>'; }
  else {
    h += '<table><thead><tr><th>Nome</th><th>CNPJ/CPF</th><th>Tipo</th><th></th></tr></thead><tbody>';
    DB.partners.forEach(p=>{ h += '<tr><td><strong>'+escapeHtml(p.name)+'</strong></td><td>'+escapeHtml(p.cnpj||'—')+'</td><td>'+escapeHtml(p.kind||'ambos')+'</td><td style="text-align:right"><button class="btn btn-ghost" onclick="editPartner(\''+p.id+'\')">✏️</button><button class="btn btn-ghost" onclick="delPartner(\''+p.id+'\')">🗑️</button></td></tr>'; });
    h += '</tbody></table>';
  }
  return h + '</div>';
}
function editPartner(id){
  const base = id ? DB.partners.find(p=>p.id===id) : null;
  const p = base || { name:'', cnpj:'', email:'', phone:'', kind:'ambos' };
  const html = '<div style="margin-bottom:.75rem"><span class="label">Nome *</span><input id="pName" class="input" value="'+escapeHtml(p.name||'')+'"></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">CNPJ/CPF</span><input id="pCnpj" class="input" value="'+escapeHtml(p.cnpj||'')+'"></div><div><span class="label">Tipo</span><select id="pKind" class="input"><option value="fornecedor"'+(p.kind==='fornecedor'?' selected':'')+'>Fornecedor</option><option value="cliente"'+(p.kind==='cliente'?' selected':'')+'>Cliente</option><option value="ambos"'+(p.kind==='ambos'?' selected':'')+'>Ambos</option></select></div></div><div class="grid-2"><div><span class="label">E-mail</span><input id="pEmail" class="input" value="'+escapeHtml(p.email||'')+'"></div><div><span class="label">Telefone</span><input id="pPhone" class="input" value="'+escapeHtml(p.phone||'')+'"></div></div>';
  openModal(id?'Editar':'Novo', html, ()=>{
    const name = document.getElementById('pName').value.trim();
    if(!name){ toast('Informe o nome','err'); return false; }
    const data = { name, cnpj:document.getElementById('pCnpj').value.trim(), email:document.getElementById('pEmail').value.trim(), phone:document.getElementById('pPhone').value.trim(), kind:document.getElementById('pKind').value };
    if(id){ Object.assign(base, data); } else { DB.partners.push(Object.assign({id:uid('p')}, data)); }
    saveDB(); toast('Salvo ✓'); renderCadastros();
  });
}
function delPartner(id){ if(!confirm('Excluir?')) return; DB.partners = DB.partners.filter(p=>p.id!==id); saveDB(); renderCadastros(); }

function renderUsuarios(){
  let h = '<div class="card"><h2 style="font-weight:700;margin-bottom:1rem">Usuários ('+DB.users.length+')</h2>';
  h += '<table><thead><tr><th>Nome</th><th>Usuário/E-mail</th><th>Perfil</th></tr></thead><tbody>';
  DB.users.forEach(u=>{ h += '<tr><td><strong>'+escapeHtml(u.name)+'</strong></td><td>'+escapeHtml(u.username||u.email||'')+'</td><td><span class="badge" style="background:#eef2ff;color:#3730a3">'+escapeHtml(u.role||'master')+'</span></td></tr>'; });
  return h + '</tbody></table></div>';
}

/* GESTÃO */
let _gestaoTab = 'licitacoes';
function setGestaoTab(t){ _gestaoTab = t; renderGestao(); }
const BID_STATUS = [{v:'aberto',l:'Aberto',c:'#0284c7'},{v:'proposta',l:'Proposta',c:'#7c3aed'},{v:'vencida',l:'Vencida',c:'#16a34a'},{v:'perdida',l:'Perdida',c:'#dc2626'}];
const CONTRACT_STATUS = [{v:'vigente',l:'Vigente',c:'#16a34a'},{v:'emergencial',l:'⚠️ Emergencial',c:'#dc2626'},{v:'aditivo',l:'Em aditivo',c:'#0284c7'},{v:'encerrado',l:'Encerrado',c:'#64748b'}];

function renderGestao(){
  const root = document.getElementById('content');
  const tab = (id,lbl,icon)=>'<button class="tab-btn '+(_gestaoTab===id?'active':'')+'" onclick="setGestaoTab(\''+id+'\')">'+icon+' '+lbl+'</button>';
  let html = '<h1 style="font-size:1.75rem;font-weight:800;margin-bottom:1rem">⚖️ Gestão</h1>';
  html += '<div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">'+tab('licitacoes','Licitações','⚖️')+tab('contratos','Contratos','📜')+tab('certidoes','Certidões','📑')+'</div>';
  if(_gestaoTab==='licitacoes') html += renderLicitacoes();
  else if(_gestaoTab==='contratos') html += renderContratos();
  else if(_gestaoTab==='certidoes') html += renderCertidoes();
  root.innerHTML = html;
}
ROUTES.gestao = renderGestao;

function renderLicitacoes(){
  const c = currentCompany();
  const list = (DB.bids||[]).filter(b=>!c||b.companyId===c.id);
  let h = '<div class="card"><div style="display:flex;align-items:center;margin-bottom:1rem"><h2 style="font-weight:700;flex:1">Licitações & Editais ('+list.length+')</h2><button class="btn btn-primary" onclick="editBid()">+ Nova licitação</button></div>';
  if(!list.length){ h += '<div style="padding:2rem;text-align:center;color:var(--soft)">Nenhuma licitação</div>'; }
  else {
    h += '<table><thead><tr><th>Nº/Objeto</th><th>Órgão</th><th>Modalidade</th><th>Data</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>';
    list.forEach(b=>{
      const st = BID_STATUS.find(s=>s.v===b.status) || BID_STATUS[0];
      h += '<tr><td><strong>'+escapeHtml(b.numero||'—')+'</strong><div style="font-size:.75rem;color:var(--soft);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(b.objeto||'')+'</div></td><td>'+escapeHtml(b.orgao||'—')+'</td><td>'+escapeHtml(b.modalidade||'—')+'</td><td>'+(b.dataSessao? new Date(b.dataSessao).toLocaleDateString('pt-BR'):'—')+'</td><td>'+fmtMoney(b.valor||0)+'</td><td><span class="badge" style="background:'+st.c+'22;color:'+st.c+'">'+st.l+'</span></td><td style="text-align:right"><button class="btn btn-ghost" onclick="editBid(\''+b.id+'\')">✏️</button><button class="btn btn-ghost" onclick="delBid(\''+b.id+'\')">🗑️</button></td></tr>';
    });
    h += '</tbody></table>';
  }
  return h + '</div>';
}
function editBid(id){
  const c = currentCompany();
  const base = id ? DB.bids.find(b=>b.id===id) : null;
  const b = base || { numero:'', objeto:'', orgao:'', modalidade:'pregao_eletronico', dataSessao:'', valor:0, status:'aberto', companyId: c?c.id:(DB.companies[0]?DB.companies[0].id:''), observacoes:'' };
  const compOpts = DB.companies.map(x=>'<option value="'+x.id+'" '+(b.companyId===x.id?'selected':'')+'>'+escapeHtml(x.name)+'</option>').join('');
  const stOpts = BID_STATUS.map(s=>'<option value="'+s.v+'" '+(b.status===s.v?'selected':'')+'>'+s.l+'</option>').join('');
  const html = '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Empresa</span><select id="bdComp" class="input">'+compOpts+'</select></div><div><span class="label">Nº edital</span><input id="bdNum" class="input" value="'+escapeHtml(b.numero||'')+'"></div></div><div style="margin-bottom:.75rem"><span class="label">Objeto *</span><textarea id="bdObj" class="input" rows="2">'+escapeHtml(b.objeto||'')+'</textarea></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Órgão</span><input id="bdOrg" class="input" value="'+escapeHtml(b.orgao||'')+'"></div><div><span class="label">Modalidade</span><select id="bdMod" class="input">'+['pregao_eletronico','cotacao_eletronica','dispensa','dispensa_emergencial','indenizacao','concorrencia'].map(m=>'<option value="'+m+'" '+(b.modalidade===m?'selected':'')+'>'+m.replace(/_/g,' ')+'</option>').join('')+'</select></div></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Data sessão</span><input id="bdData" type="date" class="input" value="'+escapeHtml(b.dataSessao||'')+'"></div><div><span class="label">Valor estimado</span><input id="bdVal" class="input" value="'+(b.valor||0)+'"></div></div><div style="margin-bottom:.75rem"><span class="label">Status</span><select id="bdSt" class="input">'+stOpts+'</select></div><div><span class="label">Observações</span><textarea id="bdObs" class="input" rows="2">'+escapeHtml(b.observacoes||'')+'</textarea></div>';
  openModal(id?'Editar licitação':'Nova licitação', html, ()=>{
    const obj = document.getElementById('bdObj').value.trim();
    if(!obj){ toast('Informe o objeto','err'); return false; }
    const data = { companyId:document.getElementById('bdComp').value, numero:document.getElementById('bdNum').value.trim(), objeto:obj, orgao:document.getElementById('bdOrg').value.trim(), modalidade:document.getElementById('bdMod').value, dataSessao:document.getElementById('bdData').value, valor:parseBRL(document.getElementById('bdVal').value), status:document.getElementById('bdSt').value, observacoes:document.getElementById('bdObs').value.trim() };
    if(id){ Object.assign(base, data); } else { DB.bids.push(Object.assign({id:uid('bid'), createdAt:new Date().toISOString()}, data)); }
    saveDB(); toast('Salvo ✓'); renderGestao();
  }, 'lg');
}
function delBid(id){ if(!confirm('Excluir?')) return; DB.bids = DB.bids.filter(b=>b.id!==id); saveDB(); renderGestao(); }

function renderContratos(){
  const c = currentCompany();
  const list = (DB.contracts||[]).filter(x=>!c||x.companyId===c.id);
  let h = '<div class="card"><div style="display:flex;align-items:center;margin-bottom:1rem"><h2 style="font-weight:700;flex:1">Contratos & Aditivos ('+list.length+')</h2><button class="btn btn-primary" onclick="editContract()">+ Novo contrato</button></div>';
  if(!list.length){ h += '<div style="padding:2rem;text-align:center;color:var(--soft)">Nenhum contrato</div>'; }
  else {
    h += '<table><thead><tr><th>Nº/Objeto</th><th>Contratante</th><th>Vigência</th><th>Valor</th><th>Aditivos</th><th>Status</th><th></th></tr></thead><tbody>';
    list.forEach(x=>{
      const st = CONTRACT_STATUS.find(s=>s.v===x.status) || CONTRACT_STATUS[0];
      const ads = (x.aditivos||[]).length;
      h += '<tr><td><strong>'+escapeHtml(x.numero||'—')+'</strong><div style="font-size:.75rem;color:var(--soft);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+escapeHtml(x.objeto||'')+'</div></td><td>'+escapeHtml(x.contratante||'—')+'</td><td style="font-size:.8rem">'+(x.dataInicio? new Date(x.dataInicio).toLocaleDateString('pt-BR'):'—')+' → '+(x.dataFim? new Date(x.dataFim).toLocaleDateString('pt-BR'):'—')+'</td><td>'+fmtMoney(x.valorAtual||x.valor||0)+'</td><td style="text-align:center">'+(ads?'<span class="badge" style="background:#eef2ff;color:#3730a3">'+ads+'</span>':'—')+'</td><td><span class="badge" style="background:'+st.c+'22;color:'+st.c+'">'+st.l+'</span></td><td style="text-align:right;white-space:nowrap"><button class="btn btn-ghost" onclick="editContract(\''+x.id+'\')">✏️</button><button class="btn btn-ghost" onclick="manageAditivos(\''+x.id+'\')">➕</button><button class="btn btn-ghost" onclick="delContract(\''+x.id+'\')">🗑️</button></td></tr>';
    });
    h += '</tbody></table>';
  }
  return h + '</div>';
}
function editContract(id){
  const c = currentCompany();
  const base = id ? DB.contracts.find(x=>x.id===id) : null;
  const x = base || { numero:'', objeto:'', contratante:'', dataInicio:'', dataFim:'', valor:0, valorAtual:0, status:'vigente', companyId: c?c.id:(DB.companies[0]?DB.companies[0].id:''), aditivos:[], observacoes:'' };
  const compOpts = DB.companies.map(co=>'<option value="'+co.id+'" '+(x.companyId===co.id?'selected':'')+'>'+escapeHtml(co.name)+'</option>').join('');
  const stOpts = CONTRACT_STATUS.map(s=>'<option value="'+s.v+'" '+(x.status===s.v?'selected':'')+'>'+s.l+'</option>').join('');
  const html = '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Empresa</span><select id="ctComp" class="input">'+compOpts+'</select></div><div><span class="label">Nº contrato</span><input id="ctNum" class="input" value="'+escapeHtml(x.numero||'')+'"></div></div><div style="margin-bottom:.75rem"><span class="label">Objeto *</span><textarea id="ctObj" class="input" rows="2">'+escapeHtml(x.objeto||'')+'</textarea></div><div style="margin-bottom:.75rem"><span class="label">Contratante</span><input id="ctCon" class="input" value="'+escapeHtml(x.contratante||'')+'"></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Início</span><input id="ctIni" type="date" class="input" value="'+escapeHtml(x.dataInicio||'')+'"></div><div><span class="label">Fim</span><input id="ctFim" type="date" class="input" value="'+escapeHtml(x.dataFim||'')+'"></div></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Valor original</span><input id="ctVal" class="input" value="'+(x.valor||0)+'"></div><div><span class="label">Valor atual</span><input id="ctValAt" class="input" value="'+(x.valorAtual||x.valor||0)+'"></div></div><div style="margin-bottom:.75rem"><span class="label">Status</span><select id="ctSt" class="input">'+stOpts+'</select></div><div><span class="label">Observações</span><textarea id="ctObs" class="input" rows="2">'+escapeHtml(x.observacoes||'')+'</textarea></div>';
  openModal(id?'Editar contrato':'Novo contrato', html, ()=>{
    const obj = document.getElementById('ctObj').value.trim();
    if(!obj){ toast('Informe o objeto','err'); return false; }
    const data = { companyId:document.getElementById('ctComp').value, numero:document.getElementById('ctNum').value.trim(), objeto:obj, contratante:document.getElementById('ctCon').value.trim(), dataInicio:document.getElementById('ctIni').value, dataFim:document.getElementById('ctFim').value, valor:parseBRL(document.getElementById('ctVal').value), valorAtual:parseBRL(document.getElementById('ctValAt').value), status:document.getElementById('ctSt').value, observacoes:document.getElementById('ctObs').value.trim() };
    if(id){ Object.assign(base, data); } else { DB.contracts.push(Object.assign({id:uid('ctr'), createdAt:new Date().toISOString(), aditivos:[]}, data)); }
    saveDB(); toast('Salvo ✓'); renderGestao();
  }, 'lg');
}
function delContract(id){ if(!confirm('Excluir?')) return; DB.contracts = DB.contracts.filter(x=>x.id!==id); saveDB(); renderGestao(); }

function manageAditivos(cid){
  const c = DB.contracts.find(x=>x.id===cid);
  if(!c) return;
  if(!Array.isArray(c.aditivos)) c.aditivos = [];
  let body = '<div style="margin-bottom:.85rem">Contrato: <strong>'+escapeHtml(c.numero||'')+'</strong></div><button class="btn btn-primary" onclick="addAditivo(\''+cid+'\')" style="margin-bottom:.85rem">+ Novo aditivo</button>';
  if(!c.aditivos.length){ body += '<div style="padding:1.5rem;text-align:center;color:var(--soft);border:1px dashed var(--line);border-radius:8px">Nenhum aditivo</div>'; }
  else {
    body += '<table><thead><tr><th>Nº</th><th>Natureza</th><th>Data</th><th>Valor</th><th>Prazo</th><th>Objeto</th><th></th></tr></thead><tbody>';
    c.aditivos.forEach((a,i)=>{
      const nat = a.natureza || 'valor';
      const cor = {valor:'#16a34a',prazo:'#0284c7',misto:'#7c3aed'}[nat]||'#64748b';
      const lbl = {valor:'💰 Valor',prazo:'⏱️ Prazo',misto:'🔀 Misto'}[nat] || nat;
      body += '<tr><td>'+escapeHtml(a.numero||(i+1))+'</td><td><span class="badge" style="background:'+cor+'22;color:'+cor+'">'+lbl+'</span></td><td>'+(a.data? new Date(a.data).toLocaleDateString('pt-BR'):'—')+'</td><td>'+(nat==='valor'||nat==='misto'? fmtMoney(a.valor||0):'—')+'</td><td>'+(nat==='prazo'||nat==='misto'? (a.novoTermino? new Date(a.novoTermino).toLocaleDateString('pt-BR'): (a.diasProrrogacao?'+'+a.diasProrrogacao+'d':'—')):'—')+'</td><td style="font-size:.75rem;max-width:160px">'+escapeHtml(a.objeto||'')+'</td><td><button class="btn btn-ghost" onclick="editAditivo(\''+cid+'\','+i+')">✏️</button><button class="btn btn-ghost" onclick="removeAditivo(\''+cid+'\','+i+')">🗑️</button></td></tr>';
    });
    body += '</tbody></table>';
  }
  openModal('Aditivos', body, null, 'lg');
  setTimeout(()=>{ const sb=document.getElementById('modalSaveBtn'); if(sb) sb.style.display='none'; }, 30);
}
function addAditivo(cid){ closeModal(); editAditivo(cid,-1); }
function editAditivo(cid, idx){
  const c = DB.contracts.find(x=>x.id===cid);
  if(!c) return;
  if(!Array.isArray(c.aditivos)) c.aditivos = [];
  const isNew = idx<0;
  const a = isNew ? {numero:String(c.aditivos.length+1), natureza:'valor', data:'', valor:0, diasProrrogacao:0, novoTermino:'', objeto:'', baseLegal:''} : c.aditivos[idx];
  const html = '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Nº</span><input id="adNum" class="input" value="'+escapeHtml(a.numero||'')+'"></div><div><span class="label">Natureza (Lei 14.133/21)</span><select id="adNat" class="input" onchange="toggleAdFields(this.value)">'+[{v:'valor',l:'💰 Valor (art. 125)'},{v:'prazo',l:'⏱️ Prazo (art. 107)'},{v:'misto',l:'🔀 Misto'}].map(n=>'<option value="'+n.v+'" '+(a.natureza===n.v?'selected':'')+'>'+n.l+'</option>').join('')+'</select></div></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Data</span><input id="adData" type="date" class="input" value="'+escapeHtml(a.data||'')+'"></div><div><span class="label">Base legal</span><input id="adBase" class="input" value="'+escapeHtml(a.baseLegal||'')+'"></div></div><div id="adValorField" style="display:'+((a.natureza==='valor'||a.natureza==='misto'||!a.natureza)?'block':'none')+';margin-bottom:.75rem"><span class="label">💰 Valor</span><input id="adVal" class="input" value="'+(a.valor||0)+'"></div><div id="adPrazoField" style="display:'+((a.natureza==='prazo'||a.natureza==='misto')?'block':'none')+';margin-bottom:.75rem"><div class="grid-2"><div><span class="label">⏱️ Dias prorrogação</span><input id="adDias" type="number" class="input" value="'+(a.diasProrrogacao||0)+'"></div><div><span class="label">Novo término</span><input id="adNT" type="date" class="input" value="'+escapeHtml(a.novoTermino||'')+'"></div></div></div><div><span class="label">Objeto/Justificativa</span><textarea id="adObj" class="input" rows="3">'+escapeHtml(a.objeto||'')+'</textarea></div>';
  openModal(isNew?'Novo aditivo':'Editar aditivo', html, ()=>{
    const data = { numero:document.getElementById('adNum').value.trim(), natureza:document.getElementById('adNat').value, data:document.getElementById('adData').value, baseLegal:document.getElementById('adBase').value.trim(), valor:parseBRL(document.getElementById('adVal').value), diasProrrogacao:parseInt(document.getElementById('adDias').value)||0, novoTermino:document.getElementById('adNT').value, objeto:document.getElementById('adObj').value.trim() };
    if(data.natureza==='prazo' && !data.diasProrrogacao && !data.novoTermino){ toast('Aditivo de prazo: informe dias ou novo término','err'); return false; }
    if(data.natureza==='valor' && !data.valor){ toast('Aditivo de valor: informe o valor','err'); return false; }
    if(isNew) c.aditivos.push(data); else Object.assign(c.aditivos[idx], data);
    if((data.natureza==='prazo'||data.natureza==='misto') && data.novoTermino) c.dataFim = data.novoTermino;
    const soma = c.aditivos.reduce((s,x)=>s+Number(x.valor||0),0);
    c.valorAtual = Number(c.valor||0)+soma;
    saveDB(); toast('Salvo ✓'); closeModal(); manageAditivos(cid);
  });
}
function toggleAdFields(nat){
  document.getElementById('adValorField').style.display = (nat==='valor'||nat==='misto')?'block':'none';
  document.getElementById('adPrazoField').style.display = (nat==='prazo'||nat==='misto')?'block':'none';
  const base = document.getElementById('adBase');
  if(base && !base.value.trim()){ base.value = {valor:'Art. 125 da Lei 14.133/21',prazo:'Art. 107 da Lei 14.133/21',misto:'Art. 124 e 125 da Lei 14.133/21'}[nat] || ''; }
}
function removeAditivo(cid, idx){
  if(!confirm('Remover?')) return;
  const c = DB.contracts.find(x=>x.id===cid);
  c.aditivos.splice(idx,1);
  const soma = c.aditivos.reduce((s,x)=>s+Number(x.valor||0),0);
  c.valorAtual = Number(c.valor||0)+soma;
  saveDB(); closeModal(); manageAditivos(cid);
}

/* CERTIDÕES */
function _docDays(d){ if(!d.validade) return null; return Math.floor((new Date(d.validade) - new Date(new Date().setHours(0,0,0,0)))/(1000*60*60*24)); }
function _docStatus(d){
  if(!d.validade) return {l:'Permanente', c:'#64748b', bg:'#f1f5f9', k:'perm'};
  const days = _docDays(d);
  if(days<0) return {l:'Vencida', c:'#dc2626', bg:'#fee2e2', k:'venc'};
  if(days<=30) return {l:'A vencer', c:'#d97706', bg:'#fef3c7', k:'avenc'};
  return {l:'Válida', c:'#15803d', bg:'#dcfce7', k:'val'};
}
function renderCertidoes(){
  const c = currentCompany();
  const list = (DB.certifications||[]).filter(x=>!c||x.companyId===c.id);
  const val = list.filter(d=>_docStatus(d).k==='val').length;
  const av = list.filter(d=>_docStatus(d).k==='avenc').length;
  const venc = list.filter(d=>_docStatus(d).k==='venc').length;
  let h = '<div class="card" style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);color:#fff;border:none;margin-bottom:1rem"><div style="display:flex;align-items:center;gap:1rem"><div style="flex:1"><div style="font-size:.7rem;letter-spacing:.18em;opacity:.85">Gestão</div><h2 style="font-size:1.4rem;font-weight:800">📑 Documentos e Certidões</h2><div style="font-size:.85rem;opacity:.9">Controle de validade</div></div><button class="btn" onclick="editCert()" style="background:#fff;color:#1e3a8a;font-weight:700">+ Upload</button></div></div>';
  h += '<div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1rem"><div class="kpi" style="border-left-color:#16a34a"><div class="label">Válidas</div><div style="font-size:1.4rem;font-weight:800;color:#16a34a">'+val+'</div></div><div class="kpi" style="border-left-color:#d97706"><div class="label">A vencer (30d)</div><div style="font-size:1.4rem;font-weight:800;color:#d97706">'+av+'</div></div><div class="kpi" style="border-left-color:#dc2626"><div class="label">Vencidas</div><div style="font-size:1.4rem;font-weight:800;color:#dc2626">'+venc+'</div></div><div class="kpi"><div class="label">Total</div><div style="font-size:1.4rem;font-weight:800">'+list.length+'</div></div></div>';
  if(!list.length){ h += '<div class="card" style="padding:2rem;text-align:center;color:var(--soft)">Nenhum documento</div>'; return h; }
  h += '<div class="card" style="padding:0;overflow-x:auto"><table><thead><tr><th>Documento</th><th>Tipo</th><th>Emissão</th><th>Validade</th><th>Status</th><th>Dias</th><th></th></tr></thead><tbody>';
  list.sort((a,b)=>{ const da=_docDays(a),db=_docDays(b); if(da===null&&db===null)return 0; if(da===null)return 1; if(db===null)return -1; return da-db; });
  list.forEach(d=>{
    const st = _docStatus(d);
    const days = _docDays(d);
    const daysTxt = days===null?'—':(days<0?Math.abs(days)+' dias atrás':days+' dias');
    h += '<tr><td><strong>'+escapeHtml(d.nome)+'</strong></td><td>'+escapeHtml(d.tipo||'—')+'</td><td>'+(d.emissao? new Date(d.emissao).toLocaleDateString('pt-BR'):'—')+'</td><td>'+(d.validade? new Date(d.validade).toLocaleDateString('pt-BR'):'—')+'</td><td><span class="badge" style="background:'+st.bg+';color:'+st.c+'">'+st.l+'</span></td><td style="color:'+st.c+';font-weight:'+(st.k!=='val'?'700':'500')+'">'+daysTxt+'</td><td style="text-align:right"><button class="btn btn-ghost" onclick="editCert(\''+d.id+'\')">✏️</button><button class="btn btn-ghost" onclick="delCert(\''+d.id+'\')">🗑️</button></td></tr>';
  });
  return h + '</tbody></table></div>';
}
function editCert(id){
  const c = currentCompany();
  const base = id ? DB.certifications.find(x=>x.id===id) : null;
  const d = base || { nome:'', tipo:'fiscal', emissao:'', validade:'', companyId: c?c.id:(DB.companies[0]?DB.companies[0].id:''), observacoes:'' };
  const compOpts = DB.companies.map(co=>'<option value="'+co.id+'" '+(d.companyId===co.id?'selected':'')+'>'+escapeHtml(co.name)+'</option>').join('');
  const tipos = ['fiscal','trabalhista','municipal','estadual','federal','cadastral','tecnica','outro'];
  const tOpts = tipos.map(t=>'<option value="'+t+'" '+(d.tipo===t?'selected':'')+'>'+t+'</option>').join('');
  const modelos = [
    {n:'CNDT - Certidão Negativa de Débitos Trabalhistas',t:'trabalhista',v:180},
    {n:'Certidão Federal - Receita e PGFN',t:'federal',v:180},
    {n:'Certidão Estadual',t:'estadual',v:180},
    {n:'Certidão Municipal',t:'municipal',v:180},
    {n:'FGTS - Certificado de Regularidade',t:'trabalhista',v:90},
    {n:'Alvará de Funcionamento',t:'municipal',v:365},
    {n:'Inscrição Estadual',t:'cadastral',v:0}
  ];
  const mOpts = '<option value="">— modelo —</option>'+modelos.map((m,i)=>'<option value="'+i+'">'+escapeHtml(m.n)+'</option>').join('');
  const html = '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Empresa</span><select id="cdComp" class="input">'+compOpts+'</select></div><div><span class="label">Modelo pronto</span><select id="cdModel" class="input" onchange="aplyCertModel(this.value)">'+mOpts+'</select></div></div><div style="margin-bottom:.75rem"><span class="label">Nome *</span><input id="cdNome" class="input" value="'+escapeHtml(d.nome||'')+'"></div><div style="margin-bottom:.75rem"><span class="label">Tipo</span><select id="cdTipo" class="input">'+tOpts+'</select></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Emissão</span><input id="cdEm" type="date" class="input" value="'+escapeHtml(d.emissao||'')+'"></div><div><span class="label">Validade <span style="font-weight:400;color:var(--soft)">(vazio=Permanente)</span></span><input id="cdVal" type="date" class="input" value="'+escapeHtml(d.validade||'')+'"></div></div><div><span class="label">Observações</span><textarea id="cdObs" class="input" rows="2">'+escapeHtml(d.observacoes||'')+'</textarea></div>';
  window._certModels = modelos;
  openModal(id?'Editar':'Upload de documento', html, ()=>{
    const nome = document.getElementById('cdNome').value.trim();
    if(!nome){ toast('Informe o nome','err'); return false; }
    const data = { companyId:document.getElementById('cdComp').value, nome, tipo:document.getElementById('cdTipo').value, emissao:document.getElementById('cdEm').value, validade:document.getElementById('cdVal').value, observacoes:document.getElementById('cdObs').value.trim() };
    if(id){ Object.assign(base, data); } else { DB.certifications.push(Object.assign({id:uid('cert')}, data)); }
    saveDB(); toast('Salvo ✓'); renderGestao();
  });
}
function aplyCertModel(idx){
  if(idx==='') return;
  const m = window._certModels[parseInt(idx)];
  if(!m) return;
  document.getElementById('cdNome').value = m.n;
  document.getElementById('cdTipo').value = m.t;
  if(m.v>0){
    const t = new Date();
    document.getElementById('cdEm').value = t.toISOString().slice(0,10);
    document.getElementById('cdVal').value = new Date(t.getTime()+m.v*86400000).toISOString().slice(0,10);
  } else { document.getElementById('cdVal').value = ''; }
}
function delCert(id){ if(!confirm('Excluir?')) return; DB.certifications = DB.certifications.filter(x=>x.id!==id); saveDB(); renderGestao(); }

/* FINANCEIRO */
function renderFinanceiro(){
  const root = document.getElementById('content');
  const c = currentCompany();
  const list = (DB.entries||[]).filter(e=>!c||e.companyId===c.id);
  let h = '<h1 style="font-size:1.75rem;font-weight:800;margin-bottom:1rem">💰 Financeiro</h1><div class="card"><div style="display:flex;align-items:center;margin-bottom:1rem"><h2 style="font-weight:700;flex:1">Lançamentos ('+list.length+')</h2><button class="btn btn-primary" onclick="editEntry()">+ Novo lançamento</button></div>';
  if(!list.length){ h += '<div style="padding:2rem;text-align:center;color:var(--soft)">Nenhum lançamento</div>'; }
  else {
    h += '<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>';
    list.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).forEach(e=>{
      const cat = DB.categories.find(c=>c.id===e.categoryId);
      h += '<tr><td>'+(e.date? new Date(e.date).toLocaleDateString('pt-BR'):'—')+'</td><td>'+escapeHtml(e.description||'—')+'</td><td>'+escapeHtml(cat?cat.name:'—')+'</td><td><span class="badge" style="background:'+(e.type==='receita'?'#dcfce7;color:#15803d':'#fee2e2;color:#dc2626')+'">'+e.type+'</span></td><td style="font-weight:600;color:'+(e.type==='receita'?'#16a34a':'#dc2626')+'">'+(e.type==='receita'?'+':'-')+' '+fmtMoney(e.amount||0)+'</td><td>'+(e.paid?'<span class="badge" style="background:#dcfce7;color:#15803d">Pago</span>':'<span class="badge" style="background:#fef3c7;color:#92400e">Pendente</span>')+'</td><td style="text-align:right"><button class="btn btn-ghost" onclick="editEntry(\''+e.id+'\')">✏️</button><button class="btn btn-ghost" onclick="delEntry(\''+e.id+'\')">🗑️</button></td></tr>';
    });
    h += '</tbody></table>';
  }
  h += '</div>';
  root.innerHTML = h;
}
ROUTES.financeiro = renderFinanceiro;

function editEntry(id){
  const c = currentCompany();
  const base = id ? DB.entries.find(e=>e.id===id) : null;
  const e = base || { type:'despesa', description:'', amount:0, date: new Date().toISOString().slice(0,10), categoryId:'', paid:false, companyId: c?c.id:(DB.companies[0]?DB.companies[0].id:'') };
  const compOpts = DB.companies.map(co=>'<option value="'+co.id+'" '+(e.companyId===co.id?'selected':'')+'>'+escapeHtml(co.name)+'</option>').join('');
  const catOpts = '<option value="">—</option>'+DB.categories.filter(c=>c.type===e.type).map(c=>'<option value="'+c.id+'" '+(e.categoryId===c.id?'selected':'')+'>'+escapeHtml(c.name)+'</option>').join('');
  const html = '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Empresa</span><select id="enComp" class="input">'+compOpts+'</select></div><div><span class="label">Tipo</span><select id="enType" class="input" onchange="reloadEntryCats(this.value)"><option value="receita"'+(e.type==='receita'?' selected':'')+'>Receita</option><option value="despesa"'+(e.type==='despesa'?' selected':'')+'>Despesa</option></select></div></div><div style="margin-bottom:.75rem"><span class="label">Descrição *</span><input id="enDesc" class="input" value="'+escapeHtml(e.description||'')+'"></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Data</span><input id="enDate" type="date" class="input" value="'+escapeHtml(e.date||'')+'"></div><div><span class="label">Valor</span><input id="enAmt" class="input" value="'+(e.amount||0)+'"></div></div><div class="grid-2"><div><span class="label">Categoria</span><select id="enCat" class="input">'+catOpts+'</select></div><div><span class="label">Status</span><select id="enPaid" class="input"><option value="true"'+(e.paid?' selected':'')+'>Pago</option><option value="false"'+(!e.paid?' selected':'')+'>Pendente</option></select></div></div>';
  openModal(id?'Editar':'Novo lançamento', html, ()=>{
    const desc = document.getElementById('enDesc').value.trim();
    if(!desc){ toast('Informe a descrição','err'); return false; }
    const data = { companyId:document.getElementById('enComp').value, type:document.getElementById('enType').value, description:desc, date:document.getElementById('enDate').value, amount:parseBRL(document.getElementById('enAmt').value), categoryId:document.getElementById('enCat').value, paid:document.getElementById('enPaid').value==='true' };
    if(id){ Object.assign(base, data); } else { DB.entries.push(Object.assign({id:uid('ent'), createdAt:new Date().toISOString()}, data)); }
    saveDB(); toast('Salvo ✓'); renderFinanceiro();
  });
}
function reloadEntryCats(type){
  const sel = document.getElementById('enCat');
  if(!sel) return;
  sel.innerHTML = '<option value="">—</option>'+DB.categories.filter(c=>c.type===type).map(c=>'<option value="'+c.id+'">'+escapeHtml(c.name)+'</option>').join('');
}
function delEntry(id){ if(!confirm('Excluir?')) return; DB.entries = DB.entries.filter(e=>e.id!==id); saveDB(); renderFinanceiro(); }

/* RH */
let _rhTab = 'funcionarios';
function setRhTab(t){ _rhTab = t; renderRH(); }
const EMP_DOC_TIPOS = [
  {v:'cnh',l:'CNH'},{v:'ear',l:'EAR/Direção Defensiva'},{v:'transp_esc',l:'Curso Transporte Escolar'},
  {v:'aso',l:'ASO'},{v:'toxicologico',l:'Exame Toxicológico'},{v:'antecedentes',l:'Antecedentes Criminais'},
  {v:'nr35',l:'NR-35'},{v:'outro',l:'Outro'}
];

function renderRH(){
  const root = document.getElementById('content');
  const c = currentCompany();
  const emps = (DB.employees||[]).filter(e=>!c||e.companyId===c.id);
  const ativos = emps.filter(e=>e.status==='ativo').length;
  const mot = emps.filter(e=>e.isMotorista && e.status==='ativo').length;
  const docs = emps.reduce((s,e)=>s+(e.docs||[]).length,0);
  const docsVenc = emps.reduce((s,e)=>s+(e.docs||[]).filter(d=>d.validade && new Date(d.validade)<new Date()).length,0);
  const tab = (id,lbl,icon)=>'<button class="tab-btn '+(_rhTab===id?'active':'')+'" onclick="setRhTab(\''+id+'\')">'+icon+' '+lbl+'</button>';
  let h = '<div class="card" style="background:linear-gradient(135deg,#713f12 0%,#a16207 100%);color:#fff;border:none;margin-bottom:1rem"><div style="display:flex;align-items:center;gap:1rem"><div style="flex:1"><div style="font-size:.7rem;letter-spacing:.18em;opacity:.85">Operacional</div><h2 style="font-size:1.4rem;font-weight:800">👥 RH / Gestão de Pessoas</h2><div style="font-size:.85rem;opacity:.9">Funcionários, motoristas e documentos</div></div><button class="btn" onclick="editEmp()" style="background:#fff;color:#713f12;font-weight:700">+ Novo funcionário</button></div></div>';
  h += '<div class="grid-2" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1rem"><div class="kpi" style="border-left-color:#16a34a"><div class="label">Ativos</div><div style="font-size:1.4rem;font-weight:800;color:#16a34a">'+ativos+'</div></div><div class="kpi" style="border-left-color:#0284c7"><div class="label">Motoristas</div><div style="font-size:1.4rem;font-weight:800;color:#0284c7">'+mot+'</div></div><div class="kpi"><div class="label">Documentos</div><div style="font-size:1.4rem;font-weight:800">'+docs+'</div></div><div class="kpi" style="border-left-color:#dc2626"><div class="label">Vencidos</div><div style="font-size:1.4rem;font-weight:800;color:#dc2626">'+docsVenc+'</div></div></div>';
  h += '<div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">'+tab('funcionarios','Funcionários','👥')+tab('documentos','Documentos','📑')+'</div>';
  if(_rhTab==='funcionarios'){
    h += '<div class="card" style="padding:0;overflow-x:auto"><table><thead><tr><th>Nome</th><th>Cargo</th><th>CPF</th><th>Admissão</th><th>Salário</th><th>Motorista</th><th>Status</th><th></th></tr></thead><tbody>';
    if(!emps.length){ h += '<tr><td colspan="8" style="padding:2rem;text-align:center;color:var(--soft)">Nenhum funcionário</td></tr>'; }
    else emps.forEach(e=>{
      h += '<tr><td><strong>'+escapeHtml(e.name)+'</strong></td><td>'+escapeHtml(e.cargo||'—')+'</td><td>'+escapeHtml(e.cpf||'—')+'</td><td>'+(e.admissao? new Date(e.admissao).toLocaleDateString('pt-BR'):'—')+'</td><td>'+(e.salary? fmtMoney(e.salary):'—')+'</td><td>'+(e.isMotorista?'<span class="badge" style="background:#dbeafe;color:#1e40af">🚚 '+escapeHtml(e.cnhCategoria||'')+'</span>':'—')+'</td><td><span class="badge" style="background:'+(e.status==='ativo'?'#dcfce7;color:#15803d':'#f1f5f9;color:#64748b')+'">'+(e.status||'ativo')+'</span></td><td style="text-align:right;white-space:nowrap"><button class="btn btn-ghost" onclick="editEmp(\''+e.id+'\')">✏️</button><button class="btn btn-ghost" onclick="manageEmpDocs(\''+e.id+'\')">📑</button><button class="btn btn-ghost" onclick="delEmp(\''+e.id+'\')">🗑️</button></td></tr>';
    });
    h += '</tbody></table></div>';
  } else if(_rhTab==='documentos'){
    const all = [];
    emps.forEach(e=>(e.docs||[]).forEach(d=>all.push(Object.assign({empName:e.name, empId:e.id}, d))));
    all.sort((a,b)=>{ const da=_docDays(a),db=_docDays(b); if(da===null&&db===null)return 0; if(da===null)return 1; if(db===null)return -1; return da-db; });
    h += '<div class="card" style="padding:0;overflow-x:auto"><table><thead><tr><th>Funcionário</th><th>Tipo</th><th>Nº</th><th>Validade</th><th>Status</th><th>Dias</th><th></th></tr></thead><tbody>';
    if(!all.length){ h += '<tr><td colspan="7" style="padding:2rem;text-align:center;color:var(--soft)">Nenhum documento</td></tr>'; }
    else all.forEach(d=>{
      const st = _docStatus(d);
      const days = _docDays(d);
      const daysTxt = days===null?'—':(days<0?Math.abs(days)+' atrás':days+' dias');
      const tipo = EMP_DOC_TIPOS.find(t=>t.v===d.tipo) || {l:d.tipo};
      h += '<tr><td><strong>'+escapeHtml(d.empName)+'</strong></td><td>'+escapeHtml(tipo.l)+'</td><td>'+escapeHtml(d.numero||'—')+'</td><td>'+(d.validade? new Date(d.validade).toLocaleDateString('pt-BR'):'—')+'</td><td><span class="badge" style="background:'+st.bg+';color:'+st.c+'">'+st.l+'</span></td><td style="color:'+st.c+';font-weight:'+(st.k!=='val'?'700':'500')+'">'+daysTxt+'</td><td style="text-align:right"><button class="btn btn-ghost" onclick="manageEmpDocs(\''+d.empId+'\')">Ver →</button></td></tr>';
    });
    h += '</tbody></table></div>';
  }
  root.innerHTML = h;
}
ROUTES.rh = renderRH;

function editEmp(id){
  const c = currentCompany();
  const base = id ? DB.employees.find(e=>e.id===id) : null;
  const e = base || { name:'', cpf:'', cargo:'', salary:0, admissao:'', status:'ativo', isMotorista:false, cnhCategoria:'', companyId: c?c.id:(DB.companies[0]?DB.companies[0].id:''), docs:[] };
  const compOpts = DB.companies.map(co=>'<option value="'+co.id+'" '+(e.companyId===co.id?'selected':'')+'>'+escapeHtml(co.name)+'</option>').join('');
  const cnhOpts = ['','A','B','C','D','E','AB','AC','AD','AE'].map(c=>'<option value="'+c+'" '+(e.cnhCategoria===c?'selected':'')+'>'+(c||'—')+'</option>').join('');
  const html = '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Empresa</span><select id="emCo" class="input">'+compOpts+'</select></div><div><span class="label">Status</span><select id="emSt" class="input"><option value="ativo"'+(e.status==='ativo'?' selected':'')+'>Ativo</option><option value="ferias"'+(e.status==='ferias'?' selected':'')+'>Em férias</option><option value="afastado"'+(e.status==='afastado'?' selected':'')+'>Afastado</option><option value="desligado"'+(e.status==='desligado'?' selected':'')+'>Desligado</option></select></div></div><div style="margin-bottom:.75rem"><span class="label">Nome *</span><input id="emName2" class="input" value="'+escapeHtml(e.name||'')+'"></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">CPF</span><input id="emCpf" class="input" value="'+escapeHtml(e.cpf||'')+'"></div><div><span class="label">Cargo</span><input id="emCargo" class="input" value="'+escapeHtml(e.cargo||'')+'"></div></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Admissão</span><input id="emAdm" type="date" class="input" value="'+escapeHtml(e.admissao||'')+'"></div><div><span class="label">Salário</span><input id="emSal" class="input" value="'+(e.salary||0)+'"></div></div><div style="margin-bottom:.5rem;padding:.75rem;background:#eff6ff;border-radius:8px;border-left:4px solid #0284c7"><label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-weight:700"><input type="checkbox" id="emMot" '+(e.isMotorista?'checked':'')+' onchange="document.getElementById(\'emMotF\').style.display=this.checked?\'block\':\'none\'">🚚 É motorista</label><div id="emMotF" style="display:'+(e.isMotorista?'block':'none')+';margin-top:.5rem"><span class="label">Categoria CNH</span><select id="emCnh" class="input">'+cnhOpts+'</select></div></div>';
  openModal(id?'Editar funcionário':'Novo funcionário', html, ()=>{
    const name = document.getElementById('emName2').value.trim();
    if(!name){ toast('Informe o nome','err'); return false; }
    const data = { companyId:document.getElementById('emCo').value, status:document.getElementById('emSt').value, name, cpf:document.getElementById('emCpf').value.trim(), cargo:document.getElementById('emCargo').value.trim(), admissao:document.getElementById('emAdm').value, salary:parseBRL(document.getElementById('emSal').value), isMotorista:document.getElementById('emMot').checked, cnhCategoria:document.getElementById('emCnh').value };
    if(id){ Object.assign(base, data); } else { DB.employees.push(Object.assign({id:uid('emp'), docs:[], createdAt:new Date().toISOString()}, data)); }
    saveDB(); toast('Salvo ✓'); renderRH();
  });
}
function delEmp(id){ if(!confirm('Excluir?')) return; DB.employees = DB.employees.filter(e=>e.id!==id); saveDB(); renderRH(); }

function manageEmpDocs(empId){
  const emp = DB.employees.find(e=>e.id===empId);
  if(!emp) return;
  if(!Array.isArray(emp.docs)) emp.docs = [];
  let body = '<div style="margin-bottom:.85rem">Funcionário: <strong>'+escapeHtml(emp.name)+'</strong></div><button class="btn btn-primary" onclick="addEmpDoc(\''+empId+'\')" style="margin-bottom:.85rem">+ Novo documento</button>';
  if(!emp.docs.length){ body += '<div style="padding:1.5rem;text-align:center;color:var(--soft);border:1px dashed var(--line);border-radius:8px">Nenhum documento</div>'; }
  else {
    body += '<table><thead><tr><th>Tipo</th><th>Nº</th><th>Validade</th><th>Status</th><th></th></tr></thead><tbody>';
    emp.docs.forEach((d,i)=>{
      const tipo = EMP_DOC_TIPOS.find(t=>t.v===d.tipo) || {l:d.tipo};
      const st = _docStatus(d);
      body += '<tr><td>'+escapeHtml(tipo.l)+'</td><td>'+escapeHtml(d.numero||'—')+'</td><td>'+(d.validade? new Date(d.validade).toLocaleDateString('pt-BR'):'—')+'</td><td><span class="badge" style="background:'+st.bg+';color:'+st.c+'">'+st.l+'</span></td><td style="text-align:right"><button class="btn btn-ghost" onclick="editEmpDoc(\''+empId+'\','+i+')">✏️</button><button class="btn btn-ghost" onclick="rmEmpDoc(\''+empId+'\','+i+')">🗑️</button></td></tr>';
    });
    body += '</tbody></table>';
  }
  openModal('Documentos', body, null, 'lg');
  setTimeout(()=>{ const sb=document.getElementById('modalSaveBtn'); if(sb) sb.style.display='none'; }, 30);
}
function addEmpDoc(empId){ closeModal(); editEmpDoc(empId,-1); }
function editEmpDoc(empId, idx){
  const emp = DB.employees.find(e=>e.id===empId);
  if(!emp) return;
  if(!Array.isArray(emp.docs)) emp.docs = [];
  const isNew = idx<0;
  const d = isNew ? {tipo:'cnh', numero:'', emissao:'', validade:'', observacoes:''} : emp.docs[idx];
  const tOpts = EMP_DOC_TIPOS.map(t=>'<option value="'+t.v+'" '+(d.tipo===t.v?'selected':'')+'>'+t.l+'</option>').join('');
  const html = '<div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Tipo</span><select id="edTipo" class="input">'+tOpts+'</select></div><div><span class="label">Nº</span><input id="edNum" class="input" value="'+escapeHtml(d.numero||'')+'"></div></div><div class="grid-2" style="margin-bottom:.75rem"><div><span class="label">Emissão</span><input id="edEm" type="date" class="input" value="'+escapeHtml(d.emissao||'')+'"></div><div><span class="label">Validade</span><input id="edVal" type="date" class="input" value="'+escapeHtml(d.validade||'')+'"></div></div><div><span class="label">Observações</span><textarea id="edObs" class="input" rows="2">'+escapeHtml(d.observacoes||'')+'</textarea></div>';
  openModal(isNew?'Novo documento':'Editar documento', html, ()=>{
    const data = { tipo:document.getElementById('edTipo').value, numero:document.getElementById('edNum').value.trim(), emissao:document.getElementById('edEm').value, validade:document.getElementById('edVal').value, observacoes:document.getElementById('edObs').value.trim() };
    if(isNew) emp.docs.push(data); else Object.assign(emp.docs[idx], data);
    saveDB(); toast('Salvo ✓'); closeModal(); manageEmpDocs(empId);
  });
}
function rmEmpDoc(empId, idx){
  if(!confirm('Remover?')) return;
  const emp = DB.employees.find(e=>e.id===empId);
  emp.docs.splice(idx,1);
  saveDB(); closeModal(); manageEmpDocs(empId);
}

/* CONFIG */
let _configTab = 'organizacao';
function setConfigTab(t){ _configTab = t; renderConfig(); }
function renderConfig(){
  const root = document.getElementById('content');
  const tab = (id,lbl,icon)=>'<button class="tab-btn '+(_configTab===id?'active':'')+'" onclick="setConfigTab(\''+id+'\')">'+icon+' '+lbl+'</button>';
  let h = '<h1 style="font-size:1.75rem;font-weight:800;margin-bottom:1rem">⚙️ Configurações</h1><div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">'+tab('organizacao','Organização','🏢')+tab('backup','Backup','💾')+'</div>';
  if(_configTab==='organizacao'){
    const isGroup = DB.org.type==='group';
    h += '<div class="card" style="background:linear-gradient(135deg,#1e293b 0%,#4f46e5 100%);color:#fff;border:none;margin-bottom:1rem"><div style="display:flex;align-items:center;gap:1rem"><div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:1.5rem">'+(isGroup?'🏢':'🏪')+'</div><div style="flex:1"><div style="font-size:.7rem;letter-spacing:.18em;opacity:.85">Modo atual</div><div style="font-size:1.3rem;font-weight:800">'+(isGroup?'Grupo Empresarial':'Empresa Única')+'</div><div style="font-size:.85rem;opacity:.9">'+DB.companies.length+' empresa(s)'+(isGroup&&DB.org.groupName?' • '+escapeHtml(DB.org.groupName):'')+'</div></div></div></div>';
    if(!isGroup){
      h += '<div class="card" style="border-left:4px solid #4f46e5;background:#eef2ff;margin-bottom:1rem"><h3 style="font-weight:700;margin-bottom:.5rem;color:#3730a3">🆙 Converter para Grupo Empresarial</h3><p style="font-size:.85rem;color:var(--soft);margin-bottom:.85rem">Permite cadastrar várias empresas. Os dados atuais são preservados.</p><button class="btn btn-primary" onclick="convertToGroup()">🏢 Converter para Grupo</button></div>';
    } else {
      h += '<div class="card" style="border-left:4px solid #16a34a;background:#f0fdf4;margin-bottom:1rem"><h3 style="font-weight:700;margin-bottom:.5rem;color:#15803d">✓ Grupo Empresarial ativo</h3><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-primary" onclick="navigate(\'cadastros\');setCadTab(\'empresas\')">📋 Gerenciar empresas</button>'+(DB.companies.length===1?'<button class="btn btn-secondary" onclick="convertToSingle()">⬅️ Voltar para Empresa Única</button>':'')+'</div></div>';
    }
    h += '<div class="card"><h3 style="font-weight:700;margin-bottom:.85rem">Ações rápidas</h3><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-secondary" onclick="navigate(\'cadastros\');setCadTab(\'empresas\')">📋 Lista de empresas</button><button class="btn btn-secondary" onclick="editEmpresa()">+ Nova empresa</button></div></div>';
  } else if(_configTab==='backup'){
    h += '<div class="card"><h3 style="font-weight:700;margin-bottom:.85rem">Backup e Restauração</h3><p style="font-size:.85rem;color:var(--soft);margin-bottom:.85rem">Os dados ficam apenas no seu navegador. Exporte periodicamente.</p><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-primary" onclick="exportBackup()">💾 Exportar JSON</button><label class="btn btn-secondary" style="cursor:pointer">📥 Importar JSON<input type="file" accept=".json" hidden onchange="importBackup(event)"></label><button class="btn btn-danger" onclick="resetAll()">🗑️ Apagar tudo</button></div></div>';
  }
  root.innerHTML = h;
}
ROUTES.config = renderConfig;

function convertToGroup(){
  const sug = (DB.companies[0]?'Grupo '+DB.companies[0].name:'Meu Grupo');
  const nome = prompt('Nome do Grupo:', sug);
  if(!nome) return;
  DB.org.type = 'group';
  DB.org.groupName = nome.trim();
  saveDB(); toast('Convertido para Grupo ✓');
  updateSidebarBadge();
  renderConfig();
}
function convertToSingle(){
  if(DB.companies.length > 1){ toast('Remova as empresas extras antes','warn'); return; }
  if(!confirm('Voltar para Empresa Única?')) return;
  DB.org.type = 'single'; DB.org.groupName = '';
  saveDB();
  if(DB.companies[0]) enterCompany(DB.companies[0].id);
  toast('Convertido para Empresa Única ✓');
  renderConfig();
}

function exportBackup(){
  const data = JSON.stringify(DB, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'jms_backup_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportado ✓');
}
function importBackup(ev){
  const file = ev.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const parsed = JSON.parse(e.target.result);
      if(!parsed.org) throw new Error('Arquivo inválido');
      if(!confirm('Substituir todos os dados?')) return;
      DB = Object.assign(JSON.parse(JSON.stringify(defaultDB)), parsed);
      saveDB(); toast('Backup restaurado ✓');
      location.reload();
    }catch(e){ toast('Erro: '+e.message,'err'); }
  };
  reader.readAsText(file);
}
function restoreBackup(ev){ importBackup(ev); }
function resetAll(){
  if(!confirm('Apagar TODOS os dados? IRREVERSÍVEL.')) return;
  if(!confirm('Tem certeza? Última confirmação.')) return;
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(LAST_USER_KEY);
  location.reload();
}

function init(){
  const sid = sessionStorage.getItem(SESSION_KEY);
  if(sid){
    const u = DB.users.find(x=>x.id===sid);
    if(u){ currentUser = u; postAuth(); return; }
  }
  showAuth();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else { init(); }
