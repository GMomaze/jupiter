import fs from 'node:fs/promises';
import path from 'node:path';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import type { PlatformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { canonicalUploadReference } from './upload-delivery.service.js';
import { DurableFileOperationService, FILE_CONTENT_TYPES, PLATFORM_FILE_ROOTS, type FileMediaType } from './durable-file-operation.js';
import { platformFileOperationRepository, type FileOperationRecord } from './platform-file-operation.repository.js';

const lifecycle=new DurableFileOperationService(platformFileOperationRepository,fs,PLATFORM_FILE_ROOTS);
const declaredTypes:Readonly<Record<string,FileMediaType>>=Object.freeze({'image/png':'image/png','image/jpeg':'image/jpeg','image/gif':'image/gif','image/webp':'image/webp'});
const issuedLogoCommits=new WeakSet<object>();
export type ManufacturerLogoCommit=Readonly<{reference:string;operationId:string}>;
function issueLogoCommit(reference:string,operationId:string):ManufacturerLogoCommit{const commit=Object.freeze({reference,operationId});issuedLogoCommits.add(commit);return commit;}
export function requireManufacturerLogoCommit(value:ManufacturerLogoCommit|null){if(value===null)return null;if(!issuedLogoCommits.has(value))throw new Error('MANUFACTURER_LOGO_COMMIT_INVALID');return value;}

async function referenced(reference:string){const rows=await sequelize.query<{count:number}>('SELECT count(*)::int count FROM manufacturers WHERE logo_url=:reference',{replacements:{reference},type:QueryTypes.SELECT});return Boolean(rows[0]?.count);}
async function finishCommitted(operation:FileOperationRecord,newReference:string){if(!(await referenced(newReference)))return false;const old=operation.previous_name;if(old&&!await referenced(`/uploads/manufacturers/${old}`))await lifecycle.safeDelete('MANUFACTURER_PUBLIC',old);if(operation.state!=='COMMITTED')await platformFileOperationRepository.transition(operation.id,'COMMITTED');return true;}

export async function runManufacturerFileMutation<T>(input:{evidence:PlatformMutationEvidence;file?:Express.Multer.File|undefined;replacement?:boolean;mutate:(logoCommit:null|ManufacturerLogoCommit)=>Promise<T>}):Promise<T>{
  if(!input.file)return input.mutate(null);
  const media=declaredTypes[input.file.mimetype];if(!media)throw new Error('MANUFACTURER_LOGO_TYPE_UNSUPPORTED');
  const destinationName=lifecycle.serverName(media);let quarantineName:string|undefined,operationId:string|undefined,result:T|undefined;
  try{
    quarantineName=(await lifecycle.quarantine('MANUFACTURER_QUARANTINE',input.file.buffer)).name;
    operationId=await platformFileOperationRepository.prepare({correlationId:input.evidence.correlationId,principalId:input.evidence.authority.principalId,operationKind:input.replacement?'REPLACEMENT':'PROMOTION',quarantineRootKey:'MANUFACTURER_QUARANTINE',destinationRootKey:'MANUFACTURER_PUBLIC',quarantineName,destinationName,previousName:null,originalName:path.basename(input.file.originalname),declaredMime:media});
    await lifecycle.validate(await platformFileOperationRepository.get(operationId),FILE_CONTENT_TYPES.manufacturerLogo);
    await lifecycle.promote(await platformFileOperationRepository.get(operationId));
    const reference=canonicalUploadReference('manufacturers',destinationName);if(!reference)throw new Error('MANUFACTURER_LOGO_REFERENCE_INVALID');
    result=await input.mutate(issueLogoCommit(reference,operationId));
    const operation=await platformFileOperationRepository.get(operationId);await finishCommitted(operation,reference);
    return result;
  }catch(error){
    if(operationId){const operation=await platformFileOperationRepository.get(operationId);const reference=operation.destination_name?canonicalUploadReference('manufacturers',operation.destination_name):undefined;if(reference&&await finishCommitted(operation,reference)&&result!==undefined)return result;await lifecycle.recover(operation,async()=>false);}
    else if(quarantineName)await lifecycle.safeDelete('MANUFACTURER_QUARANTINE',quarantineName);
    throw error;
  }
}

export async function recoverManufacturerFileOperation(operation:FileOperationRecord){const reference=operation.destination_name?canonicalUploadReference('manufacturers',operation.destination_name):undefined;if(reference&&await finishCommitted(operation,reference))return'COMMITTED';return lifecycle.recover(operation,async()=>false);}
