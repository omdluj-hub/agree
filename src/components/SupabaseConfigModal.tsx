import React, { useState } from 'react';
import { 
  getSupabaseConfig, 
  saveSupabaseConfig, 
  testSupabaseConnection,
  getActiveDbProvider,
  setActiveDbProvider,
  testNeonConnection
} from '../lib/supabase';
import { DbProviderType } from '../types';
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
  Info,
  Server,
  Zap,
  Flame,
  Globe
} from 'lucide-react';

interface DatabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  if (!isOpen) return null;

  const currentProvider = getActiveDbProvider();
  const currentSupabase = getSupabaseConfig();

  const [activeTab, setActiveTab] = useState<DbProviderType>(currentProvider);
  const [selectedProvider, setSelectedProvider] = useState<DbProviderType>(currentProvider);

  // Supabase states
  const [url, setUrl] = useState(currentSupabase.url);
  const [anonKey, setAnonKey] = useState(currentSupabase.anonKey);
  const [bucket, setBucket] = useState(currentSupabase.bucketName);
  const [table, setTable] = useState(currentSupabase.tableName);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Neon SQL Schema
  const neonSqlScript = `-- [Neon / Vercel Postgres] 환자 동의서 테이블 생성 스크립트
CREATE TABLE IF NOT EXISTS signed_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name VARCHAR(100) NOT NULL,
  birth_date VARCHAR(20),
  phone VARCHAR(50),
  is_minor BOOLEAN DEFAULT FALSE,
  representative_name VARCHAR(100),
  representative_relation VARCHAR(50),
  agreed_items JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_date VARCHAR(20) NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_path TEXT,
  pdf_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (조회 속도 최적화)
CREATE INDEX IF NOT EXISTS idx_signed_consents_patient_name ON signed_consents (patient_name);
CREATE INDEX IF NOT EXISTS idx_signed_consents_signed_date ON signed_consents (signed_date);
`;

  // Supabase SQL Schema
  const supabaseSqlScript = `-- [Supabase] 1. 환자 동의서 메타데이터 테이블 생성
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

  const handleCopyNeonSql = () => {
    navigator.clipboard.writeText(neonSqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleCopySupabaseSql = () => {
    navigator.clipboard.writeText(supabaseSqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleTestNeon = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testNeonConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || '테스트 실패' });
    } finally {
      setTesting(false);
    }
  };

  const handleTestSupabase = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        success: false,
        message: 'Supabase URL과 Anon Key를 입력해 주세요.'
      });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(url.trim(), anonKey.trim(), bucket.trim(), table.trim());
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || '테스트 실패' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveNeon = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveDbProvider('neon');
    setSelectedProvider('neon');
    onConfigSaved();
    onClose();
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ success: false, message: 'URL과 Anon Key는 필수입니다.' });
      return;
    }
    saveSupabaseConfig(url, anonKey, bucket, table);
    setActiveDbProvider('supabase');
    setSelectedProvider('supabase');
    onConfigSaved();
    onClose();
  };

  const handleSaveLocal = () => {
    setActiveDbProvider('local');
    setSelectedProvider('local');
    onConfigSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop animate-fade-in">
      <div className="modal-card database-config-modal animate-scale-up">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Database className="text-primary" size={22} />
            <div>
              <h3 className="modal-title">데이터베이스 및 클라우드 연동 설정</h3>
              <p className="modal-subtitle-text">
                동의서와 PDF를 저장할 데이터베이스(Neon 또는 Supabase)를 선택하여 연동할 수 있습니다.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>

        {/* Database Provider Switcher Tabs */}
        <div className="db-tabs-nav">
          <button
            type="button"
            onClick={() => { setActiveTab('neon'); setTestResult(null); }}
            className={`db-tab-btn ${activeTab === 'neon' ? 'active' : ''}`}
          >
            <div className="db-tab-label-row">
              <Zap size={16} className="text-emerald-500" />
              <span>Neon (Vercel Postgres)</span>
            </div>
            {selectedProvider === 'neon' && <span className="active-provider-pill">사용 중</span>}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('supabase'); setTestResult(null); }}
            className={`db-tab-btn ${activeTab === 'supabase' ? 'active' : ''}`}
          >
            <div className="db-tab-label-row">
              <Flame size={16} className="text-emerald-600" />
              <span>Supabase (클라우드)</span>
            </div>
            {selectedProvider === 'supabase' && <span className="active-provider-pill">사용 중</span>}
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('local'); setTestResult(null); }}
            className={`db-tab-btn ${activeTab === 'local' ? 'active' : ''}`}
          >
            <div className="db-tab-label-row">
              <HardDrive size={16} />
              <span>로컬 브라우저 (오프라인)</span>
            </div>
            {selectedProvider === 'local' && <span className="active-provider-pill">사용 중</span>}
          </button>
        </div>

        <div className="modal-body">
          {/* TAB 1: NEON (Vercel Postgres) */}
          {activeTab === 'neon' && (
            <form onSubmit={handleSaveNeon} className="db-config-form animate-fade-in">
              <div className="db-info-banner neon-banner">
                <div className="banner-icon-col">
                  <Zap size={24} className="text-emerald-500" />
                </div>
                <div className="banner-text-col">
                  <h4>Vercel + Neon PostgreSQL 서버리스 연동</h4>
                  <p>
                    Vercel 대시보드의 <strong>Storage → Neon Postgres</strong>를 프로젝트에 연결하면, 
                    별도의 API 키 입력 없이 Vercel의 Serverless API(<code>/api/consents</code>)를 통해 
                    환자 동의서와 PDF 파일이 자동으로 안전하게 저장됩니다.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <div className="label-with-action">
                  <label className="form-label font-bold">
                    Neon SQL 테이블 생성 스크립트
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyNeonSql}
                    className="btn-copy-code"
                  >
                    {copiedSql ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    <span>{copiedSql ? '복사됨!' : 'SQL 복사'}</span>
                  </button>
                </div>
                <p className="text-sub text-xs mb-1">
                  ※ Vercel Neon Console의 <strong>SQL Editor</strong>에서 아래 코드를 복사해 실행하시면 테이블이 즉시 준비됩니다. (서버리스 API 실행 시 자동 생성도 지원합니다.)
                </p>
                <div className="sql-preview-box">
                  <pre>{neonSqlScript}</pre>
                </div>
              </div>

              {testResult && (
                <div className={`alert-box ${testResult.success ? 'success' : 'error'} animate-scale-up`}>
                  {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="modal-footer-custom">
                <button
                  type="button"
                  onClick={handleTestNeon}
                  disabled={testing}
                  className="btn-modal-action btn-outline"
                >
                  {testing ? <Loader2 size={16} className="spin-icon" /> : <Server size={16} />}
                  <span>{testing ? '연결 확인 중...' : 'Neon API 연결 테스트'}</span>
                </button>

                <button type="submit" className="btn-primary-solid">
                  <Check size={16} />
                  <span>Neon을 기본 DB로 설정 및 저장</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SUPABASE */}
          {activeTab === 'supabase' && (
            <form onSubmit={handleSaveSupabase} className="db-config-form animate-fade-in">
              <div className="db-info-banner supabase-banner">
                <div className="banner-icon-col">
                  <Flame size={24} className="text-emerald-600" />
                </div>
                <div className="banner-text-col">
                  <h4>Supabase 클라우드 데이터베이스 & 스토리지</h4>
                  <p>
                    Supabase 프로젝트의 <strong>Project URL</strong>과 <strong>anon public key</strong>를 입력하여 
                    테이블 및 Storage Bucket과 실시간 양방향으로 연동합니다.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label font-bold">
                  Project URL <span className="text-danger">*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label font-bold">
                  Anon Public Key <span className="text-danger">*</span>
                </label>
                <div className="input-with-icon">
                  <Key className="input-icon" size={16} />
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={anonKey}
                    onChange={e => setAnonKey(e.target.value)}
                    className="form-input with-icon"
                    required
                  />
                </div>
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="form-label">스토리지 버킷명</label>
                  <input
                    type="text"
                    value={bucket}
                    onChange={e => setBucket(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">테이블명</label>
                  <input
                    type="text"
                    value={table}
                    onChange={e => setTable(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="label-with-action">
                  <label className="form-label font-bold">
                    Supabase 테이블 & 스토리지 생성 SQL
                  </label>
                  <button
                    type="button"
                    onClick={handleCopySupabaseSql}
                    className="btn-copy-code"
                  >
                    {copiedSql ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    <span>{copiedSql ? '복사됨!' : 'SQL 복사'}</span>
                  </button>
                </div>
                <div className="sql-preview-box">
                  <pre>{supabaseSqlScript}</pre>
                </div>
              </div>

              {testResult && (
                <div className={`alert-box ${testResult.success ? 'success' : 'error'} animate-scale-up`}>
                  {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="modal-footer-custom">
                <button
                  type="button"
                  onClick={handleTestSupabase}
                  disabled={testing}
                  className="btn-modal-action btn-outline"
                >
                  {testing ? <Loader2 size={16} className="spin-icon" /> : <Database size={16} />}
                  <span>{testing ? '연결 테스트 중...' : 'Supabase 연결 테스트'}</span>
                </button>

                <button type="submit" className="btn-primary-solid">
                  <Check size={16} />
                  <span>Supabase를 기본 DB로 설정 및 저장</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: LOCAL STORAGE */}
          {activeTab === 'local' && (
            <div className="db-config-form animate-fade-in">
              <div className="db-info-banner local-banner">
                <div className="banner-icon-col">
                  <HardDrive size={24} className="text-slate-600" />
                </div>
                <div className="banner-text-col">
                  <h4>로컬 브라우저 오프라인 보관 모드</h4>
                  <p>
                    클라우드나 외부 DB 연결 없이, 현재 PC의 브라우저 내부 스토리지(LocalStorage)에 동의서와 PDF(Base64)를 안전하게 보관합니다.
                    언제든지 [보안] 메뉴에서 ZIP 파일로 백업할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="modal-footer-custom">
                <span className="text-sub text-sm">
                  ※ 외부 데이터베이스 연결을 일시 중단하고 로컬에만 문서를 보관할 때 선택합니다.
                </span>
                <button
                  type="button"
                  onClick={handleSaveLocal}
                  className="btn-primary-solid"
                >
                  <Check size={16} />
                  <span>로컬 모드로 전환</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
