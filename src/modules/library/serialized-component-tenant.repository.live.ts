import {
  type CreateOptions,
  type FindOptions,
  type InferCreationAttributes,
  type UpdateOptions,
} from 'sequelize';
import { SerializedComponent } from '../../models/index.js';
import {
  SerializedComponentTenantRepository,
  type SerializedComponentModelPort,
  type SerializedComponentTenantRecord,
} from './serialized-component-tenant.repository.js';

const liveSerializedComponentModelPort: SerializedComponentModelPort = {
  findOne: (options) => SerializedComponent.findOne(options as FindOptions) as unknown as Promise<SerializedComponentTenantRecord | null>,
  findAll: (options) => SerializedComponent.findAll(options as FindOptions) as unknown as Promise<readonly SerializedComponentTenantRecord[]>,
  create: (input, options) => SerializedComponent.create(
    input as unknown as InferCreationAttributes<SerializedComponent>,
    options as CreateOptions,
  ) as unknown as Promise<SerializedComponentTenantRecord>,
  update: (input, options) => SerializedComponent.update(input, options as unknown as UpdateOptions),
};

export const serializedComponentTenantRepository =
  new SerializedComponentTenantRepository(liveSerializedComponentModelPort);
