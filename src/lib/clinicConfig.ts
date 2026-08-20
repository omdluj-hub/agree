import { ClinicInfo } from '../types';

const STORAGE_CLINIC_INFO_KEY = 'clinic_basic_info_settings';

export const DEFAULT_CLINIC_INFO: ClinicInfo = {
  name: '연세스마트의원',
  bizNumber: '123-45-67890',
  phone: '02-1234-5678'
};

export function getClinicInfo(): ClinicInfo {
  try {
    const raw = localStorage.getItem(STORAGE_CLINIC_INFO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        name: parsed.name || localStorage.getItem('clinic_hospital_name') || DEFAULT_CLINIC_INFO.name,
        bizNumber: parsed.bizNumber || DEFAULT_CLINIC_INFO.bizNumber,
        phone: parsed.phone || DEFAULT_CLINIC_INFO.phone
      };
    }

    // Fallback to legacy single key if exists
    const legacyName = localStorage.getItem('clinic_hospital_name');
    if (legacyName) {
      return {
        ...DEFAULT_CLINIC_INFO,
        name: legacyName
      };
    }
  } catch (err) {
    console.error('Failed to load clinic info from localStorage:', err);
  }
  return DEFAULT_CLINIC_INFO;
}

export function saveClinicInfo(info: ClinicInfo): void {
  localStorage.setItem(STORAGE_CLINIC_INFO_KEY, JSON.stringify(info));
  localStorage.setItem('clinic_hospital_name', info.name);
}
