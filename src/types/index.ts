export interface ClinicInfo {
  name: string;      // 병원/의원 명칭
  bizNumber: string; // 사업자등록번호 (예: 123-45-67890)
  phone: string;     // 대표 전화번호 (예: 02-1234-5678)
}

export interface ConsentTermItem {
  id: string; // Unique ID (e.g., 'collectRequired', 'sensitiveInfo', 'term_17283921_x')
  title: string;
  badgeLabel: string; // '필수' | '선택'
  category: 'required' | 'optional';
  content: string;    // '내용보기' 및 PDF에 출력되는 전체 상세 내용 텍스트
}

export interface ConsentTermsSettings {
  documentTitle: string; // 메인 동의서 공식 명칭 (예: 개인정보 수집 · 이용 및 진료 동의서)
  sectionTitle: string;  // 환자 화면 섹션 제목 (예: 개인정보 수집 및 처리 동의)
  introText: string;     // 서두 안내 문구
  terms: ConsentTermItem[];
}

export interface PatientInfo {
  name: string;
  birthDate: string; // YYYY-MM-DD or YYYYMMDD
  phone: string;
  isMinor: boolean;
  representativeName?: string;
  representativeRelation?: string;
}

export type ConsentAgreementState = Record<string, boolean>;

export interface SignedConsentRecord {
  id?: string;
  patient_name: string;
  birth_date: string;
  phone: string;
  is_minor: boolean;
  representative_name?: string;
  representative_relation?: string;
  agreed_items: ConsentAgreementState;
  signed_date: string; // YYYY-MM-DD
  signed_at: string;   // ISO String
  pdf_path: string;
  pdf_url: string;
  created_at?: string;
}

export type DbProviderType = 'neon' | 'supabase' | 'local';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  bucketName: string;
  tableName: string;
  isConfigured: boolean;
}

export interface NeonConfig {
  isConfigured: boolean;
  apiUrl: string; // e.g. '/api/consents'
}

export interface DatabaseSettings {
  provider: DbProviderType;
  supabase: SupabaseConfig;
  neon: NeonConfig;
}
