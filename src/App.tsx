import React, { useState, useEffect } from 'react';
import { PatientForm } from './components/PatientForm';
import { AdminView } from './components/AdminView';
import { SuccessModal } from './components/SuccessModal';
import { SupabaseConfigModal } from './components/SupabaseConfigModal';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { getSupabaseConfig } from './lib/supabase';
import { isAdminPasswordSet } from './lib/security';
import { getConsentTermsSettings } from './lib/consentConfig';
import { getClinicInfo, saveClinicInfo } from './lib/clinicConfig';
import { ConsentTermsSettings, ClinicInfo } from './types';
import { 
  Building2, 
  ShieldCheck, 
  HeartHandshake, 
  Lock, 
  ArrowLeft 
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'patient' | 'admin'>('patient');
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>(() => {
    return getClinicInfo();
  });
  const [consentSettings, setConsentSettings] = useState<ConsentTermsSettings>(() => {
    return getConsentTermsSettings();
  });
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState(false);

  const [lastSubmissionResult, setLastSubmissionResult] = useState<{
    patientName: string;
    pdfBlob: Blob;
    pdfUrl: string;
    isLocalFallback: boolean;
    signedDate: string;
  } | null>(null);

  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig());
  const [formResetKey, setFormResetKey] = useState(0);

  const refreshConfig = () => {
    setSupabaseConfig(getSupabaseConfig());
  };

  const handleUpdateClinicInfo = (newInfo: ClinicInfo) => {
    setClinicInfo(newInfo);
    saveClinicInfo(newInfo);
  };

  const handleUpdateConsentSettings = (newSettings: ConsentTermsSettings) => {
    setConsentSettings(newSettings);
  };

  const handlePatientSuccess = (result: {
    patientName: string;
    pdfBlob: Blob;
    pdfUrl: string;
    isLocalFallback: boolean;
    signedDate: string;
  }) => {
    setLastSubmissionResult(result);
    setIsSuccessOpen(true);
  };

  const handleResetForNext = () => {
    setIsSuccessOpen(false);
    setLastSubmissionResult(null);
    setFormResetKey(prev => prev + 1);
  };

  const handleFooterAdminClick = () => {
    if (activeTab === 'admin') {
      setActiveTab('patient');
      return;
    }

    if (isAdminPasswordSet()) {
      setIsAdminAuthModalOpen(true);
    } else {
      setActiveTab('admin');
    }
  };

  const handleAdminAuthSuccess = () => {
    setIsAdminAuthModalOpen(false);
    setActiveTab('admin');
  };

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-wrap">
            <div className="brand-logo">
              <Building2 size={24} className="text-brand" />
            </div>
            <div>
              <div className="brand-title-row">
                <h1 className="brand-title">{clinicInfo.name}</h1>
                <span className={`brand-sub-badge ${activeTab === 'admin' ? 'admin-badge' : ''}`}>
                  {activeTab === 'admin' ? '관리자 모드' : '전자동의서'}
                </span>
              </div>
              <p className="brand-tagline">개인정보 수집·이용 동의 및 자필 전자서명 시스템</p>
            </div>
          </div>

          {/* If Admin Mode, show Quick Return button in header */}
          {activeTab === 'admin' && (
            <div className="header-right-actions animate-fade-in">
              <button
                type="button"
                onClick={() => setActiveTab('patient')}
                className="btn-header-back"
              >
                <ArrowLeft size={16} />
                <span>환자 서명 화면으로 이동</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="content-container">
          {activeTab === 'patient' ? (
            <div className="patient-mode-wrapper animate-fade-in">
              <div className="mode-intro-banner">
                <div className="intro-icon-box">
                  <HeartHandshake size={28} className="text-primary-brand" />
                </div>
                <div className="intro-text-box">
                  <h2>환자 개인정보 수집·이용 및 민감정보 처리 동의서</h2>
                  <p>
                    의료법 및 개인정보보호법에 따른 필수 동의 절차입니다. 동의 내용을 확인하신 후 아래에 성명과 자필 서명을 입력해 주세요.
                  </p>
                </div>
              </div>

              <PatientForm
                key={formResetKey}
                onSuccess={handlePatientSuccess}
                clinicName={clinicInfo.name}
                clinicInfo={clinicInfo}
                consentSettings={consentSettings}
              />
            </div>
          ) : (
            <AdminView
              clinicName={clinicInfo.name}
              clinicInfo={clinicInfo}
              onUpdateClinicInfo={handleUpdateClinicInfo}
              onOpenConfig={() => setIsConfigOpen(true)}
              onBackToPatient={() => setActiveTab('patient')}
              consentSettings={consentSettings}
              onUpdateConsentSettings={handleUpdateConsentSettings}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <SuccessModal
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        result={lastSubmissionResult}
        onResetForNextPatient={handleResetForNext}
      />

      <SupabaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigSaved={refreshConfig}
      />

      {/* Admin Mode Entrance Password Verification Modal */}
      <AdminPasswordModal
        isOpen={isAdminAuthModalOpen}
        onClose={() => setIsAdminAuthModalOpen(false)}
        onSuccess={handleAdminAuthSuccess}
        title="원무과 관리자 모드 진입"
        description="관리자 모드에 진입하려면 설정된 비밀번호를 입력해 주세요."
      />

      {/* Footer with Secret Admin Mode entrance text */}
      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-center">
            <button
              type="button"
              onClick={handleFooterAdminClick}
              className="footer-secret-admin-btn"
              title={activeTab === 'patient' ? '관리자 모드 열기' : '환자 서명 모드로 전환'}
            >
              <ShieldCheck size={16} className="text-primary" />
              <span>본 시스템은 개인정보보호법 제15조·제23조·제24조 및 의료법 제22조를 준수합니다.</span>
              {activeTab === 'patient' && isAdminPasswordSet() && (
                <Lock size={12} className="footer-lock-hint" />
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
