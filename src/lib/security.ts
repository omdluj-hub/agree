import JSZip from 'jszip';
import { SignedConsentRecord } from '../types';
import { triggerPdfDownload } from './pdfGenerator';

const STORAGE_ADMIN_PASSWORD_KEY = 'clinic_admin_password_hash';
const STORAGE_REQUIRE_DOC_PASSWORD_KEY = 'clinic_require_doc_password';

// Simple hash for local admin password storage
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + btoa(encodeURIComponent(str)).slice(0, 8);
}

export function isAdminPasswordSet(): boolean {
  const hash = localStorage.getItem(STORAGE_ADMIN_PASSWORD_KEY);
  return Boolean(hash && hash.trim());
}

export function verifyAdminPassword(inputPassword: string): boolean {
  if (!isAdminPasswordSet()) return true; // If no password set, always passes
  const storedHash = localStorage.getItem(STORAGE_ADMIN_PASSWORD_KEY);
  return storedHash === simpleHash(inputPassword.trim());
}

export function setAdminPassword(newPassword: string): void {
  if (!newPassword.trim()) {
    clearAdminPassword();
    return;
  }
  localStorage.setItem(STORAGE_ADMIN_PASSWORD_KEY, simpleHash(newPassword.trim()));
}

export function clearAdminPassword(): void {
  localStorage.removeItem(STORAGE_ADMIN_PASSWORD_KEY);
}

export function isPasswordRequiredForDocs(): boolean {
  return localStorage.getItem(STORAGE_REQUIRE_DOC_PASSWORD_KEY) === 'true';
}

export function setPasswordRequiredForDocs(enabled: boolean): void {
  localStorage.setItem(STORAGE_REQUIRE_DOC_PASSWORD_KEY, enabled ? 'true' : 'false');
}

/**
 * Export all consent records and their PDFs into a single compressed .zip file
 */
export async function exportAllConsentsAsZip(
  records: SignedConsentRecord[],
  clinicName = '의원'
): Promise<{ success: boolean; count: number; filename: string }> {
  if (!records || records.length === 0) {
    throw new Error('내보낼 동의서 데이터가 없습니다.');
  }

  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const cleanClinic = clinicName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
  const zipFilename = `${cleanClinic}_개인정보동의서_전체백업_${dateStr}.zip`;

  // 1. Generate CSV summary table with UTF-8 BOM for Korean Excel compatibility
  let csvContent = '\uFEFF번호,환자성명,생년월일,연락처,만14세미만여부,대리인성명,대리인관계,필수개인정보동의,필수민감정보동의,필주고유식별정보동의,선택안내동의,서명일자,서명일시,PDF파일명\n';

  const pdfFolder = zip.folder('동의서_PDF');

  for (let idx = 0; idx < records.length; idx++) {
    const r = records[idx];
    const itemNum = idx + 1;
    const cleanPatient = (r.patient_name || '환자').trim().replace(/[^a-zA-Z0-9가-힣]/g, '_');
    const pdfItemName = `${itemNum}_개인정보동의서_${cleanPatient}_${r.signed_date || 'signed'}.pdf`;

    // Format agreement items
    const agreementSummary = Object.entries(r.agreed_items || {})
      .map(([k, v]) => `${k}:${v ? '동의' : '미동의'}`)
      .join('; ');

    csvContent += `"${itemNum}","${r.patient_name}","${r.birth_date || ''}","${r.phone || ''}","${r.is_minor ? '예' : '아니오'}","${r.representative_name || ''}","${r.representative_relation || ''}","${agreementSummary}","${r.signed_date || ''}","${r.signed_at || ''}","${pdfItemName}"\n`;

    // 2. Add PDF file to ZIP
    try {
      if (r.pdf_url) {
        if (r.pdf_url.startsWith('data:application/pdf')) {
          const base64Data = r.pdf_url.split(',')[1];
          pdfFolder?.file(pdfItemName, base64Data, { base64: true });
        } else if (r.pdf_url.startsWith('http')) {
          // Fetch from Supabase remote URL
          try {
            const resp = await fetch(r.pdf_url);
            if (resp.ok) {
              const arrayBuf = await resp.arrayBuffer();
              pdfFolder?.file(pdfItemName, arrayBuf);
            }
          } catch (fetchErr) {
            console.warn(`Failed to fetch remote PDF for ${r.patient_name}:`, fetchErr);
          }
        }
      }
    } catch (pdfErr) {
      console.warn(`Error processing PDF for ${r.patient_name}:`, pdfErr);
    }
  }

  // Add CSV and metadata JSON into root of ZIP
  zip.file('환자동의서_총괄목록.csv', csvContent);
  zip.file(
    '백업메타데이터.json',
    JSON.stringify(
      {
        clinicName,
        exportDate: new Date().toISOString(),
        totalRecords: records.length,
        records: records.map(r => ({
          ...r,
          pdf_url: r.pdf_url?.startsWith('data:') ? '[Base64 PDF Content in Folder]' : r.pdf_url
        }))
      },
      null,
      2
    )
  );

  // Generate ZIP blob and trigger download
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }, 30000);

  return {
    success: true,
    count: records.length,
    filename: zipFilename
  };
}
