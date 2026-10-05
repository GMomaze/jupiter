import 'dotenv/config';
import pg from 'pg';
import { PlatformAuthorityRepository } from '../modules/platform-authority/platform-authority.repository.js';
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const required=(name:string)=>{const value=process.env[name]?.trim();if(!value)throw new Error(`MISSING_${name}`);return value;};
async function main(){if(process.env.ALLOW_INITIAL_SYSTEM_OWNER_PREFLIGHT!=='YES')throw new Error('INITIAL_SYSTEM_OWNER_PREFLIGHT_NOT_AUTHORIZED');const result=await new PlatformAuthorityRepository(pool).preflightBootstrap({userId:required('PLATFORM_OWNER_USER_ID'),expectedEmail:required('PLATFORM_OWNER_EMAIL'),expectedDatabase:required('DB_NAME'),confirmationToken:required('PLATFORM_OWNER_CONFIRMATION')});console.log(JSON.stringify({outcome:'READY',database:result.database,userId:result.userId,ledgerHead:result.ledgerHead,capabilityCount:result.capabilityCount}));}
main().then(()=>pool.end()).catch(async error=>{console.error(error instanceof Error?error.message:'Bootstrap preflight failed.');await pool.end();process.exitCode=1;});
