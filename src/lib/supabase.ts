import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SignedConsentRecord, SupabaseConfig } from '../types';

const STORAGE_KEY_URL = 'clinic_supabase_url';
const STORAGE_KEY_KEY = 'clinic_supabase_anon_key';
const STORAGE_KEY_BUCKET = 'clinic_supabase_bucket';
const STORAGE_KEY_TABLE = 'clinic_supabase_table';
const LOCAL_RECORDS_KEY = 'clinic_local_records';

const DEFAULT_BUCKET = 'medical-consents';
const DEFAULT_TABLE = 'patient_consents';

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
 * Upload PDF to Supabase Storage Bucket, or store as Base64 Data URL for persistent local mode
 */
export async function uploadConsentPdf(
  pdfBlob: Blob,
  filename: string,
  dataUrl?: string
): Promise<{ path: string; publicUrl: string; isLocalFallback?: boolean }> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();

  if (!client || !config.isConfigured) {
    // Local fallback: convert to persistent Base64 Data URL so it never expires on page reload
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

  // Upload to Supabase Storage
  const { error: uploadError } = await client.storage
    .from(config.bucketName)
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    console.error('Supabase Storage Upload Error:', uploadError);
    throw new Error(`스토리지 업로드 실패: ${uploadError.message}`);
  }

  // Get Public URL
  const { data: urlData } = client.storage
    .from(config.bucketName)
    .getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: urlData.publicUrl,
    isLocalFallback: false
  };
}

/**
 * Save consent metadata to Supabase DB Table or persistent local storage
 */
export async function saveConsentRecord(record: SignedConsentRecord): Promise<SignedConsentRecord> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();

  if (!client || !config.isConfigured) {
    // Save to LocalStorage fallback
    const existing: SignedConsentRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
    const newRecord: SignedConsentRecord = {
      ...record,
      id: 'local_' + Date.now(),
      created_at: new Date().toISOString()
    };
    existing.unshift(newRecord);
    
    try {
      localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(existing));
    } catch (quotaErr) {
      console.warn('LocalStorage quota exceeded, trimming oldest records:', quotaErr);
      // Keep most recent 5 records if quota is full
      const trimmed = existing.slice(0, 5);
      localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(trimmed));
    }
    return newRecord;
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

/**
 * Fetch consent records
 */
export async function fetchConsentRecords(searchQuery = ''): Promise<SignedConsentRecord[]> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();

  if (!client || !config.isConfigured) {
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

/**
 * Delete a consent record and its PDF
 */
export async function deleteConsentRecord(id: string, pdfPath: string): Promise<void> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();

  if (!client || !config.isConfigured || id.startsWith('local_')) {
    const local: SignedConsentRecord[] = JSON.parse(localStorage.getItem(LOCAL_RECORDS_KEY) || '[]');
    const filtered = local.filter(r => r.id !== id);
    localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(filtered));
    return;
  }

  // Delete from Storage if path exists
  if (pdfPath && !pdfPath.startsWith('local/')) {
    await client.storage.from(config.bucketName).remove([pdfPath]);
  }

  // Delete from DB
  const { error } = await client
    .from(config.tableName)
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`삭제 실패: ${error.message}`);
  }
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
