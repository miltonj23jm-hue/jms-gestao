/* ============================================================
   RH / GESTÃO DE PESSOAS — Funcionários, Motoristas e Documentos
   ============================================================ */
let _rhTab = 'funcionarios';
function setRhTab(t){ _rhTab = t; renderRH(); }

const EMP_DOC_TIPOS = [
  {v:'cnh',           l:'CNH',                          warn:30},
  {v:'ear',           l:'EAR/Direção Defensiva',        warn:30},
  {v:'transp_escolar',l:'Curso Transporte Escolar',     warn:60},
  {v:'aso',           l:'ASO (Saúde Ocupacional)',      warn:30},
  {v:'toxicologico',  l:'Exame Toxicológico',           warn:60},
  {v:'antecedentes',  l:'Antecedentes Criminais',       warn:30},
  {v:'nr35',          l:'NR-35 / Treinamentos',         warn:90},
  {v:'ctps',          l:'CTPS / Carteira de Trabalho',  warn:0},
  {v:'rg',            l:'RG',                           warn:0},
  {v:'cpf',           l:'CPF',                          warn:0},
  {v:'outro',         l:'Outro',                        warn:30}
];
const CNH_CATEGORIAS = ['A','B','C','D','E','AB','AC','AD','AE'];
const EMP_STATUS = [
  {v:'ativo',     l:'Ativo',     c:'#16a34a'},
  {v:'ferias',    l:'Em férias', c:'#0284c7'},
  {v:'afastado',  l:'Afastado',  c:'#d97706'},
  {v:'desligado', l:'Desligado', c:'#dc2626'}
];

function _empDocDaysLeft(d){
  if(!d.validade) return null;
  const v = new Date(d.validade);
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.floor((v - today)/(1000*60*60*24));
}
function _empDocStatus(d){
  if(!d.validade) return {key:'permanente', l:'Permanente', c:'#64748b', bg:'#f1f5f9'};
  const days = _empDocDaysLeft(d);
  const tipo = EMP_DOC_TIPOS.find(t=>t.v===d.tipo) || EMP_DOC_TIPOS[EMP_DOC_TIPOS.length-1];
  if(days<0) return {key:'vencido', l:'Vencido', c:'#dc2626', bg:'#fee2e2'};
  if(days<=(tipo.warn||30)) return {key:'a_vencer', l:'A vencer', c:'#d97706', bg:'#fef3c7'};
  return {key:'valido', l:'Válido', c:'#15803d', bg:'#dcfce7'};
}

function renderRH(){
  if(!DB.employees) DB.employees = [];
  const root = document.getElementById('content'); if(!root) return;
  const company = (typeof currentCompany==='function') ? currentCompany() : null;
  const emps = (DB.employees||[]).filter(e=>!company || e.companyId === company.id);
  const ativos = emps.filter(e=>e.status==='ativo').length;
  const motoristas = emps.filter(e=>e.isMotorista && e.status==='ativo').length;
  const docsTotal = emps.reduce((s,e)=>s+((e.docs||[]).length),0);
  const docsVencidos = emps.reduce((s,e)=>s+((e.docs||[]).filter(d=>_empDocStatus(d).key==='vencido').length),0);
  const docsAVencer = emps.reduce((s,e)=>s+((e.docs||[]).filter(d=>_empDocStatus(d).key==='a_vencer').length),0);

  let html = '<div class="card mb-4" style="background:linear-gradient(135deg,#713f12 0%,#a16207 100%);color:#fff;border:none">'+
    '<div class="flex items-center gap-3 flex-wrap">'+
      '<div style="width:64px;height:64px;border-radius:14px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center"><i data-lucide="users" style="width:36px;height:36px;color:#fff"></i></div>'+
      '<div class="flex-1 min-w-[200px]">'+
        '<div style="font-size:.7rem;letter-spacing:.2em;font-weight:700;opacity:.85;text-transform:uppercase">Operacional</div>'+
        '<div style="font-size:1.5rem;font-weight:800">RH / Gestão de Pessoas</div>'+
        '<div style="font-size:.85rem;opacity:.9">Funcionários, motoristas, CNH, EAR, ASO e demais documentos</div>'+
      '</div>'+
      '<button class="btn btn-primary" onclick="editEmployee()" style="background:#fff;color:#713f12;border:none;font-weight:700">+ Novo funcionário</button>'+
    '</div></div>';

  html += '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">'+
    '<div class="card" style="border-left:4px solid #16a34a"><div class="text-xs text-slate-500 uppercase tracking-wider">Ativos</div><div class="text-2xl font-bold mt-1" style="color:#16a34a">'+ativos+'</div></div>'+
    '<div class="card" style="border-left:4px solid #0284c7"><div class="text-xs text-slate-500 uppercase tracking-wider">Motoristas</div><div class="text-2xl font-bold mt-1" style="color:#0284c7">'+motoristas+'</div></div>'+
    '<div class="card" style="border-left:4px solid #4f46e5"><div class="text-xs text-slate-500 uppercase tracking-wider">Documentos</div><div class="text-2xl font-bold mt-1" style="color:#4f46e5">'+docsTotal+'</div></div>'+
    '<div class="card" style="border-left:4px solid #d97706"><div class="text-xs text-slate-500 uppercase tracking-wider">A vencer</div><div class="text-2xl font-bold mt-1" style="color:#d97706">'+docsAVencer+'</div></div>'+
    '<div class="card" style="border-left:4px solid #dc2626"><div class="text-xs text-slate-500 uppercase tracking-wider">Vencidos</div><div class="text-2xl font-bold mt-1" style="color:#dc2626">'+docsVencidos+'</div></div>'+
  '</div>';

  const tabBtn = (id,label,icon)=>'<button class="btn '+(_rhTab===id?'btn-primary':'btn-secondary')+'" onclick="setRhTab(\''+id+'\')">'+icon+' '+label+'</button>';
  html += '<div class="card mb-3" style="padding:.6rem"><div class="flex gap-2 flex-wrap">'+
    tabBtn('funcionarios','Funcionários','👥')+
    tabBtn('documentos','Documentos','📑')+
    tabBtn('motoristas','Motoristas & Veículos','🚚')+
  '</div></div>';

  if(_rhTab==='funcionarios') html += _renderRhFuncionarios(emps);
  else if(_rhTab==='documentos') html += _renderRhDocumentos(emps);
  else if(_rhTab==='motoristas') html += _renderRhMotoristas(emps);

  root.innerHTML = html;
  setTimeout(()=>{ if(window.lucide) lucide.createIcons(); }, 30);
}

function _renderRhFuncionarios(emps){
  if(!emps.length){
    return '<div class="card text-center py-10">'+
      '<div style="font-size:3rem;margin-bottom:.5rem">👥</div>'+
      '<div class="text-lg font-semibold text-slate-700 mb-1">Nenhum funcionário cadastrado</div>'+
      '<div class="text-sm text-slate-500 mb-4">Cadastre funcionários e motoristas com documentação e validade.</div>'+
      '<button class="btn btn-primary" onclick="editEmployee()">+ Cadastrar primeiro funcionário</button>'+
    '</div>';
  }
  let h = '<div class="card overflow-x-auto" style="padding:0"><table class="w-full text-sm">';
  h += '<thead><tr class="text-left border-b border-slate-200" style="background:#f8fafc">'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Funcionário</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Cargo</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">CPF</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Admissão</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Salário</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Motorista</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Status</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600 text-right">Ações</th>'+
  '</tr></thead><tbody>';
  emps.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))).forEach((e,i)=>{
    const st = EMP_STATUS.find(x=>x.v===e.status) || EMP_STATUS[0];
    const rowBg = i%2===0 ? '#fff' : '#fafbfc';
    const motLabel = e.isMotorista ? '<span style="background:#dbeafe;color:#1e40af;padding:.18rem .5rem;border-radius:999px;font-size:.7rem;font-weight:700">🚚 '+escapeHtml(e.cnhCategoria||'')+'</span>' : '<span class="text-slate-400">—</span>';
    h += '<tr style="background:'+rowBg+';border-bottom:1px solid #f1f5f9">'+
      '<td class="px-4 py-3"><div class="font-semibold text-slate-800">'+escapeHtml(e.name||'—')+'</div>'+(e.email?'<div class="text-xs text-slate-500">'+escapeHtml(e.email)+'</div>':'')+'</td>'+
      '<td class="px-4 py-3 text-slate-700">'+escapeHtml(e.cargo||'—')+'</td>'+
      '<td class="px-4 py-3 text-xs text-slate-700">'+escapeHtml(e.cpf||'—')+'</td>'+
      '<td class="px-4 py-3 text-xs text-slate-700">'+(e.admissao? new Date(e.admissao).toLocaleDateString('pt-BR') : '—')+'</td>'+
      '<td class="px-4 py-3 text-slate-700">'+(e.salary ? fmtMoney(e.salary) : '—')+'</td>'+
      '<td class="px-4 py-3">'+motLabel+'</td>'+
      '<td class="px-4 py-3"><span style="background:'+st.c+'22;color:'+st.c+';padding:.18rem .55rem;border-radius:999px;font-size:.7rem;font-weight:700">'+escapeHtml(st.l)+'</span></td>'+
      '<td class="px-4 py-3 text-right whitespace-nowrap">'+
        '<button class="btn btn-ghost text-xs" onclick="editEmployee(\''+e.id+'\')" title="Editar">✏️</button>'+
        '<button class="btn btn-ghost text-xs" onclick="manageEmpDocs(\''+e.id+'\')" title="Documentos">📑</button>'+
        '<button class="btn btn-ghost text-xs" onclick="deleteEmployee(\''+e.id+'\')" title="Excluir">🗑️</button>'+
      '</td>'+
    '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function _renderRhDocumentos(emps){
  const allDocs = [];
  emps.forEach(e=>(e.docs||[]).forEach(d=>allDocs.push(Object.assign({empName:e.name, empId:e.id}, d))));
  allDocs.sort((a,b)=>{
    const da=_empDocDaysLeft(a), db=_empDocDaysLeft(b);
    if(da===null && db===null) return 0;
    if(da===null) return 1;
    if(db===null) return -1;
    return da - db;
  });
  if(!allDocs.length){
    return '<div class="card text-center py-8 text-slate-500">'+
      '<div style="font-size:2.5rem;margin-bottom:.5rem">📑</div>'+
      '<div class="font-semibold text-slate-700">Nenhum documento cadastrado</div>'+
      '<div class="text-sm mt-1">Acesse um funcionário (botão 📑) para adicionar documentos.</div>'+
    '</div>';
  }
  let h = '<div class="card overflow-x-auto" style="padding:0"><table class="w-full text-sm">';
  h += '<thead><tr class="text-left border-b border-slate-200" style="background:#f8fafc">'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Funcionário</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Tipo</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Nº</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Emissão</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Validade</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Status</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Dias restantes</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600 text-right">Ações</th>'+
  '</tr></thead><tbody>';
  allDocs.forEach((d,i)=>{
    const st = _empDocStatus(d);
    const tipo = EMP_DOC_TIPOS.find(t=>t.v===d.tipo) || EMP_DOC_TIPOS[EMP_DOC_TIPOS.length-1];
    const days = _empDocDaysLeft(d);
    const rowBg = i%2===0 ? '#fff' : '#fafbfc';
    const daysCol = st.key==='vencido' ? '#dc2626' : (st.key==='a_vencer' ? '#d97706' : '#475569');
    const daysTxt = days===null ? '—' : (days<0 ? Math.abs(days)+' dias atrás' : days+' dias');
    h += '<tr style="background:'+rowBg+';border-bottom:1px solid #f1f5f9">'+
      '<td class="px-4 py-3 font-semibold text-slate-800">'+escapeHtml(d.empName||'—')+'</td>'+
      '<td class="px-4 py-3 text-slate-700">'+escapeHtml(tipo.l)+'</td>'+
      '<td class="px-4 py-3 text-slate-700">'+escapeHtml(d.numero||'—')+'</td>'+
      '<td class="px-4 py-3 text-xs">'+(d.emissao? new Date(d.emissao).toLocaleDateString('pt-BR') : '—')+'</td>'+
      '<td class="px-4 py-3 text-xs">'+(d.validade? new Date(d.validade).toLocaleDateString('pt-BR') : '—')+'</td>'+
      '<td class="px-4 py-3"><span style="background:'+st.bg+';color:'+st.c+';padding:.25rem .7rem;border-radius:999px;font-size:.75rem;font-weight:600">'+escapeHtml(st.l)+'</span></td>'+
      '<td class="px-4 py-3" style="color:'+daysCol+';font-weight:'+(st.key!=='valido'&&st.key!=='permanente'?'700':'500')+'">'+daysTxt+'</td>'+
      '<td class="px-4 py-3 text-right"><button class="btn btn-ghost text-xs" onclick="manageEmpDocs(\''+d.empId+'\')">Ver funcionário →</button></td>'+
    '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function _renderRhMotoristas(emps){
  const motoristas = emps.filter(e=>e.isMotorista);
  if(!motoristas.length){
    return '<div class="card text-center py-8 text-slate-500">'+
      '<div style="font-size:2.5rem;margin-bottom:.5rem">🚚</div>'+
      '<div class="font-semibold text-slate-700">Nenhum motorista cadastrado</div>'+
      '<div class="text-sm mt-1">Marque um funcionário como "É motorista" no cadastro e informe a categoria da CNH.</div>'+
    '</div>';
  }
  let h = '<div class="card overflow-x-auto" style="padding:0"><table class="w-full text-sm">';
  h += '<thead><tr class="text-left border-b border-slate-200" style="background:#f8fafc">'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Motorista</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">CNH</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Categoria</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Validade CNH</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600">Apto p/ rota?</th>'+
    '<th class="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-slate-600 text-right">Ações</th>'+
  '</tr></thead><tbody>';
  motoristas.forEach((m,i)=>{
    const rowBg = i%2===0 ? '#fff' : '#fafbfc';
    const docs = m.docs||[];
    const cnh = docs.find(d=>d.tipo==='cnh');
    const ear = docs.find(d=>d.tipo==='ear');
    const aso = docs.find(d=>d.tipo==='aso');
    const cnhSt = cnh ? _empDocStatus(cnh) : null;
    const allValid = cnh && _empDocStatus(cnh).key==='valido' &&
                     ear && _empDocStatus(ear).key==='valido' &&
                     aso && _empDocStatus(aso).key==='valido';
    const aptoLabel = allValid
      ? '<span style="background:#dcfce7;color:#15803d;padding:.18rem .55rem;border-radius:999px;font-size:.7rem;font-weight:700">✓ Apto</span>'
      : '<span style="background:#fee2e2;color:#dc2626;padding:.18rem .55rem;border-radius:999px;font-size:.7rem;font-weight:700" title="CNH/EAR/ASO ausente ou vencido">⚠ Pendência</span>';
    h += '<tr style="background:'+rowBg+';border-bottom:1px solid #f1f5f9">'+
      '<td class="px-4 py-3 font-semibold text-slate-800">'+escapeHtml(m.name||'—')+'</td>'+
      '<td class="px-4 py-3 text-xs text-slate-700">'+escapeHtml((cnh&&cnh.numero)||'—')+'</td>'+
      '<td class="px-4 py-3"><span style="background:#dbeafe;color:#1e40af;padding:.18rem .5rem;border-radius:999px;font-size:.75rem;font-weight:700">'+escapeHtml(m.cnhCategoria||'—')+'</span></td>'+
      '<td class="px-4 py-3 text-xs">'+(cnh&&cnh.validade ? new Date(cnh.validade).toLocaleDateString('pt-BR') : '—')+(cnhSt?' <span style="color:'+cnhSt.c+';font-weight:700">('+cnhSt.l+')</span>':'')+'</td>'+
      '<td class="px-4 py-3">'+aptoLabel+'</td>'+
      '<td class="px-4 py-3 text-right whitespace-nowrap">'+
        '<button class="btn btn-ghost text-xs" onclick="editEmployee(\''+m.id+'\')">✏️</button>'+
        '<button class="btn btn-ghost text-xs" onclick="manageEmpDocs(\''+m.id+'\')">📑</button>'+
      '</td>'+
    '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

function editEmployee(id){
  if(!DB.employees) DB.employees = [];
  const company = (typeof currentCompany==='function') ? currentCompany() : null;
  const base = id ? DB.employees.find(x=>x.id===id) : null;
  const e = base ? base : {
    companyId: company?company.id:(DB.companies[0]?DB.companies[0].id:''),
    name:'', cpf:'', rg:'', email:'', phone:'',
    cargo:'', salary:0, admissao:'', status:'ativo',
    isMotorista:false, cnhCategoria:'',
    docs:[]
  };
  const companyOpts = (DB.companies||[]).map(x=>'<option value="'+x.id+'" '+(e.companyId===x.id?'selected':'')+'>'+escapeHtml(x.name)+'</option>').join('');
  const statusOpts = EMP_STATUS.map(s=>'<option value="'+s.v+'" '+(e.status===s.v?'selected':'')+'>'+s.l+'</option>').join('');
  const cnhOpts = '<option value="">—</option>'+CNH_CATEGORIAS.map(c=>'<option value="'+c+'" '+(e.cnhCategoria===c?'selected':'')+'>'+c+'</option>').join('');

  const html = ''+
    '<div class="form-section">'+
      '<div class="form-section-title">👤 Dados Pessoais</div>'+
      '<div class="grid-2 mb-3">'+
        '<div><span class="label">Empresa *</span><select id="emCompany" class="input">'+companyOpts+'</select></div>'+
        '<div><span class="label">Status</span><select id="emStatus" class="input">'+statusOpts+'</select></div>'+
      '</div>'+
      '<div class="mb-3"><span class="label">Nome completo *</span><input id="emName" class="input" value="'+escapeHtml(e.name||'')+'"></div>'+
      '<div class="grid-2 mb-3">'+
        '<div><span class="label">CPF</span><input id="emCpf" class="input" placeholder="000.000.000-00" value="'+escapeHtml(e.cpf||'')+'"></div>'+
        '<div><span class="label">RG</span><input id="emRg" class="input" value="'+escapeHtml(e.rg||'')+'"></div>'+
      '</div>'+
      '<div class="grid-2 mb-3">'+
        '<div><span class="label">E-mail</span><input id="emEmail" type="email" class="input" value="'+escapeHtml(e.email||'')+'"></div>'+
        '<div><span class="label">Telefone</span><input id="emPhone" class="input" placeholder="(00) 00000-0000" value="'+escapeHtml(e.phone||'')+'"></div>'+
      '</div>'+
    '</div>'+

    '<div class="form-section">'+
      '<div class="form-section-title">💼 Vínculo Empregatício</div>'+
      '<div class="grid-2 mb-3">'+
        '<div><span class="label">Cargo</span><input id="emCargo" class="input" placeholder="Ex.: Motorista" value="'+escapeHtml(e.cargo||'')+'"></div>'+
        '<div><span class="label">Salário base</span><input id="emSalary" class="input" value="'+(e.salary||0)+'"></div>'+
      '</div>'+
      '<div><span class="label">Data de admissão</span><input id="emAdmissao" type="date" class="input" value="'+escapeHtml(e.admissao||'')+'"></div>'+
    '</div>'+

    '<div class="form-section" style="border-left:4px solid #0284c7;background:#eff6ff;padding:1rem;border-radius:8px;margin-top:1rem">'+
      '<div class="form-section-title" style="color:#1e40af;font-weight:700;margin-bottom:.5rem">🚚 Motorista</div>'+
      '<div class="mb-3">'+
        '<label class="flex items-center gap-2 cursor-pointer">'+
          '<input type="checkbox" id="emIsMotorista" '+(e.isMotorista?'checked':'')+' onchange="document.getElementById(\'emMotoristaFields\').style.display=this.checked?\'block\':\'none\'">'+
          '<span class="font-semibold text-slate-800">É motorista</span>'+
        '</label>'+
        '<div class="text-xs text-slate-600 mt-1">Marque para habilitar categoria da CNH. Documentos CNH/EAR/ASO/Toxicológico são gerenciados em 📑 após salvar.</div>'+
      '</div>'+
      '<div id="emMotoristaFields" style="display:'+(e.isMotorista?'block':'none')+'">'+
        '<div><span class="label">Categoria CNH</span><select id="emCnhCat" class="input">'+cnhOpts+'</select></div>'+
      '</div>'+
    '</div>';

  openModal(id?'Editar funcionário':'Novo funcionário', html, ()=>{
    const data = {
      companyId: document.getElementById('emCompany').value,
      status:    document.getElementById('emStatus').value,
      name:      document.getElementById('emName').value.trim(),
      cpf:       document.getElementById('emCpf').value.trim(),
      rg:        document.getElementById('emRg').value.trim(),
      email:     document.getElementById('emEmail').value.trim(),
      phone:     document.getElementById('emPhone').value.trim(),
      cargo:     document.getElementById('emCargo').value.trim(),
      salary:    (typeof parseBRL==='function')?parseBRL(document.getElementById('emSalary').value):parseFloat(document.getElementById('emSalary').value)||0,
      admissao:  document.getElementById('emAdmissao').value,
      isMotorista: document.getElementById('emIsMotorista').checked,
      cnhCategoria: document.getElementById('emCnhCat').value
    };
    if(!data.name){ toast('Informe o nome do funcionário','err'); return false; }
    if(id){ Object.assign(e, data); }
    else { DB.employees.push(Object.assign({id:uid('emp'), createdAt:new Date().toISOString(), docs:[]}, data)); }
    saveDB();
    toast(id?'Funcionário atualizado ✓':'Funcionário cadastrado ✓');
    renderRH();
  }, 'lg');
}

function deleteEmployee(id){
  if(!confirm('Excluir este funcionário e todos os seus documentos?')) return;
  DB.employees = (DB.employees||[]).filter(x=>x.id!==id);
  saveDB();
  toast('Funcionário excluído');
  renderRH();
}

function manageEmpDocs(empId){
  const emp = (DB.employees||[]).find(x=>x.id===empId);
  if(!emp) return;
  if(!Array.isArray(emp.docs)) emp.docs = [];
  const renderBody = ()=>{
    let body = '<div class="text-sm text-slate-600 mb-3">Funcionário: <strong>'+escapeHtml(emp.name||'')+'</strong>'+(emp.cargo?' — '+escapeHtml(emp.cargo):'')+'</div>';
    body += '<div class="flex justify-end mb-2"><button class="btn btn-primary text-sm" onclick="addEmpDoc(\''+empId+'\')">+ Novo documento</button></div>';
    if(!emp.docs.length){
      body += '<div class="text-center py-6 text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg">Nenhum documento cadastrado</div>';
    } else {
      body += '<div class="overflow-x-auto"><table class="w-full text-sm">';
      body += '<thead><tr class="text-left border-b border-slate-200 bg-slate-50">'+
        '<th class="px-2 py-1.5 font-semibold text-slate-600">Tipo</th>'+
        '<th class="px-2 py-1.5 font-semibold text-slate-600">Nº</th>'+
        '<th class="px-2 py-1.5 font-semibold text-slate-600">Emissão</th>'+
        '<th class="px-2 py-1.5 font-semibold text-slate-600">Validade</th>'+
        '<th class="px-2 py-1.5 font-semibold text-slate-600">Status</th>'+
        '<th class="px-2 py-1.5 font-semibold text-slate-600 text-right">Ações</th>'+
      '</tr></thead><tbody>';
      emp.docs.forEach((d,i)=>{
        const tipo = EMP_DOC_TIPOS.find(t=>t.v===d.tipo) || EMP_DOC_TIPOS[EMP_DOC_TIPOS.length-1];
        const st = _empDocStatus(d);
        body += '<tr class="border-b border-slate-100">'+
          '<td class="px-2 py-1.5">'+escapeHtml(tipo.l)+'</td>'+
          '<td class="px-2 py-1.5 text-xs">'+escapeHtml(d.numero||'—')+'</td>'+
          '<td class="px-2 py-1.5 text-xs">'+(d.emissao? new Date(d.emissao).toLocaleDateString('pt-BR') : '—')+'</td>'+
          '<td class="px-2 py-1.5 text-xs">'+(d.validade? new Date(d.validade).toLocaleDateString('pt-BR') : '—')+'</td>'+
          '<td class="px-2 py-1.5"><span style="background:'+st.bg+';color:'+st.c+';padding:.15rem .5rem;border-radius:999px;font-size:.7rem;font-weight:700">'+escapeHtml(st.l)+'</span></td>'+
          '<td class="px-2 py-1.5 text-right whitespace-nowrap">'+
            '<button class="btn btn-ghost text-xs" onclick="editEmpDoc(\''+empId+'\','+i+')">✏️</button>'+
            '<button class="btn btn-ghost text-xs" onclick="removeEmpDoc(\''+empId+'\','+i+')">🗑️</button>'+
          '</td>'+
        '</tr>';
      });
      body += '</tbody></table></div>';
    }
    return body;
  };
  openModal('Documentos do funcionário', renderBody(), null, 'lg');
  setTimeout(()=>{ const sb=document.getElementById('modalSaveBtn'); if(sb) sb.style.display='none'; },30);
}

function addEmpDoc(empId){ editEmpDoc(empId, -1); }

function editEmpDoc(empId, idx){
  const emp = (DB.employees||[]).find(x=>x.id===empId);
  if(!emp) return;
  if(!Array.isArray(emp.docs)) emp.docs = [];
  const isNew = idx < 0;
  const d = isNew ? {tipo:'cnh', numero:'', emissao:'', validade:'', observacoes:''} : emp.docs[idx];
  const tipoOpts = EMP_DOC_TIPOS.map(t=>'<option value="'+t.v+'" '+(d.tipo===t.v?'selected':'')+'>'+t.l+'</option>').join('');
  const html = ''+
    '<div class="grid-2 mb-3">'+
      '<div><span class="label">Tipo de documento</span><select id="edTipo" class="input">'+tipoOpts+'</select></div>'+
      '<div><span class="label">Nº / Identificação</span><input id="edNumero" class="input" value="'+escapeHtml(d.numero||'')+'"></div>'+
    '</div>'+
    '<div class="grid-2 mb-3">'+
      '<div><span class="label">Data de emissão</span><input id="edEmissao" type="date" class="input" value="'+escapeHtml(d.emissao||'')+'"></div>'+
      '<div><span class="label">Data de validade</span><input id="edValidade" type="date" class="input" value="'+escapeHtml(d.validade||'')+'"></div>'+
    '</div>'+
    '<div><span class="label">Observações</span><textarea id="edObs" class="input" rows="2">'+escapeHtml(d.observacoes||'')+'</textarea></div>';
  openModal(isNew?'Novo documento':'Editar documento', html, ()=>{
    const data = {
      tipo:     document.getElementById('edTipo').value,
      numero:   document.getElementById('edNumero').value.trim(),
      emissao:  document.getElementById('edEmissao').value,
      validade: document.getElementById('edValidade').value,
      observacoes: document.getElementById('edObs').value.trim()
    };
    if(isNew){ emp.docs.push(data); }
    else { Object.assign(emp.docs[idx], data); }
    saveDB();
    toast(isNew?'Documento adicionado ✓':'Documento atualizado ✓');
    closeModal();
    manageEmpDocs(empId);
  });
}

function removeEmpDoc(empId, idx){
  if(!confirm('Remover este documento?')) return;
  const emp = (DB.employees||[]).find(x=>x.id===empId);
  if(!emp) return;
  emp.docs.splice(idx,1);
  saveDB();
  toast('Documento removido');
  closeModal();
  manageEmpDocs(empId);
}
