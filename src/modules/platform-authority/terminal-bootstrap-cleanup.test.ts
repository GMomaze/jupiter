import {afterEach,describe,expect,it,vi} from 'vitest';
import {enumerateMigrationFiles} from '../../scripts/migrationLedgerComparison.js';
import {PlatformAuthorityRepository} from './platform-authority.repository.js';

afterEach(()=>{delete process.env.ALLOW_R4_TERMINAL_BOOTSTRAP_CLEANUP;delete process.env.ALLOW_TERMINATED_SYSTEM_OWNER_REBOOTSTRAP;});
describe('R4 test-only terminal bootstrap cleanup',()=>{
  it('is separately and exactly test gated',async()=>{
    const pool={connect:vi.fn()};
    await expect(new PlatformAuthorityRepository(pool as any).terminalCleanupDisposableBootstrap({} as any,{} as any)).rejects.toThrow('TERMINAL_BOOTSTRAP_CLEANUP_NOT_ALLOWED');
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('keeps normal bootstrap replay refusal when rebootstrap flag is absent',async()=>{
    process.env.NODE_ENV='test';
    const query=vi.fn(async(sql:string)=>{if(sql.includes('current_database'))return{rows:[{name:'jupiter_test'}],rowCount:1};if(sql.includes('SequelizeMeta'))return{rows:enumerateMigrationFiles().map(name=>({name})),rowCount:117};if(sql.includes("to_regclass('public.platform_principals')"))return{rows:[{principals:true,capabilities:true,grants:true,audit:true,capability_set:true,audit_trigger:true}],rowCount:1};if(sql.includes("action='SYSTEM_OWNER_BOOTSTRAPPED'"))return{rows:[{}],rowCount:1};return{rows:[],rowCount:0}});const client={query,release:vi.fn()};
    await expect(new PlatformAuthorityRepository({connect:vi.fn().mockResolvedValue(client)} as any).preflightBootstrap({userId:'00000000-0000-4000-8000-000000000001',expectedEmail:'a@b.test',expectedDatabase:'jupiter_test',confirmationToken:'BOOTSTRAP:jupiter_test:00000000-0000-4000-8000-000000000001:a@b.test'})).rejects.toThrow('SYSTEM_OWNER_BOOTSTRAP_ALREADY_COMPLETED');
  });
});
