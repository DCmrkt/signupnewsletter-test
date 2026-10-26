import {RECIPIENT,DEFAULT_SUBJECT,DEFAULT_BODY,createMailto} from './mailto.js';

const $=id=>document.getElementById(id);
const subject=$('mail-subject'),body=$('mail-body'),link=$('open-mail'),confirmed=$('confirm-google');
const form=$('mail-form'),status=$('mail-status');
subject.value=DEFAULT_SUBJECT;body.value=DEFAULT_BODY;
function update(){
  $('message-count').value=body.value.length.toLocaleString('it-IT')+' / 4.000';
  try {link.href=createMailto(subject.value,body.value);link.removeAttribute('aria-disabled');}
  catch {link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
}
for(const field of [subject,body]) field.addEventListener('input',()=>{confirmed.checked=false;status.textContent='';update();});
link.addEventListener('click',event=>{
  if(!form.reportValidity()){event.preventDefault();return;}
  try {link.href=createMailto(subject.value,body.value);}
  catch(error){event.preventDefault();status.textContent=error.message;return;}
  status.textContent='Completa l’invio nella tua app di posta. Se non si apre, usa “Copia messaggio” e scrivi a '+RECIPIENT+'.';
});
form.addEventListener('submit',event=>event.preventDefault());
$('reset-template').addEventListener('click',()=>{
  subject.value=DEFAULT_SUBJECT;body.value=DEFAULT_BODY;confirmed.checked=false;update();
  status.textContent='Template ripristinato. Puoi modificarlo prima di aprire la mail.';
});
$('copy-message').addEventListener('click',async()=>{
  try {await navigator.clipboard.writeText(body.value);status.textContent='Messaggio copiato. Puoi incollarlo in una mail a '+RECIPIENT+'.';}
  catch {body.focus();body.select();status.textContent='Il browser non ha copiato il testo. Il messaggio è selezionato: usa Copia e incollalo nella tua mail.';}
});
update();
