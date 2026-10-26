import './network.js';
import { sections } from './questions.js';
import { RECIPIENT, createMailto } from './mailto.js';
import { buildGoogleSubmission } from './google-submission.js';

const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
const MAX_MESSAGE = 4000;
const labels = ['I tuoi riferimenti', 'La tua organizzazione', 'Il tuo database', 'I macro-canali', 'Ultime indicazioni', 'Il messaggio finale'];
const descriptions = [
  'Presentati: ci aiuterà a collegare le specifiche alla tua organizzazione.',
  'Raccontaci come è strutturata la raccolta fondi e quali sono le vostre previsioni per il 2026.',
  'Condividi i criteri che ci permetteranno di interpretare correttamente le informazioni nel database.',
  'Per alcuni KPI, come l’attrition, forniremo un dettaglio per macro-canale. Aiutaci a classificare le campagne: quelle non riconducibili ai canali indicati saranno classificate come ALTRO.',
  'Segnala eventuali eccezioni o informazioni che vuoi condividere con il team.',
  'Registra le risposte, verifica la conferma di Google e personalizza il messaggio per Stefania. La mail si apre nella tua app di posta.'
];
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
let saveAttempted = false;
if (PREVIEW) {
  document.getElementById('preview-banner').hidden = false;
  document.getElementById('mode-label').textContent = 'Anteprima interattiva';
  document.getElementById('service-notice').textContent = ' · Nessuna risposta o email viene inviata.';
  document.getElementById('demo-button').hidden = false;
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
      invalidateSubmission();
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
const saveBox = element('div', 'save-questionnaire');
saveBox.append(element('h3', '', '1. Registra le risposte'));
saveBox.append(element('p', '', 'Si apre la conferma di Google in una nuova scheda. Controlla che le risposte risultino registrate, poi torna qui per scrivere a Stefania.'));
const saveButton = element('button', 'button button-secondary', PREVIEW ? 'Simula il salvataggio' : 'Registra il questionario ↗');
saveButton.type = 'button'; saveButton.id = 'save-questionnaire';
const saveStatus = element('p', 'save-status'); saveStatus.id = 'save-status'; saveStatus.setAttribute('role', 'status');
const retryButton = element('button', 'text-button', 'Non ho ricevuto la conferma: riprova');
retryButton.type = 'button'; retryButton.id = 'retry-questionnaire'; retryButton.hidden = true;
saveBox.append(saveButton, saveStatus, retryButton); final.append(saveBox);
const composer = element('div', 'mail-composer');
const mailHeading = element('div', 'mail-heading');
const mailLabel = element('span'); mailLabel.append(element('i', 'mail-icon'), document.createTextNode('2. Il messaggio per Stefania'));
const reset = element('button', 'text-button', 'Ripristina template'); reset.type = 'button'; reset.id = 'reset-template';
mailHeading.append(mailLabel, reset);
const routing = element('dl', 'mail-routing');
for (const [title, value, id] of [['A', RECIPIENT, 'recipient']]) {
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
const tip = element('p', '', 'Puoi modificare il testo. Il pulsante apre la tua app di posta: premi Invia lì per spedire il messaggio.'); tip.id = 'message-tip';
const count = element('output'); count.id = 'message-count'; count.htmlFor = 'mail-body';
footer.append(tip, count);
mailContent.append(subjectBox, bodyBox, footer);
composer.append(mailHeading, routing, mailContent);
final.append(composer);
const confirmation = element('label', 'confirmation');
const confirmed = element('input'); confirmed.type = 'checkbox'; confirmed.id = 'confirm-send'; confirmed.name = 'confirm-send'; confirmed.required = true;
const confirmText = element('span'); confirmText.append(document.createTextNode(PREVIEW ? 'Ho controllato il messaggio di esempio per ' : 'Ho verificato la conferma di Google e ho riletto il messaggio per '), element('strong', '', RECIPIENT), document.createTextNode('.'));
confirmation.append(confirmed, confirmText); final.append(confirmation);
const copyRow = element('div', 'mail-copy-row');
const copy = element('button', 'text-button', 'Copia messaggio'); copy.id = 'copy-message'; copy.type = 'button';
copyRow.append(copy, element('p', '', 'Se la tua app di posta non si apre, copia il testo e incollalo nella webmail.'));
final.append(copyRow);
const templateStatus = element('p', 'template-status'); templateStatus.id = 'template-status'; templateStatus.setAttribute('role', 'status'); final.append(templateStatus);

function read(id) { return answers.get(id).input.value.trim(); }
function template() {
  const name = read('2092238618') || '[Nome e cognome]';
  const org = read('479301265') || '[Organizzazione]';
  return `Ciao Stefania,\n\nho completato il questionario Benchmark 2027 per ${org}.\n\nTi confermo che le informazioni inserite sono definitive e pronte per l’elaborazione. Resto a disposizione per eventuali chiarimenti.\n\nGrazie,\n${name}\n${org}`;
}
function updateCount() { count.value = `${body.value.length.toLocaleString('it-IT')} / 4.000`; }
function updateMessage() {
  $('recap-name').textContent = read('2092238618') || 'Da compilare';
  $('recap-org').textContent = read('479301265') || 'Da compilare';
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
  if (completed) confirmed.checked = false;
  $('form-view').hidden = false;
  $('success-view').hidden = true;
  clearError(); current = index; completed = false;
  panels.forEach((panel, i) => { panel.hidden = i !== index; });
  $('section-title').textContent = headings[index];
  $('section-description').textContent = descriptions[index];
  $('step-label').textContent = `SEZIONE ${String(index + 1).padStart(2, '0')} / 06`;
  $('progress-description').textContent = labels[index];
  $('progress').value = index + 1;
  $('back').hidden = index === 0;
  $('required-note').hidden = index === 5;
  $('next').textContent = index === 5 ? (PREVIEW ? 'Simula il finale →' : 'Apri email precompilata ↗') : index === 4 ? 'Rivedi il messaggio →' : 'Continua →';
  updateNav(); updateMessage(); $('sections').scrollTop = 0;
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
    confirmed.setCustomValidity(confirmed.checked ? '' : 'Verifica la conferma di Google e controlla il messaggio prima di aprire la mail.');
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
  if ([...answers.values()].some(record => record.wrapper.contains(event.target))) invalidateSubmission();
  if (event.target === body) { bodyEdited = true; templateStatus.textContent = ''; updateCount(); }
  if (event.target === subject) subjectEdited = true;
  if ([body,subject].includes(event.target)) confirmed.checked = false;
  if (['answer-email','answer-2092238618','answer-479301265'].includes(event.target.id)) { updateMessage(); confirmed.checked = false; }
});
form.addEventListener('change', event => {
  clearError();
  if ([...answers.values()].some(record => record.wrapper.contains(event.target))) invalidateSubmission();
});
reset.addEventListener('click', () => {
  bodyEdited = false; subjectEdited = false; confirmed.checked = false; updateMessage();
  templateStatus.textContent = 'Template ripristinato con i riferimenti attuali. Puoi modificarlo di nuovo.';
});
$('back').addEventListener('click', () => showSection(Math.max(0, current - 1)));
function invalidateSubmission() {
  saveAttempted = false; saveButton.disabled = false; retryButton.hidden = true; saveStatus.textContent = ''; confirmed.checked = false;
}
function validateQuestionnaire() {
  for (let index = 0; index < 5; index++) {
    if (!validatePanel(index)) { showSection(index); validatePanel(index); return false; }
  }
  return true;
}
function questionnaireAnswers() {
  const values = {}, other = {};
  for (const [id, record] of answers) {
    values[id] = record.input ? [record.input.value] : record.inputs.filter(input => input.checked).map(input => input.value);
    if (record.otherChoice?.checked) other[id] = record.otherInput.value;
  }
  return {values, other};
}
saveButton.addEventListener('click', () => {
  if (saveAttempted) return;
  clearError();
  if (!validateQuestionnaire()) return;
  if (!PREVIEW) {
    try {
      const {values, other} = questionnaireAnswers();
      const submission = buildGoogleSubmission(values, other);
      const post = document.createElement('form'); post.method = 'POST'; post.action = submission.action;
      post.target = '_blank'; post.rel = 'noopener'; post.hidden = true; post.acceptCharset = 'UTF-8';
      for (const [name, value] of submission.fields) {
        const field = document.createElement('input'); field.type = 'hidden'; field.name = name; field.value = value; post.append(field);
      }
      document.body.append(post); post.submit(); post.remove();
    } catch (error) { saveStatus.textContent = error.message; return; }
  }
  saveAttempted = true; saveButton.disabled = true; retryButton.hidden = false; confirmed.checked = false;
  saveStatus.textContent = PREVIEW ? 'Simulazione: nessuna risposta è stata trasmessa. Puoi provare il box del messaggio.' : 'Controlla la conferma nella scheda Google. Poi torna qui, personalizza il messaggio e spunta la casella sotto.';
});
retryButton.addEventListener('click', () => {
  if (!PREVIEW && !window.confirm('Ripeti solo se Google non ha registrato le risposte: un nuovo invio può creare una seconda risposta. Hai verificato che il tentativo precedente non è riuscito?')) return;
  invalidateSubmission(); saveButton.click();
});
copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(body.value); templateStatus.textContent = 'Messaggio copiato. Puoi incollarlo in una mail a ' + RECIPIENT + '.'; }
  catch { body.focus(); body.select(); templateStatus.textContent = 'Il messaggio è selezionato: usa Copia e incollalo nella tua webmail.'; }
});
form.addEventListener('submit', event => {
  event.preventDefault();
  if (current === 5 && !PREVIEW && !saveAttempted) {
    $('form-error').textContent = 'Prima registra il questionario con il pulsante sopra e verifica la conferma di Google.';
    $('form-error').hidden = false; saveButton.focus(); return;
  }
  if (completed || !validatePanel(current)) return;
  if (current < 5) { furthest = Math.max(furthest, current + 1); showSection(current + 1); return; }
  // Revalidate every section: jumping back must never leave required answers unchecked.
  if (!validateQuestionnaire()) return;
  if (!PREVIEW) {
    try {
      const draft = createMailto(subject.value, body.value);
      templateStatus.textContent = 'Completa l’invio nella tua app di posta. Se non si apre, usa Copia messaggio.';
      window.location.href = draft;
    } catch (error) { templateStatus.textContent = error.message; }
    return;
  }
  completed = true;
  $('success-subject').textContent = subject.value.trim();
  $('success-message').textContent = body.value;
  $('form-view').hidden = true; $('success-view').hidden = false;
  $('success-title').focus({preventScroll:true}); $('questionnaire').scrollIntoView({behavior:'instant'});
  $('announcement').textContent = 'Simulazione completata. Nessuna risposta o email è stata inviata.';
});
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
