import React, { useState, useEffect } from 'react';
import { ConsentTermsSettings, ConsentTermItem } from '../types';
import { 
  DEFAULT_CONSENT_SETTINGS, 
  CONSENT_PRESETS,
  getConsentTermsSettings, 
  saveConsentTermsSettings, 
  resetConsentTermsSettings,
  createNewTerm
} from '../lib/consentConfig';
import { 
  FileEdit, 
  Save, 
  RotateCcw, 
  Check, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles,
  Building2,
  FileText,
  HelpCircle,
  FolderPlus,
  Eye,
  CheckSquare
} from 'lucide-react';

interface ConsentTermsEditorProps {
  onSettingsUpdated: (newSettings: ConsentTermsSettings) => void;
  clinicName: string;
}

export const ConsentTermsEditor: React.FC<ConsentTermsEditorProps> = ({
  onSettingsUpdated,
  clinicName
}) => {
  const [settings, setSettings] = useState<ConsentTermsSettings>(getConsentTermsSettings());
  const [isSavedNotice, setIsSavedNotice] = useState(false);
  const [isResetNotice, setIsResetNotice] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);

  useEffect(() => {
    setSettings(getConsentTermsSettings());
  }, []);

  const handleDocumentTitleChange = (val: string) => {
    setSettings(prev => ({ ...prev, documentTitle: val }));
  };

  const handleSectionTitleChange = (val: string) => {
    setSettings(prev => ({ ...prev, sectionTitle: val }));
  };

  const handleIntroTextChange = (val: string) => {
    setSettings(prev => ({ ...prev, introText: val }));
  };

  const handleTermFieldChange = (termId: string, field: keyof ConsentTermItem, value: string) => {
    setSettings(prev => ({
      ...prev,
      terms: prev.terms.map(t => {
        if (t.id === termId) {
          if (field === 'category') {
            const cat = value as 'required' | 'optional';
            return {
              ...t,
              category: cat,
              badgeLabel: cat === 'required' ? '필수' : '선택'
            };
          }
          return { ...t, [field]: value };
        }
        return t;
      })
    }));
  };

  // Add blank term
  const handleAddNewTerm = () => {
    const newTerm = createNewTerm({
      title: `신규 동의 항목 ${settings.terms.length + 1}`,
      badgeLabel: '필수',
      category: 'required',
      content: `• 동의 목적: 상세 동의 목적 및 내용을 여기에 입력하세요.\n• 보존기간: 의료법에 따른 법정 보존기간 준수\n• 유의사항: 동의 거부 시 안내사항을 입력하세요.`
    });
    setSettings(prev => ({
      ...prev,
      terms: [...prev.terms, newTerm]
    }));
  };

  // Add preset template
  const handleAddPresetTerm = (preset: typeof CONSENT_PRESETS[0]) => {
    const newTerm = createNewTerm(preset.term);
    setSettings(prev => ({
      ...prev,
      terms: [...prev.terms, newTerm]
    }));
    setShowPresetsMenu(false);
  };

  // Delete term
  const handleDeleteTerm = (termId: string) => {
    if (settings.terms.length <= 1) {
      alert('최소 1개 이상의 동의 항목이 유지되어야 합니다.');
      return;
    }
    const target = settings.terms.find(t => t.id === termId);
    if (window.confirm(`[${target?.title || '선택한 항목'}] 항목을 삭제하시겠습니까?`)) {
      setSettings(prev => ({
        ...prev,
        terms: prev.terms.filter(t => t.id !== termId)
      }));
    }
  };

  // Move term order
  const handleMoveTerm = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= settings.terms.length) return;

    const reordered = [...settings.terms];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    setSettings(prev => ({ ...prev, terms: reordered }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveConsentTermsSettings(settings);
    onSettingsUpdated(settings);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleResetToDefault = () => {
    if (window.confirm('모든 동의서 제목과 항목 세부 내용을 의료법/개인정보보호법 표준 기본 서식으로 되돌리시겠습니까?')) {
      const def = resetConsentTermsSettings();
      setSettings(def);
      onSettingsUpdated(def);
      setIsResetNotice(true);
      setTimeout(() => setIsResetNotice(false), 3000);
    }
  };

  return (
    <div className="form-card visual-terms-editor animate-fade-in">
      {/* Editor Header Banner */}
      <div className="card-header visual-editor-header">
        <div className="flex-center gap-1">
          <FileEdit className="card-icon" size={22} />
          <div>
            <h3 className="card-title">동의서 화면 및 약관 직접 편집기</h3>
            <p className="card-subtitle-text">
              환자 화면에 보이는 제목과 '내용보기' 텍스트를 직관적으로 바로 수정할 수 있습니다.
            </p>
          </div>
        </div>
        <div className="terms-header-actions">
          {isSavedNotice && (
            <span className="badge-cloud flex-center gap-1 animate-scale-up font-bold">
              <Check size={16} /> 변경사항이 저장되었습니다!
            </span>
          )}
          {isResetNotice && (
            <span className="badge-fallback flex-center gap-1 animate-scale-up font-bold">
              <RotateCcw size={16} /> 표준 기본 양식으로 복구됨
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="visual-editor-body">
        {/* Document Header Customization Box */}
        <div className="visual-doc-preview-header">
          <div className="form-group-inline">
            <span className="visual-field-tag">A4 PDF 메인 제목</span>
            <input
              type="text"
              value={settings.documentTitle}
              onChange={e => handleDocumentTitleChange(e.target.value)}
              className="visual-title-input"
              placeholder="동의서 메인 제목을 입력하세요 (예: 개인정보 수집 · 이용 및 진료 동의서)"
              required
            />
          </div>

          <div className="visual-intro-row">
            <span className="visual-clinic-badge">{clinicName}</span>
            <input
              type="text"
              value={settings.introText}
              onChange={e => handleIntroTextChange(e.target.value)}
              className="visual-intro-input"
              placeholder="은(는) 「개인정보보호법」 및 「의료법」에 따라..."
            />
          </div>
        </div>

        {/* Section 2 Wrapper (Mirrors Patient Form UI) */}
        <div className="visual-section-container">
          <div className="visual-section-header-bar">
            <div className="visual-section-title-wrap">
              <FileText size={18} className="text-primary" />
              <input
                type="text"
                value={settings.sectionTitle}
                onChange={e => handleSectionTitleChange(e.target.value)}
                className="visual-section-title-input"
                placeholder="섹션 제목 (예: 개인정보 수집 및 처리 동의)"
                required
              />
            </div>
            <span className="text-sub text-xs">
              ※ 아래 각 항목의 제목과 '내용보기' 텍스트를 자유롭게 편집하세요.
            </span>
          </div>

          {/* List of Editable Terms */}
          <div className="visual-terms-list">
            {settings.terms.map((term, index) => {
              const isOptional = term.category === 'optional';

              return (
                <div 
                  key={term.id} 
                  className={`visual-term-card ${isOptional ? 'optional' : 'required'}`}
                >
                  {/* Top Bar: Order, Category, Title, Delete */}
                  <div className="visual-term-topbar">
                    <div className="term-left-controls">
                      <span className="term-order-badge">{index + 1}</span>

                      {/* Category Pill Switcher */}
                      <button
                        type="button"
                        onClick={() => handleTermFieldChange(term.id, 'category', isOptional ? 'required' : 'optional')}
                        className={`btn-category-pill ${isOptional ? 'opt' : 'req'}`}
                        title="클릭하여 필수/선택 구분을 전환합니다."
                      >
                        {isOptional ? '[선택 동의]' : '[필수 동의]'}
                      </button>

                      {/* Term Title Input */}
                      <input
                        type="text"
                        value={term.title}
                        onChange={e => handleTermFieldChange(term.id, 'title', e.target.value)}
                        className="term-title-inline-input"
                        placeholder="동의 항목 제목을 입력하세요"
                        required
                      />
                    </div>

                    <div className="term-right-controls">
                      {/* Move buttons */}
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveTerm(index, 'up')}
                        className="btn-term-icon"
                        title="위로 이동"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={index === settings.terms.length - 1}
                        onClick={() => handleMoveTerm(index, 'down')}
                        className="btn-term-icon"
                        title="아래로 이동"
                      >
                        <ArrowDown size={14} />
                      </button>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteTerm(term.id)}
                        className="btn-term-delete"
                        title="이 동의 항목 삭제"
                        disabled={settings.terms.length <= 1}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Single Clean Content Textarea for '내용보기' & PDF Output */}
                  <div className="visual-term-content-box">
                    <div className="content-box-label-row">
                      <span className="content-box-label flex-center gap-1">
                        <Eye size={13} className="text-primary" />
                        환자가 '내용보기' 클릭 시 표시될 전체 세부 내용 및 PDF 인쇄 텍스트:
                      </span>
                    </div>
                    <textarea
                      rows={4}
                      value={term.content}
                      onChange={e => handleTermFieldChange(term.id, 'content', e.target.value)}
                      className="visual-term-textarea"
                      placeholder="• 수집 및 이용목적: ...&#10;• 수집항목: ...&#10;• 보유기간: ..."
                      required
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Term Buttons Row */}
          <div className="visual-add-buttons-row">
            <button
              type="button"
              onClick={handleAddNewTerm}
              className="btn-visual-add-new"
            >
              <Plus size={16} />
              <span>새 동의 항목 추가</span>
            </button>

            {/* Presets dropdown */}
            <div className="preset-dropdown-wrapper">
              <button
                type="button"
                onClick={() => setShowPresetsMenu(prev => !prev)}
                className="btn-visual-add-preset"
              >
                <Sparkles size={16} />
                <span>추천 템플릿 항목 추가 (진료/수술/비급여 등) ▾</span>
              </button>

              {showPresetsMenu && (
                <div className="preset-menu-popover animate-scale-up">
                  <div className="preset-menu-header">병원 표준 동의 템플릿 선택</div>
                  {CONSENT_PRESETS.map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => handleAddPresetTerm(preset)}
                      className="preset-menu-item"
                    >
                      <FolderPlus size={15} className="text-primary" />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="visual-editor-footer">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="btn-reset-default"
            title="의료법 4대 표준 기본 양식으로 되돌립니다."
          >
            <RotateCcw size={16} />
            <span>의료법 표준 서식으로 초기화</span>
          </button>

          <button type="submit" className="btn-save-terms-large">
            <Save size={18} />
            <span>동의서 변경사항 저장 및 즉시 적용</span>
          </button>
        </div>
      </form>
    </div>
  );
};
