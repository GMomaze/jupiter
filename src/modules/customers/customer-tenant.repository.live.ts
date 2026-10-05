import {
  type CreateOptions,
  type FindOptions,
  type InferCreationAttributes,
  type UpdateOptions,
} from 'sequelize';
import { Customer } from '../../models/index.js';
import {
  CustomerTenantRepository,
  type CustomerTenantRecord,
} from './customer-tenant.repository.js';

const liveCustomerModelPort = {
  findOne: (options: Readonly<Record<string, unknown>>) =>
    Customer.findOne(options as FindOptions) as unknown as Promise<CustomerTenantRecord | null>,
  findAll: (options: Readonly<Record<string, unknown>>) =>
    Customer.findAll(options as FindOptions) as unknown as Promise<readonly CustomerTenantRecord[]>,
  count: (options: Readonly<Record<string, unknown>>) =>
    Customer.count(options as FindOptions),
  create: (values: Readonly<Record<string, unknown>>, options: Readonly<Record<string, unknown>>) =>
    Customer.create(
      values as unknown as InferCreationAttributes<Customer>,
      options as CreateOptions,
    ) as unknown as Promise<CustomerTenantRecord>,
  update: (values: Readonly<Record<string, unknown>>, options: Readonly<Record<string, unknown>>) =>
    Customer.update(values, options as unknown as UpdateOptions),
};

export const customerTenantRepository = new CustomerTenantRepository(liveCustomerModelPort);
