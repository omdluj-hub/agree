import React, { useState, useEffect } from 'react';
import { 
  isAdminPasswordSet, 
  setAdminPassword, 
  clearAdminPassword, 
  isPasswordRequiredForDocs, 
  setPasswordRequiredForDocs,
  verifyAdminPassword,
  exportAllConsentsAsZip
} from '../lib/security';
import { SignedConsentRecord } from '../types';
import { 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Unlock, 
  Download, 
  X, 
  Check, 
  AlertCircle, 
  FileArchive, 
  RefreshCw, 
  ToggleLeft, 
  ToggleRight,
  Info,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: SignedConsentRecord[];
  clinicName: string;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  records,
  clinicName
}) => {
  const [hasPassword, setHasPassword] = useState(isAdminPasswordSet());
  const [requireDocPassword, setRequireDocPassword] = useState(isPasswordRequiredForDocs());

  // Password edit form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Status notices
  const [noticeMsg, setNoticeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasPassword(isAdminPasswordSet());
      setRequireDocPassword(isPasswordRequiredForDocs());
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setNoticeMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setNoticeMsg(null);

    // If password was already set, verify current password first
    if (hasPassword && !verifyAdminPassword(currentPw)) {
      setNoticeMsg({ type: 'error', text: '현재 비밀번호가 일치하지 않습니다.' });
      return;
    }

    if (!newPw.trim()) {
      setNoticeMsg({ type: 'error', text: '새 비밀번호를 입력해 주세요.' });
      return;
    }

    if (newPw !== confirmPw) {
      setNoticeMsg({ type: 'error', text: '새 비밀번호와 확인 입력이 일치하지 않습니다.' });
      return;
    }

    setAdminPassword(newPw);
    setHasPassword(true);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setNoticeMsg({ type: 'success', text: '관리자 비밀번호가 성공적으로 설정/변경되었습니다.' });
  };

  const handleResetPassword = () => {
    if (hasPassword) {
      if (!currentPw) {
        setNoticeMsg({ type: 'error', text: '비밀번호를 초기화(해제)하려면 현재 비밀번호를 입력해 주세요.' });
        return;
      }
      if (!verifyAdminPassword(currentPw)) {
        setNoticeMsg({ type: 'error', text: '현재 비밀번호가 일치하지 않습니다.' });
        return;
      }
    }

    clearAdminPassword();
    setHasPassword(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setNoticeMsg({ type: 'success', text: '관리자 비밀번호가 초기화(해제)되었습니다. 이제 비밀번호 없이 진입할 수 있습니다.' });
  };

  const handleToggleDocPassword = () => {
    const nextVal = !requireDocPassword;
    setRequireDocPassword(nextVal);
    setPasswordRequiredForDocs(nextVal);
    setNoticeMsg({
      type: 'success',
      text: nextVal 
        ? '문서(PDF) 열람 및 다운로드 시 비밀번호 확인이 활성화되었습니다.' 
        : '문서 열람 및 다운로드 시 비밀번호 확인이 비활성화되었습니다.'
    });
  };

  const handleExportAllZip = async () => {
    setIsExporting(true);
    setNoticeMsg(null);
    try {
      const res = await exportAllConsentsAsZip(records, clinicName);
      setNoticeMsg({
        type: 'success',
        text: `총 ${res.count}건의 동의서와 PDF 파일이 [${res.filename}] 압축 파일로 안전하게 내보내졌습니다.`
      });
    } catch (err: any) {
      setNoticeMsg({ type: 'error', text: err.message || '데이터 압축 내보내기 중 오류가 발생했습니다.' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in">
      <div className="modal-card security-modal animate-scale-up" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <ShieldCheck className="text-primary" size={22} />
            <h2 className="modal-title">원무과 보안 및 데이터 백업 설정</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: '1.25rem' }}>
          {/* Status Message */}
          {noticeMsg && (
            <div className={`alert-box ${noticeMsg.type === 'success' ? 'success' : 'error'} animate-scale-up`}>
              {noticeMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="alert-text">{noticeMsg.text}</span>
            </div>
          )}

          {/* Section 1: Password Configuration */}
          <div className="security-section-card">
            <div className="section-card-header">
              <div className="flex-center gap-1">
                {hasPassword ? <Lock size={18} className="text-primary" /> : <Unlock size={18} className="text-warning" />}
                <h3 className="section-card-title">관리자 비밀번호 설정</h3>
              </div>
              <span className={`status-pill ${hasPassword ? 'secured' : 'unsecured'}`}>
                {hasPassword ? '🔒 비밀번호 보호 중' : '🔓 비밀번호 미설정 (자유 진입)'}
              </span>
            </div>

            <p className="section-card-desc">
              비밀번호를 설정하면 환자 화면 하단 문구를 클릭하여 관리자 모드로 진입할 때 비밀번호를 확인합니다.
            </p>

            <form onSubmit={handleSavePassword} className="security-form-grid">
              {hasPassword && (
                <div className="form-group">
                  <label className="form-label">현재 비밀번호</label>
                  <input
                    type="password"
                    placeholder="현재 비밀번호 입력"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    className="form-input"
                  />
                </div>
              )}

              <div className="form-row-two">
                <div className="form-group">
                  <label className="form-label">{hasPassword ? '새 비밀번호' : '신규 비밀번호'}</label>
                  <input
                    type="password"
                    placeholder="새 비밀번호 입력"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">비밀번호 확인</label>
                  <input
                    type="password"
                    placeholder="비밀번호 다시 입력"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-actions-row">
                <button type="submit" className="btn-primary-solid">
                  <KeyRound size={15} />
                  <span>{hasPassword ? '비밀번호 변경' : '비밀번호 설정'}</span>
                </button>

                {hasPassword && (
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="btn-clear-auth"
                    title="비밀번호를 삭제하여 자유 진입 모드로 변경합니다."
                  >
                    <RefreshCw size={14} />
                    <span>비밀번호 초기화(해제)</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Section 2: Require Password for Document Viewing/Downloading */}
          <div className="security-section-card">
            <div className="toggle-setting-row" onClick={handleToggleDocPassword}>
              <div className="toggle-text-wrap">
                <h3 className="section-card-title flex-center gap-1">
                  <Lock size={16} className="text-primary" />
                  문서 열람 및 다운로드 시 비밀번호 확인
                </h3>
                <p className="section-card-desc" style={{ marginTop: '0.2rem' }}>
                  동의서 PDF를 보거나 다운로드할 때마다 관리자 비밀번호를 재확인하여 환자 개인정보 유출을 방지합니다.
                </p>
              </div>
              <button type="button" className="btn-toggle-switch" aria-pressed={requireDocPassword}>
                {requireDocPassword ? (
                  <ToggleRight size={34} className="text-primary" />
                ) : (
                  <ToggleLeft size={34} className="text-muted" />
                )}
              </button>
            </div>
          </div>

          {/* Section 3: Export All Data as ZIP */}
          <div className="security-section-card highlight-export">
            <div className="section-card-header">
              <div className="flex-center gap-1">
                <FileArchive size={18} className="text-primary" />
                <h3 className="section-card-title">전체 동의서 데이터 압축 백업 (.zip)</h3>
              </div>
              <span className="badge-cloud-small">
                총 {records.length}건 보관 중
              </span>
            </div>

            <p className="section-card-desc">
              현재 보관된 모든 환자의 <strong>개인정보 동의서 PDF 파일</strong>과 <strong>Excel 호환 CSV 총괄 목록</strong>을 단일 압축 파일(.zip)로 일괄 내보내기합니다.
            </p>

            <div className="export-action-box">
              <button
                type="button"
                onClick={handleExportAllZip}
                disabled={isExporting || records.length === 0}
                className="btn-export-all-zip"
              >
                {isExporting ? (
                  <>
                    <RefreshCw size={18} className="spin-icon" />
                    <span>전체 데이터 압축 파일 생성 중...</span>
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    <span>모든 데이터 압축해서 내보내기 (ZIP)</span>
                  </>
                )}
              </button>
              <div className="export-features-list">
                <span><Check size={14} className="text-success" /> 모든 환자 원본 PDF 포함</span>
                <span><Check size={14} className="text-success" /> 엑셀 열람용 CSV 요약본 포함</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <span className="text-sub text-sm">
            * 의료법 및 개인정보보호법 안전성 확보 조치
          </span>
          <button type="button" onClick={onClose} className="btn-primary-solid">
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
