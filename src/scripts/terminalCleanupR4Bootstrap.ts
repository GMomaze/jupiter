import { pool } from '../config/database.js';
import { PlatformAuthorityRepository } from '../modules/platform-authority/platform-authority.repository.js';

const fixtureRootId='MP2-R4-3-FIXTURE-20260916T193141Z';
const bootstrapPrincipalId='bc77103f-7224-4da9-9384-9b31d500f8d3';
const bootstrapUserId='9ef90541-cf81-4ec6-bee8-d979d8af6584';
const bootstrapAuditId='edc2905c-2820-4191-9fd1-57ae046fe0ba';
const principalIds=['582bbe91-4de4-43ed-be27-a720d5072db7','959d3479-b59b-4d33-9799-c67e29beb4ec','bc77103f-7224-4da9-9384-9b31d500f8d3','c7774833-7d90-43d5-bdbe-9824dd4dee95'];
const grantIds=['0191a9f5-50e6-42fb-a45d-6b66fd6764e3','33cb8fb4-6ec2-4ed1-8517-d918299fe0e1','3d118388-cdc2-4019-8588-b36617b45edb','413babf0-7f00-4988-91a4-db72fcba598e','452a9502-b0d9-4eff-9f80-a48cc0489ae2','4d67cf35-2a9c-4383-815b-509f37a1735b','afdae50f-d227-4e22-85cc-3b7fbc6a4dcf','e4243a20-7581-45c0-9a6e-50e0beb068ca','e6710ed6-e718-4f3b-be8d-c86036483fc0'];

async function main(){
  if(process.env.NODE_ENV!=='test'||process.env.DB_NAME!=='jupiter_test'||process.env.ALLOW_R4_TERMINAL_BOOTSTRAP_CLEANUP!=='YES') throw new Error('TERMINAL_BOOTSTRAP_CLEANUP_NOT_ALLOWED');
  const expected=`TERMINATE:jupiter_test:${fixtureRootId}:${bootstrapPrincipalId}:${bootstrapAuditId}`;
  if(process.env.R4_TERMINAL_BOOTSTRAP_CONFIRMATION!==expected) throw new Error('TERMINAL_BOOTSTRAP_CONFIRMATION_MISMATCH');
  const repository=new PlatformAuthorityRepository(pool); const authority=await repository.resolveHuman(bootstrapUserId); if(!authority) throw new Error('TERMINAL_BOOTSTRAP_OWNER_MISSING');
  const result=await repository.terminalCleanupDisposableBootstrap(authority,{fixtureRootId,expectedDatabase:'jupiter_test',confirmationToken:expected,bootstrapPrincipalId,bootstrapAuditId,principalIds,grantIds});
  console.log(JSON.stringify(result));
}
main().finally(()=>pool.end());
