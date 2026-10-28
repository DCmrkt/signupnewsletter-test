import { sections } from './questions.js';
import { buildGoogleSubmission, postGoogleSubmission } from './google-submission.js?v=20261027-anonymous';
import { saveProgress, loadProgress, clearProgress } from './progress-store.js?v=20261028-progress';
import { createRecapSnapshot, downloadRecapPdf } from './recap-pdf.js?v=20261027-checked';
import { launchConfetti } from './confetti.js';

const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
const labels = ['I tuoi riferimenti', 'La tua organizzazione', 'Il tuo database', 'I macro-canali', 'Ultime indicazioni', 'Riepilogo e conferma'];
const descriptions = [
  'Presentati: ci aiuterà a collegare le specifiche alla tua organizzazione.',
  'Raccontaci come è strutturata la raccolta fondi e quali sono le vostre previsioni per il 2026.',
  'Condividi i criteri che ci permetteranno di interpretare correttamente le informazioni nel database.',
  'Per alcuni KPI, come l’attrition, forniremo un dettaglio per macro-canale. Aiutaci a classificare le campagne: quelle non riconducibili ai canali indicati saranno classificate come ALTRO.',
  'Segnala eventuali eccezioni o informazioni che vuoi condividere con il team.',
  'Rileggi tutte le risposte. Puoi modificare ogni sezione prima di confermare la registrazione.'
];
const headings = ['I tuoi riferimenti', 'La tua organizzazione', 'I criteri nel database', 'Le campagne, per canale', 'Prima di concludere', 'Riepilogo e conferma'];
const $ = id => document.getElementById(id);
const form = $('survey');
const answers = new Map();
const panels = [];
let current = 0;
let furthest = 0;
let saveAttempted = false;
let previouslySubmitted = false;
let inFlight = false;
let pdfGenerating = false;
let draftReady = false;
let hasSavedProgress = false;
const compactIntro = window.matchMedia?.('(max-width: 800px), (max-height: 820px)');
if (compactIntro) {
  const setIntroLayout = () => { $('questionnaire-info').open = !compactIntro.matches; };
  setIntroLayout(); compactIntro.addEventListener('change', setIntroLayout);
}
if (PREVIEW) {
  document.getElementById('preview-banner').hidden = false;
  document.getElementById('mode-label').textContent = 'Anteprima interattiva';
  document.getElementById('service-notice').textContent = ' · Nessuna risposta o email viene inviata.';
  document.getElementById('demo-button').hidden = false;
  document.getElementById('draft-tools').hidden = true;
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
      invalidateSubmission(); resetSectionConfirmation(answers.get(question.id).sectionIndex); updateReview(); persistProgress();
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
  for (const question of section.questions) {
    panel.append([0,1].includes(question.type) ? textField(question) : choiceField(question));
    answers.get(question.id).sectionIndex = index;
  }
  $('sections').append(panel);
  panels.push(panel);
  const li = element('li');
  const button = element('button', 'step-button');
  button.type = 'button';
  button.setAttribute('aria-label', `Sezione ${index + 1}: ${labels[index]}`);
  button.append(element('span', 'step-number', String(index + 1)), element('span', '', labels[index]));
  button.addEventListener('click', () => { if (index <= furthest) showSection(index); });
  li.append(button);
  $('step-list').append(li);
});

const final = panels[5];
const review = element('section', 'answer-review'); review.id = 'answer-review';
const reviewToolbar = element('div', 'review-toolbar');
const pdfButton = element('button', 'button button-secondary', 'Scarica PDF ↓'); pdfButton.type = 'button'; pdfButton.id = 'download-recap-pdf';
const pdfStatus = element('p', 'pdf-status'); pdfStatus.setAttribute('role', 'status');
reviewToolbar.append(element('h3', '', 'Le tue risposte'), pdfButton);
review.append(reviewToolbar, pdfStatus, element('p', 'review-intro', 'Tutto il questionario, prima dell’invio. Apri “Modifica” per aggiornare una sezione.'));
const reviewGroups = sections.slice(0,5).map((section,index) => {
  const group = element('section', 'review-group');
  const heading = element('h4', '', `${String(index + 1).padStart(2,'0')} · ${labels[index]}`);
  const values = element('dl', 'review-values');
  const rows = new Map();
  for (const question of section.questions) {
    const row = element('div'); row.dataset.reviewQuestion = question.id;
    const value = element('dd'); value.dataset.reviewValue = '';
    row.append(element('dt', '', question.title), value); values.append(row); rows.set(question.id,value);
  }
  const details = element('details', 'review-edit');
  const summary = element('summary');
  summary.setAttribute('aria-label', `Modifica le risposte: ${labels[index]}`);
  summary.append(element('span','edit-closed','Modifica'),element('span','edit-open','Chiudi modifica'));
  const editor = element('div','review-editor'); details.append(summary,editor);
  const confirmSection = element('button', 'review-confirm', 'Conferma');
  confirmSection.type = 'button'; confirmSection.dataset.confirmSection = index;
  confirmSection.setAttribute('aria-label', `Conferma la sezione: ${labels[index]}`); confirmSection.setAttribute('aria-pressed', 'false');
  confirmSection.addEventListener('click', () => {
    clearError(); if (!validatePanel(index)) return; updateReview(); details.open = false;
    confirmSection.setAttribute('aria-pressed', 'true'); confirmSection.textContent = 'Confermato ✓';
  });
  group.append(heading,values,details,confirmSection); review.append(group);
  return {details,editor,rows,confirmSection};
});
final.append(review);
const recommendation = element('div', 'recommendation');
recommendation.append(element('span', '', '↗'));
const reminder = element('p');
reminder.append(element('strong', '', 'Un’ultima raccomandazione.'), document.createTextNode(' Per la buona riuscita dell’analisi, assicurati che vengano caricate le azioni per le campagne di Direct Mailing del 2025–2026.'));
recommendation.append(reminder);
final.append(recommendation);

const confirmation = element('label','confirmation');
const confirmed = element('input'); confirmed.type='checkbox'; confirmed.id='confirm-review'; confirmed.name='confirm-review'; confirmed.required=true;
confirmation.append(confirmed,element('span','','Ho riletto il riepilogo e confermo le risposte del questionario.'));
final.append(confirmation);
const saveStatus=element('p','save-status'); saveStatus.id='registration-status'; saveStatus.setAttribute('role','status'); final.append(saveStatus);
function answerText(record){const values=record.input?[record.input.value.trim()]:record.inputs.filter(input=>input.checked).map(input=>input===record.otherChoice?'Altro: '+(record.otherInput.value.trim()||'da specificare'):input.value);return values.filter(Boolean).join(' · ')||'Non compilato';}
function updateReview(){for(const[id,record]of answers)reviewGroups[record.sectionIndex].rows.get(id).textContent=answerText(record);}
function placeQuestionFields(inReview){for(const record of answers.values())(inReview?reviewGroups[record.sectionIndex].editor:panels[record.sectionIndex]).append(record.wrapper);if(inReview)updateReview();}
function clearError(){
 $('form-error').hidden=true;
 for(const input of form.querySelectorAll('input,textarea')){
  const errorId=input.dataset.validationError;
  if(errorId){const descriptions=(input.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==errorId);if(descriptions.length)input.setAttribute('aria-describedby',descriptions.join(' '));else input.removeAttribute('aria-describedby');delete input.dataset.validationError;}
  input.classList.remove('field-error');input.removeAttribute('aria-invalid');input.setCustomValidity('');
 }
 for(const error of form.querySelectorAll('.field-validation-message'))error.hidden=true;
 for(const field of form.querySelectorAll('.field-invalid'))field.classList.remove('field-invalid');
}
function showValidationError(input,message){
 const field=input.closest('.field')||input.closest('.confirmation');
 const target=input.closest('.other-answer')||field;
 const errorId='validation-'+input.id;
 let error=$(errorId);
 if(!error){error=element('p','field-validation-message');error.id=errorId;if(field.matches('.confirmation'))field.after(error);else target.insertBefore(error,target.children[1]||null);}
 error.textContent=message;error.hidden=false;field.classList.add('field-invalid');
 input.dataset.validationError=errorId;
 input.setAttribute('aria-describedby',[...new Set((input.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).concat(errorId))].join(' '));
 input.setAttribute('aria-invalid','true');input.classList.add('field-error');
 $('form-error').textContent=message;$('form-error').hidden=false;
 input.focus({preventScroll:true});target.scrollIntoView({behavior:'instant',block:'start'});
}
function updateNav(){for(const[index,button]of[...$('step-list').querySelectorAll('button')].entries()){button.disabled=index>furthest;button.classList.toggle('complete',index<current);if(index===current)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');button.querySelector('.step-number').textContent=index<current?'✓':String(index+1);}}
function showSection(index,focus=true){
 if(inFlight)return;
 $('form-view').hidden=false;$('success-view').hidden=true;clearError();current=index;placeQuestionFields(index===5);panels.forEach((panel,i)=>panel.hidden=i!==index);
 $('section-title').textContent=headings[index];$('section-description').textContent=descriptions[index];$('step-label').textContent='SEZIONE '+String(index+1)+' DI 6';$('progress-description').textContent=labels[index];$('progress').value=index+1;
 const compact=index>0&&index<5;$('section-title').classList.toggle('sr-only',compact);$('section-description').hidden=compact;
 $('back').hidden=index===0;$('required-note').hidden=index>0;$('next').textContent=index===5?(saveAttempted?'Torna alla conferma →':PREVIEW?'Simula la conferma →':'Conferma e registra'):(index===4?'Rivedi le risposte →':'Continua →');$('next').disabled=false;updateNav();$('sections').scrollTop=0;form.scrollTop=0;persistProgress();
 if(focus){$('section-title').focus({preventScroll:true});$('questionnaire').scrollIntoView({behavior:'instant',block:'start'});}
}
function validatePanel(index){
 const controls=[];
 for(const record of answers.values()){
  if(record.sectionIndex!==index)continue;controls.push(...record.wrapper.querySelectorAll('input,textarea'));
  if(record.inputs){record.inputs[0].setCustomValidity(record.question.required&&!record.inputs.some(input=>input.checked)?'Seleziona almeno una risposta.':'');if(record.otherChoice?.checked)record.otherInput.setCustomValidity(record.otherInput.value.trim()?'':'Specifica la risposta Altro.');}
  else if(record.question.required&&!record.input.value.trim())record.input.setCustomValidity('Compila questo campo.');
 }
 if(index===5){confirmed.setCustomValidity(confirmed.checked?'':'Conferma di aver riletto tutte le risposte prima di registrare il questionario.');controls.push(confirmed);}
 const invalid=controls.find(input=>!input.disabled&&!input.checkValidity());
 if(!invalid)return true;
 const message=invalid.type==='email'&&invalid.validity.typeMismatch?'Inserisci un indirizzo email valido.':invalid.validationMessage;
 if(current===5&&index<5)reviewGroups[index].details.open=true;else if(current!==index)showSection(index);
 showValidationError(invalid,message);return false;
}
function resetSectionConfirmation(index){const button=reviewGroups[index].confirmSection;button.setAttribute('aria-pressed','false');button.textContent='Conferma';}
function invalidateSubmission(){saveAttempted=false;confirmed.checked=false;$('next').disabled=false;if(current===5)$('next').textContent=PREVIEW?'Simula la conferma →':'Conferma e registra';saveStatus.textContent='';}
for(const eventName of['input','change'])form.addEventListener(eventName,event=>{clearError();const changed=[...answers.values()].find(record=>record.wrapper.contains(event.target));if(changed){invalidateSubmission();resetSectionConfirmation(changed.sectionIndex);if(current===5)updateReview();persistProgress();}});
function validateQuestionnaire(){for(let index=0;index<5;index++)if(!validatePanel(index))return false;return true;}
function questionnaireAnswers(){const values={},other={};for(const[id,record]of answers){values[id]=record.input?[record.input.value]:record.inputs.filter(input=>input.checked).map(input=>input.value);if(record.otherChoice?.checked)other[id]=record.otherInput.value;}return{values,other};}
pdfButton.addEventListener('click',async()=>{
 const {values,other}=questionnaireAnswers();const snapshot=createRecapSnapshot(values,other);
 pdfGenerating=true;pdfButton.disabled=true;pdfStatus.textContent='Preparazione del PDF…';
 try{await downloadRecapPdf(snapshot);pdfStatus.textContent='PDF pronto con le risposte attuali.';}
 catch{pdfStatus.textContent='Non è stato possibile generare il PDF. Riprova: le risposte restano nella pagina.';}
 finally{pdfGenerating=false;pdfButton.disabled=inFlight;}
});
function showCompletion(preview,animate=true){
 $('success-view').querySelector('.success-symbol').textContent='✓';
 $('success-eyebrow').textContent=preview?'ANTEPRIMA COMPLETATA':'INVIO COMPLETATO';
 $('success-title').textContent=preview?'Riepilogo confermato.':'Questionario inviato.';
 $('success-description').textContent=preview?'Simulazione completata: nessuna risposta o email è stata inviata.':'Hai completato l’invio. La ricevuta automatica include il PDF con tutte le tue risposte.';
 $('receipt-to').textContent=answers.get('email').input.value.trim();
 $('receipt-description').textContent=preview?'Questa è un’anteprima: nessuna email viene inviata.':'Dopo la registrazione riceverai automaticamente la ricevuta con tutte le risposte nel PDF allegato. Stefania è già in copia: non occorre inviare altri messaggi.';
 $('receipt-panel').hidden=false;
 $('form-view').hidden=true;$('success-view').hidden=false;$('success-title').focus({preventScroll:true});
 $('announcement').textContent=preview?'Simulazione completata. Nessuna risposta o email è stata inviata.':'Richiesta di invio completata.';
 persistProgress('completed');if(animate)launchConfetti($('success-title'));
}
async function registerQuestionnaire(){
 if(saveAttempted||inFlight)return;clearError();if(!validateQuestionnaire()||!validatePanel(5))return;
 if(PREVIEW){saveAttempted=true;showCompletion(true);return;}
 if(previouslySubmitted&&!window.confirm('Hai già avviato un invio. Ripeterlo potrebbe creare una seconda risposta. Verifica con il team se il questionario è già arrivato prima di procedere. Vuoi inviare nuovamente?'))return;
 let restoreControls=()=>{};
 try{
  if(navigator.onLine===false)throw new Error('Sei offline. Riconnettiti e riprova: le risposte restano in questa pagina.');
  const{values,other}=questionnaireAnswers(),submission=buildGoogleSubmission(values,other);
  inFlight=true;saveAttempted=true;form.setAttribute('aria-busy','true');
  const controls=[...document.querySelectorAll('#survey input,#survey textarea,#survey button,#step-list button,#demo-button')].map(control=>[control,control.disabled]);
  for(const[control]of controls)control.disabled=true;
  restoreControls=()=>{for(const[control,disabled]of controls)control.disabled=disabled;};
  saveStatus.textContent='Invio in corso…';$('next').textContent='Invio in corso…';$('announcement').textContent='Invio del questionario in corso.';
  previouslySubmitted=true;persistProgress('uncertain');await postGoogleSubmission(submission);showCompletion(false);
 }catch(error){saveAttempted=false;saveStatus.textContent=error.message||'Invio non riuscito. Le risposte restano nel riepilogo.';$('announcement').textContent=saveStatus.textContent;}
 finally{inFlight=false;restoreControls();pdfButton.disabled=pdfGenerating;form.removeAttribute('aria-busy');updateNav();$('next').disabled=saveAttempted;$('next').textContent='Conferma e registra';persistProgress();}
}
form.addEventListener('submit',event=>{event.preventDefault();if(inFlight)return;if(current===5){if(saveAttempted)showCompletion(PREVIEW);else registerQuestionnaire();return;}if(!validatePanel(current))return;furthest=Math.max(furthest,current+1);showSection(current+1);});
$('back').addEventListener('click',()=>showSection(Math.max(0,current-1)));
$('edit-review').addEventListener('click',()=>{confirmed.checked=false;showSection(5);});
$('demo-button').addEventListener('click',()=>{for(const record of answers.values()){if(record.input&&!record.input.value.trim()){const examples={email:'referente@example.org','2092238618':'Giulia Rossi','479301265':'Fondazione Esempio'};record.input.value=examples[record.question.id]||'Esempio dimostrativo: criteri e codici da condividere con il team.';}else if(record.inputs&&!record.inputs.some(input=>input.checked))record.inputs[0].checked=true;}furthest=5;showSection(5);$('announcement').textContent='Dati di esempio inseriti. Rileggi e conferma il riepilogo.';});
function persistProgress(phase){
 if(PREVIEW||!draftReady)return;
 const data=questionnaireAnswers();
 for(const[id,record]of answers)if(record.otherInput)data.other[id]=record.otherInput.value;
 if(!previouslySubmitted&&!Object.values(data.values).some(values=>values.some(value=>value.length))&&!Object.values(data.other).some(value=>value.length)){
  if(hasSavedProgress){const cleared=clearProgress();if(cleared.ok){hasSavedProgress=false;$('draft-status').textContent='Nessuna risposta salvata.';$('clear-draft').hidden=true;}else $('draft-status').textContent='Salvataggio locale non disponibile: tieni aperta la pagina per conservare le modifiche.';}
  return;
 }
 const result=saveProgress({...data,current,furthest,previouslySubmitted,phase:phase||(inFlight||previouslySubmitted&&!saveAttempted?'uncertain':saveAttempted?'completed':'draft')});
 $('draft-status').textContent=result.ok?'Progressi salvati su questo dispositivo.':'Salvataggio locale non disponibile: tieni aperta la pagina per conservare le risposte.';
 if(result.ok)hasSavedProgress=true;
 $('clear-draft').hidden=false;
}
function applyProgress(state){
 for(const[id,record]of answers){
  if(record.input)record.input.value=state.values[id][0]||'';
  else for(const input of record.inputs)input.checked=state.values[id].includes(input.value);
  if(record.otherInput){record.otherInput.value=state.other[id]||'';record.otherInput.disabled=!record.otherChoice.checked;record.otherInput.required=record.otherChoice.checked;record.wrapper.querySelector('.other-answer').hidden=!record.otherChoice.checked;}
 }
 current=state.current;furthest=state.furthest;previouslySubmitted=state.previouslySubmitted;saveAttempted=state.phase==='completed';
 if(saveAttempted){try{const data=questionnaireAnswers();buildGoogleSubmission(data.values,data.other);}catch{saveAttempted=false;}}
}
$('clear-draft').addEventListener('click',()=>{
 if(inFlight||!window.confirm('Vuoi cancellare le risposte salvate su questo dispositivo? Le risposte già inviate a Google resteranno registrate.'))return;
 if(!clearProgress().ok){$('draft-status').textContent='Non è stato possibile cancellare i dati locali. Riprova dalle impostazioni del browser.';return;}
 draftReady=false;for(const record of answers.values()){
  if(record.input)record.input.value='';else for(const input of record.inputs)input.checked=false;
  if(record.otherInput){record.otherInput.value='';record.otherInput.disabled=true;record.otherInput.required=false;record.wrapper.querySelector('.other-answer').hidden=true;}
 }
 reviewGroups.forEach((group,index)=>{group.details.open=false;resetSectionConfirmation(index);});
 saveAttempted=false;previouslySubmitted=false;hasSavedProgress=false;furthest=0;confirmed.checked=false;saveStatus.textContent='';showSection(0);draftReady=true;
 $('draft-status').textContent='Dati locali cancellati. Puoi iniziare un nuovo questionario.';$('clear-draft').hidden=true;
});
const restored=PREVIEW?{}:loadProgress();
if(restored.state){hasSavedProgress=true;applyProgress(restored.state);}
draftReady=true;showSection(current,false);
if(saveAttempted)showCompletion(PREVIEW,false);
if(restored.state){$('draft-status').textContent='Progressi ripristinati da questo dispositivo.';if(restored.state.phase==='uncertain'){saveStatus.textContent='Un invio precedente potrebbe essere già arrivato: controlla la ricevuta prima di ripetere l’invio.';}}
else if(restored.error)$('draft-status').textContent=restored.error==='unavailable'?'Salvataggio locale non disponibile: tieni aperta la pagina per conservare le risposte.':'La bozza precedente non è leggibile. Puoi iniziare un nuovo questionario.';
else if(restored.expired)$('draft-status').textContent='La bozza precedente è scaduta dopo 30 giorni.';
window.addEventListener('pagehide',()=>persistProgress());
