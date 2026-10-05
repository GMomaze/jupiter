import { Router } from 'express';
import type { Pool } from 'pg';
import { emitOperationalEvent } from './operational-event.js';
import { resolveCanonicalMigrationHead } from '../../scripts/migrationLedgerComparison.js';

export function createHealthRouter(pool:Pick<Pool,'query'>){const router=Router();router.get('/live',(_req,res)=>res.status(200).json({status:'ok'}));router.get('/ready',async(_req,res)=>{try{const result=await pool.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sessions') sessions,(SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) ledger_head`);if(!result.rows[0]?.sessions||result.rows[0]?.ledger_head!==resolveCanonicalMigrationHead())throw new Error('READINESS_PREREQUISITE_FAILED');return res.status(200).json({status:'ready'});}catch(error){emitOperationalEvent({code:'READINESS_FAILED',severity:'ERROR',outcome:'FAILED',operation:'READINESS',error});return res.status(503).json({status:'not_ready'});}});return router;}
