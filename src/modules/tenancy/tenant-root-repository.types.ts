import type { TenantQueryAuthority } from './tenant-query-authority.js';

export const TENANT_REPOSITORY_ERROR_CODES = [
  'TENANT_AUTHORITY_REQUIRED',
  'TENANT_RESOURCE_UNAVAILABLE',
  'TENANT_QUERY_FAILED',
] as const;

export type TenantRepositoryErrorCode =
  (typeof TENANT_REPOSITORY_ERROR_CODES)[number];

export type TenantBusinessInput<TInput extends object> = Omit<
  TInput,
  'tenant_id' | 'custodian_tenant_id'
> & {
  readonly tenant_id?: never;
  readonly custodian_tenant_id?: never;
};

export interface TenantRepositoryOptions<TTransaction = unknown> {
  readonly transaction?: TTransaction;
}

export interface TenantPageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface TenantPage<TEntity> {
  readonly rows: readonly TEntity[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export type TenantUniqueMutationResult =
  | Readonly<{ outcome: 'CHANGED' }>
  | Readonly<{ outcome: 'UNAVAILABLE' }>;

// Implementations must map 0 affected rows to UNAVAILABLE, 1 to CHANGED,
// and treat more than 1 affected row as TENANT_QUERY_FAILED.

export interface TenantBulkMutationResult {
  readonly affectedCount: number;
}

export interface TenantAggregateRequest<TFilter, TGroup = never> {
  readonly filter: TFilter;
  readonly operation: 'COUNT' | 'SUM' | 'MIN' | 'MAX';
  readonly field?: string;
  readonly groupBy?: TGroup;
}

export interface TenantOwnedRootRepository<
  TEntity,
  TCreateInput extends object,
  TUpdateInput extends object,
  TFilter,
  TSearch,
  TAggregate = unknown,
  TGroup = never,
  TTransaction = unknown,
> {
  readonly repositoryScope: 'TENANT_OWNED_ROOT';

  getById(
    authority: TenantQueryAuthority,
    id: string,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TEntity | undefined>;

  findOne(
    authority: TenantQueryAuthority,
    filter: TFilter,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TEntity | undefined>;

  list(
    authority: TenantQueryAuthority,
    filter: TFilter,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<readonly TEntity[]>;

  search(
    authority: TenantQueryAuthority,
    search: TSearch,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<readonly TEntity[]>;

  count(
    authority: TenantQueryAuthority,
    filter: TFilter,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<number>;

  listPage(
    authority: TenantQueryAuthority,
    input: Readonly<{ filter: TFilter; page: TenantPageRequest }>,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TenantPage<TEntity>>;

  create(
    authority: TenantQueryAuthority,
    input: TenantBusinessInput<TCreateInput>,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TEntity>;

  updateById(
    authority: TenantQueryAuthority,
    input: Readonly<{
      id: string;
      changes: TenantBusinessInput<TUpdateInput>;
    }>,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TenantUniqueMutationResult>;

  deleteById(
    authority: TenantQueryAuthority,
    id: string,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TenantUniqueMutationResult>;

  updateMany(
    authority: TenantQueryAuthority,
    input: Readonly<{
      filter: TFilter;
      changes: TenantBusinessInput<TUpdateInput>;
    }>,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TenantBulkMutationResult>;

  deleteMany(
    authority: TenantQueryAuthority,
    filter: TFilter,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TenantBulkMutationResult>;

  aggregate(
    authority: TenantQueryAuthority,
    input: TenantAggregateRequest<TFilter, TGroup>,
    options?: TenantRepositoryOptions<TTransaction>,
  ): Promise<TAggregate>;
}

export interface SharedReferenceRepository {
  readonly repositoryScope: 'SHARED_REFERENCE';
}
