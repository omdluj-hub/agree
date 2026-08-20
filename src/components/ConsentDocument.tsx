import React from 'react';
import { PatientInfo, ConsentAgreementState, ConsentTermsSettings, ClinicInfo } from '../types';
import { DEFAULT_CONSENT_SETTINGS } from '../lib/consentConfig';
import { DEFAULT_CLINIC_INFO } from '../lib/clinicConfig';

interface ConsentDocumentProps {
  patientInfo: PatientInfo;
  agreements: ConsentAgreementState;
  signatureUrl: string | null;
  clinicInfo?: ClinicInfo;
  clinicName?: string;
  signedDate: string; // e.g. "2026년 08월 20일"
  consentSettings?: ConsentTermsSettings;
}

export const ConsentDocument: React.FC<ConsentDocumentProps> = ({
  patientInfo,
  agreements,
  signatureUrl,
  clinicInfo,
  clinicName,
  signedDate,
  consentSettings = DEFAULT_CONSENT_SETTINGS
}) => {
  const terms = consentSettings.terms || DEFAULT_CONSENT_SETTINGS.terms;
  const currentClinicName = clinicInfo?.name || clinicName || DEFAULT_CLINIC_INFO.name;
  const currentBizNumber = clinicInfo?.bizNumber || DEFAULT_CLINIC_INFO.bizNumber;
  const currentPhone = clinicInfo?.phone || DEFAULT_CLINIC_INFO.phone;

  return (
    <div id="consent-document-a4" className="consent-document-a4">
      {/* Document Header */}
      <div className="doc-header">
        <div className="doc-badge">의료기관 전용 표준 양식</div>
        <h1 className="doc-title">{consentSettings.documentTitle || DEFAULT_CONSENT_SETTINGS.documentTitle}</h1>
        <p className="doc-subtitle">
          {currentClinicName}{consentSettings.introText ?? DEFAULT_CONSENT_SETTINGS.introText}
        </p>
      </div>

      {/* Render Dynamic Consent Sections */}
      {terms.map((term, index) => {
        const isAgreed = agreements[term.id as keyof ConsentAgreementState] ?? false;
        const isOptional = term.category === 'optional';

        return (
          <div key={term.id} className={`doc-section ${isOptional ? 'optional-section' : ''}`}>
            <div className="doc-section-title">
              <div>
                <span className="section-num">{index + 1}</span>
                <span>{term.title} ({term.badgeLabel || (isOptional ? '선택' : '필수')}항목)</span>
              </div>
              <span className={`status-badge ${isAgreed ? 'agreed' : 'disagreed'}`}>
                {isAgreed ? '동의함 [V]' : '미동의 [ ]'}
              </span>
            </div>

            <div className="doc-content-box">
              <p className="doc-content-text">
                {term.content}
              </p>
            </div>
          </div>
        );
      })}

      {/* Confirmation & Signature Footer */}
      <div className="doc-footer-area">
        <p className="declaration-text">
          본인은 상기 개인정보 및 고유식별정보의 수집·이용 및 민감정보 처리에 관한 내용을 충분히 숙지하였으며, 이에 동의합니다.
        </p>

        {/* Date Display (Automatically generated) */}
        <div className="doc-date-display">
          <span>작성일자 : </span>
          <strong className="date-highlight">{signedDate}</strong>
        </div>

        {/* Patient and Signature Box */}
        <div className="doc-signature-grid">
          <div className="patient-meta-box">
            <div className="meta-row">
              <span className="meta-label">환 자 성 명 :</span>
              <span className="meta-value font-bold">{patientInfo.name || '___________'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">생 년 월 일 :</span>
              <span className="meta-value">{patientInfo.birthDate || '___________'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">연 락 처 :</span>
              <span className="meta-value">{patientInfo.phone || '___________'}</span>
            </div>

            {patientInfo.isMinor && (
              <div className="representative-meta">
                <div className="meta-row">
                  <span className="meta-label">법정대리인 :</span>
                  <span className="meta-value font-bold">{patientInfo.representativeName || '_______'}</span>
                  <span className="meta-sub"> (관계: {patientInfo.representativeRelation || '부/모'})</span>
                </div>
              </div>
            )}
          </div>

          <div className="signature-box-display">
            <span className="signature-box-label">환자 (또는 대리인) 자필서명</span>
            <div className="signature-img-container">
              {signatureUrl ? (
                <img src={signatureUrl} alt="환자 자필서명" className="signature-img-rendered" />
              ) : (
                <div className="signature-empty-box">( 서 명 )</div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Hospital Information & Seal Footer */}
        <div className="doc-clinic-issuer-card">
          <div className="issuer-info-table">
            <div className="issuer-row">
              <span className="issuer-lbl">의료기관명 :</span>
              <strong className="issuer-val font-bold">{currentClinicName}</strong>
            </div>
            <div className="issuer-row">
              <span className="issuer-lbl">사업자번호 :</span>
              <span className="issuer-val">{currentBizNumber}</span>
            </div>
            <div className="issuer-row">
              <span className="issuer-lbl">대표전화 :</span>
              <span className="issuer-val">{currentPhone}</span>
            </div>
          </div>
          <div className="clinic-stamp-area">
            <span className="clinic-sign-text">{currentClinicName} 귀중</span>
            <span className="clinic-stamp-mark">( 직 인 )</span>
          </div>
        </div>
      </div>
    </div>
  );
};
