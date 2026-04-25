export type ServiceBulletinSyncMethod = 'ALL' | 'VERYON' | 'ATP' | 'PIPER_PDF';

export type VeryonImportOptions = {
  rootPath?: string | null;
};

export type PiperPdfImportOptions = {
  pdfPath?: string | null;
};

export type ExternalServiceBulletin = {
  source: 'VERYON' | 'ATP' | 'PIPER_PDF';
  source_primary: 'VERYON' | 'ATP' | 'PIPER_PDF' | 'MANUAL';
  source_refs: Array<{
    provider: string;
    reference: string;
    url?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  sb_number: string;
  title: string;
  model_id: string;
  compliance_type: 'MANDATORY' | 'OPTIONAL' | 'MANUAL';
  revision?: string | null;
  document_url?: string | null;
  description?: string | null;
  issued_on?: string | null;
};
