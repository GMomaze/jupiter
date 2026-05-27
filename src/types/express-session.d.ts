import 'express-session';

declare module 'express-session' {
  interface CustomerSessionUser {
    id: string;
    customer_id: string;
    email: string;
    display_name: string;
  }

  interface AdImportSessionState {
    token: string;
    createdAt: number;
    fileName: string;
    preview: {
      fileType: 'CSV' | 'XLSX';
      totalRows: number;
      validRowCount: number;
      invalidRowCount: number;
      unknownColumns: string[];
      duplicateWarnings: string[];
      rows: Array<{
        rowNumber: number;
        status: 'VALID' | 'INVALID';
        values: {
          ad_number: string;
          subject_heading: string;
          subject: string;
          status: string;
          cfr_part_reference: string;
          effective_date: string;
          service_office: string;
          office_of_primary_responsibility: string;
          docket_number: string;
          citation: string;
          citation_publish_date: string;
          make: string;
          model: string;
          product_type: string;
          product_subtype: string;
          affected_ad: string[];
          superseded_ad: string[];
          affected_by: string[];
          superseded_by: string[];
          comments: string;
          summary: string;
        };
        errors: string[];
        warnings: string[];
      }>;
    };
  }

  interface SbImportSessionState {
    token: string;
    createdAt: number;
    fileName: string;
    preview: {
      adapterUsed: 'PIPER' | 'GENERIC' | 'CESSNA';
      fileName: string;
      totalRows: number;
      validRowCount: number;
      invalidRowCount: number;
      unknownColumns: string[];
      rows: Array<{
        rowNumber: number;
        status: 'VALID' | 'INVALID';
        values: {
          manufacturer: string;
          reference: string;
          title: string;
          issue_date: string;
          revision: string;
          status: string;
          category: string;
          applicability_make: string;
          applicability_model: string;
          applicability_product_type: string;
          applicability_notes: string;
          summary: string;
          compliance_requirement: string;
          source_file: string;
          source_format: string;
          raw_source_text: string;
          is_active: boolean | null;
        };
        errors: string[];
      }>;
    };
  }

  interface StandardTaskImportSessionState {
    token: string;
    createdAt: number;
    fileName: string;
    csvPayload: string;
    headers: string[];
    suggestedMapping: Record<
      | 'title'
      | 'description'
      | 'source_type'
      | 'interval_hours'
      | 'interval_months'
      | 'model_applicability'
      | 'aircraft_applicability'
      | 'is_active',
      string
    >;
    unknownColumns: string[];
    selectedMapping?: Record<
      | 'title'
      | 'description'
      | 'source_type'
      | 'interval_hours'
      | 'interval_months'
      | 'model_applicability'
      | 'aircraft_applicability'
      | 'is_active',
      string
    >;
    preview?: {
      totalRows: number;
      validRowCount: number;
      invalidRowCount: number;
      unknownColumns: string[];
      unmappedOptionalFields: Array<
        | 'title'
        | 'description'
        | 'source_type'
        | 'interval_hours'
        | 'interval_months'
        | 'model_applicability'
        | 'aircraft_applicability'
        | 'is_active'
      >;
      mapping: Record<
        | 'title'
        | 'description'
        | 'source_type'
        | 'interval_hours'
        | 'interval_months'
        | 'model_applicability'
        | 'aircraft_applicability'
        | 'is_active',
        string
      >;
      rows: Array<{
        rowNumber: number;
        status: 'VALID' | 'INVALID';
        values: {
          title: string;
          description: string;
          source_type: string;
          interval_hours: number | null;
          interval_months: number | null;
          model_applicability: string;
          aircraft_applicability: string;
          is_active: boolean | null;
        };
        errors: string[];
      }>;
    };
  }

  interface SessionData {
    adImportState?: AdImportSessionState;
    sbImportState?: SbImportSessionState;
    standardTaskImportState?: StandardTaskImportSessionState;
    lastActivity?: number;
    customerUser?: CustomerSessionUser;
  }
}
