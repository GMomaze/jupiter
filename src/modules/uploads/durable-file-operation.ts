import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlatformFileOperationRepository, FileOperationRecord } from './platform-file-operation.repository.js';

export type FileMediaType='image/png'|'image/jpeg'|'image/gif'|'image/webp'|'text/csv'|'application/pdf';
export type FileRootRegistry=Readonly<Record<string,string>>;
type FileSystem=Pick<typeof fs,'mkdir'|'writeFile'|'readFile'|'lstat'|'realpath'|'rename'|'unlink'>;
const extension:Readonly<Record<FileMediaType,string>>=Object.freeze({'image/png':'.png','image/jpeg':'.jpg','image/gif':'.gif','image/webp':'.webp','text/csv':'.csv','application/pdf':'.pdf'});

function contained(root:string,target:string){const rel=path.relative(root,target);return rel!==''&&rel!=='..'&&!rel.startsWith(`..${path.sep}`)&&!path.isAbsolute(rel);}
function basename(value:string){if(path.basename(value)!==value||value.includes('..')||value.includes('/')||value.includes('\\'))throw new Error('FILE_OPERATION_BASENAME_REQUIRED');return value;}
function detect(bytes:Buffer):FileMediaType|undefined{
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes.at(-2)===0xff&&bytes.at(-1)===0xd9)return'image/jpeg';
  if(bytes.subarray(0,6).toString('ascii')==='GIF87a'||bytes.subarray(0,6).toString('ascii')==='GIF89a')return'image/gif';
  if(bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')return'image/webp';
  if(bytes.subarray(0,5).toString('ascii')==='%PDF-')return'application/pdf';
  if(!bytes.includes(0)&&/[,;\t]/.test(bytes.subarray(0,4096).toString('utf8'))&&/\r?\n/.test(bytes.subarray(0,4096).toString('utf8')))return'text/csv';
}

export class DurableFileOperationService{
  constructor(private readonly journal:PlatformFileOperationRepository,private readonly fileSystem:FileSystem,private readonly roots:FileRootRegistry){}
  private root(key:string){const configured=this.roots[key];if(!configured)throw new Error('FILE_OPERATION_ROOT_UNKNOWN');return path.resolve(configured);}
  private target(key:string,name:string){const root=this.root(key),target=path.resolve(root,basename(name));if(!contained(root,target))throw new Error('FILE_OPERATION_PATH_OUTSIDE_ROOT');return{root,target};}
  serverName(type:FileMediaType){return`${randomUUID()}${extension[type]}`;}
  async quarantine(rootKey:string,bytes:Buffer){const name=`${randomUUID()}.upload`,{root,target}=this.target(rootKey,name);await this.fileSystem.mkdir(root,{recursive:true});await this.fileSystem.writeFile(target,bytes,{flag:'wx'});return Object.freeze({name,size:bytes.length});}
  async validate(operation:FileOperationRecord,allowed:readonly FileMediaType[]){if(operation.state!=='PREPARED')throw new Error('FILE_OPERATION_NOT_PREPARED');const{root,target}=this.target(operation.quarantine_root_key,operation.quarantine_name);const metadata=await this.fileSystem.lstat(target);if(metadata.isSymbolicLink()||!metadata.isFile())throw new Error('FILE_OPERATION_UNSAFE_SOURCE');const realRoot=await this.fileSystem.realpath(root),realTarget=await this.fileSystem.realpath(target);if(!contained(realRoot,realTarget))throw new Error('FILE_OPERATION_PATH_OUTSIDE_ROOT');const bytes=await this.fileSystem.readFile(realTarget),media=detect(bytes);if(!media||!allowed.includes(media))throw new Error('FILE_OPERATION_CONTENT_REJECTED');if(operation.declared_mime&&operation.declared_mime!==media)throw new Error('FILE_OPERATION_MIME_MISMATCH');const digest=createHash('sha256').update(bytes).digest('hex');await this.journal.transition(operation.id,'VALIDATED',{detectedMediaType:media,contentSha256:digest,sizeBytes:bytes.length});return Object.freeze({media,digest,size:bytes.length});}
  async promote(operation:FileOperationRecord){if(operation.state!=='VALIDATED'||!operation.destination_name||!operation.content_sha256||operation.size_bytes==null)throw new Error('FILE_OPERATION_NOT_VALIDATED');const source=this.target(operation.quarantine_root_key,operation.quarantine_name),destination=this.target(operation.destination_root_key,operation.destination_name);const metadata=await this.fileSystem.lstat(source.target);if(metadata.isSymbolicLink()||!metadata.isFile())throw new Error('FILE_OPERATION_UNSAFE_SOURCE');const realRoot=await this.fileSystem.realpath(source.root),realSource=await this.fileSystem.realpath(source.target);if(!contained(realRoot,realSource))throw new Error('FILE_OPERATION_PATH_OUTSIDE_ROOT');const bytes=await this.fileSystem.readFile(realSource);if(bytes.length!==Number(operation.size_bytes)||createHash('sha256').update(bytes).digest('hex')!==operation.content_sha256)throw new Error('FILE_OPERATION_VALIDATION_STALE');await this.fileSystem.mkdir(destination.root,{recursive:true});try{await this.fileSystem.lstat(destination.target);throw new Error('FILE_OPERATION_DESTINATION_EXISTS');}catch(error:any){if(error?.code!=='ENOENT')throw error;}await this.journal.transition(operation.id,'PROMOTING');await this.fileSystem.rename(source.target,destination.target);await this.journal.transition(operation.id,'PROMOTED');return destination.target;}
  async safeDelete(rootKey:string,name:string){const{root,target}=this.target(rootKey,name);try{const metadata=await this.fileSystem.lstat(target);if(metadata.isSymbolicLink()||!metadata.isFile())throw new Error('FILE_OPERATION_UNSAFE_DELETE');const realRoot=await this.fileSystem.realpath(root),realTarget=await this.fileSystem.realpath(target);if(!contained(realRoot,realTarget))throw new Error('FILE_OPERATION_PATH_OUTSIDE_ROOT');await this.fileSystem.unlink(realTarget);return true;}catch(error:any){if(error?.code==='ENOENT')return false;throw error;}}
  async recover(operation:FileOperationRecord,isDestinationCommitted:(value:FileOperationRecord)=>Promise<boolean>){if(operation.state==='COMMITTED'||operation.state==='CLEANED')return operation.state;if((operation.state==='PROMOTING'||operation.state==='PROMOTED')&&await isDestinationCommitted(operation)){if(operation.state==='PROMOTING')await this.journal.transition(operation.id,'PROMOTED');await this.journal.transition(operation.id,'COMMITTED');return'COMMITTED';}if((operation.state==='PROMOTING'||operation.state==='PROMOTED')&&operation.destination_name)await this.safeDelete(operation.destination_root_key,operation.destination_name);await this.safeDelete(operation.quarantine_root_key,operation.quarantine_name);if(operation.state!=='CLEANUP_REQUIRED')await this.journal.transition(operation.id,'CLEANUP_REQUIRED');await this.journal.transition(operation.id,'CLEANED');return'CLEANED';}
}

export const FILE_CONTENT_TYPES=Object.freeze({manufacturerLogo:Object.freeze(['image/png','image/jpeg','image/gif','image/webp'] as const),serviceBulletinImport:Object.freeze(['text/csv','application/pdf'] as const)});

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..','..');
export const PLATFORM_FILE_ROOTS=Object.freeze({
  MANUFACTURER_QUARANTINE:process.env.MANUFACTURER_QUARANTINE_ROOT??path.join(repositoryRoot,'.jupiter-private-uploads','manufacturer-logos'),
  MANUFACTURER_PUBLIC:process.env.MANUFACTURER_UPLOAD_ROOT??path.join(repositoryRoot,'uploads','manufacturers'),
  SB_IMPORT_QUARANTINE:process.env.SB_IMPORT_QUARANTINE_ROOT??path.join(repositoryRoot,'.jupiter-private-uploads','service-bulletins'),
  SB_IMPORT_EPHEMERAL:process.env.SB_IMPORT_EPHEMERAL_ROOT??path.join(repositoryRoot,'.jupiter-private-uploads','service-bulletin-work'),
});
