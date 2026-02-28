export interface ReferenceTable {
  id: string;
  code: string;           // Immutable once created
  label: string;
  description?: string;
  is_active: boolean;
  system_locked: boolean; // Cannot be deleted/deactivated if true
  created_at: Date;
}

// Example type for any RF record
export type ReferenceRecord = Readonly<ReferenceTable>;