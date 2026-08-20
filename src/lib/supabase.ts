import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignedConsentRecord, SupabaseConfig, NeonConfig, DatabaseSettings, DbProviderType } from '../types';

const STORAGE_PROVIDER_KEY = 'clinic_active_db_provider'; // 'neon' | 'supabase' | 'local'
const STORAGE_KEY_URL = 'clinic_supabase_url';
const STORAGE_KEY_KEY = 'clinic_supabase_anon_key';
const STORAGE_KEY_BUCKET = 'clinic_supabase_bucket';
const STORAGE_KEY_TABLE = 'clinic_supabase_table';
const LOCAL_RECORDS_KEY = 'clinic_local_records';

const DEFAULT_BUCKET = 'medical-consents';
const DEFAULT_TABLE = 'patient_consents';

export function getActiveDbProvider(): DbProviderType {
  const stored = localStorage.getItem(STORAGE_PROVIDER_KEY) as DbProviderType | null;
  if (stored === 'neon' || stored === 'supabase' || stored === 'local') {
    return stored;
  }
  // Default to neon if on Vercel or local fallback
  return 'neon';
}

export function setActiveDbProvider(provider: DbProviderType) {
  localStorage.setItem(STORAGE_PROVIDER_KEY, provider);
}

export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const storedKey = localStorage.getItem(STORAGE_KEY_KEY) || envKey;
  const bucket = localStorage.getItem(STORAGE_KEY_BUCKET) || DEFAULT_BUCKET;
  const table = localStorage.getItem(STORAGE_KEY_TABLE) || DEFAULT_TABLE;

  return {
    url: storedUrl,
    anonKey: storedKey,
    bucketName: bucket,
    tableName: table,
    isConfigured: Boolean(storedUrl && storedKey)
  };
}

export function getNeonConfig(): NeonConfig {
  return {
    isConfigured: true,
    apiUrl: '/api/consents'
  };
}

export function getDatabaseSettings(): DatabaseSettings {
  return {
    provider: getActiveDbProvider(),
    supabase: getSupabaseConfig(),
    neon: getNeonConfig()
  };
}

export function saveSupabaseConfig(url: string, anonKey: string, bucket = DEFAULT_BUCKET, table = DEFAULT_TABLE) {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_KEY, anonKey.trim());
  localStorage.setItem(STORAGE_KEY_BUCKET, bucket.trim() || DEFAULT_BUCKET);
  localStorage.setItem(STORAGE_KEY_TABLE, table.trim() || DEFAULT_TABLE);
  
  // Re-instantiate client
  cachedClient = null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config.isConfigured) return null;

  if (!cachedClient) {
    try {
      cachedClient = createClient(config.url, config.anonKey);
    } catch (e) {
      console.error('Failed to create Supabase client', e);
      return null;
    }
  }
  return cachedClient;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload PDF:
 * - If Supabase: uploads to bucket or fallback
 * - If Neon: converts to persistent Base64 Data URL to be stored in PostgreSQL
 * - If Local: persistent Base64 Data URL
 */
export async function uploadConsentPdf(
  pdfBlob: Blob,
  filename: string,
  dataUrl?: string
): Promise<{ path: string; publicUrl: string; isLocalFallback?: boolean }> {
  const provider = getActiveDbProvider();

  // For Neon & Local, we store the full Base64 PDF data directly
  if (provider === 'neon' || provider === 'local') {
    let persistentDataUrl = dataUrl;
    if (!persistentDataUrl) {
      persistentDataUrl = await blobToBase64(pdfBlob);
    }
    return {
      path: `${provider}/${filename}`,
      publicUrl: persistentDataUrl,
      isLocalFallback: provider === 'local'
    };
  }

  // Supabase provider
  const client = getSupabaseClient();
  const config = getSupabaseConfig();

  if (!client || !config.isConfigured) {
    let persistentDataUrl = dataUrl;
    if (!persistentDataUrl) {
      persistentDataUrl = await blobToBase64(pdfBlob);
    }
    return {
      path: `local/${filename}`,
      publicUrl: persistentDataUrl,
      isLocalFallback: true
    };
  }

  const cleanFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = `consents/${new Date().toISOString().slice(0, 10)}/${cleanFilename}`;

  const { error: uploadError } = await client.storage
    .from(config.bucketName)
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    console.warn('Supabase storage upload failed, falling back to Base64:', uploadError);
    let fallbackDataUrl = dataUrl;
    if (!fallbackDataUrl) {
      fallbackDataUrl = await blobToBase64(pdfBlob);
    }
    return {
      path: `local/${filename}`,
      publicUrl: fallbackDataUrl,
      isLocalFallback: true
    };
  }

  const { data: { publicUrl } } = client.storage
    .from(config.bucketName)
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: publicUrl || '',
    isLocalFallback: false
  };
}

/**
 * Save signed consent record (Supports Neon API, Supabase, Local)
 */
export async function saveConsentRecord(record: SignedConsentRecord): Promise<SignedConsentRecord> {
  const provider = getActiveDbProvider();

  // 1. NEON Database Provider via Serverless API (/api/consents)
  if (provider === 'neon') {
    try {
      const res = await fetch('/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data as SignedConsentRecord;
        }
      } else {
        const errJson = await res.json().catch(() => ({ error: res.statusText }));
        console.warn('Neon Serverless API not responding as expected, saving locally:', errJson);
      }
    } catch (apiErr) {
      console.warn('Neon /api/consents fetch error (likely running locally without backend), fallback to local storage:', apiErr);
    }

    // Fallback save to local storage
    return saveLocalRecord(record);
  }

  // 2. SUPABASE Database Provider
  if (provider === 'supabase') {
    const client = getSupabaseClient();
    const config = getSupabaseConfig();

    if (!client || !config.isConfigured) {
      return saveLocalRecord(record);
    }

    const { data, error } = await client
      .from(config.tableName)
      .insert([
        {
          patient_name: record.patient_name,
          birth_date: record.birth_date,
          phone: record.phone,
          is_minor: record.is_minor,
          representative_name: record.representative_name || null,
          representative_relation: record.representative_relation || null,
          agreed_items: record.agreed_items,
          signed_date: record.signed_date,
          signed_at: record.signed_at,
          pdf_path: record.pdf_path,
          pdf_url: record.pdf_url
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase DB Insert Error:', error);
      throw new Error(`데이터베이스 저장 실패: ${error.message}`);
    }

    return data as SignedConsentRecord;
  }

  // 3. LOCAL Storage Provider
  return saveLocalRecord(record);
}

function saveLocalRecord(record: SignedConsentRecord): SignedConsentRecord {
  const localList: SignedConsentRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
  const newRecord: SignedConsentRecord = {
    ...record,
    id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString()
  };
  localList.unshift(newRecord);
  localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(localList));
  return newRecord;
}

/**
 * Fetch consent records (Supports Neon, Supabase, Local)
 */
export async function fetchConsentRecords(searchQuery = ''): Promise<SignedConsentRecord[]> {
  const provider = getActiveDbProvider();

  // 1. NEON Provider
  if (provider === 'neon') {
    try {
      const url = searchQuery.trim() 
        ? `/api/consents?q=${encodeURIComponent(searchQuery.trim())}`
        : '/api/consents';

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          return json.data as SignedConsentRecord[];
        }
      }
    } catch (err) {
      console.warn('Neon API fetch failed, loading from local storage:', err);
    }
    return fetchLocalRecords(searchQuery);
  }

  // 2. SUPABASE Provider
  if (provider === 'supabase') {
    const client = getSupabaseClient();
    const config = getSupabaseConfig();

    if (!client || !config.isConfigured) {
      return fetchLocalRecords(searchQuery);
    }

    let query = client
      .from(config.tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (searchQuery.trim()) {
      query = query.or(`patient_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,birth_date.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch records from Supabase:', error);
      throw new Error(`목록 조회 실패: ${error.message}`);
    }

    return (data || []) as SignedConsentRecord[];
  }

  // 3. LOCAL Provider
  return fetchLocalRecords(searchQuery);
}

function fetchLocalRecords(searchQuery = ''): SignedConsentRecord[] {
  const local: SignedConsentRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
  if (!searchQuery.trim()) return local;
  const q = searchQuery.toLowerCase();
  return local.filter(r => 
    r.patient_name.toLowerCase().includes(q) || 
    r.phone?.includes(q) || 
    r.signed_date?.includes(q) ||
    r.birth_date?.includes(q)
  );
}

/**
 * Delete a consent record and its PDF
 */
export async function deleteConsentRecord(id: string, pdfPath?: string): Promise<void> {
  const provider = getActiveDbProvider();

  // 1. NEON Provider
  if (provider === 'neon') {
    try {
      const res = await fetch(`/api/consents?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) return;
    } catch (err) {
      console.warn('Neon delete API failed, removing locally:', err);
    }
    deleteLocalRecord(id);
    return;
  }

  // 2. SUPABASE Provider
  if (provider === 'supabase') {
    const client = getSupabaseClient();
    const config = getSupabaseConfig();

    if (!client || !config.isConfigured || id.startsWith('local_')) {
      deleteLocalRecord(id);
      return;
    }

    if (pdfPath && !pdfPath.startsWith('local/')) {
      await client.storage.from(config.bucketName).remove([pdfPath]);
    }

    const { error } = await client
      .from(config.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`삭제 실패: ${error.message}`);
    }
    return;
  }

  // 3. LOCAL Provider
  deleteLocalRecord(id);
}

function deleteLocalRecord(id: string) {
  const local: SignedConsentRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
  const filtered = local.filter(r => r.id !== id);
  localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(filtered));
}

/**
 * Test Supabase Connection
 */
export async function testSupabaseConnection(url: string, anonKey: string, bucket = DEFAULT_BUCKET, table = DEFAULT_TABLE): Promise<{ success: boolean; message: string }> {
  try {
    const testClient = createClient(url, anonKey);
    const { error: tableError } = await testClient.from(table).select('id').limit(1);
    
    if (tableError && tableError.code !== 'PGRST116') {
      return {
        success: false,
        message: `테이블 접근 오류 (${table}): ${tableError.message}. SQL 스키마를 Supabase SQL Editor에서 실행했는지 확인해주세요.`
      };
    }

    const { data: bucketList, error: bucketError } = await testClient.storage.listBuckets();
    if (bucketError) {
      return {
        success: false,
        message: `스토리지 접근 오류: ${bucketError.message}`
      };
    }

    const hasBucket = bucketList?.some(b => b.name === bucket);
    if (!hasBucket) {
      return {
        success: true,
        message: `연결 성공! (주의: '${bucket}' 스토리지 버킷이 아직 없습니다. Supabase Storage에서 public 버킷으로 생성해주세요.)`
      };
    }

    return {
      success: true,
      message: 'Supabase 데이터베이스 및 스토리지 연결이 완벽하게 확인되었습니다!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `연결 실패: ${err.message || err}`
    };
  }
}

/**
 * Test Neon Connection via /api/consents
 */
export async function testNeonConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/consents');
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        return {
          success: true,
          message: 'Vercel + Neon PostgreSQL 데이터베이스 연결이 정상 확인되었습니다!'
        };
      }
    }
    const errJson = await res.json().catch(() => ({ error: res.statusText }));
    return {
      success: false,
      message: `Neon API 응답 오류: ${errJson.error || 'Vercel 환경변수(POSTGRES_URL/DATABASE_URL)를 확인해주세요.'}`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `연결 테스트 실패: ${err.message}. (로컬 개발 환경에서는 Vercel 배포 후 자동으로 활성화됩니다.)`
    };
  }
}
