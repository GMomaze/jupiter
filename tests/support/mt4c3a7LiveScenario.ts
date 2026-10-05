import { randomUUID } from 'node:crypto';

export const MT4C3A7_LIVE_OPT_IN = 'ALLOW_MT4C3A7_LIVE_VERIFICATION';
export const MT4C3A7_DEFERRED_BOUNDARY = 'MT-4C4 NOT CERTIFIED BY MT-4C3A7';

export interface Mt4c3a7RunState {
  readonly correlationId: string;
  readonly tenantA: string;
  readonly tenantAPublic: string;
  readonly membershipA: string;
  readonly tenantB: string;
  readonly tenantBPublic: string;
  readonly membershipB: string;
  readonly nonexistentAircraft: string;
  readonly nonexistentCustomer: string;
  aircraftA?: string;
  aircraftB?: string;
  customerA?: string;
  customerB?: string;
  relationship?: string;
  readonly createdFixtureIds: string[];
  readonly immutableAuditIds: string[];
  mutationStarted: boolean;
  cleanupCompleted: boolean;
  finalVerificationCompleted: boolean;
}

export interface Mt4c3a7LiveDependencies {
  preflight(state: Mt4c3a7RunState): Promise<void>;
  createTenantFixtures(state: Mt4c3a7RunState): Promise<void>;
  verifyAuthorities(state: Mt4c3a7RunState): Promise<void>;
  verifyAircraftScenario(state: Mt4c3a7RunState): Promise<void>;
  verifyCustomerScenario(state: Mt4c3a7RunState): Promise<void>;
  verifyRelationshipScenario(state: Mt4c3a7RunState): Promise<void>;
  verifyUpdateScenario(state: Mt4c3a7RunState): Promise<void>;
  verifyLifecycleScenario(state: Mt4c3a7RunState): Promise<void>;
  verifyOwnershipAndAdmin(state: Mt4c3a7RunState): Promise<void>;
  verifyAuditAccounting(state: Mt4c3a7RunState): Promise<void>;
  cleanupExactMutableFixtures(state: Mt4c3a7RunState): Promise<void>;
  verifyFinalState(state: Mt4c3a7RunState): Promise<void>;
}

export function createMt4c3a7RunState(
  correlationId: string,
  uuid: () => string = randomUUID,
): Mt4c3a7RunState {
  return {
    correlationId,
    tenantA: uuid(), tenantAPublic: uuid(), membershipA: uuid(),
    tenantB: uuid(), tenantBPublic: uuid(), membershipB: uuid(),
    nonexistentAircraft: uuid(), nonexistentCustomer: uuid(),
    createdFixtureIds: [], immutableAuditIds: [], mutationStarted: false,
    cleanupCompleted: false, finalVerificationCompleted: false,
  };
}

export function createMt4c3a7LiveExecution(
  dependencies: Mt4c3a7LiveDependencies,
): {
  scenario(correlationId: string): Promise<Mt4c3a7RunState>;
  cleanup(correlationId: string): Promise<void>;
  state(): Mt4c3a7RunState | undefined;
} {
  let runState: Mt4c3a7RunState | undefined;
  return {
    async scenario(correlationId) {
      runState = createMt4c3a7RunState(correlationId);
      await dependencies.preflight(runState);
      runState.mutationStarted = true;
      await dependencies.createTenantFixtures(runState);
      await dependencies.verifyAuthorities(runState);
      await dependencies.verifyAircraftScenario(runState);
      await dependencies.verifyCustomerScenario(runState);
      await dependencies.verifyRelationshipScenario(runState);
      await dependencies.verifyUpdateScenario(runState);
      await dependencies.verifyLifecycleScenario(runState);
      await dependencies.verifyOwnershipAndAdmin(runState);
      await dependencies.verifyAuditAccounting(runState);
      return runState;
    },
    async cleanup(correlationId) {
      if (!runState || runState.correlationId !== correlationId) {
        throw new Error('MT4C3A7_CLEANUP_STATE_MISMATCH');
      }
      if (runState.mutationStarted) {
        await dependencies.cleanupExactMutableFixtures(runState);
      }
      runState.cleanupCompleted = true;
      await dependencies.verifyFinalState(runState);
      runState.finalVerificationCompleted = true;
    },
    state: () => runState,
  };
}

export async function createProductionMt4c3a7Dependencies(): Promise<Mt4c3a7LiveDependencies> {
  if (process.env[MT4C3A7_LIVE_OPT_IN] !== 'YES') {
    throw new Error(`MT4C3A7_LIVE: ${MT4C3A7_LIVE_OPT_IN} must be exactly YES`);
  }
  const { createProductionMt4c3a7Dependencies: create } =
    await import('./mt4c3a7LiveScenario.production.js');
  return create();
}
