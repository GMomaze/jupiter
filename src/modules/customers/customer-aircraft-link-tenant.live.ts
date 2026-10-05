import { type CreateOptions, type FindOptions } from 'sequelize';
import { Aircraft, Customer, CustomerAircraftLink } from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';
import { aircraftTenantRepository } from '../aircraft/aircraft-tenant.repository.live.js';
import { customerTenantRepository } from './customer-tenant.repository.live.js';
import {
  CustomerAircraftLinkTenantRepository,
  type CustomerAircraftLinkTenantRecord,
} from './customer-aircraft-link-tenant.repository.js';
import { CustomerAircraftLinkTenantService } from './customer-aircraft-link-tenant.service.js';

const liveLinkModelPort = {
  findOne: (options: Readonly<Record<string, unknown>>) =>
    CustomerAircraftLink.findOne(options as FindOptions) as unknown as Promise<CustomerAircraftLinkTenantRecord | null>,
  findAll: (options: Readonly<Record<string, unknown>>) =>
    CustomerAircraftLink.findAll(options as FindOptions) as unknown as Promise<readonly CustomerAircraftLinkTenantRecord[]>,
  create: (values: Readonly<Record<string, unknown>>, options: Readonly<Record<string, unknown>>) =>
    CustomerAircraftLink.create(values, options as CreateOptions) as unknown as Promise<CustomerAircraftLinkTenantRecord>,
};

export const customerAircraftLinkTenantRepository =
  new CustomerAircraftLinkTenantRepository(
    liveLinkModelPort,
    customerTenantRepository,
    aircraftTenantRepository,
    Customer,
    Aircraft,
  );

export const customerAircraftLinkTenantService = new CustomerAircraftLinkTenantService(
  customerAircraftLinkTenantRepository,
  AuditService,
);
