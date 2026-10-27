import { sections } from './questions.js';

const groupTitles = ['I tuoi riferimenti', 'La tua organizzazione', 'Il tuo database', 'I macro-canali', 'Ultime indicazioni'];

export function createRecapSnapshot(values, other = {}, { generatedAt = new Date() } = {}) {
  return {
    generatedAt: new Date(generatedAt).toISOString(),
    organization: (values['479301265'] || []).join(' ').trim(),
    groups: sections.slice(0, 5).map((section, index) => ({
      title: groupTitles[index],
      questions: section.questions.map(question => ({
        id: question.id,
        title: question.title,
        value: (values[question.id] || []).map(value => value === 'Altro'
          ? `Altro: ${(other[question.id] || '').trim() || 'da specificare'}`
          : value.trim()).filter(Boolean).join('\n') || 'Non compilato'
      }))
    }))
  };
}

export function pdfFilename(snapshot) {
  const slug = snapshot.organization.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');
  return `benchmark-2027-${slug || 'questionario'}.pdf`;
}

export function createRecapPdf(snapshot, { jsPDF, fontBase64 }) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.addFileToVFS('Inter.ttf', fontBase64);
  pdf.addFont('Inter.ttf', 'Inter', 'normal');
  pdf.setFont('Inter', 'normal');
  pdf.setProperties({ title: 'Analisi Benchmark 2027 - Riepilogo', creator: 'Direct Channel' });
  const margin = 18, width = 174, bottom = 276;
  let y = margin;
  // Preserve literal database codes and signed values exactly as entered.
  const clean = value => String(value);
  function nextPage() {
    pdf.addPage();
    pdf.setTextColor(99, 113, 140); pdf.setFontSize(8);
    pdf.text('ANALISI BENCHMARK 2027 / RIEPILOGO', margin, 13);
    y = 25;
  }
  function text(value, { size = 10, color = [17, 29, 55], leading = 5, after = 3 } = {}) {
    pdf.setFontSize(size); pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(clean(value), width);
    for (const line of lines) {
      if (y + leading > bottom) { nextPage(); pdf.setFontSize(size); pdf.setTextColor(...color); }
      pdf.text(line, margin, y); y += leading;
    }
    y += after;
  }
  text('Analisi Benchmark 2027', { size: 22, leading: 10, after: 1 });
  text('Riepilogo del questionario', { size: 13, leading: 7 });
  const date = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(snapshot.generatedAt));
  text(`Esportato il ${date} - ${snapshot.groups.flatMap(group => group.questions).length} risposte`, { size: 9, color: [99, 113, 140] });
  text('Copia delle risposte presenti nel riepilogo al momento del download.', { size: 9, color: [99, 113, 140], after: 8 });
  for (const [index, group] of snapshot.groups.entries()) {
    if (y + 32 > bottom) nextPage();
    pdf.setDrawColor(238, 163, 45); pdf.setLineWidth(.6); pdf.line(margin, y - 6, margin + 12, y - 6);
    text(`${String(index + 1).padStart(2, '0')} / ${group.title}`, { size: 13, leading: 7, after: 5 });
    for (const question of group.questions) {
      pdf.setFontSize(10);
      const titleHeight = pdf.splitTextToSize(clean(question.title), width).length * 5;
      if (y + Math.min(titleHeight + 11, 45) > bottom) nextPage();
      text(question.title, { size: 10, color: [99, 113, 140], after: 1 });
      text(question.value, { size: 10.5, leading: 5.2, after: 6 });
    }
    y += 3;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(220, 226, 235); pdf.setLineWidth(.2); pdf.line(margin, 282, 192, 282);
    pdf.setFontSize(8); pdf.setTextColor(99, 113, 140);
    pdf.text('Direct Channel - Gruppo Mondadori', margin, 288);
    pdf.text(`${page} / ${pages}`, 192, 288, { align: 'right' });
  }
  return pdf;
}

let resources;
async function loadResources() {
  if (!resources) resources = (async () => {
    await import('./assets/vendor/jspdf-4.2.1.umd.min.js');
    const response = await fetch(new URL('./assets/fonts/inter-variable.ttf', import.meta.url));
    if (!response.ok) throw new Error('Font PDF non disponibile.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return { jsPDF: globalThis.jspdf.jsPDF, fontBase64: btoa(binary) };
  })().catch(error => { resources = undefined; throw error; });
  return resources;
}

export async function downloadRecapPdf(snapshot) {
  const pdf = createRecapPdf(snapshot, await loadResources());
  pdf.save(pdfFilename(snapshot));
}
