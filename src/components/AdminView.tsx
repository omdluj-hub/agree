import React, { useState, useEffect } from 'react';
import { SignedConsentRecord, ConsentTermsSettings, ClinicInfo } from '../types';
import { fetchConsentRecords, deleteConsentRecord, getActiveDbProvider } from '../lib/supabase';
import { triggerPdfDownload, createPdfBlobUrl } from '../lib/pdfGenerator';
import { isPasswordRequiredForDocs, isAdminPasswordSet } from '../lib/security';
import { SecurityModal } from './SecurityModal';
import { AdminPasswordModal } from './AdminPasswordModal';
import { ConsentTermsEditor } from './ConsentTermsEditor';
import { 
  Search, 
  RefreshCw, 
  FileText, 
  Download, 
  Trash2, 
  Eye, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle,
  X,
  ExternalLink,
  HardDrive,
  Building2,
  ArrowLeft,
  Settings,
  Save,
  Check,
  Shield,
  Database,
  Zap,
  Flame
} from 'lucide-react';

interface AdminViewProps {
  clinicName: string;
  clinicInfo: ClinicInfo;
  onUpdateClinicInfo: (info: ClinicInfo) => void;
  onOpenConfig: () => void;
  onBackToPatient: () => void;
  consentSettings: ConsentTermsSettings;
  onUpdateConsentSettings: (settings: ConsentTermsSettings) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  clinicName,
  clinicInfo,
  onUpdateClinicInfo,
  onOpenConfig,
  onBackToPatient,
  consentSettings,
  onUpdateConsentSettings
}) => {
  const [records, setRecords] = useState<SignedConsentRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  // Security Modal State
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);

  // Password Prompt State for Document Viewing/Downloading
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Clinic info edit state
  const [clinicInput, setClinicInput] = useState<ClinicInfo>(clinicInfo);
  const [infoSavedNotice, setInfoSavedNotice] = useState(false);

  // PDF Preview State
  const [previewRecord, setPreviewRecord] = useState<SignedConsentRecord | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string>('');

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<SignedConsentRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeProvider = getActiveDbProvider();
  const providerDisplay = activeProvider === 'neon' 
    ? 'Neon (Vercel)' 
    : activeProvider === 'supabase' 
      ? 'Supabase' 
      : '로컬 보관';

  const loadData = async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConsentRecords(query);
      setRecords(data);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setClinicInput(clinicInfo);
  }, [clinicInfo]);

  useEffect(() => {
    if (!previewRecord) {
      setPreviewBlobUrl('');
      return;
    }
    const url = createPdfBlobUrl(previewRecord.pdf_url);
    setPreviewBlobUrl(url);

    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewRecord]);

  const handleSaveClinicInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicInput.name.trim()) return;
    onUpdateClinicInfo(clinicInput);
    setInfoSavedNotice(true);
    setTimeout(() => setInfoSavedNotice(false), 3000);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(searchQuery);
  };

  // Perform action with security check if requirePasswordForDocs is enabled
  const executeWithSecurityCheck = (action: () => void) => {
    if (isPasswordRequiredForDocs() && isAdminPasswordSet()) {
      setPendingAction(() => action);
      setIsPasswordPromptOpen(true);
    } else {
      action();
    }
  };

  const handlePasswordSuccess = () => {
    setIsPasswordPromptOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleViewRecord = (record: SignedConsentRecord) => {
    executeWithSecurityCheck(() => {
      setPreviewRecord(record);
    });
  };

  const handleDownloadRecord = (record: SignedConsentRecord) => {
    executeWithSecurityCheck(() => {
      const filename = `개인정보동의서_${record.patient_name.trim()}_${record.signed_date || 'signed'}.pdf`;
      const success = triggerPdfDownload(record.pdf_url, filename);
      if (success) {
        setDownloadSuccessMsg(`[${record.patient_name}] 님의 동의서가 PC의 [다운로드] 폴더에 저장되었습니다.`);
        setTimeout(() => setDownloadSuccessMsg(null), 4000);
      } else {
        alert('PDF 다운로드에 실패했습니다. 다시 시도해 주세요.');
      }
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteConsentRecord(deleteTarget.id || '', deleteTarget.pdf_path);
      setRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = records.filter(r => r.signed_date === todayStr || r.signed_at?.startsWith(todayStr)).length;
  const totalCount = records.length;

  return (
    <div className="admin-view-container animate-fade-in">
      {/* Top Banner Navigation */}
      <div className="admin-top-nav-card">
        <button
          type="button"
          onClick={onBackToPatient}
          className="btn-back-to-patient"
        >
          <ArrowLeft size={18} />
          <span>환자 서명 화면으로 돌아가기</span>
        </button>

        <div className="admin-top-right-btns">
          {/* [보안] Button */}
          <button
            type="button"
            onClick={() => setIsSecurityOpen(true)}
            className="btn-security-action"
            title="관리자 비밀번호 설정, 문서 보안 및 전체 데이터 백업"
          >
            <Shield size={16} />
            <span>보안</span>
            {isAdminPasswordSet() && <span className="secure-active-dot" />}
          </button>

          {/* Database Config Button */}
          <button
            type="button"
            onClick={onOpenConfig}
            className={`btn-supabase-status ${activeProvider !== 'local' ? 'connected' : 'local'}`}
          >
            <span className="status-indicator-dot" />
            <Database size={15} />
            <span>{providerDisplay}</span>
            <Settings size={14} className="settings-gear" />
          </button>

          <button
            type="button"
            onClick={() => loadData(searchQuery)}
            disabled={loading}
            className="btn-refresh"
          >
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* Admin Title Area */}
      <div className="admin-header-row">
        <div>
          <h2 className="admin-title">관리자 모드 (원무과 동의서 보관함)</h2>
          <p className="admin-subtitle">
            환자가 서명 완료한 동의서(PDF) 목록을 실시간 조회 및 인쇄·다운로드하고 병원 기본 정보와 약관을 설정할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Download notice */}
      {downloadSuccessMsg && (
        <div className="alert-box success animate-scale-up">
          <CheckCircle2 size={18} />
          <span>{downloadSuccessMsg}</span>
        </div>
      )}

      {/* Clinic Information Settings Card */}
      <div className="form-card clinic-settings-card">
        <div className="card-header">
          <Building2 className="card-icon" size={20} />
          <div className="card-title-wrap">
            <h3 className="card-title">병의원 기본 정보 및 직인 설정</h3>
            <p className="card-subtitle-text">
              동의서 상단 타이틀 및 생성되는 A4 PDF 하단 공식 직인 발행처에 표시될 상세 정보입니다.
            </p>
          </div>
          {infoSavedNotice && (
            <span className="badge-cloud flex-center gap-1 animate-scale-up font-bold">
              <Check size={16} /> 병원 정보가 저장되었습니다!
            </span>
          )}
        </div>
        <form onSubmit={handleSaveClinicInfo} className="clinic-info-form">
          <div className="clinic-info-grid">
            <div className="form-group">
              <label className="form-label font-bold">
                의료기관 명칭 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={clinicInput.name}
                onChange={e => setClinicInput(prev => ({ ...prev, name: e.target.value }))}
                placeholder="예: 연세스마트의원, 서울하늘치과"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label font-bold">사업자등록번호</label>
              <input
                type="text"
                value={clinicInput.bizNumber}
                onChange={e => setClinicInput(prev => ({ ...prev, bizNumber: e.target.value }))}
                placeholder="예: 123-45-67890"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label font-bold">대표 전화번호</label>
              <input
                type="text"
                value={clinicInput.phone}
                onChange={e => setClinicInput(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="예: 02-1234-5678"
                className="form-input"
              />
            </div>
          </div>

          <div className="clinic-info-footer">
            <span className="text-sub text-xs">
              ※ 입력하신 병원명, 사업자등록번호, 대표전화는 동의서 하단 공식 직인 날인처 및 PDF 문서에 상세히 첨부됩니다.
            </span>
            <button type="submit" className="btn-primary-solid">
              <Save size={16} />
              <span>병원 정보 저장</span>
            </button>
          </div>
        </form>
      </div>

      {/* Consent Terms & Clauses Customization Card */}
      <ConsentTermsEditor
        onSettingsUpdated={onUpdateConsentSettings}
        clinicName={clinicInput.name || clinicName}
      />

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap primary">
            <Calendar size={22} />
          </div>
          <div>
            <span className="stat-label">오늘 서명된 동의서</span>
            <div className="stat-val">{todayCount} <span className="stat-unit">건</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap success">
            <FileText size={22} />
          </div>
          <div>
            <span className="stat-label">총 보관 문서 수</span>
            <div className="stat-val">{totalCount} <span className="stat-unit">건</span></div>
          </div>
        </div>

        <div className="stat-card cursor-pointer" onClick={onOpenConfig}>
          <div className="stat-icon-wrap info">
            <HardDrive size={22} />
          </div>
          <div>
            <span className="stat-label">데이터베이스 연동 상태</span>
            <div className="stat-val-status">
              {activeProvider === 'neon' ? (
                <span className="text-success flex-center gap-1 font-bold">
                  <Zap size={16} className="text-emerald-500" /> Neon Postgres (Vercel)
                </span>
              ) : activeProvider === 'supabase' ? (
                <span className="text-success flex-center gap-1 font-bold">
                  <Flame size={16} className="text-emerald-600" /> Supabase 연동됨
                </span>
              ) : (
                <span className="text-warning flex-center gap-1 font-bold">
                  로컬 보관 (클릭하여 설정)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="search-filter-card">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="환자 성명, 연락처, 생년월일 또는 작성일자 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <button type="submit" className="btn-search">
            검색
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                loadData('');
              }}
              className="btn-clear-search"
            >
              초기화
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="alert-box error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Table of Records */}
      <div className="table-responsive-card">
        {loading ? (
          <div className="loading-state">
            <RefreshCw size={28} className="spin-icon text-primary" />
            <p>동의서 목록을 불러오는 중입니다...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} className="empty-icon" />
            <h3>보관된 동의서가 없습니다.</h3>
            <p>환자 서명 화면에서 동의서를 작성하면 여기에 자동으로 기록됩니다.</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>환자 성명</th>
                <th>생년월일</th>
                <th>연락처</th>
                <th>서명 일자</th>
                <th>동의 현황</th>
                <th>저장 위치</th>
                <th className="text-right">관리 작업</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id || record.pdf_path}>
                  <td>
                    <div className="patient-name-col">
                      <strong className="name-text">{record.patient_name}</strong>
                      {record.is_minor && (
                        <span className="minor-badge">
                          대리인: {record.representative_name} ({record.representative_relation || '부/모'})
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{record.birth_date || '-'}</td>
                  <td>{record.phone || '-'}</td>
                  <td>
                    <span className="date-badge">
                      {record.signed_date || record.signed_at?.slice(0, 10)}
                    </span>
                  </td>
                  <td>
                    <div className="agreed-tag-group">
                      <span className="tag-req">동의 완료</span>
                    </div>
                  </td>
                  <td>
                    {record.pdf_path?.startsWith('local/') || record.id?.startsWith('local_') ? (
                      <span className="badge-local">로컬 보관</span>
                    ) : record.pdf_path?.startsWith('neon/') ? (
                      <span className="badge-cloud-small" style={{ background: '#0284c7', color: '#ffffff' }}>Neon DB</span>
                    ) : (
                      <span className="badge-cloud-small">Supabase</span>
                    )}
                  </td>
                  <td className="text-right">
                    <div className="table-btn-group">
                      <button
                        type="button"
                        onClick={() => handleViewRecord(record)}
                        className="btn-tbl-action btn-view"
                        title="PDF 미리보기"
                      >
                        <Eye size={15} />
                        <span>보기</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadRecord(record)}
                        className="btn-tbl-action btn-down"
                        title="다운로드"
                      >
                        <Download size={15} />
                        <span>다운</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(record)}
                        className="btn-tbl-action btn-del"
                        title="삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PDF Preview Modal */}
      {previewRecord && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-card pdf-preview-modal animate-scale-up">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <FileText className="text-primary" size={20} />
                <h3 className="modal-title">
                  {previewRecord.patient_name} 님의 서명 동의서 미리보기
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRecord(null)}
                className="btn-close-modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pdf-iframe-container">
              <object
                data={previewBlobUrl || previewRecord.pdf_url}
                type="application/pdf"
                className="pdf-iframe"
              >
                <iframe
                  src={previewBlobUrl || previewRecord.pdf_url}
                  title="동의서 PDF"
                  className="pdf-iframe"
                >
                  <p className="p-4 text-center text-white">
                    PDF 뷰어가 브라우저에서 차단되었습니다. 아래 [새 창에서 열기] 또는 [PDF 다운로드] 버튼을 이용해 주세요.
                  </p>
                </iframe>
              </object>
            </div>

            <div className="modal-footer">
              <span className="text-sub text-sm">
                서명일시: {previewRecord.signed_at || previewRecord.signed_date}
              </span>
              <div className="footer-right">
                <a
                  href={previewBlobUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-modal-action btn-outline"
                >
                  <ExternalLink size={16} />
                  <span>새 창에서 열기 / 인쇄</span>
                </a>
                <a
                  href={previewBlobUrl || '#'}
                  download={`개인정보동의서_${previewRecord.patient_name.trim()}_${previewRecord.signed_date || 'signed'}.pdf`}
                  className="btn-primary-solid"
                  onClick={() => {
                    setDownloadSuccessMsg(`[${previewRecord.patient_name}] 님의 동의서 다운로드가 시작되었습니다.`);
                    setTimeout(() => setDownloadSuccessMsg(null), 4000);
                  }}
                >
                  <Download size={16} />
                  <span>PDF 다운로드</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewRecord(null)}
                  className="btn-cancel"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop animate-fade-in">
          <div className="modal-card confirm-modal animate-scale-up">
            <div className="confirm-icon-wrap">
              <AlertTriangle size={36} className="text-danger" />
            </div>
            <h3 className="modal-title">동의서 문서를 삭제하시겠습니까?</h3>
            <p className="modal-desc">
              <strong>{deleteTarget.patient_name}</strong> 님의 동의서 및 PDF 파일이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-cancel"
                disabled={isDeleting}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-danger-solid"
                disabled={isDeleting}
              >
                {isDeleting ? '삭제 중...' : '삭제 확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Modal */}
      <SecurityModal
        isOpen={isSecurityOpen}
        onClose={() => setIsSecurityOpen(false)}
        records={records}
        clinicName={clinicInput.name || clinicName}
      />

      {/* Password Prompt Modal for Doc Actions */}
      <AdminPasswordModal
        isOpen={isPasswordPromptOpen}
        onClose={() => {
          setIsPasswordPromptOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handlePasswordSuccess}
        title="환자 개인정보 보호 - 관리자 비밀번호 확인"
        description="동의서 열람 또는 다운로드를 진행하려면 관리자 비밀번호를 입력해 주세요."
      />
    </div>
  );
};
