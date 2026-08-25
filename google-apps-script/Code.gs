const HISTORY_SCHEMA_VERSION = 1;
const PATIENTS_SHEET = 'Pacientes';
const PROPOSALS_SHEET = 'Propostas';
const SNAPSHOT_PARTS = 5;
const SNAPSHOT_CHUNK = 45000;

const PATIENT_HEADERS = [
  'patient_id','nome','nome_normalizado','criado_em','atualizado_em','arquivado'
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
  const proposals = rowsAsObjects_(qs, PROPOSAL_HEADERS).filter(r => !truthy_(r.arquivado));

  const byPatient = {};
  proposals.forEach(p => {
    const id = String(p.patient_id || '');
    if (!byPatient[id]) byPatient[id] = [];
    byPatient[id].push(p);
  });

  const out = patients.map(p => {
    const list = (byPatient[String(p.patient_id)] || []).sort((a,b) => Number(b.versao||0)-Number(a.versao||0));
    const latest = list[0] || {};
    return {
      patient_id:String(p.patient_id),
      nome:String(p.nome||''),
      proposal_count:list.length,
      latest_version:list.length ? Number(latest.versao||0) : null,
      latest_total:list.length ? Number(latest.total||0) : null,
      latest_updated:list.length ? iso_(latest.atualizado_em || latest.criado_em) : ''
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
  return {proposal:{proposal_id:proposalId, patient_id:patientId, patient_name:name, versao:nextVersion, atualizado_em:iso_(now)}};
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
  return {proposal:{proposal_id:proposalId, patient_id:String(found.obj.patient_id), patient_name:name, versao:Number(found.obj.versao||0), atualizado_em:iso_(now)}};
}

function archiveProposal_(body) {
  const proposalId = required_(body.proposalId, 'proposalId');
  const ss = db_();
  const qs = ss.getSheetByName(PROPOSALS_SHEET);
  const found = findRowById_(qs, PROPOSAL_HEADERS, 'proposal_id', proposalId);
  if (!found) throw new Error('Proposta não encontrada.');
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
  sheet.appendRow([id, name, normalizeName_(name), now, now, false]);
  return {row:sheet.getLastRow(), obj:{patient_id:id,nome:name,nome_normalizado:normalizeName_(name),criado_em:now,atualizado_em:now,arquivado:false}};
}

function touchPatient_(sheet, row, name) {
  writeObjectUpdates_(sheet, row, PATIENT_HEADERS, {
    nome:name,
    nome_normalizado:normalizeName_(name),
    atualizado_em:new Date()
  });
}

function findPatientsByNormalizedName_(sheet, name) {
  const n = normalizeName_(name);
  const rows = rowsAsObjectsWithRow_(sheet, PATIENT_HEADERS);
  return rows.filter(x => String(x.obj.nome_normalizado || '') === n);
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
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  const current = sh.getRange(1,1,1,headers.length).getValues()[0].map(String);
  if (current.join('|') !== headers.join('|')) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
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
function db_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Banco não configurado. Execute setupHistoryDatabase() primeiro.');
  const ss = SpreadsheetApp.openById(id);
  if (!ss.getSheetByName(PATIENTS_SHEET) || !ss.getSheetByName(PROPOSALS_SHEET)) throw new Error('Abas do histórico não encontradas. Execute setupHistoryDatabase() novamente.');
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
