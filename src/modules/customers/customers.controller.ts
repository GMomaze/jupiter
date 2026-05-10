import { Request, Response } from 'express';
import { CustomersService } from './customers.service.js';

export class CustomersController {
  private static getParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  private static buildFormData(body: Record<string, unknown> = {}) {
    return {
      name: typeof body.name === 'string' ? body.name : '',
      contact_person: typeof body.contact_person === 'string' ? body.contact_person : '',
      email: typeof body.email === 'string' ? body.email : '',
      phone: typeof body.phone === 'string' ? body.phone : '',
      alternate_phone: typeof body.alternate_phone === 'string' ? body.alternate_phone : '',
      billing_address_line_1: typeof body.billing_address_line_1 === 'string' ? body.billing_address_line_1 : '',
      billing_address_line_2: typeof body.billing_address_line_2 === 'string' ? body.billing_address_line_2 : '',
      billing_city: typeof body.billing_city === 'string' ? body.billing_city : '',
      billing_state_or_province: typeof body.billing_state_or_province === 'string' ? body.billing_state_or_province : '',
      billing_postal_code: typeof body.billing_postal_code === 'string' ? body.billing_postal_code : '',
      billing_country: typeof body.billing_country === 'string' ? body.billing_country : '',
      physical_address_line_1: typeof body.physical_address_line_1 === 'string' ? body.physical_address_line_1 : '',
      physical_address_line_2: typeof body.physical_address_line_2 === 'string' ? body.physical_address_line_2 : '',
      physical_city: typeof body.physical_city === 'string' ? body.physical_city : '',
      physical_state_or_province: typeof body.physical_state_or_province === 'string' ? body.physical_state_or_province : '',
      physical_postal_code: typeof body.physical_postal_code === 'string' ? body.physical_postal_code : '',
      physical_country: typeof body.physical_country === 'string' ? body.physical_country : '',
      vat_number: typeof body.vat_number === 'string' ? body.vat_number : '',
      tax_number: typeof body.tax_number === 'string' ? body.tax_number : '',
      account_reference: typeof body.account_reference === 'string' ? body.account_reference : '',
      status: typeof body.status === 'string' ? body.status : 'ACTIVE',
      notes: typeof body.notes === 'string' ? body.notes : '',
    };
  }

  private static toUserError(err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';

    switch (message) {
      case 'CUSTOMER_NAME_REQUIRED':
        return 'Customer name is required.';
      case 'CUSTOMER_CONTACT_REQUIRED':
        return 'Contact person is required.';
      case 'CUSTOMER_EMAIL_REQUIRED':
        return 'Email is required.';
      case 'CUSTOMER_PHONE_REQUIRED':
        return 'Phone is required.';
      case 'CUSTOMER_STATUS_REQUIRED':
      case 'CUSTOMER_STATUS_INVALID':
        return 'Customer status must be ACTIVE or INACTIVE.';
      case 'CUSTOMER_NOT_FOUND':
        return 'Customer not found.';
      default:
        return message;
    }
  }

  static async index(req: Request, res: Response) {
    try {
      const customers = await CustomersService.listCustomers();
      res.render('customers/index', { customers });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async showCreate(req: Request, res: Response) {
    res.render('customers/create', {
      form: CustomersController.buildFormData(),
      error: null,
    });
  }

  static async create(req: Request, res: Response) {
    try {
      const customer = await CustomersService.createCustomer(req.body, (req.user as any)?.id || null);
      req.flash('success', 'Customer created successfully.');
      res.redirect(`/customers/${customer.id}/edit`);
    } catch (err) {
      res.status(400).render('customers/create', {
        form: CustomersController.buildFormData(req.body),
        error: CustomersController.toUserError(err),
      });
    }
  }

  static async showEdit(req: Request, res: Response) {
    try {
      const customerId = CustomersController.getParam(req.params.id);
      const customer = await CustomersService.getCustomerOrThrow(customerId);
      res.render('customers/edit', {
        customer,
        form: CustomersController.buildFormData(customer.toJSON() as Record<string, unknown>),
        error: null,
      });
    } catch (err) {
      res.status(404).send(CustomersController.toUserError(err));
    }
  }

  static async update(req: Request, res: Response) {
    const customerId = CustomersController.getParam(req.params.id);

    try {
      const customer = await CustomersService.updateCustomer(customerId, req.body, (req.user as any)?.id || null);
      req.flash('success', 'Customer updated successfully.');
      res.redirect(`/customers/${customer.id}/edit`);
    } catch (err) {
      let customer = null;
      try {
        customer = await CustomersService.getCustomerOrThrow(customerId);
      } catch {
        customer = null;
      }

      res.status(400).render('customers/edit', {
        customer,
        form: CustomersController.buildFormData(req.body),
        error: CustomersController.toUserError(err),
      });
    }
  }
}
