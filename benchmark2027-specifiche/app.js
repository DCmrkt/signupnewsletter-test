import { sections } from './questions.js';
import { deliveryConfig } from './config.js';
import { createDeliveryService } from './submission-service.js';
import { deliveryView } from './submission-state.js';

const PREVIEW = new URL(location.href).searchParams.get('preview') === '1';
const delivery = createDeliveryService(deliveryConfig);
let requestId = crypto.randomUUID();
let busy = false;
let checkOnly = false;
let frozen = false;
const RECIPIENT = 'mirco.devito@mondadori.it';
const MAX_MESSAGE = 4000;
const labels = ['I tuoi riferimenti', 'La tua organizzazione', 'Il tuo database', 'I macro-canali', 'Ultime indicazioni', 'Il messaggio finale'];
const descriptions = [
  'Presentati: ci aiuterà a collegare le specifiche alla tua organizzazione.',
  'Raccontaci come è strutturata la raccolta fondi e quali sono le vostre previsioni per il 2026.',
  'Condividi i criteri che ci permetteranno di interpretare correttamente le informazioni nel database.',
  'Per alcuni KPI, come l’attrition, forniremo un dettaglio per macro-canale. Aiutaci a classificare le campagne: quelle non riconducibili ai canali indicati saranno classificate come ALTRO.',
  'Segnala eventuali eccezioni o informazioni che vuoi condividere con il team.',
  'Rileggi e personalizza il messaggio. Il destinatario è già impostato: ti basta confermare quando sei pronto.'
];
const tags = ['COMINCIAMO DA QUI', 'UNO SGUARDO D’INSIEME', 'DAI DATI ALLE INFORMAZIONI', 'LA LETTURA DEI CANALI', 'I DETTAGLI FANNO LA DIFFERENZA', 'L’ULTIMO PASSAGGIO'];
const headings = ['I tuoi riferimenti', 'La tua organizzazione', 'I criteri nel database', 'Le campagne, per canale', 'Prima di concludere', 'Una mail, con le tue parole.'];
const $ = id => document.getElementById(id);
const form = $('survey');
const answers = new Map();
const panels = [];
let current = 0;
let furthest = 0;
let bodyEdited = false;
let subjectEdited = false;
let completed = false;

$('demo-button').hidden = !PREVIEW;
if (PREVIEW) {
  $('mode-label').textContent = 'Anteprima interattiva';
  $('service-notice').textContent = ' · Nessuna risposta o email viene inviata.';
  $('collection-note').textContent = 'Modalità anteprima: i dati restano in questa scheda e si perdono ricaricando la pagina.';
} else if (deliveryConfig.enabled) {
  $('service-notice').textContent = ' · Il tuo messaggio per il team.';
  $('collection-note').textContent = 'Le risposte vengono registrate in Google Forms. Il messaggio personalizzato viene inviato solo a Mirco.';
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function textField(question) {
  const wrapper = element('div', 'field');
  const id = `answer-${question.id}`;
  const label = element('label', '', question.title);
  label.htmlFor = id;
  if (question.required) label.append(element('span', 'required-star', ' *'));
  wrapper.append(label);
  const input = element(question.type === 1 ? 'textarea' : 'input', question.type === 1 ? 'long-answer' : 'text-input');
  input.id = id;
  input.name = question.id;
  input.required = question.required;
  if (question.type !== 1) input.type = question.id === 'email' ? 'email' : 'text';
  if (question.id === 'email') { input.autocomplete = 'email'; input.placeholder = 'nome@organizzazione.it'; }
  else if (question.id === '2092238618') { input.autocomplete = 'name'; input.placeholder = 'Come ti chiami?'; }
  else if (question.id === '479301265') { input.autocomplete = 'organization'; input.placeholder = 'Il nome della tua organizzazione'; }
  else input.placeholder = 'Scrivi qui la tua risposta…';
  if (question.description) {
    const help = element('p', 'field-help', question.description);
    help.id = `help-${question.id}`;
    input.setAttribute('aria-describedby', help.id);
    wrapper.append(help);
  }
  wrapper.append(input);
  answers.set(question.id, {question, wrapper, input});
  return wrapper;
}

function choiceField(question) {
  const wrapper = element('fieldset', 'field');
  const legend = element('legend', '', question.title);
  if (question.required) legend.append(element('span', 'required-star', ' *'));
  wrapper.append(legend);
  if (question.description) wrapper.append(element('p', 'field-help', question.description));
  const grid = element('div', 'choice-grid');
  const inputs = [];
  let otherChoice;
  let otherInput;
  for (const [index, option] of question.options.entries()) {
    const label = element('label', 'choice');
    const input = element('input');
    input.type = question.type === 4 ? 'checkbox' : 'radio';
    input.name = question.id;
    input.id = `answer-${question.id}-${index}`;
    input.value = option.label;
    if (question.required && question.type === 2) input.required = true;
    label.append(input, element('span', '', option.label));
    grid.append(label);
    inputs.push(input);
    if (option.other) otherChoice = input;
  }
  wrapper.append(grid);
  if (otherChoice) {
    const otherBox = element('div', 'other-answer');
    otherBox.hidden = true;
    const label = element('label', 'sr-only', `Specifica altro: ${question.title}`);
    otherInput = element('input', 'text-input');
    otherInput.type = 'text';
    otherInput.id = `other-${question.id}`;
    otherInput.name = `${question.id}-other`;
    otherInput.placeholder = 'Specifica la tua risposta';
    label.htmlFor = otherInput.id;
    otherBox.append(label, otherInput);
    wrapper.append(otherBox);
    for (const input of inputs) input.addEventListener('change', () => {
      otherBox.hidden = !otherChoice.checked;
      otherInput.required = otherChoice.checked;
      otherInput.disabled = !otherChoice.checked;
      otherInput.setCustomValidity('');
      if (input === otherChoice && input.checked) otherInput.focus();
    });
    otherInput.disabled = true;
  }
  if (question.type === 2 && !question.required) {
    const clear = element('button', 'text-button', 'Cancella selezione');
    clear.type = 'button';
    clear.setAttribute('aria-label', `Cancella selezione: ${question.title}`);
    clear.addEventListener('click', () => {
      for (const input of inputs) input.checked = false;
      if (otherInput) {
        otherInput.disabled = true;
        otherInput.required = false;
        wrapper.querySelector('.other-answer').hidden = true;
      }
      clearError();
    });
    wrapper.append(clear);
  }
  answers.set(question.id, {question, wrapper, inputs, otherChoice, otherInput});
  return wrapper;
}

sections.forEach((section, index) => {
  const panel = element('section', 'question-panel');
  panel.setAttribute('aria-label', headings[index]);
  panel.hidden = index !== 0;
  for (const question of section.questions) panel.append([0,1].includes(question.type) ? textField(question) : choiceField(question));
  $('sections').append(panel);
  panels.push(panel);
  const li = element('li');
  const button = element('button', 'step-button');
  button.type = 'button';
  button.setAttribute('aria-label', `Sezione ${index + 1}: ${labels[index]}`);
  button.append(element('span', 'step-number', String(index + 1).padStart(2, '0')), element('span', '', labels[index]));
  button.addEventListener('click', () => { if (index <= furthest) showSection(index); });
  li.append(button);
  $('step-list').append(li);
});

const final = panels[5];
const recommendation = element('div', 'recommendation');
recommendation.append(element('span', '', '↗'));
const reminder = element('p');
reminder.append(element('strong', '', 'Un’ultima raccomandazione.'), document.createTextNode(' Per la buona riuscita dell’analisi, assicurati che vengano caricate le azioni per le campagne di Direct Mailing del 2025–2026.'));
recommendation.append(reminder);
final.append(recommendation);
const recap = element('dl', 'recap');
for (const [key, title] of [['recap-name', 'Il tuo nome'], ['recap-org', 'Organizzazione']]) {
  const item = element('div');
  const value = element('dd'); value.id = key;
  item.append(element('dt', '', title), value); recap.append(item);
}
final.append(recap);
const composer = element('div', 'mail-composer');
const mailHeading = element('div', 'mail-heading');
const mailLabel = element('span'); mailLabel.append(element('i', 'mail-icon'), document.createTextNode('Il messaggio per il team'));
const reset = element('button', 'text-button', 'Ripristina template'); reset.type = 'button'; reset.id = 'reset-template';
mailHeading.append(mailLabel, reset);
const routing = element('dl', 'mail-routing');
for (const [title, value, id] of [['A', RECIPIENT, 'recipient'], ['Risposte a', '', 'reply-to']]) {
  const item = element('div'); const text = element('dd', 'mail-address', value); text.id = id;
  if (id === 'recipient') text.append(element('span', 'recipient-note', 'Unico destinatario'));
  item.append(element('dt', '', title), text); routing.append(item);
}
const mailContent = element('div', 'mail-content');
const subjectBox = element('div', 'field');
const subjectLabel = element('label', '', 'Oggetto'); subjectLabel.htmlFor = 'mail-subject';
const subject = element('input', 'text-input'); subject.id = 'mail-subject'; subject.name = 'mail-subject'; subject.type = 'text'; subject.required = true; subject.maxLength = 200;
subjectBox.append(subjectLabel, subject);
const bodyBox = element('div', 'field');
const bodyLabel = element('label', '', 'Il tuo messaggio'); bodyLabel.htmlFor = 'mail-body';
const body = element('textarea', 'long-answer'); body.id = 'mail-body'; body.name = 'mail-body'; body.required = true; body.maxLength = MAX_MESSAGE; body.spellcheck = true; body.setAttribute('aria-describedby', 'message-tip message-count');
bodyBox.append(bodyLabel, body);
const footer = element('div', 'composer-footer');
const tip = element('p', '', 'Puoi modificare liberamente il testo. Inserisci solo le informazioni utili alla conferma, senza dati di singoli donatori.'); tip.id = 'message-tip';
const count = element('output'); count.id = 'message-count'; count.htmlFor = 'mail-body';
footer.append(tip, count);
mailContent.append(subjectBox, bodyBox, footer);
composer.append(mailHeading, routing, mailContent);
final.append(composer);
const confirmation = element('label', 'confirmation');
const confirmed = element('input'); confirmed.type = 'checkbox'; confirmed.id = 'confirm-send'; confirmed.name = 'confirm-send'; confirmed.required = true;
const confirmText = element('span'); confirmText.append(document.createTextNode('Ho controllato il messaggio e desidero inviarlo a '), element('strong', '', RECIPIENT), document.createTextNode('.'));
confirmation.append(confirmed, confirmText); final.append(confirmation);
const templateStatus = element('p', 'template-status'); templateStatus.id = 'template-status'; templateStatus.setAttribute('role', 'status'); final.append(templateStatus);

function read(id) { return answers.get(id).input.value.trim(); }
function template() {
  const name = read('2092238618') || '[Nome e cognome]';
  const org = read('479301265') || '[Organizzazione]';
  return `Ciao Mirco,\n\nho completato il questionario Benchmark 2027 per ${org}.\n\nTi confermo che le informazioni inserite sono pronte per la vostra verifica. Per eventuali chiarimenti puoi rispondere a questa email.\n\nGrazie,\n${name}\n${org}`;
}
function updateCount() { count.value = `${body.value.length.toLocaleString('it-IT')} / 4.000`; }
function updateMessage() {
  $('recap-name').textContent = read('2092238618') || 'Da compilare';
  $('recap-org').textContent = read('479301265') || 'Da compilare';
  $('reply-to').textContent = read('email') || 'La tua email';
  if (!bodyEdited) body.value = template();
  if (!subjectEdited) subject.value = `Benchmark 2027 · Questionario completato${read('479301265') ? ' — ' + read('479301265') : ''}`.slice(0,200);
  updateCount();
}
function clearError() {
  $('form-error').hidden = true;
  for (const input of form.querySelectorAll('input, textarea')) { input.classList.remove('field-error'); input.removeAttribute('aria-invalid'); input.setCustomValidity(''); }
}
function updateNav() {
  for (const [index, button] of [...$('step-list').querySelectorAll('button')].entries()) {
    button.disabled = index > furthest;
    button.classList.toggle('complete', index < current);
    if (index === current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    button.querySelector('.step-number').textContent = index < current ? '✓' : String(index + 1).padStart(2, '0');
  }
}
function showSection(index, focus = true) {
  if (busy || frozen || (completed && !PREVIEW)) return;
  if (completed) confirmed.checked = false;
  $('form-view').hidden = false;
  $('success-view').hidden = true;
  clearError(); current = index; completed = false;
  panels.forEach((panel, i) => { panel.hidden = i !== index; });
  $('section-tag').textContent = tags[index];
  $('section-title').textContent = headings[index];
  $('section-description').textContent = descriptions[index];
  $('step-label').textContent = `SEZIONE ${String(index + 1).padStart(2, '0')} / 06`;
  $('progress-description').textContent = labels[index];
  $('progress').value = index + 1;
  $('back').hidden = index === 0;
  $('step-caption').textContent = index === 5 ? (PREVIEW ? 'Anteprima: nessun invio reale.' : 'Destinatario unico: Mirco.') : 'Un passo alla volta.';
  $('required-note').hidden = index === 5;
  $('next').textContent = index === 5 ? (PREVIEW ? 'Simula l’invio →' : deliveryConfig.enabled ? 'Invia questionario e messaggio →' : 'Invio in attivazione') : index === 4 ? 'Rivedi il messaggio →' : 'Continua →';
  $('next').disabled = index === 5 && !PREVIEW && !deliveryConfig.enabled;
  updateNav(); updateMessage();
  if (focus) { $('section-title').focus({preventScroll:true}); $('questionnaire').scrollIntoView({behavior:'instant', block:'start'}); }
}
function validatePanel(index) {
  for (const record of answers.values()) {
    if (!panels[index].contains(record.wrapper)) continue;
    if (record.inputs) {
      record.inputs[0].setCustomValidity(record.question.required && !record.inputs.some(input => input.checked) ? 'Seleziona almeno una risposta.' : '');
      if (record.otherChoice?.checked) record.otherInput.setCustomValidity(record.otherInput.value.trim() ? '' : 'Specifica la risposta Altro.');
    } else if (record.question.required && !record.input.value.trim()) record.input.setCustomValidity('Compila questo campo.');
  }
  if (index === 5) {
    body.setCustomValidity(!body.value.trim() ? 'Scrivi il messaggio da inviare.' : body.value.length > MAX_MESSAGE ? 'Il messaggio può contenere al massimo 4.000 caratteri.' : '');
    subject.setCustomValidity(subject.value.trim() ? '' : 'Scrivi un oggetto per la mail.');
    confirmed.setCustomValidity(confirmed.checked ? '' : 'Conferma di avere controllato il messaggio.');
  }
  const invalid = [...panels[index].querySelectorAll('input, textarea')].find(input => !input.disabled && !input.checkValidity());
  if (invalid) {
    invalid.setAttribute('aria-invalid', 'true'); invalid.classList.add('field-error');
    $('form-error').textContent = invalid.validationMessage;
    $('form-error').hidden = false;
    invalid.focus(); return false;
  }
  return true;
}
form.addEventListener('input', event => {
  clearError();
  if (event.target === body) { bodyEdited = true; templateStatus.textContent = ''; updateCount(); }
  if (event.target === subject) subjectEdited = true;
  if ([body,subject].includes(event.target)) confirmed.checked = false;
  if (['answer-email','answer-2092238618','answer-479301265'].includes(event.target.id)) { updateMessage(); confirmed.checked = false; }
});
form.addEventListener('change', clearError);
reset.addEventListener('click', () => {
  bodyEdited = false; subjectEdited = false; confirmed.checked = false; updateMessage();
  templateStatus.textContent = 'Template ripristinato con i riferimenti attuali. Puoi modificarlo di nuovo.';
});
$('back').addEventListener('click', () => showSection(Math.max(0, current - 1)));
function payload() {
  const selected = {}, other = {};
  for (const [id,record] of answers) {
    selected[id] = record.input ? [record.input.value] : record.inputs.filter(input=>input.checked).map(input=>input.value);
    if (record.otherChoice?.checked) other[id] = record.otherInput.value;
  }
  return {version:1,requestId,answers:selected,other,subject:subject.value,body:body.value,consent:confirmed.checked,website:''};
}
function freezeFields(value) {
  frozen=value;
  for (const field of form.querySelectorAll('input,textarea')) field.disabled=value || (field.classList.contains('text-input') && field.closest('.other-answer')?.hidden===true);
  $('reset-template').disabled=value;
}
function showSuccess() {
  completed = true;
  $('success-subject').textContent = subject.value.trim();
  $('success-message').textContent = body.value;
  if (!PREVIEW) {
    $('success-title').textContent = 'Questionario registrato. Messaggio inoltrato.';
    $('success-view').querySelector('.eyebrow').textContent = 'INVIO ACCETTATO';
    $('success-view').querySelector('p:not(.eyebrow)').textContent = 'Google ha registrato le risposte e ha accettato il messaggio per l’invio a Mirco. La consegna nella casella dipende anche dai filtri del destinatario.';
    $('edit-message').hidden = true;
    for (const button of $('step-list').querySelectorAll('button')) button.disabled=true;
  }
  $('form-view').hidden = true; $('success-view').hidden = false;
  $('success-title').focus({preventScroll:true}); $('questionnaire').scrollIntoView({behavior:'instant'});
  $('announcement').textContent = PREVIEW ? 'Simulazione completata. Nessuna risposta o email è stata inviata.' : 'Questionario registrato e messaggio accettato per l’invio a Mirco.';
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (completed || busy) return;
  if (checkOnly) {
    busy=true; $('next').disabled=true;
    try { applyDeliveryResult(await delivery.status(requestId)); }
    catch { $('form-error').textContent='Stato non disponibile. Conserva il riferimento '+requestId+' e riprova la verifica.'; $('form-error').hidden=false; }
    finally {busy=false;$('next').disabled=false;}
    return;
  }
  if (!frozen && !validatePanel(current)) return;
  if (current < 5) { furthest = Math.max(furthest, current + 1); showSection(current + 1); return; }
  if (!PREVIEW && !deliveryConfig.enabled) return;
  // Revalidate every section: jumping back must never leave required answers unchecked.
  for (let index = 0; index < 5; index++) {
    const old = current; current = index;
    if (!validatePanel(index)) { showSection(index); validatePanel(index); return; }
    current = old;
  }
  if (PREVIEW) { showSuccess(); return; }
  const submission=payload();
  busy=true;freezeFields(true);$('next').disabled=true;$('next').textContent='Invio in corso…';form.setAttribute('aria-busy','true');
  $('form-error').textContent='Non chiudere questa pagina: salvataggio del questionario e invio del messaggio in corso.';$('form-error').hidden=false;
  try { applyDeliveryResult(await delivery.send(submission)); }
  catch(error) {
    $('form-error').textContent=error.message+' Riferimento: '+requestId;
    $('form-error').hidden=false;
    if(error.safeToRetry){freezeFields(false);requestId=crypto.randomUUID();checkOnly=false;$('next').textContent='Riprova l’invio';}
    else{checkOnly=true;$('next').textContent='Verifica stato';}
  } finally {busy=false;$('next').disabled=false;form.removeAttribute('aria-busy');}
});
function applyDeliveryResult(result) {
  const view=deliveryView(result);
  if(view.success) { showSuccess();return; }
  freezeFields(view.freeze);checkOnly=view.check;
  $('form-error').textContent=view.message+' Riferimento: '+requestId;$('form-error').hidden=false;
  $('next').textContent=view.check?'Verifica stato':result.formSaved?'Riprova la sola email':'Riprova l’invio';
  if (!view.freeze) requestId=crypto.randomUUID();
}
$('edit-message').addEventListener('click', () => {
  $('success-view').hidden = true; $('form-view').hidden = false; confirmed.checked = false; showSection(5);
});
$('demo-button').addEventListener('click', () => {
  for (const record of answers.values()) {
    if (record.input && !record.input.value.trim()) {
      const examples = {email:'referente@example.org','2092238618':'Giulia Rossi','479301265':'Fondazione Esempio'};
      record.input.value = examples[record.question.id] || 'Esempio dimostrativo: criteri e codici da condividere con il team.';
    } else if (record.inputs && !record.inputs.some(input => input.checked)) record.inputs[0].checked = true;
  }
  furthest = 5; showSection(5);
  $('announcement').textContent = 'Sono stati aggiunti dati di esempio nei campi vuoti. Ora puoi provare il messaggio finale.';
});
showSection(0, false);
