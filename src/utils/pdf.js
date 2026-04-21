import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportElementToPdf(element, filename = 'monthly-summary.pdf') {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: null });
  const image = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const ratio = canvas.height / canvas.width;
  const targetHeight = pageWidth * ratio;
  pdf.addImage(image, 'PNG', 0, 0, pageWidth, targetHeight);
  pdf.save(filename);
}
