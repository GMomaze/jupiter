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

  interface SessionData {
    adImportState?: AdImportSessionState;
    lastActivity?: number;
    customerUser?: CustomerSessionUser;
  }
}
