import { sequelize, Customer, CustomerAircraftLink, Aircraft } from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';

type CustomerPayload = {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  alternate_phone?: string | null;
  billing_address_line_1?: string | null;
  billing_address_line_2?: string | null;
  billing_city?: string | null;
  billing_state_or_province?: string | null;
  billing_postal_code?: string | null;
  billing_country?: string | null;
  physical_address_line_1?: string | null;
  physical_address_line_2?: string | null;
  physical_city?: string | null;
  physical_state_or_province?: string | null;
  physical_postal_code?: string | null;
  physical_country?: string | null;
  vat_number?: string | null;
  tax_number?: string | null;
  account_reference?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string | null;
};

type AircraftLinkPayload = {
  aircraft_id: string;
  customer_id: string;
  relationship_type: string;
  start_date: string;
  notes?: string | null;
  actor_id?: string | null;
};

export class CustomersService {
  private static withOptionalActorId<T extends Record<string, unknown>>(
    payload: T,
    actor_id: string | null | undefined
  ): T & { actor_id?: string | null } {
    if (actor_id === undefined) {
      return payload;
    }

    return {
      ...payload,
      actor_id,
    };
  }

  private static normalizeString(value: unknown) {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private static normalizeRequiredString(value: unknown, field: string) {
    const normalized = this.normalizeString(value);
    if (!normalized) {
      throw new Error(field);
    }
    return normalized;
  }

  private static normalizeStatus(value: unknown) {
    const normalized = this.normalizeRequiredString(value, 'CUSTOMER_STATUS_REQUIRED').toUpperCase();
    if (normalized !== 'ACTIVE' && normalized !== 'INACTIVE') {
      throw new Error('CUSTOMER_STATUS_INVALID');
    }
    return normalized as 'ACTIVE' | 'INACTIVE';
  }

  private static normalizeDate(value: unknown, field: string) {
    const normalized = this.normalizeRequiredString(value, field);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new Error(field);
    }
    return normalized;
  }

  private static buildCustomerValues(payload: Record<string, unknown>): CustomerPayload {
    return {
      name: this.normalizeRequiredString(payload.name, 'CUSTOMER_NAME_REQUIRED'),
      contact_person: this.normalizeRequiredString(payload.contact_person, 'CUSTOMER_CONTACT_REQUIRED'),
      email: this.normalizeRequiredString(payload.email, 'CUSTOMER_EMAIL_REQUIRED'),
      phone: this.normalizeRequiredString(payload.phone, 'CUSTOMER_PHONE_REQUIRED'),
      alternate_phone: this.normalizeString(payload.alternate_phone),
      billing_address_line_1: this.normalizeString(payload.billing_address_line_1),
      billing_address_line_2: this.normalizeString(payload.billing_address_line_2),
      billing_city: this.normalizeString(payload.billing_city),
      billing_state_or_province: this.normalizeString(payload.billing_state_or_province),
      billing_postal_code: this.normalizeString(payload.billing_postal_code),
      billing_country: this.normalizeString(payload.billing_country),
      physical_address_line_1: this.normalizeString(payload.physical_address_line_1),
      physical_address_line_2: this.normalizeString(payload.physical_address_line_2),
      physical_city: this.normalizeString(payload.physical_city),
      physical_state_or_province: this.normalizeString(payload.physical_state_or_province),
      physical_postal_code: this.normalizeString(payload.physical_postal_code),
      physical_country: this.normalizeString(payload.physical_country),
      vat_number: this.normalizeString(payload.vat_number),
      tax_number: this.normalizeString(payload.tax_number),
      account_reference: this.normalizeString(payload.account_reference),
      status: this.normalizeStatus(payload.status),
      notes: this.normalizeString(payload.notes),
    };
  }

  static async listCustomers() {
    return Customer.findAll({
      order: [['name', 'ASC']],
    });
  }

  static async getCustomerOrThrow(id: string) {
    const customer = await Customer.findByPk(id, {
      include: [
        {
          model: CustomerAircraftLink,
          as: 'AircraftLinks',
          include: [
            {
              model: Aircraft,
              as: 'Aircraft',
              attributes: ['id', 'registration', 'serial_number'],
            }
          ],
          required: false,
        }
      ],
      order: [[{ model: CustomerAircraftLink, as: 'AircraftLinks' }, 'is_current', 'DESC']],
    });

    if (!customer) {
      throw new Error('CUSTOMER_NOT_FOUND');
    }

    return customer;
  }

  static async getActiveCustomers() {
    return Customer.findAll({
      where: { status: 'ACTIVE' },
      order: [['name', 'ASC']],
    });
  }

  static async createCustomer(payload: Record<string, unknown>, actor_id?: string | null) {
    const values = this.buildCustomerValues(payload);

    return sequelize.transaction(async (transaction) => {
      const customer = await Customer.create(values, { transaction });

      await AuditService.log(
        this.withOptionalActorId(
          {
            table_name: 'customers',
            row_id: customer.id,
            action: 'CREATE',
            reason: 'Customer master record created',
            new_values: values,
          },
          actor_id
        ),
        transaction
      );

      return customer;
    });
  }

  static async updateCustomer(id: string, payload: Record<string, unknown>, actor_id?: string | null) {
    const values = this.buildCustomerValues(payload);

    return sequelize.transaction(async (transaction) => {
      const customer = await Customer.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!customer) {
        throw new Error('CUSTOMER_NOT_FOUND');
      }

      const oldValues = customer.toJSON();

      await customer.update(values, { transaction });

      await AuditService.log(
        this.withOptionalActorId(
          {
            table_name: 'customers',
            row_id: customer.id,
            action: 'UPDATE',
            reason: 'Customer master record updated',
            old_values: oldValues,
            new_values: customer.toJSON(),
          },
          actor_id
        ),
        transaction
      );

      return customer;
    });
  }

  static async assignAircraftToCustomer(payload: AircraftLinkPayload) {
    const customer_id = this.normalizeRequiredString(payload.customer_id, 'CUSTOMER_ID_REQUIRED');
    const aircraft_id = this.normalizeRequiredString(payload.aircraft_id, 'AIRCRAFT_ID_REQUIRED');
    const relationship_type = this.normalizeRequiredString(payload.relationship_type, 'RELATIONSHIP_TYPE_REQUIRED');
    const start_date = this.normalizeDate(payload.start_date, 'START_DATE_REQUIRED');
    const notes = this.normalizeString(payload.notes);

    return sequelize.transaction(async (transaction) => {
      const customer = await Customer.findByPk(customer_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!customer) {
        throw new Error('CUSTOMER_NOT_FOUND');
      }

      const aircraft = await Aircraft.findByPk(aircraft_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!aircraft) {
        throw new Error('AIRCRAFT_NOT_FOUND');
      }

      const existingCurrent = await CustomerAircraftLink.findOne({
        where: {
          aircraft_id,
          customer_id,
          relationship_type,
          is_current: true,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existingCurrent) {
        throw new Error('CURRENT_CUSTOMER_ALREADY_ASSIGNED');
      }

      const link = await CustomerAircraftLink.create(
        {
          customer_id,
          aircraft_id,
          relationship_type,
          is_current: true,
          start_date,
          end_date: null,
          notes,
        },
        { transaction }
      );

      await AuditService.log(
        this.withOptionalActorId(
          {
            table_name: 'customer_aircraft_links',
            row_id: link.id,
            action: 'CREATE',
            reason: 'Current customer relationship added to aircraft',
            new_values: link.toJSON(),
          },
          payload.actor_id
        ),
        transaction
      );

      return link;
    });
  }
}
