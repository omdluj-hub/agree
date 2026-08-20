import React, { useState, useEffect } from 'react';
import { CheckCircle2, Download, PlusCircle, ShieldCheck, Database, Eye, Check } from 'lucide-react';
import { createPdfBlobUrl } from '../lib/pdfGenerator';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: {
    patientName: string;
    pdfBlob: Blob;
    pdfUrl: string;
    isLocalFallback: boolean;
    signedDate: string;
  } | null;
  onResetForNextPatient: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  result,
  onResetForNextPatient
}) => {
  const [downloaded, setDownloaded] = useState(false);
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string>('');

  useEffect(() => {
    if (!result) return;
    const url = createPdfBlobUrl(result.pdfBlob || result.pdfUrl);
    setDownloadBlobUrl(url);

    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [result]);

  if (!isOpen || !result) return null;

  const filename = `개인정보동의서_${result.patientName.trim()}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return (
    <div className="modal-backdrop animate-fade-in">
      <div className="modal-card success-modal animate-scale-up">
        <div className="success-icon-wrapper">
          <div className="icon-pulse-ring" />
          <CheckCircle2 size={54} className="text-success" />
        </div>

        <h2 className="modal-title">동의서 서명 및 저장이 완료되었습니다!</h2>
        <p className="modal-desc">
          <strong>{result.patientName}</strong> 님의 개인정보 수집·이용 동의서가 서명과 함께 안전하게 처리되었습니다.
        </p>

        {/* Status Card */}
        <div className="storage-status-card">
          <div className="status-item">
            <ShieldCheck size={18} className="text-primary" />
            <span>서명 일자: <strong>{result.signedDate}</strong></span>
          </div>
          <div className="status-item">
            <Database size={18} className="text-primary" />
            <span>
              저장 상태:{' '}
              {result.isLocalFallback ? (
                <span className="badge-fallback">로컬 브라우저 세션 보관 (Supabase 미연동)</span>
              ) : (
                <span className="badge-cloud">Supabase 클라우드 Storage & DB 저장 완료</span>
              )}
            </span>
          </div>
        </div>

        {downloaded && (
          <div className="alert-box success animate-scale-up" style={{ margin: '0 0 1rem 0' }}>
            <Check size={18} />
            <span>브라우저 <strong>[다운로드]</strong> 폴더에 PDF 저장이 시작되었습니다!</span>
          </div>
        )}

        {/* Action Buttons (Native Anchor tags for 100% reliable download and new tab) */}
        <div className="modal-actions">
          <a
            href={downloadBlobUrl || '#'}
            download={filename}
            className="btn-modal-action btn-download"
            onClick={() => {
              setDownloaded(true);
              setTimeout(() => setDownloaded(false), 4000);
            }}
          >
            <Download size={18} />
            <span>PDF 즉시 다운로드 (PC 저장)</span>
          </a>

          <a
            href={downloadBlobUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-modal-action btn-outline"
          >
            <Eye size={18} />
            <span>생성된 PDF 새 탭에서 바로 보기 / 인쇄</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setDownloaded(false);
              onResetForNextPatient();
            }}
            className="btn-modal-action btn-primary"
          >
            <PlusCircle size={18} />
            <span>다음 환자 서명하기</span>
          </button>
        </div>

        <p className="signature-hint" style={{ marginTop: '0.85rem' }}>
          * 다운로드 클릭 시 내 컴퓨터의 <code>다운로드 (Downloads)</code> 폴더에 <code>{filename}</code> 파일이 저장됩니다.
        </p>
      </div>
    </div>
  );
};
