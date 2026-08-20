import React, { useState, useRef, useEffect } from 'react';
import { PatientInfo, ConsentAgreementState, ConsentTermsSettings, ClinicInfo } from '../types';
import { SignaturePad, SignaturePadRef } from './SignaturePad';
import { ConsentDocument } from './ConsentDocument';
import { generateConsentPdf } from '../lib/pdfGenerator';
import { uploadConsentPdf, saveConsentRecord } from '../lib/supabase';
import { DEFAULT_CONSENT_SETTINGS } from '../lib/consentConfig';
import { DEFAULT_CLINIC_INFO } from '../lib/clinicConfig';
import { 
  User, 
  Calendar, 
  Phone, 
  ShieldCheck, 
  CheckCircle, 
  CheckSquare, 
  Square, 
  AlertCircle, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Users, 
  Sparkles, 
  FileCheck2,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PatientFormProps {
  onSuccess: (result: {
    patientName: string;
    pdfBlob: Blob;
    pdfUrl: string;
    isLocalFallback: boolean;
    signedDate: string;
  }) => void;
  clinicName: string;
  clinicInfo?: ClinicInfo;
  consentSettings?: ConsentTermsSettings;
}

export const PatientForm: React.FC<PatientFormProps> = ({ 
  onSuccess, 
  clinicName,
  clinicInfo = DEFAULT_CLINIC_INFO,
  consentSettings = DEFAULT_CONSENT_SETTINGS 
}) => {
  const termsList = consentSettings.terms || DEFAULT_CONSENT_SETTINGS.terms;

  // Today's date automatically
  const [currentDateFormatted, setCurrentDateFormatted] = useState('');
  const [currentDateRaw, setCurrentDateRaw] = useState('');

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[now.getDay()];

    setCurrentDateFormatted(`${year}년 ${month}월 ${day}일 (${dayName})`);
    setCurrentDateRaw(`${year}-${month}-${day}`);
  }, []);

  // Form State
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    name: '',
    birthDate: '',
    phone: '',
    isMinor: false,
    representativeName: '',
    representativeRelation: '부/모'
  });

  // Dynamic Agreements Map initialized with required terms checked
  const [agreements, setAgreements] = useState<ConsentAgreementState>(() => {
    const initial: Record<string, boolean> = {};
    termsList.forEach(t => {
      initial[t.id] = t.category === 'required';
    });
    return initial;
  });

  useEffect(() => {
    setAgreements(prev => {
      const next: Record<string, boolean> = {};
      termsList.forEach(t => {
        next[t.id] = prev[t.id] !== undefined ? prev[t.id] : (t.category === 'required');
      });
      return next;
    });
  }, [consentSettings]);

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const signaturePadRef = useRef<SignaturePadRef | null>(null);
  const printDocRef = useRef<HTMLDivElement | null>(null);

  // Phone number auto-formatter
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length > 7) {
      value = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}-${value.slice(3)}`;
    }
    setPatientInfo(prev => ({ ...prev, phone: value }));
  };

  // Birth date auto-formatter (YYYY-MM-DD or 6/8 digits)
  const handleBirthDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length > 8) value = value.slice(0, 8);

    if (value.length === 8) {
      value = `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6)}`;
    } else if (value.length === 6) {
      value = `${value.slice(0, 2)}.${value.slice(2, 4)}.${value.slice(4)}`;
    }
    setPatientInfo(prev => ({ ...prev, birthDate: value }));
  };

  // Master Agree All
  const isAllChecked = termsList.length > 0 && termsList.every(t => agreements[t.id]);

  const handleToggleAll = () => {
    const nextState = !isAllChecked;
    const nextMap: Record<string, boolean> = {};
    termsList.forEach(t => {
      nextMap[t.id] = nextState;
    });
    setAgreements(nextMap);
  };

  const handleAgreementChange = (termId: string) => {
    setAgreements(prev => ({ ...prev, [termId]: !prev[termId] }));
  };

  // Toggle details accordion
  const toggleSection = (secId: string) => {
    setExpandedSection(prev => (prev === secId ? null : secId));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation: Name
    if (!patientInfo.name.trim()) {
      setErrorMessage('환자 성명을 입력해 주세요.');
      document.getElementById('patient-name-input')?.focus();
      return;
    }

    // 2. Validation: Required Checkboxes
    const requiredTerms = termsList.filter(t => t.category === 'required' || t.badgeLabel === '필수');
    const uncheckedRequired = requiredTerms.find(t => !agreements[t.id]);
    if (uncheckedRequired) {
      setErrorMessage(`[${uncheckedRequired.title}] 항목은 필수 동의 항목입니다. 동의란에 체크해 주세요.`);
      return;
    }

    // 3. Validation: Minor Representative
    if (patientInfo.isMinor && !patientInfo.representativeName?.trim()) {
      setErrorMessage('만 14세 미만인 경우 법정대리인(보호자) 성명을 입력해 주세요.');
      return;
    }

    // 4. Validation: Signature
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setErrorMessage('서명란에 환자 본인(또는 대리인)의 자필 서명을 입력해 주세요.');
      return;
    }

    const sigUrl = signaturePadRef.current.toDataURL();
    if (!sigUrl) {
      setErrorMessage('서명 이미지 추출에 실패했습니다. 다시 서명해 주세요.');
      return;
    }

    setSignatureDataUrl(sigUrl);
    setIsSubmitting(true);

    try {
      setSubmitStep('1/3 공식 A4 전자문서 생성 중...');

      // Small delay to ensure state and signature image are rendered in printDocRef
      await new Promise(r => setTimeout(r, 200));

      const docElement = document.getElementById('printable-consent-document');
      if (!docElement) {
        throw new Error('문서 렌더링 요소를 찾을 수 없습니다.');
      }

      const { blob: pdfBlob, dataUrl, filename } = await generateConsentPdf(docElement, patientInfo.name);

      setSubmitStep('2/3 보안 저장소에 PDF 업로드 중...');

      // Upload to Supabase Storage (or store persistent Base64 Data URL locally)
      const uploadResult = await uploadConsentPdf(pdfBlob, filename, dataUrl);

      setSubmitStep('3/3 동의서 데이터베이스 기록 중...');

      // Save Record to Supabase DB
      await saveConsentRecord({
        patient_name: patientInfo.name,
        birth_date: patientInfo.birthDate || '미기재',
        phone: patientInfo.phone || '미기재',
        is_minor: patientInfo.isMinor,
        representative_name: patientInfo.representativeName,
        representative_relation: patientInfo.representativeRelation,
        agreed_items: agreements,
        signed_date: currentDateRaw,
        signed_at: new Date().toISOString(),
        pdf_path: uploadResult.path,
        pdf_url: uploadResult.publicUrl
      });

      // Trigger Confetti Effect
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {
        // ignore
      }

      onSuccess({
        patientName: patientInfo.name,
        pdfBlob,
        pdfUrl: uploadResult.publicUrl,
        isLocalFallback: Boolean(uploadResult.isLocalFallback),
        signedDate: currentDateFormatted
      });

    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMessage(err.message || '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  return (
    <div className="patient-form-container">
      {/* Date Header Badge */}
      <div className="today-banner">
        <div className="banner-left">
          <Calendar size={18} className="text-primary" />
          <span className="banner-label">오늘 작성일자 :</span>
          <strong className="banner-date">{currentDateFormatted}</strong>
        </div>
        <div className="banner-badge">
          <ShieldCheck size={14} />
          <span>의료법 및 개인정보보호법 준수 서식</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="consent-interactive-form">
        {/* Section 1: Patient Details */}
        <section className="form-card">
          <div className="card-header">
            <User className="card-icon" size={20} />
            <h2 className="card-title">환자 기본 정보</h2>
            <span className="required-tag">필수 입력</span>
          </div>

          <div className="input-grid">
            <div className="form-group">
              <label htmlFor="patient-name-input" className="form-label">
                환자 성명 <span className="text-danger">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="patient-name-input"
                  type="text"
                  placeholder="예: 홍길동"
                  value={patientInfo.name}
                  onChange={e => setPatientInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                생년월일 <span className="text-sub">(6자리 또는 8자리)</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="예: 950312 또는 1995.03.12"
                  value={patientInfo.birthDate}
                  onChange={handleBirthDateChange}
                  className="form-input"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                휴대전화 번호 <span className="text-sub">(예약/안내)</span>
              </label>
              <div className="input-wrapper">
                <Phone size={16} className="input-icon" />
                <input
                  type="tel"
                  placeholder="010-1234-5678"
                  value={patientInfo.phone}
                  onChange={handlePhoneChange}
                  className="form-input with-icon"
                />
              </div>
            </div>
          </div>

          {/* Minor / Legal Representative toggle */}
          <div className="minor-toggle-box">
            <label className="checkbox-label cursor-pointer">
              <input
                type="checkbox"
                checked={patientInfo.isMinor}
                onChange={e => setPatientInfo(prev => ({ ...prev, isMinor: e.target.checked }))}
                className="hidden-checkbox"
              />
              <span className="custom-checkbox">
                {patientInfo.isMinor ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
              </span>
              <span className="checkbox-text font-medium">
                환자가 만 14세 미만 아동/청소년이거나 법정대리인이 대신 서명합니다.
              </span>
            </label>

            {patientInfo.isMinor && (
              <div className="minor-input-subgrid animate-fade-in">
                <div className="form-group">
                  <label className="form-label">
                    법정대리인(보호자) 성명 <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="보호자 성명"
                    value={patientInfo.representativeName || ''}
                    onChange={e => setPatientInfo(prev => ({ ...prev, representativeName: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">환자와의 관계</label>
                  <select
                    value={patientInfo.representativeRelation || '부/모'}
                    onChange={e => setPatientInfo(prev => ({ ...prev, representativeRelation: e.target.value }))}
                    className="form-select"
                  >
                    <option value="부">부 (아버지)</option>
                    <option value="모">모 (어머니)</option>
                    <option value="조부모">조부모</option>
                    <option value="후견인">후견인</option>
                    <option value="기타">기타 대리인</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Terms & Consent Agreements (Dynamically rendered from customizable settings) */}
        <section className="form-card">
          <div className="card-header">
            <FileText className="card-icon" size={20} />
            <h2 className="card-title">{consentSettings.sectionTitle || '개인정보 수집 및 처리 동의'}</h2>
          </div>

          {/* Master Agree All Button */}
          <div 
            onClick={handleToggleAll} 
            className={`agree-all-box ${isAllChecked ? 'all-active' : ''}`}
          >
            <div className="agree-all-left">
              <span className="agree-all-icon">
                {isAllChecked ? <CheckSquare size={22} className="text-primary-brand" /> : <Square size={22} />}
              </span>
              <div>
                <strong className="agree-all-title">모든 필수 및 선택 항목에 전체 동의합니다.</strong>
                <p className="agree-all-desc">진료에 필요한 모든 안내 항목과 동의 사항에 일괄 동의합니다.</p>
              </div>
            </div>
            <Sparkles size={18} className="sparkle-icon" />
          </div>

          <div className="agreements-list">
            {termsList.map(term => {
              const isChecked = agreements[term.id] ?? false;
              const isOptional = term.category === 'optional';
              const isExpanded = expandedSection === term.id;

              return (
                <div key={term.id} className={`agreement-item ${isOptional ? 'optional' : ''}`}>
                  <div className="item-main">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleAgreementChange(term.id)}
                        className="hidden-checkbox"
                      />
                      <span className="custom-checkbox">
                        {isChecked ? <CheckSquare size={19} className="text-primary" /> : <Square size={19} />}
                      </span>
                      <span className="item-title">
                        <span className={isOptional ? 'badge-opt' : 'badge-req'}>
                          [{term.badgeLabel || (isOptional ? '선택' : '필수')}]
                        </span>{' '}
                        {term.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleSection(term.id)}
                      className="btn-expand"
                    >
                      <span>내용보기</span>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="item-detail animate-slide-down">
                      <p style={{ whiteSpace: 'pre-line', margin: 0, lineHeight: 1.6 }}>
                        {term.content}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: Digital Signature Pad */}
        <section className="form-card">
          <div className="card-header">
            <SignaturePad ref={signaturePadRef} height={190} />
          </div>
        </section>

        {/* Error Notice */}
        {errorMessage && (
          <div className="alert-box error animate-shake">
            <AlertCircle size={20} className="alert-icon" />
            <p className="alert-text">{errorMessage}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="submit-action-area">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn-submit-consent ${isSubmitting ? 'loading' : ''}`}
          >
            {isSubmitting ? (
              <span className="btn-loading-content">
                <Loader2 size={22} className="spin-icon" />
                <span>{submitStep || '전자서명 처리 및 PDF 저장 중...'}</span>
              </span>
            ) : (
              <span className="btn-normal-content">
                <FileCheck2 size={22} />
                <span>동의서 서명 완료 및 저장</span>
              </span>
            )}
          </button>
          <p className="submit-sub-notice">
            ※ 확인을 누르면 서명이 포함된 공식 PDF 동의서가 생성되어 안전하게 저장됩니다.
          </p>
        </div>
      </form>

      {/* Hidden container for High-Resolution PDF rendering via html2canvas */}
      <div className="printable-canvas-offscreen" aria-hidden="true">
        <div id="printable-consent-document" ref={printDocRef}>
          <ConsentDocument
            patientInfo={patientInfo}
            agreements={agreements}
            signatureUrl={signatureDataUrl || (signaturePadRef.current ? signaturePadRef.current.toDataURL() : null)}
            clinicInfo={clinicInfo}
            clinicName={clinicName}
            signedDate={currentDateFormatted}
            consentSettings={consentSettings}
          />
        </div>
      </div>
    </div>
  );
};
