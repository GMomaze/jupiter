import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  MT4C3A7_DEFERRED_BOUNDARY,
  createMt4c3a7LiveExecution,
  type Mt4c3a7LiveDependencies,
} from '../support/mt4c3a7LiveScenario.js';
import { runScenarioWithCleanup } from '../support/mt4c3a7ScenarioRunner.js';

function dependencies(events: string[]): Mt4c3a7LiveDependencies {
  const phase = (name: string) => vi.fn(async () => { events.push(name); });
  return {
    preflight: phase('preflight'), createTenantFixtures: phase('fixtures'),
    verifyAuthorities: phase('authority'), verifyAircraftScenario: phase('aircraft'),
    verifyCustomerScenario: phase('customer'), verifyRelationshipScenario: phase('relationship'),
    verifyUpdateScenario: phase('updates'), verifyLifecycleScenario: phase('lifecycle'),
    verifyOwnershipAndAdmin: phase('ownership-admin'), verifyAuditAccounting: phase('audits'),
    cleanupExactMutableFixtures: phase('cleanup'), verifyFinalState: phase('final'),
  };
}

describe('MT-4C3A7 live scenario callback', () => {
  it('orders preflight before mutation and final proof after exact cleanup', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    const execution = createMt4c3a7LiveExecution(deps);
    const result = await runScenarioWithCleanup({
      correlationFactory: () => 'correlation-1',
      scenario: execution.scenario,
      cleanup: execution.cleanup,
    });
    expect(events).toEqual([
      'preflight', 'fixtures', 'authority', 'aircraft', 'customer', 'relationship',
      'updates', 'lifecycle', 'ownership-admin', 'audits', 'cleanup', 'final',
    ]);
    expect(result.result).toMatchObject({
      correlationId: 'correlation-1', mutationStarted: true,
      cleanupCompleted: true, finalVerificationCompleted: true,
    });
    expect(new Set([
      result.result.tenantA, result.result.tenantB, result.result.membershipA,
      result.result.membershipB, result.result.nonexistentAircraft,
      result.result.nonexistentCustomer,
    ]).size).toBe(6);
  });

  it('preflight failure prevents mutation and still performs final verification', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    deps.preflight = vi.fn(async () => { events.push('preflight'); throw new Error('blocked'); });
    const execution = createMt4c3a7LiveExecution(deps);
    await expect(runScenarioWithCleanup({ scenario: execution.scenario, cleanup: execution.cleanup }))
      .rejects.toThrow('blocked');
    expect(events).toEqual(['preflight', 'final']);
    expect(deps.createTenantFixtures).not.toHaveBeenCalled();
    expect(deps.cleanupExactMutableFixtures).not.toHaveBeenCalled();
  });

  it('partial scenario failure sends the exact recorded state to cleanup', async () => {
    const events: string[] = [];
    const deps = dependencies(events);
    deps.verifyAircraftScenario = vi.fn(async (state) => {
      state.aircraftA = 'aircraft-a'; events.push('aircraft'); throw new Error('partial');
    });
    const execution = createMt4c3a7LiveExecution(deps);
    await expect(runScenarioWithCleanup({
      correlationFactory: () => 'correlation-partial',
      scenario: execution.scenario,
      cleanup: execution.cleanup,
    })).rejects.toThrow('partial');
    expect(deps.cleanupExactMutableFixtures).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'correlation-partial', aircraftA: 'aircraft-a' }),
    );
    expect(events.at(-2)).toBe('cleanup');
    expect(events.at(-1)).toBe('final');
  });

  it('encodes canonical helpers, exact cleanup, authority negatives, and exclusions', () => {
    const source = readFileSync('tests/support/mt4c3a7LiveScenario.production.ts', 'utf8');
    expect(source).toContain('verifyRepositoryMigrationLedger(ledger)');
    expect(source).toContain("Object.freeze({ tenantId: state.tenantA })");
    expect(source).toContain("error.message === 'TENANT_AUTHORITY_REQUIRED'");
    expect(source).toContain("'REPOSITORY_FORGED_AUTHORITY'");
    expect(source).toContain("'GLOBAL_TENANT_GATE'");
    expect(source).toContain("'FINAL_RLS'");
    expect(source).toContain('AUDIT_CLASSIFICATION_');
    expect(source).toContain('state.createdFixtureIds.includes(id)');
    expect(source).toContain('AircraftService.activate(a, state.aircraftA!, reason)');
    expect(source).toContain("message === 'AIRCRAFT_NOT_FOUND'");
    expect(source).toContain('ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE');
    expect(source).not.toMatch(/DELETE FROM audit_log|TRUNCATE/i);
    expect(MT4C3A7_DEFERRED_BOUNDARY).toBe('MT-4C4 NOT CERTIFIED BY MT-4C3A7');
  });
});
