import { ConsentTermsSettings, ConsentTermItem } from '../types';

const STORAGE_CONSENT_SETTINGS_KEY = 'clinic_consent_terms_settings';

export const DEFAULT_CONSENT_SETTINGS: ConsentTermsSettings = {
  documentTitle: '개인정보 수집 · 이용 및 고유식별정보 처리 동의서',
  sectionTitle: '개인정보 수집 및 처리 동의',
  introText: '은(는) 「개인정보보호법」 및 「의료법」에 따라 환자의 개인정보, 민감정보 및 고유식별정보를 보호하며 다음과 같이 수집·이용하고자 합니다.',
  terms: [
    {
      id: 'collectRequired',
      title: '개인정보의 수집 및 이용에 관한 동의',
      badgeLabel: '필수',
      category: 'required',
      content: `• 수집 및 이용목적: 진단·치료·처방 등 진료서비스 제공, 진료비 청구·수납, 본인확인 및 검사결과 통보\n• 수집항목: 성명, 생년월일, 성별, 연락처(휴대전화), 주소, 건강보험 자격 정보\n• 보유 및 이용기간: 의료법 시행규칙 제15조에 따른 법정 보존기간(최소 5년~10년) 준수 후 파기\n• 거부 권리 및 불이익: 귀하는 개인정보 수집·이용에 거부할 권리가 있으나, 필수항목 미동의 시 진료 접수가 제한될 수 있습니다.`
    },
    {
      id: 'sensitiveInfo',
      title: '민감정보(건강·진료 정보) 처리에 관한 동의',
      badgeLabel: '필수',
      category: 'required',
      content: `• 처리목적: 정확한 진단, 투약 및 수술·시술 계획 수립, 과거 병력 참조 및 부작용/알레르기 예방\n• 수집항목: 과거병력, 약물 알레르기 반응, 가족력, 혈압/혈당 등 신체계측 및 임상검사/방사선 판독 결과\n• 보유 및 이용기간: 의료법 제22조에 따른 진료기록부 보존연한 준수\n• 미동의 시 안내: 민감정보 처리에 동의하지 않으실 경우 정확한 진단 및 안전한 처방에 제한이 있을 수 있습니다.`
    },
    {
      id: 'uniqueIdInfo',
      title: '고유식별정보(주민등록번호 등) 수집 및 처리에 관한 동의',
      badgeLabel: '필수',
      category: 'required',
      content: `• 법적근거 및 목적: 「의료법」 제22조 및 「국민건강보험법」에 따른 진료기록부 작성, 본인확인 및 요양급여비용 청구\n• 처리항목: 주민등록번호, 외국인등록번호(외국인인 경우)\n• 보유 및 이용기간: 의료법 시행규칙 제15조에 따른 법정 보존기간 준수 후 안전하게 파기\n• 법정 필수 안내: 고유식별정보는 의료법에 따른 진료기록 작성 및 국민건강보험 적용을 위한 법정 필수 처리 항목입니다.`
    },
    {
      id: 'marketingOptional',
      title: '진료예약 및 병원안내 알림 수신 동의',
      badgeLabel: '선택',
      category: 'optional',
      content: `• 안내내용: 진료 예약일정 안내, 검사결과 확인 알림, 예방접종 시기 및 건강정보 문자(SMS/알림톡) 발송\n• 수집항목: 성명, 휴대전화 번호\n• 보유기간: 진료 종결 시 또는 수신 동의 철회 시까지\n• 선택 안내: 선택 동의 사항으로 동의하지 않으셔도 기본 진료 서비스 이용에 아무런 제한이 없습니다.`
    }
  ]
};

// Preset templates for quick addition by hospital admins
export const CONSENT_PRESETS: { name: string; term: Omit<ConsentTermItem, 'id'> }[] = [
  {
    name: '일반 진료·검사 및 처치 시행 동의 (필수)',
    term: {
      title: '일반 진료·검사 및 처치 시행 동의',
      badgeLabel: '필수',
      category: 'required',
      content: `• 동의목적: 의학적 판단에 따른 진단 검사, 처방, 투약, 처치 및 응급 처치 시행\n• 대상항목: 진료 및 처치 내역, 임상검사 결과, 투약 및 치료 기록\n• 유효기간: 의료법에 따른 진료기록 보존기간 준수\n• 안내: 진료 동의 거부 시 적절한 의학적 치료를 제공받으실 수 없습니다.`
    }
  },
  {
    name: '수술 · 시술 및 마취 시행 동의 (필수)',
    term: {
      title: '수술 · 시술 및 마취 시행 동의',
      badgeLabel: '필수',
      category: 'required',
      content: `• 설명 및 동의: 담당 의사로부터 수술/시술/마취의 목적, 필요성, 방법 및 발생 가능한 후유증·합병증에 대해 충분한 설명을 들었으며, 이에 동의하여 시술을 승인합니다.\n• 보존기간: 의료법 시행규칙 제15조에 따른 수술기록 보존기간 준수\n• 철회안내: 환자 또는 법정대리인은 시술 시작 전 언제든 동의를 철회할 수 있습니다.`
    }
  },
  {
    name: '비급여 진료 항목 및 비용 사전 안내 동의 (선택)',
    term: {
      title: '비급여 진료 항목 및 비용 안내 동의',
      badgeLabel: '선택',
      category: 'optional',
      content: `• 안내내용: 국민건강보험 비급여 대상 항목의 치료 필요성, 대체 가능한 급여 치료 유무 및 본인부담 비용에 대해 사전 고지 및 설명을 들었습니다.\n• 선택안내: 비급여 항목은 환자의 자발적 선택 사항이며 동의하지 않으셔도 기본 급여 진료에 차별이 없습니다.`
    }
  },
  {
    name: '입원 서약 및 병원 규정 준수 동의 (필수)',
    term: {
      title: '입원 서약 및 원내 규정 준수 동의',
      badgeLabel: '필수',
      category: 'required',
      content: `• 서약내용: 입원 진료에 관한 원내 제반 수칙과 감염예방 규정을 준수하며, 진료비 수납 및 퇴원 절차를 성실히 이행할 것을 서약합니다.\n• 보존기간: 입원 종결 및 진료비 정산 완료 시까지`
    }
  },
  {
    name: '개인정보의 제3자 제공 및 검사 위탁 동의 (선택)',
    term: {
      title: '개인정보의 제3자 제공 및 검사 위탁 동의',
      badgeLabel: '선택',
      category: 'optional',
      content: `• 위탁목적: 외부 전문 수탁 검사기관을 통한 정밀 혈액/조직 검사 의뢰 및 결과 수신\n• 제공항목: 환자 식별정보(성명/생년월일), 검체 및 임상 검사 의뢰 데이터\n• 보유기간: 검사 완료 및 결과 통보 후 수탁기관 규정에 따라 안전 파기`
    }
  },
  {
    name: '병원 이벤트 및 건강 소식 마케팅 동의 (선택)',
    term: {
      title: '병원 이벤트 및 건강 혜택 알림 마케팅 동의',
      badgeLabel: '선택',
      category: 'optional',
      content: `• 목적: 계절별 건강검진 이벤트, 신규 진료 프로그램 및 혜택 안내 SMS/카카오톡 발송\n• 항목: 성명, 휴대전화 번호\n• 보유기간: 동의 철회 시 또는 수신 거부 요청 시까지 (수신거부 무료)`
    }
  }
];

export function createNewTerm(base?: Partial<ConsentTermItem>): ConsentTermItem {
  const uniqueId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: uniqueId,
    title: base?.title || '신규 동의 항목',
    badgeLabel: base?.badgeLabel || '필수',
    category: base?.category || 'required',
    content: base?.content || '• 동의 내용: 환자가 확인해야 할 세부 내용을 여기에 입력하세요.\n• 보존기간: 의료법 법정 보존기간 준수\n• 안내: 동의 관련 유의사항을 입력하세요.'
  };
}

export function getConsentTermsSettings(): ConsentTermsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_CONSENT_SETTINGS_KEY);
    if (!raw) return DEFAULT_CONSENT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.terms) && parsed.terms.length > 0) {
      // Compatibility normalization
      const normalizedTerms: ConsentTermItem[] = parsed.terms.map((t: any) => {
        if (t.content) return t;
        // Construct single content from old fields if legacy
        const parts: string[] = [];
        if (t.purpose) parts.push(`• 수집·처리목적: ${t.purpose}`);
        if (t.items) parts.push(`• 항목: ${t.items}`);
        if (t.period) parts.push(`• 보유기간: ${t.period}`);
        if (t.refuseNotice) parts.push(`• 안내: ${t.refuseNotice}`);
        return {
          id: t.id,
          title: t.title,
          badgeLabel: t.badgeLabel || (t.category === 'optional' ? '선택' : '필수'),
          category: t.category || 'required',
          content: parts.join('\n') || '동의 내용'
        };
      });

      return {
        documentTitle: parsed.documentTitle || DEFAULT_CONSENT_SETTINGS.documentTitle,
        sectionTitle: parsed.sectionTitle || DEFAULT_CONSENT_SETTINGS.sectionTitle,
        introText: parsed.introText ?? DEFAULT_CONSENT_SETTINGS.introText,
        terms: normalizedTerms
      };
    }
  } catch (err) {
    console.error('Failed to load consent terms settings from localStorage:', err);
  }
  return DEFAULT_CONSENT_SETTINGS;
}

export function saveConsentTermsSettings(settings: ConsentTermsSettings): void {
  localStorage.setItem(STORAGE_CONSENT_SETTINGS_KEY, JSON.stringify(settings));
}

export function resetConsentTermsSettings(): ConsentTermsSettings {
  localStorage.removeItem(STORAGE_CONSENT_SETTINGS_KEY);
  return DEFAULT_CONSENT_SETTINGS;
}
