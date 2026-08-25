const HISTORY_SCHEMA_VERSION = 2;
const PATIENTS_SHEET = 'Pacientes';
const PROPOSALS_SHEET = 'Propostas';
const SNAPSHOT_PARTS = 5;
const SNAPSHOT_CHUNK = 45000;

const PATIENT_HEADERS = [
  'patient_id','nome','nome_normalizado','criado_em','atualizado_em','arquivado',
  'amigo_id','data_nascimento','cpf','sexo','email','celular','cep','endereco',
  'cadastro_origem','cadastro_atualizado_em'
];

const PROPOSAL_HEADERS = [
  'proposal_id','patient_id','versao','criado_em','atualizado_em',
  'data_orcamento','data_cirurgia','procedimentos','hospital','total',
  'entrada','restante_medico','status','app_version',
  'snapshot_1','snapshot_2','snapshot_3','snapshot_4','snapshot_5','arquivado'
];

function setupHistoryDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Abra o Apps Script a partir da planilha do histórico.');
  ss.setSpreadsheetTimeZone('America/Sao_Paulo');
  try { ss.setSpreadsheetLocale('pt_BR'); } catch (e) {}

  const patients = ensureSheet_(ss, PATIENTS_SHEET, PATIENT_HEADERS);
  const proposals = ensureSheet_(ss, PROPOSALS_SHEET, PROPOSAL_HEADERS);
  formatSheets_(patients, proposals);

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());
  if (!props.getProperty('API_TOKEN')) props.setProperty('API_TOKEN', generateToken_());
  props.setProperty('SCHEMA_VERSION', String(HISTORY_SCHEMA_VERSION));

  const info = getSetupInfo_();
  Logger.log('=== CONFIGURAÇÃO DO HISTÓRICO ===');
  Logger.log('PLANILHA: %s', info.spreadsheetName);
  Logger.log('SPREADSHEET_ID: %s', info.spreadsheetId);
  Logger.log('API_TOKEN: %s', info.apiToken);
  Logger.log('WEB_APP_URL: %s', info.webAppUrl || '(será exibida depois da implantação do Web App)');
  Logger.log('================================');
  return info;
}

function mostrarConfiguracao() {
  const info = getSetupInfo_();
  Logger.log(JSON.stringify(info, null, 2));
  return info;
}

function resetApiToken() {
  const token = generateToken_();
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  Logger.log('NOVO API_TOKEN: %s', token);
  return token;
}

function testarBancoLocalmente() {
  const ss = db_();
  const out = {
    ok: true,
    spreadsheet: ss.getName(),
    patients: Math.max(0, ss.getSheetByName(PATIENTS_SHEET).getLastRow() - 1),
    proposals: Math.max(0, ss.getSheetByName(PROPOSALS_SHEET).getLastRow() - 1)
  };
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

function doGet() {
  return json_({ok:true, service:'Plano Cirúrgico - Histórico', message:'Use o aplicativo para acessar este endpoint.'});
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    authorize_(body.token);
    const action = String(body.action || '').trim();
    if (!action) throw new Error('Ação não informada.');

    let result;
    switch (action) {
      case 'ping': result = ping_(); break;
      case 'listPatients': result = listPatients_(body); break;
      case 'listProposals': result = listProposals_(body); break;
      case 'getProposal': result = getProposal_(body); break;
      case 'getPatientProfile': result = getPatientProfile_(body); break;
      case 'updatePatientProfile': result = withLock_(() => updatePatientProfile_(body)); break;
      case 'bulkUpdatePatientProfiles': result = withLock_(() => bulkUpdatePatientProfiles_(body)); break;
      case 'createVersion': result = withLock_(() => createVersion_(body)); break;
      case 'overwriteProposal': result = withLock_(() => overwriteProposal_(body)); break;
      case 'archiveProposal': result = withLock_(() => archiveProposal_(body)); break;
      default: throw new Error('Ação desconhecida: ' + action);
    }
    return json_(Object.assign({ok:true}, result || {}));
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function ping_() {
  const ss = db_();
  return {
    service:'history',
    schemaVersion:HISTORY_SCHEMA_VERSION,
    spreadsheetName:ss.getName(),
    serverTime:new Date().toISOString()
  };
}

function listPatients_(body) {
  const ss = db_();
  const ps = ss.getSheetByName(PATIENTS_SHEET);
  const qs = ss.getSheetByName(PROPOSALS_SHEET);
  const patients = rowsAsObjects_(ps, PATIENT_HEADERS).filter(r => !truthy_(r.arquivado));
  const allProposals = rowsAsObjects_(qs, PROPOSAL_HEADERS);
  const proposals = allProposals.filter(r => !truthy_(r.arquivado));

  const byPatient = {}, byPatientAll = {};
  allProposals.forEach(p => {
    const id = String(p.patient_id || '');
    if (!byPatientAll[id]) byPatientAll[id] = [];
    byPatientAll[id].push(p);
  });
  proposals.forEach(p => {
    const id = String(p.patient_id || '');
    if (!byPatient[id]) byPatient[id] = [];
    byPatient[id].push(p);
  });

  const out = patients.map(p => {
    const list = (byPatient[String(p.patient_id)] || []).sort((a,b) => Number(b.versao||0)-Number(a.versao||0));
    const totalList = byPatientAll[String(p.patient_id)] || [];
    const latest = list[0] || {};
    return {
      patient_id:String(p.patient_id),
      nome:String(p.nome||''),
      proposal_count:list.length,
      proposal_count_total:totalList.length,
      latest_version:list.length ? Number(latest.versao||0) : null,
      latest_total:list.length ? Number(latest.total||0) : null,
      latest_updated:list.length ? iso_(latest.atualizado_em || latest.criado_em) : '',
      amigo_id:String(p.amigo_id||''),
      cpf:normalizeDigits_(p.cpf),
      data_nascimento:dateOnly_(p.data_nascimento),
      cadastro_count:profileCompletionCount_(p),
      cadastro_completo:profileCompletionCount_(p) === 8
    };
  }).sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR', {sensitivity:'base'}));

  return {patients:out};
}

function listProposals_(body) {
  const patientId = required_(body.patientId, 'patientId');
  const ss = db_();
  const qs = ss.getSheetByName(PROPOSALS_SHEET);
  const proposals = rowsAsObjects_(qs, PROPOSAL_HEADERS)
    .filter(r => String(r.patient_id) === String(patientId) && !truthy_(r.arquivado))
    .sort((a,b) => Number(b.versao||0)-Number(a.versao||0))
    .map(p => proposalPublic_(p));
  return {proposals};
}

function getProposal_(body) {
  const proposalId = required_(body.proposalId, 'proposalId');
  const ss = db_();
  const qs = ss.getSheetByName(PROPOSALS_SHEET);
  const found = findRowById_(qs, PROPOSAL_HEADERS, 'proposal_id', proposalId);
  if (!found) throw new Error('Proposta não encontrada.');
  if (truthy_(found.obj.arquivado)) throw new Error('Esta proposta está arquivada.');
  const ps = ss.getSheetByName(PATIENTS_SHEET);
  const patient = findRowById_(ps, PATIENT_HEADERS, 'patient_id', found.obj.patient_id);
  const snapshot = readSnapshot_(found.obj);
  return {
    proposal:Object.assign(proposalPublic_(found.obj), {patient_name: patient ? String(patient.obj.nome||'') : ''}),
    snapshot
  };
}

function getPatientProfile_(body) {
  const patientId = required_(body.patientId, 'patientId');
  const ss = db_();
  const ps = ss.getSheetByName(PATIENTS_SHEET);
  const found = findRowById_(ps, PATIENT_HEADERS, 'patient_id', patientId);
  if (!found || truthy_(found.obj.arquivado)) throw new Error('Paciente não encontrada.');
  return {profile:profilePublic_(found.obj)};
}

function updatePatientProfile_(body) {
  const patientId = required_(body.patientId, 'patientId');
  const ss = db_();
  const ps = ss.getSheetByName(PATIENTS_SHEET);
  const found = findRowById_(ps, PATIENT_HEADERS, 'patient_id', patientId);
  if (!found || truthy_(found.obj.arquivado)) throw new Error('Paciente não encontrada.');
  const clean = sanitizeProfile_(body.profile || {}, false);
  if (!clean.nome) clean.nome = String(found.obj.nome || '').trim();
  if (!clean.nome) throw new Error('Nome da paciente é obrigatório.');
  const now = new Date();
  const updates = Object.assign({}, clean, {
    nome_normalizado:normalizeName_(clean.nome),
    atualizado_em:now,
    cadastro_origem:String(body.source || 'Manual').trim() || 'Manual',
    cadastro_atualizado_em:now
  });
  if (body.amigoId !== undefined) {
    const amigoId = String(body.amigoId || '').trim();
    if (amigoId) {
      const linkedElsewhere = rowsAsObjectsWithRow_(ps, PATIENT_HEADERS).find(x => String(x.obj.amigo_id||'') === amigoId && String(x.obj.patient_id||'') !== String(patientId));
      if (linkedElsewhere) throw new Error('ID do Amigo já vinculado a outra paciente.');
    }
    updates.amigo_id = amigoId;
  }
  writeObjectUpdates_(ps, found.row, PATIENT_HEADERS, updates);
  const refreshed = findRowById_(ps, PATIENT_HEADERS, 'patient_id', patientId);
  return {profile:profilePublic_(refreshed.obj)};
}

function bulkUpdatePatientProfiles_(body) {
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (!updates.length) return {updated:0, unchanged:0, failed:0, results:[]};
  if (updates.length > 500) throw new Error('Importação muito grande para uma única operação.');
  const ss = db_();
  const ps = ss.getSheetByName(PATIENTS_SHEET);
  const rows = rowsAsObjectsWithRow_(ps, PATIENT_HEADERS);
  const byPatientId = new Map(rows.map(x => [String(x.obj.patient_id||''), x]));
  const amigoOwners = new Map();
  rows.forEach(x => { const id=String(x.obj.amigo_id||'').trim(); if(id&&!amigoOwners.has(id))amigoOwners.set(id,String(x.obj.patient_id||'')); });
  let updated = 0, unchanged = 0, failed = 0;
  const results = [];
  updates.forEach(item => {
    const patientId = String(item.patientId || '').trim();
    const found = patientId ? byPatientId.get(patientId) : null;
    if (!found || truthy_(found.obj.arquivado)) {
      failed++; results.push({patientId, ok:false, error:'Paciente não encontrada'});
      return;
    }
    const incoming = sanitizeProfile_(item.profile || {}, true);
    const merged = {};
    PROFILE_FIELDS.forEach(k => {
      const v = incoming[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') merged[k] = v;
    });
    const amigoId = String(item.amigoId || '').trim();
    if (amigoId) {
      const owner = amigoOwners.get(amigoId);
      if (owner && owner !== patientId) {
        failed++; results.push({patientId, ok:false, error:'ID do Amigo já vinculado a outra paciente'});
        return;
      }
      merged.amigo_id = amigoId;
    }
    if (merged.nome) merged.nome_normalizado = normalizeName_(merged.nome);
    const changed = profileUpdatesChanged_(found.obj, merged);
    if (changed) {
      const now = new Date();
      merged.atualizado_em = now;
      merged.cadastro_origem = 'Amigo';
      merged.cadastro_atualizado_em = now;
      Object.assign(found.obj, merged);
      writeObjectRow_(ps, found.row, PATIENT_HEADERS, found.obj);
      if (amigoId) amigoOwners.set(amigoId, patientId);
      updated++;
    } else {
      unchanged++;
      if (amigoId) amigoOwners.set(amigoId, patientId);
    }
    results.push({patientId, ok:true, changed, cadastro_count:profileCompletionCount_(found.obj)});
  });
  return {updated, unchanged, failed, results};
}

function createVersion_(body) {
  validateSnapshot_(body.snapshot);
  const ss = db_();
  const ps = ss.getSheetByName(PATIENTS_SHEET);
  const qs = ss.getSheetByName(PROPOSALS_SHEET);
  const name = String(body.patientName || body.snapshot.patient && body.snapshot.patient.name || '').trim();
  if (!name) throw new Error('Nome da paciente não informado.');

  let patient = null;
  if (body.patientId) patient = findRowById_(ps, PATIENT_HEADERS, 'patient_id', body.patientId);
  if (!patient) {
    const matches = findPatientsByNormalizedName_(ps, name).filter(x => !truthy_(x.obj.arquivado));
    if (matches.length === 1) patient = matches[0];
  }
  if (!patient) patient = createPatient_(ps, name);

  const patientId = String(patient.obj.patient_id);
  const all = rowsAsObjects_(qs, PROPOSAL_HEADERS).filter(r => String(r.patient_id) === patientId);
  const nextVersion = all.reduce((m,r) => Math.max(m, Number(r.versao||0)), 0) + 1;
  const now = new Date();
  const proposalId = Utilities.getUuid();
  const meta = sanitizeMeta_(body.meta || {}, body.snapshot);
  const chunks = snapshotChunks_(body.snapshot);

  const row = [
    proposalId, patientId, nextVersion, now, now,
    meta.data_orcamento, meta.data_cirurgia, meta.procedimentos, meta.hospital, meta.total,
    meta.entrada, meta.restante_medico, 'ativa', meta.app_version,
    chunks[0],chunks[1],chunks[2],chunks[3],chunks[4], false
  ];
  qs.appendRow(row);
  touchPatient_(ps, patient.row, name);
  const patientAfter = findRowById_(ps, PATIENT_HEADERS, 'patient_id', patientId);
  return {proposal:{proposal_id:proposalId, patient_id:patientId, patient_name:patientAfter ? String(patientAfter.obj.nome||name) : name, versao:nextVersion, atualizado_em:iso_(now)}};
}

function overwriteProposal_(body) {
  validateSnapshot_(body.snapshot);
  const proposalId = required_(body.proposalId, 'proposalId');
  const ss = db_();
  const qs = ss.getSheetByName(PROPOSALS_SHEET);
  const found = findRowById_(qs, PROPOSAL_HEADERS, 'proposal_id', proposalId);
  if (!found) throw new Error('Proposta não encontrada.');
  if (truthy_(found.obj.arquivado)) throw new Error('Não é possível sobrescrever uma proposta arquivada.');
  const expectedUpdatedAt = String(body.expectedUpdatedAt || '').trim();
  const currentUpdatedAt = iso_(found.obj.atualizado_em || found.obj.criado_em);
  if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
    throw new Error('CONFLICT:Esta proposta foi modificada em outro dispositivo após ser aberta.');
  }

  const meta = sanitizeMeta_(body.meta || {}, body.snapshot);
  const chunks = snapshotChunks_(body.snapshot);
  const now = new Date();
  const updates = {
    atualizado_em:now,
    data_orcamento:meta.data_orcamento,
    data_cirurgia:meta.data_cirurgia,
    procedimentos:meta.procedimentos,
    hospital:meta.hospital,
    total:meta.total,
    entrada:meta.entrada,
    restante_medico:meta.restante_medico,
    status:'ativa',
    app_version:meta.app_version,
    snapshot_1:chunks[0],snapshot_2:chunks[1],snapshot_3:chunks[2],snapshot_4:chunks[3],snapshot_5:chunks[4]
  };
  writeObjectUpdates_(qs, found.row, PROPOSAL_HEADERS, updates);

  const ps = ss.getSheetByName(PATIENTS_SHEET);
  const patient = findRowById_(ps, PATIENT_HEADERS, 'patient_id', found.obj.patient_id);
  const name = String(body.snapshot.patient && body.snapshot.patient.name || patient && patient.obj.nome || '').trim();
  if (patient) touchPatient_(ps, patient.row, name || patient.obj.nome);
  const patientAfter = findRowById_(ps, PATIENT_HEADERS, 'patient_id', found.obj.patient_id);
  const patientName = patientAfter ? String(patientAfter.obj.nome||name) : name;
  return {proposal:{proposal_id:proposalId, patient_id:String(found.obj.patient_id), patient_name:patientName, versao:Number(found.obj.versao||0), atualizado_em:iso_(now)}};
}

function archiveProposal_(body) {
  const proposalId = required_(body.proposalId, 'proposalId');
  const ss = db_();
  const qs = ss.getSheetByName(PROPOSALS_SHEET);
  const found = findRowById_(qs, PROPOSAL_HEADERS, 'proposal_id', proposalId);
  if (!found) throw new Error('Proposta não encontrada.');
  if (truthy_(found.obj.arquivado)) throw new Error('Esta proposta já está arquivada.');
  const expectedUpdatedAt = String(body.expectedUpdatedAt || '').trim();
  const currentUpdatedAt = iso_(found.obj.atualizado_em || found.obj.criado_em);
  if (expectedUpdatedAt && currentUpdatedAt && expectedUpdatedAt !== currentUpdatedAt) {
    throw new Error('CONFLICT:Esta proposta foi modificada em outro dispositivo após ser aberta.');
  }
  writeObjectUpdates_(qs, found.row, PROPOSAL_HEADERS, {arquivado:true, status:'arquivada', atualizado_em:new Date()});
  return {proposalId};
}

function sanitizeMeta_(meta, snapshot) {
  const c = snapshot.computed || {};
  return {
    data_orcamento:String(meta.data_orcamento || snapshot.fields && snapshot.fields.budgetDate || ''),
    data_cirurgia:String(meta.data_cirurgia || snapshot.fields && snapshot.fields.surgeryDate || ''),
    procedimentos:String(meta.procedimentos || ''),
    hospital:String(meta.hospital || ''),
    total:finiteNumber_(meta.total, c.total),
    entrada:finiteNumber_(meta.entrada, c.signal),
    restante_medico:finiteNumber_(meta.restante_medico, c.teamBalance),
    app_version:String(meta.app_version || snapshot.appVersion || '')
  };
}

function validateSnapshot_(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('Snapshot ausente ou inválido.');
  if (!snapshot.patient || !String(snapshot.patient.name || '').trim()) throw new Error('Snapshot sem nome da paciente.');
  const json = JSON.stringify(snapshot);
  if (json.length > SNAPSHOT_PARTS * SNAPSHOT_CHUNK) throw new Error('Snapshot muito grande para o armazenamento configurado.');
}

function snapshotChunks_(snapshot) {
  const json = JSON.stringify(snapshot);
  const chunks = [];
  for (let i=0;i<SNAPSHOT_PARTS;i++) chunks.push(json.slice(i*SNAPSHOT_CHUNK, (i+1)*SNAPSHOT_CHUNK));
  return chunks;
}

function readSnapshot_(obj) {
  let json = '';
  for (let i=1;i<=SNAPSHOT_PARTS;i++) json += String(obj['snapshot_'+i] || '');
  if (!json) throw new Error('Snapshot não encontrado nesta proposta.');
  try { return JSON.parse(json); } catch (e) { throw new Error('Snapshot da proposta está corrompido.'); }
}

function createPatient_(sheet, name) {
  const now = new Date();
  const id = Utilities.getUuid();
  const rowObj = {
    patient_id:id,nome:name,nome_normalizado:normalizeName_(name),criado_em:now,atualizado_em:now,arquivado:false,
    amigo_id:'',data_nascimento:'',cpf:'',sexo:'',email:'',celular:'',cep:'',endereco:'',cadastro_origem:'',cadastro_atualizado_em:''
  };
  sheet.appendRow(PATIENT_HEADERS.map(h => rowObj[h] === undefined ? '' : rowObj[h]));
  return {row:sheet.getLastRow(), obj:rowObj};
}

function touchPatient_(sheet, row, name) {
  const current = rowsAsObjectsWithRow_(sheet, PATIENT_HEADERS).find(x => x.row === row);
  const linkedToAmigo = !!String(current && current.obj.amigo_id || '').trim();
  const updates = {atualizado_em:new Date()};
  if (!linkedToAmigo && String(name||'').trim()) {
    updates.nome = String(name).trim();
    updates.nome_normalizado = normalizeName_(name);
  }
  writeObjectUpdates_(sheet, row, PATIENT_HEADERS, updates);
}

function findPatientsByNormalizedName_(sheet, name) {
  const n = normalizeName_(name);
  const rows = rowsAsObjectsWithRow_(sheet, PATIENT_HEADERS);
  return rows.filter(x => String(x.obj.nome_normalizado || '') === n);
}

const PROFILE_FIELDS = ['nome','data_nascimento','cpf','sexo','email','celular','cep','endereco'];

function sanitizeProfile_(profile, importMode) {
  const out = {};
  if (!importMode || profile.nome !== undefined) out.nome = String(profile.nome || '').trim();
  if (!importMode || profile.data_nascimento !== undefined) out.data_nascimento = dateOnly_(profile.data_nascimento);
  if (!importMode || profile.cpf !== undefined) out.cpf = normalizeDigits_(profile.cpf).slice(0,11);
  if (!importMode || profile.sexo !== undefined) out.sexo = String(profile.sexo || '').trim();
  if (!importMode || profile.email !== undefined) out.email = String(profile.email || '').trim();
  if (!importMode || profile.celular !== undefined) out.celular = normalizeDigits_(profile.celular).slice(0,13);
  if (!importMode || profile.cep !== undefined) out.cep = normalizeDigits_(profile.cep).slice(0,8);
  if (!importMode || profile.endereco !== undefined) out.endereco = String(profile.endereco || '').trim();
  return out;
}
function profilePublic_(p) {
  const profile = {
    patient_id:String(p.patient_id||''),
    amigo_id:String(p.amigo_id||''),
    nome:String(p.nome||''),
    data_nascimento:dateOnly_(p.data_nascimento),
    cpf:normalizeDigits_(p.cpf),
    sexo:String(p.sexo||''),
    email:String(p.email||''),
    celular:normalizeDigits_(p.celular),
    cep:normalizeDigits_(p.cep),
    endereco:String(p.endereco||''),
    cadastro_origem:String(p.cadastro_origem||''),
    cadastro_atualizado_em:iso_(p.cadastro_atualizado_em || p.atualizado_em)
  };
  profile.cadastro_count = profileCompletionCount_(profile);
  profile.cadastro_completo = profile.cadastro_count === 8;
  return profile;
}
function profileCompletionCount_(p) {
  return PROFILE_FIELDS.reduce((n,k) => n + (String(p[k] || '').trim() ? 1 : 0), 0);
}
function profileUpdatesChanged_(current, updates) {
  return Object.keys(updates).some(k => {
    let a = current[k], b = updates[k];
    if (k === 'cpf' || k === 'celular' || k === 'cep') { a = normalizeDigits_(a); b = normalizeDigits_(b); }
    else if (k === 'data_nascimento') { a = dateOnly_(a); b = dateOnly_(b); }
    else { a = String(a == null ? '' : a).trim(); b = String(b == null ? '' : b).trim(); }
    return a !== b;
  });
}
function normalizeDigits_(v) { return String(v == null ? '' : v).replace(/\D/g,''); }
function dateOnly_(v) {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, 'America/Sao_Paulo', 'yyyy-MM-dd');
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return br[3] + '-' + br[2].padStart(2,'0') + '-' + br[1].padStart(2,'0');
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyy-MM-dd');
}

function proposalPublic_(p) {
  return {
    proposal_id:String(p.proposal_id||''),
    patient_id:String(p.patient_id||''),
    versao:Number(p.versao||0),
    criado_em:iso_(p.criado_em),
    atualizado_em:iso_(p.atualizado_em),
    data_orcamento:String(p.data_orcamento||''),
    data_cirurgia:String(p.data_cirurgia||''),
    procedimentos:String(p.procedimentos||''),
    hospital:String(p.hospital||''),
    total:Number(p.total||0),
    entrada:Number(p.entrada||0),
    restante_medico:Number(p.restante_medico||0),
    status:String(p.status||'ativa'),
    app_version:String(p.app_version||'')
  };
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return sh;
  }
  const existingWidth = Math.max(1, sh.getLastColumn());
  const current = sh.getRange(1,1,1,existingWidth).getValues()[0].map(v => String(v||'').trim());
  const compareWidth = Math.min(current.length, headers.length);
  for (let i=0;i<compareWidth;i++) {
    if (!current[i] || headers[i] !== current[i]) {
      throw new Error('Estrutura inesperada na aba "' + name + '". Não insira, remova, reordene nem renomeie os cabeçalhos existentes.');
    }
  }
  if (current.length > headers.length) {
    const extras = current.slice(headers.length).filter(Boolean);
    if (extras.length) throw new Error('A aba "' + name + '" possui colunas desconhecidas após a estrutura esperada.');
  }
  if (current.length < headers.length) {
    const missing = headers.slice(current.length);
    sh.getRange(1,current.length+1,1,missing.length).setValues([missing]);
  }
  return sh;
}

function formatSheets_(patients, proposals) {
  [patients,proposals].forEach(sh => {
    sh.setFrozenRows(1);
    const h = sh.getRange(1,1,1,sh.getLastColumn());
    h.setFontWeight('bold').setBackground('#0c262c').setFontColor('#ffffff');
    sh.autoResizeColumns(1, Math.min(sh.getLastColumn(), 14));
  });
  const totalCol = PROPOSAL_HEADERS.indexOf('total')+1;
  const entradaCol = PROPOSAL_HEADERS.indexOf('entrada')+1;
  const restanteCol = PROPOSAL_HEADERS.indexOf('restante_medico')+1;
  [totalCol,entradaCol,restanteCol].forEach(c => proposals.getRange(2,c,Math.max(1,proposals.getMaxRows()-1),1).setNumberFormat('R$ #,##0.00'));
  for(let i=1;i<=SNAPSHOT_PARTS;i++){
    const c=PROPOSAL_HEADERS.indexOf('snapshot_'+i)+1;
    proposals.getRange(2,c,Math.max(1,proposals.getMaxRows()-1),1).setNumberFormat('@');
    proposals.hideColumns(c);
  }
}

function rowsAsObjects_(sheet, headers) {
  return rowsAsObjectsWithRow_(sheet, headers).map(x => x.obj);
}
function rowsAsObjectsWithRow_(sheet, headers) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2,1,last-1,headers.length).getValues();
  return values.map((row,i) => ({row:i+2,obj:headers.reduce((o,h,j)=>(o[h]=row[j],o),{})}));
}
function findRowById_(sheet, headers, field, id) {
  return rowsAsObjectsWithRow_(sheet, headers).find(x => String(x.obj[field]) === String(id)) || null;
}
function writeObjectUpdates_(sheet, row, headers, updates) {
  Object.keys(updates).forEach(k => {
    const idx = headers.indexOf(k);
    if (idx >= 0) sheet.getRange(row, idx+1).setValue(updates[k]);
  });
}
function writeObjectRow_(sheet, row, headers, obj) {
  sheet.getRange(row,1,1,headers.length).setValues([headers.map(h => obj[h] === undefined ? '' : obj[h])]);
}
function db_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Banco não configurado. Execute setupHistoryDatabase() primeiro.');
  const ss = SpreadsheetApp.openById(id);
  ensureSheet_(ss, PATIENTS_SHEET, PATIENT_HEADERS);
  ensureSheet_(ss, PROPOSALS_SHEET, PROPOSAL_HEADERS);
  props.setProperty('SCHEMA_VERSION', String(HISTORY_SCHEMA_VERSION));
  return ss;
}
function authorize_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected) throw new Error('API_TOKEN não configurado. Execute setupHistoryDatabase().');
  if (!token || String(token) !== String(expected)) throw new Error('Token inválido.');
}
function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw new Error('Corpo da requisição vazio.');
  try { return JSON.parse(e.postData.contents); } catch (err) { throw new Error('JSON inválido.'); }
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function required_(v, name) { if (v === undefined || v === null || String(v).trim() === '') throw new Error(name + ' é obrigatório.'); return v; }
function truthy_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'sim'; }
function normalizeName_(s) { return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' '); }
function generateToken_() { return Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''); }
function finiteNumber_(a,b) { const x=Number(a); if(Number.isFinite(x))return x; const y=Number(b); return Number.isFinite(y)?y:0; }
function iso_(v) { if(!v)return ''; const d=v instanceof Date?v:new Date(v); return isNaN(d.getTime())?String(v):d.toISOString(); }
function getSetupInfo_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID') || '';
  let name='';
  if(id){try{name=SpreadsheetApp.openById(id).getName();}catch(e){}}
  return {
    schemaVersion:HISTORY_SCHEMA_VERSION,
    spreadsheetId:id,
    spreadsheetName:name,
    apiToken:props.getProperty('API_TOKEN') || '',
    webAppUrl:ScriptApp.getService().getUrl() || ''
  };
}
