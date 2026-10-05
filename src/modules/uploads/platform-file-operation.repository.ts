import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';

export type FileOperationState = 'PREPARED'|'VALIDATED'|'PROMOTING'|'PROMOTED'|'COMMITTED'|'CLEANUP_REQUIRED'|'CLEANED'|'FAILED';
export type FileOperationKind = 'PROMOTION'|'REPLACEMENT'|'EPHEMERAL_IMPORT';
export type QuarantineRootKey='MANUFACTURER_QUARANTINE'|'SB_IMPORT_QUARANTINE';
export type DestinationRootKey='MANUFACTURER_PUBLIC'|'SB_IMPORT_EPHEMERAL';
export type FileOperationRecord = Readonly<{
  id:string; correlation_id:string; principal_id:string; operation_kind:FileOperationKind; state:FileOperationState;
  quarantine_root_key:QuarantineRootKey; destination_root_key:DestinationRootKey; quarantine_name:string; destination_name:string|null;
  previous_name:string|null; original_name:string|null; declared_mime:string|null; detected_media_type:string|null;
  content_sha256:string|null; size_bytes:string|null; resource_type:string|null; resource_id:string|null; failure_code:string|null;
}>;

const transitions: Readonly<Record<FileOperationState, readonly FileOperationState[]>> = Object.freeze({
  PREPARED: Object.freeze<FileOperationState[]>(['VALIDATED','CLEANUP_REQUIRED','FAILED']),
  VALIDATED: Object.freeze<FileOperationState[]>(['PROMOTING','CLEANUP_REQUIRED','FAILED']),
  PROMOTING: Object.freeze<FileOperationState[]>(['PROMOTED','CLEANUP_REQUIRED']),
  PROMOTED: Object.freeze<FileOperationState[]>(['COMMITTED','CLEANUP_REQUIRED']),
  CLEANUP_REQUIRED: Object.freeze<FileOperationState[]>(['CLEANED','FAILED']),
  FAILED: Object.freeze<FileOperationState[]>(['CLEANED']),
  COMMITTED: Object.freeze<FileOperationState[]>([]), CLEANED: Object.freeze<FileOperationState[]>([]),
});

export class PlatformFileOperationRepository {
  async prepare(input:{correlationId:string;principalId:string;operationKind:FileOperationKind;quarantineRootKey:QuarantineRootKey;destinationRootKey:DestinationRootKey;quarantineName:string;destinationName?:string|null;previousName?:string|null;originalName?:string|null;declaredMime?:string|null}, transaction?:Transaction) {
    const id=randomUUID();
    await sequelize.query(`INSERT INTO platform_file_operations
      (id,correlation_id,principal_id,operation_kind,state,quarantine_root_key,destination_root_key,quarantine_name,destination_name,previous_name,original_name,declared_mime)
      VALUES(:id,:correlationId,:principalId,:operationKind,'PREPARED',:quarantineRootKey,:destinationRootKey,:quarantineName,:destinationName,:previousName,:originalName,:declaredMime)`,
      {replacements:{id,...input,destinationName:input.destinationName??null,previousName:input.previousName??null,originalName:input.originalName??null,declaredMime:input.declaredMime??null},...(transaction?{transaction}:{}),type:QueryTypes.RAW});
    return id;
  }

  async lock(id:string, transaction:Transaction):Promise<FileOperationRecord>{
    const rows=await sequelize.query<FileOperationRecord>('SELECT * FROM platform_file_operations WHERE id=:id FOR UPDATE',{replacements:{id},transaction,type:QueryTypes.SELECT});
    if(!rows[0])throw new Error('FILE_OPERATION_NOT_FOUND'); return Object.freeze({...rows[0]});
  }

  async get(id:string):Promise<FileOperationRecord>{
    const rows=await sequelize.query<FileOperationRecord>('SELECT * FROM platform_file_operations WHERE id=:id',{replacements:{id},type:QueryTypes.SELECT});
    if(!rows[0])throw new Error('FILE_OPERATION_NOT_FOUND'); return Object.freeze({...rows[0]});
  }

  async recordPreviousName(id:string,previousName:string|null,transaction:Transaction){
    const [,count]=await sequelize.query(`UPDATE platform_file_operations
      SET previous_name=:previousName,updated_at=CURRENT_TIMESTAMP WHERE id=:id AND state='PROMOTED'`,
      {replacements:{id,previousName},transaction,type:QueryTypes.UPDATE});
    if(count!==1)throw new Error('FILE_OPERATION_PREVIOUS_STATE_REFUSED');
  }

  async transition(id:string,to:FileOperationState,input:{detectedMediaType?:string;contentSha256?:string;sizeBytes?:number;failureCode?:string|null}={},transaction?:Transaction){
    const run=async(tx:Transaction)=>{const current=await this.lock(id,tx);if(!transitions[current.state].includes(to))throw new Error('FILE_OPERATION_INVALID_TRANSITION');
      await sequelize.query(`UPDATE platform_file_operations SET state=:to,
        detected_media_type=COALESCE(:detectedMediaType,detected_media_type),content_sha256=COALESCE(:contentSha256,content_sha256),
        size_bytes=COALESCE(:sizeBytes,size_bytes),failure_code=:failureCode,updated_at=CURRENT_TIMESTAMP,
        completed_at=CASE WHEN :to IN ('COMMITTED','CLEANED') THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id=:id`,
        {replacements:{id,to,detectedMediaType:input.detectedMediaType??null,contentSha256:input.contentSha256??null,sizeBytes:input.sizeBytes??null,failureCode:input.failureCode??null},transaction:tx});};
    return transaction?run(transaction):sequelize.transaction(run);
  }

  recoverable(before:Date,limit=100){const bounded=Math.max(1,Math.min(100,Math.trunc(limit)));
    return sequelize.query<FileOperationRecord>(`SELECT * FROM platform_file_operations WHERE state NOT IN ('COMMITTED','CLEANED') AND updated_at<:before ORDER BY updated_at,id LIMIT :limit`,{replacements:{before,limit:bounded},type:QueryTypes.SELECT});}
}

export const platformFileOperationRepository=new PlatformFileOperationRepository();
