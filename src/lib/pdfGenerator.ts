import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface GeneratedPdfResult {
  blob: Blob;
  dataUrl: string;
  filename: string;
}

/**
 * Capture an HTML DOM element and render it into a high-fidelity A4 PDF.
 */
export async function generateConsentPdf(
  element: HTMLElement,
  patientName: string
): Promise<GeneratedPdfResult> {
  const canvas = await html2canvas(element, {
    scale: 2.0, // 2x scale for crisp Korean fonts and signature rendering
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: 794,
  });

  const imgData = canvas.toDataURL('image/png', 1.0);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pdfWidth = 210;
  const pdfHeight = 297;

  const rawImgWidth = pdfWidth;
  const rawImgHeight = (canvas.height * pdfWidth) / canvas.width;

  // Single Page Auto-Fit: If content fits within 1 page (up to ~1.25x threshold),
  // fit it precisely into 1 single A4 page without generating unnecessary blank overflow pages.
  if (rawImgHeight <= pdfHeight * 1.25) {
    // If slightly larger than 297mm, scale down proportionally to fit exactly in 1 page
    if (rawImgHeight > pdfHeight) {
      const scale = pdfHeight / rawImgHeight;
      const fittedWidth = pdfWidth * scale;
      const xOffset = (pdfWidth - fittedWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, 0, fittedWidth, pdfHeight, undefined, 'FAST');
    } else {
      pdf.addImage(imgData, 'PNG', 0, 0, rawImgWidth, rawImgHeight, undefined, 'FAST');
    }
  } else {
    // True multi-page document handling with empty margin cutoff threshold (15mm)
    let heightLeft = rawImgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, rawImgWidth, rawImgHeight, undefined, 'FAST');
    heightLeft -= pdfHeight;

    const BLANK_PAGE_THRESHOLD = 15; // Ignore trailing residual white margins <= 15mm
    while (heightLeft > BLANK_PAGE_THRESHOLD) {
      position = heightLeft - rawImgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, rawImgWidth, rawImgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const cleanName = patientName.trim().replace(/\s+/g, '_') || '환자';
  const filename = `개인정보동의서_${cleanName}_${todayStr}.pdf`;

  const blob = pdf.output('blob');
  const dataUrl = pdf.output('dataurlstring');

  return {
    blob,
    dataUrl,
    filename
  };
}

/**
 * Convert Base64 Data URL or Blob to a clean Object URL
 */
export function createPdfBlobUrl(dataOrBlob: Blob | string): string {
  if (dataOrBlob instanceof Blob) {
    return URL.createObjectURL(dataOrBlob);
  }

  if (typeof dataOrBlob === 'string') {
    if (dataOrBlob.startsWith('data:')) {
      const parts = dataOrBlob.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      return URL.createObjectURL(blob);
    }
    // Remote HTTPS URL
    return dataOrBlob;
  }

  return '';
}

/**
 * Universal download trigger
 */
export function triggerPdfDownload(dataOrBlob: Blob | string, filename: string): boolean {
  try {
    const url = createPdfBlobUrl(dataOrBlob);
    if (!url) return false;

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    }, 30000);

    return true;
  } catch (err) {
    console.error('Download error:', err);
    return false;
  }
}
