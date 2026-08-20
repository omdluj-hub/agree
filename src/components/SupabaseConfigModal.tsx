import React, { useState } from 'react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection 
} from '../lib/supabase';
import { 
  X, 
  Database, 
  Key, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  HardDrive,
  Info
} from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  if (!isOpen) return null;

  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [bucket, setBucket] = useState(currentConfig.bucketName);
  const [table, setTable] = useState(currentConfig.tableName);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const sqlScript = `-- 1. 환자 동의서 메타데이터 테이블 생성
create table if not exists public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  birth_date text not null,
  phone text,
  is_minor boolean default false,
  representative_name text,
  representative_relation text,
  agreed_items jsonb not null,
  signed_date date not null default current_date,
  signed_at timestamp with time zone default now(),
  pdf_path text not null,
  pdf_url text not null,
  created_at timestamp with time zone default now()
);

-- 2. RLS 활성화 및 권한 정책
alter table public.patient_consents enable row level security;

create policy "Allow insert for consent forms"
on public.patient_consents for insert with check (true);

create policy "Allow select for consent records"
on public.patient_consents for select using (true);

create policy "Allow delete for consent records"
on public.patient_consents for delete using (true);

-- 3. 스토리지 버킷 생성 및 권한 설정
insert into storage.buckets (id, name, public)
values ('${bucket || 'medical-consents'}', '${bucket || 'medical-consents'}', true)
on conflict (id) do nothing;

create policy "Allow public upload to consent bucket"
on storage.objects for insert with check (bucket_id = '${bucket || 'medical-consents'}');

create policy "Allow public read from consent bucket"
on storage.objects for select using (bucket_id = '${bucket || 'medical-consents'}');
`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        success: false,
        message: 'Supabase URL과 Anon Key를 입력해 주세요.'
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await testSupabaseConnection(url.trim(), anonKey.trim(), bucket.trim(), table.trim());
    setTesting(false);
    setTestResult(res);
  };

  const handleSave = () => {
    saveSupabaseConfig(url, anonKey, bucket, table);
    onConfigSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop animate-fade-in">
      <div className="modal-card config-modal animate-scale-up">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Database className="text-primary" size={22} />
            <h2 className="modal-title">Supabase 연동 및 DB 설정</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Guide banner */}
          <div className="guide-box">
            <Info size={18} className="guide-icon" />
            <div className="guide-text">
              <p>Supabase 프로젝트 대시보드의 <strong>Project Settings → API</strong>에서 URL 및 `anon` `public` 키를 복사하여 아래에 입력하세요.</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="config-form-grid">
            <div className="form-group">
              <label className="form-label">
                <Database size={15} />
                <span>Supabase Project URL</span>
              </label>
              <input
                type="url"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <Key size={15} />
                <span>Supabase Anon Public API Key</span>
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={e => setAnonKey(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="config-row-two">
              <div className="form-group">
                <label className="form-label">
                  <HardDrive size={15} />
                  <span>Storage 버킷명</span>
                </label>
                <input
                  type="text"
                  placeholder="medical-consents"
                  value={bucket}
                  onChange={e => setBucket(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Layers size={15} />
                  <span>DB 테이블명</span>
                </label>
                <input
                  type="text"
                  placeholder="patient_consents"
                  value={table}
                  onChange={e => setTable(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>

          {/* Test connection alert */}
          {testResult && (
            <div className={`alert-box ${testResult.success ? 'success' : 'error'} animate-fade-in`}>
              {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <p className="alert-text">{testResult.message}</p>
            </div>
          )}

          {/* SQL Editor Section */}
          <div className="sql-box-container">
            <div className="sql-box-header">
              <span className="sql-title">📌 Supabase SQL Editor 실행 스크립트</span>
              <button
                type="button"
                onClick={handleCopySql}
                className="btn-copy-sql"
              >
                {copiedSql ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                <span>{copiedSql ? '복사 완료!' : 'SQL 복사하기'}</span>
              </button>
            </div>
            <pre className="sql-code-snippet">
              <code>{sqlScript}</code>
            </pre>
            <p className="sql-hint">
              * Supabase 프로젝트 대시보드 좌측 <strong>SQL Editor</strong>에 붙여넣고 [Run]을 누르시면 테이블과 스토리지가 1초만에 생성됩니다.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="modal-footer">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="btn-test-conn"
          >
            {testing ? <Loader2 size={16} className="spin-icon" /> : <Database size={16} />}
            <span>연결 테스트</span>
          </button>

          <div className="footer-right">
            <button type="button" onClick={onClose} className="btn-cancel">
              취소
            </button>
            <button type="button" onClick={handleSave} className="btn-primary-solid">
              저장 및 적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
