# MP2 Section 5.2 Final Acceptance Disposable Fixture Cleanup Manifest

**Fixture-root ID:** `SEC52-FIXTURE-20260928T194924614`

**Status:** DISPOSABLE SECTION 5.2 ACCEPTANCE FIXTURE SET COMPLETE; CLEANUP NOT AUTHORIZED (required for subsequent Section 5 final acceptance testing)

**Database:** `jupiter_test` at `127.0.0.1:5432`

This manifest records the exact non-secret identifiers of the independent,
disposable Section 5.2 acceptance fixture set. It is distinct from the
historical MP2-R4-3 recovery fixture set (root `MP2-R4-3-FIXTURE-20260916T193141Z`),
which remains untouched and is not reused by this fixture. No broad name search
is an authorized cleanup mechanism.

## Guarded bootstrap resources

| Resource | Exact identifier |
| --- | --- |
| Disposable System Owner user | `95e16523-7db0-43b0-b76e-637c3a921e63` |
| Normalized test email | `sec52-system-owner-sec52@example.test` |
| HUMAN platform principal | `3115e26d-d04a-4be6-b4a4-722a29e73a25` |
| `PLATFORM_AUTHORITY_MANAGE` grant | `064927ba-122d-40aa-b6e8-b73ff7acbb3e` |
| `PLATFORM_AUDIT_VIEW` grant | `3c1e82c4-ca9a-4e03-bfc8-5110d512c5c9` |
| `SYSTEM_OWNER_BOOTSTRAPPED` audit | `69588aba-4439-4b4b-9df1-ea7732e26409` |

The System Owner user has a non-reusable placeholder password hash. Authority is
the canonical repository-issued HUMAN authority backed by the two grants above.

## System Owner six-capability reconciliation (MERGE model)

On the Project Owner MERGE-model decision, the disposable System Owner was
reconciled to the canonical six-capability contract through a temporary
separate HUMAN grantor (Option B), preserving self-grant prohibition and
normal immutable audit. Additional grants:

| Resource | Exact identifier |
| --- | --- |
| `TENANT_PROVISION` grant | `a0c34673-07a7-45c8-b19d-7c3350ec5c6e` |
| `TENANT_ACTIVATE` grant | `ccabf77b-0d43-4bc9-ab7a-2316bd061452` |
| `TENANT_SUSPEND` grant | `98e7d362-bf98-4403-98aa-114298372471` |
| `TENANT_REINSTATE` grant | `ea65aa8f-9ef5-4fb5-9747-dd91d0b9664c` |

Temporary reconciliation grantor (retired: `PLATFORM_AUTHORITY_MANAGE` revoked,
principal DISABLED, user deactivated):

| Resource | Exact identifier |
| --- | --- |
| Grantor HUMAN principal (DISABLED) | `a6964571-a3ca-4efa-a3be-d9132ce52ef1` |
| Grantor user (inactive) | `0978283a-823f-459d-8294-bdb02e7caa77` |
| Grantor email | `sec52-reconciliation-grantor-1790710467385@example.test` |

Development browser-login password: to be established through the guarded
`setSec52SystemOwnerPassword.ts` script (Argon2id, `jupiter_test` only). Not yet
set at reconciliation time; disposable development access with the owner above
as cleanup owner.

## Bounded lifecycle operator

| Resource | Exact identifier |
| --- | --- |
| Disposable operator user | `d61b328f-9440-4e37-82d5-5aaef1dd2279` |
| HUMAN platform principal | `b69ebf8f-4f45-4651-b3ab-35a0f8ca7dc3` |
| `TENANT_PROVISION` grant | `af58f6f0-7f4b-4eec-83be-6d65781493ce` |
| `TENANT_ACTIVATE` grant | `378e11b9-7570-452d-961e-bdbbef8990fb` |
| `TENANT_SUSPEND` grant | `d2ad6b00-29a2-46ef-ac73-db8c2f398115` |

The operator is a separate HUMAN principal (self-grant is forbidden by the
canonical authority boundary) used solely for tenant lifecycle commands.

## Acceptance tenant resources

| Resource | Exact identifier |
| --- | --- |
| Tenant A / public ID / code | `90219a98-b71b-461d-a805-014368a0d43e` / `7d9409e4-0e7b-433c-9152-d9aa10313bf3` / `SEC52_A` |
| Tenant A ADMIN user / membership / role | `b6b4d374-97c4-4d5e-8e97-929e33e8ade2` / `9d4e34ce-95cb-469f-9cbb-b6ce2184f740` / `f71af769-fd11-487a-9d7b-9594a62f5967` |
| Tenant A staff user / membership | `0f8baa78-3bd2-4bef-9fdf-9d710f440e9e` / `bb7b814a-fe7e-419c-a71a-c08b45b3d743` |
| Tenant A customer / portal user | `be193510-df71-4f5a-9f57-f1aefa6d3f2a` / `acb694b9-e425-4b8e-bd73-fabc481d7ab4` |
| Tenant B / public ID / code | `618fd0e9-4317-4e71-8d9e-4f0e3120e4fc` / `107835ce-b7a9-4d52-a365-1413f9b0f4de` / `SEC52_B` |
| Tenant B ADMIN user / membership / role | `50224617-a5b6-4f74-b54f-88207a01bba5` / `586a7d52-128c-481d-a16b-69d985281c90` / `a0cbe85d-0b4c-4d92-b7ff-59ee061a760f` |
| Tenant B staff user / membership | `3003d557-dbae-43ab-ba79-1798af5b0f79` / `2df4e5a8-0589-40a3-b5ac-1c3824dd4f0d` |
| Tenant B customer / portal user | `5103fc25-7e25-4e7f-8572-2080f48e4068` / `b4437b53-8a48-4471-a331-639c843f085a` |

Tenant A is `ACTIVE`. Tenant B is authoritatively `SUSPENDED` (via the
`TENANT_SUSPEND` lifecycle command) with all memberships and data preserved for
subsequent suspension/reinstatement acceptance tests.

## Scheduler SERVICE

The scheduler SERVICE principal was **not** provisioned for this fixture: the
historical R4-3 `SB_SYNC_SCHEDULER` SERVICE principal (`959d3479-b59b-4d33-9799-c67e29beb4ec`,
currently `DISABLED`) occupies the exact `SB_SYNC_SCHEDULER` service code, and the
authoritative `provisionSbSyncScheduler` refuses a second principal for that code.
Per the "do not reuse R4-3 fixtures" directive, that principal is left untouched.
If a Section 5.2 scheduler fixture is later required, it needs separate
authorization to address the service-code collision.

## Immutable audit identifiers

Platform audit IDs (Section 5.2 acceptance operations):

- `SYSTEM_OWNER_BOOTSTRAPPED`: `69588aba-4439-4b4b-9df1-ea7732e26409`
- `PLATFORM_PRINCIPAL_CREATED`: `c9a1f498-dfd3-418f-8c2b-82450cf0271a`
- `CAPABILITY_GRANTED`: `c187083d-17ca-4bd2-ab8e-fa1a6636f06d`, `b411a8b3-656b-4f70-a3ce-e1f508acc784`, `fe11bf8a-1358-4720-a162-f58deb1c060f`
- `TENANT_PROVISION`: `77bbac6b-c123-48f6-ba82-41b2a09ff50d`, `1c3e56c6-4ef7-40b4-8c2d-dc82798a9f5b`
- `TENANT_ACTIVATE`: `738b9a8f-bd8b-4d89-a1ca-b923ad602c17`, `f130ff8c-2d4d-42ac-af58-ea4771916058`
- `TENANT_SUSPEND`: `a84b34f1-725e-4c0d-972f-f5c357b15414`

Membership-authority audit IDs:

- `STAFF_INVITED`: `39d9a120-348a-4bac-bb01-3e1f02ba691f`, `65ee264f-a420-4af2-b2b1-2db676980922`
- `MEMBERSHIP_ACTIVATED`: `d5c8411a-fd9c-4f99-bbad-064cd1336e0e`, `cc025382-b894-494b-b63f-52897d0304b2`

## Section 5.3/5.4 lifecycle-test company (SEC52_C)

| Resource | Exact identifier |
| --- | --- |
| Lifecycle-test tenant / public ID / code | `26b7d2ce-9007-44b6-aa29-d3ab10ed4bc7` / `ab42fbd6-d3c8-4aec-8adb-93eb803f5d1f` / `SEC52_C` |
| Initial Company Admin user / membership | `07433cc2-8b3c-4eb0-b458-346b7f657a3d` / `011efca5-9158-4e29-aa8c-9e5a480f24cf` |
| Lifecycle-test customer(s) | synthetic `sec52-customer-c-sec52@example.test` (4 rows retained from verification re-runs) |

SEC52_C is `ACTIVE` (left active after the Section 5.4 reinstate). The lifecycle
operator gained one additional grant for Section 5.3/5.4: `TENANT_REINSTATE`
(authoritative, granted by the disposable System Owner).

## Section 5.5 shared-master acceptance resources

| Resource | Exact identifier |
| --- | --- |
| Curator HUMAN user / principal | `e7e865d8-cdff-44c6-8a75-0c6dfcb23fef` / `ce690ec1-7b17-4a2b-8daf-e4efa56afed9` |
| `MANUFACTURER_MASTER_MANAGE` grant | `133c2624-2a87-415b-8dfb-47684c7de4a1` |
| Synthetic manufacturers | `dad1f187-2f20-4dfe-bf8b-4f36b3d7a2cb` (`SEC55_61DC5467`), `49438441-c431-4282-9131-cb0c8b927dc9` (`SEC55_E6BB6EE5`) |

The curator is a disposable HUMAN principal holding only `MANUFACTURER_MASTER_MANAGE`
(no wildcard). The two synthetic manufacturers are the permitted-mutation
acceptance records.

## Cleanup constraints

These resources must remain for subsequent Section 5 final acceptance testing.
Cleanup is separately authorized and must account for the System Owner, operator,
tenants, memberships, roles, customers, portal users and audit evidence listed
above. Canonical last-System-Owner and immutable-audit protections must not be
bypassed. Direct deletion, trigger disablement or broad identifier matching is
not authorized.
