import type { Request, RequestHandler } from 'express';
import type { OrganisationSelectionService } from './organisation-selection.service.js';
import type { TenantSwitchTokenCodec } from './tenant-switch-token.js';

type OrganisationOptions = Pick<OrganisationSelectionService, 'listOptions'>;
type ExpectedTokenFactory = Pick<TenantSwitchTokenCodec, 'createExpectedContextToken'>;

export interface ActiveOrganisationUiDependencies {
  readonly selectionService: OrganisationOptions;
  readonly tokenCodec: ExpectedTokenFactory;
}

export interface ActiveOrganisationUiModel {
  readonly current: Readonly<{
    tenantCode: string;
    tenantDisplayName: string;
  }>;
  readonly alternatives: readonly Readonly<{
    tenantPublicId: string;
    tenantCode: string;
    tenantDisplayName: string;
  }>[];
  readonly expectedContextToken?: string;
}

function authenticatedUserId(req: Request): string | null {
  const value = (req.user as { id?: unknown } | undefined)?.id;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function createActiveOrganisationUiMiddleware(
  dependencies: ActiveOrganisationUiDependencies,
): RequestHandler {
  return async (req, res, next) => {
    const userId = authenticatedUserId(req);
    const validated = req.tenantContext;
    const stored = req.session?.activeTenantContext;
    if (
      !userId ||
      !validated ||
      !stored ||
      validated.membership.userId !== userId ||
      validated.tenant.id !== stored.tenantId ||
      validated.membership.id !== stored.membershipId
    ) {
      return next();
    }

    const current = Object.freeze({
      tenantCode: validated.tenant.code,
      tenantDisplayName: validated.tenant.displayName,
    });

    try {
      const options = await dependencies.selectionService.listOptions(userId);
      const alternatives = Object.freeze(
        options
          .filter(option => option.tenantPublicId !== validated.tenant.publicId)
          .map(option => Object.freeze({
            tenantPublicId: option.tenantPublicId,
            tenantCode: option.tenantCode,
            tenantDisplayName: option.tenantDisplayName,
          })),
      );
      const expectedContextToken = alternatives.length > 0
        ? dependencies.tokenCodec.createExpectedContextToken({
            authenticatedUserId: userId,
            context: stored,
          })
        : undefined;
      res.locals.activeOrganisationUi = Object.freeze({
        current,
        alternatives,
        ...(expectedContextToken ? { expectedContextToken } : {}),
      }) satisfies ActiveOrganisationUiModel;
    } catch {
      res.locals.activeOrganisationUi = Object.freeze({
        current,
        alternatives: Object.freeze([]),
      }) satisfies ActiveOrganisationUiModel;
    }
    return next();
  };
}
