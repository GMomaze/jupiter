# MP2-R4-3 Disposable Fixture Cleanup Manifest

**Fixture-root ID:** `MP2-R4-3-FIXTURE-20260916T193141Z`

**Status:** DISPOSABLE RECOVERY FIXTURE SET COMPLETE; CLEANUP NOT AUTHORIZED

**Database:** `jupiter_test` at `127.0.0.1:5432`

This manifest contains only non-secret exact identifiers. It must be extended
by later authorized fixture creation. No broad name search is an authorized
cleanup mechanism.

## Guarded bootstrap resources

| Resource | Exact identifier |
| --- | --- |
| Disposable user | `9ef90541-cf81-4ec6-bee8-d979d8af6584` |
| Normalized test email | `mp2-r4-3-system-owner-9ef90541cf81@example.test` |
| HUMAN platform principal | `bc77103f-7224-4da9-9384-9b31d500f8d3` |
| `PLATFORM_AUDIT_VIEW` grant | `413babf0-7f00-4988-91a4-db72fcba598e` |
| `PLATFORM_AUTHORITY_MANAGE` grant | `452a9502-b0d9-4eff-9f80-a48cc0489ae2` |
| `SYSTEM_OWNER_BOOTSTRAPPED` audit | `edc2905c-2820-4191-9fd1-57ae046fe0ba` |

The user has a randomly generated Argon2 hash whose plaintext was discarded;
no reusable credential was created or recorded. Authority is the canonical
repository-issued HUMAN authority backed by the two grants above.

## Recovery fixture resources

| Resource | Exact identifier |
| --- | --- |
| Tenant A / public ID | `bc267abd-31ea-418b-b722-7ca5edbb24ab` / `67e8563e-444a-4050-9f4d-ee93ee310b32` |
| Tenant A ADMIN user / membership / role assignment | `2d2ed277-d393-4908-9960-2ccf54abcd81` / `35c8db0f-c9b3-4591-9ebb-0251b17af492` / `72c614f9-48c3-4373-944f-10f60c3c056d` |
| Tenant A staff user / membership | `b77fe113-edef-4e56-9972-a7591599682e` / `ebdbddb2-f956-4b76-bc2f-849dffe968de` |
| Tenant A customer / portal user | `75763672-b0bd-429a-9fcf-f4c960b51611` / `a57e4138-b2ed-4ad0-9646-6216f3cb5acb` |
| Tenant A aircraft / customer-aircraft link | `b5647fb6-8004-4911-bbcc-59ccbeac1c17` / `3e478abc-fa36-4c0a-abb0-7eed6b65eb21` |
| Tenant A file | `uploads/aircraft/mp2-r4-3-tenant-a.svg`; SHA-256 `80ddf64ab84ec63195d5415afc33fcac3d5d9957e1c5cce46da824679674372b`; 155 bytes |
| Tenant B / public ID | `6bcd73d8-af71-4364-a8f1-f3aa780841b9` / `4780279d-ce63-4138-923e-a616178dd2fd` |
| Tenant B ADMIN user / membership / role assignment | `b4933cef-af0f-4d19-89fd-415f38e34690` / `52a86e84-0760-4074-9ccd-499ad6e2203f` / `68ed4d53-6d35-43dd-927e-ae174235a487` |
| Tenant B staff user / membership | `f3185497-4dcf-4ae4-a5e7-4d1abbffc9ca` / `181c2cb9-747e-448a-911d-d30d2661d784` |
| Tenant B customer / portal user | `995c8d01-aa62-46c0-9f60-6532b3157afc` / `f687b54d-03ad-40a5-bde9-84cd3547f7ea` |
| Tenant B aircraft / customer-aircraft link | `528057c0-71ce-4475-92bc-2a097c53820f` / `62c473cf-ce54-4d09-a7c9-3d2dff4f9151` |
| Tenant B file | `uploads/aircraft/mp2-r4-3-tenant-b.svg`; SHA-256 `b1d3013b1ef95ee6a747050cf25a1bf7def0d0b0e88e3440a6be8d34297381f6`; 155 bytes |
| Scheduler principal / grant | `959d3479-b59b-4d33-9799-c67e29beb4ec` / `afdae50f-d227-4e22-85cc-3b7fbc6a4dcf` |

Tenant A is `ACTIVE`. Tenant B is authoritatively `SUSPENDED` with all listed
data preserved. The scheduler has exactly `SERVICE_BULLETIN_SYNC_EXECUTE`.

## Bounded lifecycle operators and grants

| Principal / user | Exact active grants |
| --- | --- |
| `582bbe91-4de4-43ed-be27-a720d5072db7` / `0133e869-af40-472d-bdc3-c9b115f13da2` | `e4243a20-7581-45c0-9a6e-50e0beb068ca` (`TENANT_PROVISION`); `4d67cf35-2a9c-4383-815b-509f37a1735b` (`TENANT_ACTIVATE`); `33cb8fb4-6ec2-4ed1-8517-d918299fe0e1` (`TENANT_SUSPEND`) |
| `c7774833-7d90-43d5-bdbe-9824dd4dee95` / `2d2ed277-d393-4908-9960-2ccf54abcd81` | `e6710ed6-e718-4f3b-be8d-c86036483fc0` (`TENANT_PROVISION`); `3d118388-cdc2-4019-8588-b36617b45edb` (`TENANT_ACTIVATE`); `0191a9f5-50e6-42fb-a45d-6b66fd6764e3` (`TENANT_SUSPEND`) |

## Immutable audit identifiers

Platform audit IDs: `ba917c9d-2971-4771-972c-0f6b238d93dc`, `9d23a052-150a-4f75-845e-91d4955e37eb`, `1ef2b749-56c5-41aa-b480-7608beb10555`, `471857b4-6c00-4c0a-aa23-84527069e5e1`, `65b5016d-1ac3-4246-b3b3-cb4c6dd9c902`, `53c681b1-3fef-455c-88bc-8538ddefe26b`, `8de6ba64-8a0a-483f-9c41-5fbe8a5f1123`, `98e65d94-a854-42bf-831d-979e412f3e83`, `7e69f968-6653-4c26-88d1-8960ff4b20d7`, `ec93c7b7-f803-4bcb-b093-915c7a837d37`, `94d4a1f5-840d-45c4-a1e1-204e35aba8a1`, `f4319bee-55dc-43b7-b152-713d6669c281`, `731c3682-3dd9-4eed-b692-394f3dd82098`, `83695858-e0a0-4507-90bc-4d243ea5b307`, `d9e9ff76-908e-46c6-86ae-c7ce607b32e9`, `c7b82a9f-63e1-4f16-aeba-cec6e610cc31`, `02e8b19b-f103-4781-a3e7-b3e8273b2101`, `8f3421cb-f33a-4199-abb6-28f1d96133ce`, `68b2dfba-0745-40c8-8726-c0b822daaca8`, `efe834f8-f412-492c-a5c3-ecd46681b3b6`.

Membership-authority audit IDs: `3c8b480e-46ee-4de4-872a-83c1e37deab0`, `fa5201e8-f895-4910-bc93-9ae54174c424`, `bdfe44c6-8c2b-4162-9338-e7245d41087f`, `7ce2ceb6-d74a-47fa-963c-da62dfcc5e65`.

## Cleanup constraints

These resources must remain for subsequent R4-3 fixture creation and recovery
evidence. Cleanup is separately authorized and must account for all later
dependent platform, scheduler, tenant, membership and audit evidence. Canonical
last-System-Owner and immutable-audit protections must not be bypassed. Direct
deletion, trigger disablement or broad identifier matching is not authorized.

## Temporary code removal inventory (C11/S9-14)

The following temporary TEST-only R4-3 recovery artifacts must be removed as
part of C11/S9-14 closeout; they are not part of normal Jupiter product code.

- `src/modules/recovery/recovery-membership-offboard.ts` — temporary
  `RecoveryMembershipOffboard` (Phase C C5-resume offboard of the five remaining
  fixture memberships on the three already-SUSPENDED fixture tenants). No HTTP
  route and no normal application import.
- `src/scripts/phaseC.ts` resume additions — the `R4_3_PHASE_C_RESUME` flag,
  the `R4_3_PHASE_C_RESUME_C9` flag, the `RecoveryMembershipOffboard`
  instantiation, the read-only Set1-A disable-verification branch, and the
  offboard branch.
