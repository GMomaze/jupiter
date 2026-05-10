import { Router } from 'express';
import { ensureCustomerAuthenticated } from '../../middleware/customer-auth.middleware.js';
import { Customer } from '../../models/Customer.js';
import { CustomerAircraftLink } from '../../models/CustomerAircraftLink.js';
import { Aircraft } from '../../models/core/Aircraft.js';
import { ComponentModel } from '../../models/ComponentModel.js';
import { Manufacturer } from '../../models/Manufacturer.js';
import { sequelize } from '../../models/index.js';
import { ComplianceService } from '../compliance/compliance.service.js';

const router = Router();
const AIRCRAFT_VISIBLE_RELATIONSHIP_TYPES = [
  'OWNER',
  'CO_OWNER',
  'OPERATOR',
  'MANAGEMENT_COMPANY',
] as const;

router.use(ensureCustomerAuthenticated);

router.get('/', async (req, res, next) => {
  try {
    const sessionCustomerUser = req.session.customerUser!;
    const customer = await Customer.findByPk(sessionCustomerUser.customer_id, {
      attributes: ['id', 'name'],
    });

    return res.render('customer-portal/index', {
      customerUser: sessionCustomerUser,
      customerName: customer?.name || null,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/aircraft', async (req, res, next) => {
  try {
    const sessionCustomerUser = req.session.customerUser!;
    const customer = await Customer.findByPk(sessionCustomerUser.customer_id, {
      attributes: ['id', 'name'],
    });

    const links = await CustomerAircraftLink.findAll({
      where: {
        customer_id: sessionCustomerUser.customer_id,
        is_current: true,
        relationship_type: AIRCRAFT_VISIBLE_RELATIONSHIP_TYPES as unknown as string[],
      },
      include: [
        {
          model: Aircraft,
          as: 'Aircraft',
          attributes: ['id', 'registration', 'serial_number'],
          required: true,
          include: [
            {
              model: ComponentModel,
              attributes: ['id', 'model_name'],
              required: false,
              include: [
                {
                  model: Manufacturer,
                  attributes: ['id', 'name'],
                  required: false,
                },
              ],
            },
          ],
        },
      ],
      order: [
        [{ model: Aircraft, as: 'Aircraft' }, 'registration', 'ASC'],
        ['relationship_type', 'ASC'],
      ],
    });

    const aircraftMap = new Map<string, any>();

    for (const link of links as any[]) {
      const aircraft = link.Aircraft;
      if (!aircraft) continue;

      const existing = aircraftMap.get(aircraft.id);
      if (existing) {
        if (!existing.relationshipTypes.includes(link.relationship_type)) {
          existing.relationshipTypes.push(link.relationship_type);
        }
        continue;
      }

      aircraftMap.set(aircraft.id, {
        id: aircraft.id,
        registration: aircraft.registration,
        serialNumber: aircraft.serial_number || null,
        modelName: aircraft.ComponentModel?.model_name || null,
        manufacturerName: aircraft.ComponentModel?.Manufacturer?.name || null,
        relationshipTypes: [link.relationship_type],
      });
    }

    const aircraftList = Array.from(aircraftMap.values()).sort((left, right) =>
      String(left.registration).localeCompare(String(right.registration))
    );

    return res.render('customer-portal/aircraft', {
      customerUser: sessionCustomerUser,
      customerName: customer?.name || null,
      aircraftList,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/workpacks', async (req, res, next) => {
  try {
    const sessionCustomerUser = req.session.customerUser!;
    const customer = await Customer.findByPk(sessionCustomerUser.customer_id, {
      attributes: ['id', 'name'],
    });

    const [rows] = await sequelize.query(
      `
        SELECT DISTINCT
          w.id,
          w.work_order_number,
          w.created_at,
          w.certified_at,
          w.qa_reviewed_at,
          w.released_at,
          a.registration AS aircraft_registration,
          s.code AS status_code,
          s.label AS status_label,
          cal.relationship_type
        FROM customer_aircraft_links cal
        JOIN aircraft a
          ON a.id = cal.aircraft_id
        JOIN workpacks w
          ON w.aircraft_id = a.id
        JOIN rf_workpack_status s
          ON s.id = w.status_id
        WHERE cal.customer_id = :customerId
          AND cal.is_current = true
          AND cal.relationship_type IN (:relationshipTypes)
        ORDER BY w.created_at DESC, w.work_order_number DESC
      `,
      {
        replacements: {
          customerId: sessionCustomerUser.customer_id,
          relationshipTypes: [...AIRCRAFT_VISIBLE_RELATIONSHIP_TYPES],
        },
      }
    );

    const workpacks = (rows as any[]).map((row) => {
      const safeStatus =
        String(row.status_label || '').trim() ||
        String(row.status_code || '').trim() ||
        'Unknown';

      const closedAt =
        row.released_at ||
        row.certified_at ||
        row.qa_reviewed_at ||
        null;

      return {
        id: row.id,
        identifier: row.work_order_number,
        workOrderNumber: row.work_order_number || null,
        aircraftRegistration: row.aircraft_registration,
        title: `Workpack ${row.work_order_number}`,
        description: 'Customer-safe maintenance workpack summary',
        status: safeStatus,
        relationshipType: row.relationship_type,
        openedAt: row.created_at || null,
        closedAt,
      };
    });

    return res.render('customer-portal/workpacks', {
      customerUser: sessionCustomerUser,
      customerName: customer?.name || null,
      workpacks,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/documents', async (req, res, next) => {
  try {
    const sessionCustomerUser = req.session.customerUser!;
    const customer = await Customer.findByPk(sessionCustomerUser.customer_id, {
      attributes: ['id', 'name'],
    });

    const [rows] = await sequelize.query(
      `
        SELECT DISTINCT
          w.id,
          w.work_order_number,
          w.created_at,
          w.released_at,
          a.registration AS aircraft_registration
        FROM customer_aircraft_links cal
        JOIN aircraft a
          ON a.id = cal.aircraft_id
        JOIN workpacks w
          ON w.aircraft_id = a.id
        WHERE cal.customer_id = :customerId
          AND cal.is_current = true
          AND cal.relationship_type IN (:relationshipTypes)
          AND w.released_at IS NOT NULL
        ORDER BY w.released_at DESC, w.work_order_number DESC
      `,
      {
        replacements: {
          customerId: sessionCustomerUser.customer_id,
          relationshipTypes: [...AIRCRAFT_VISIBLE_RELATIONSHIP_TYPES],
        },
      }
    );

    const documents = (rows as any[]).map((row) => ({
      id: `release-summary:${row.id}`,
      title: `Release Summary for Workpack ${row.work_order_number}`,
      documentType: 'RELEASE_SUMMARY',
      aircraftRegistration: row.aircraft_registration,
      workpackReference: row.work_order_number || null,
      createdAt: row.created_at || null,
      releasedAt: row.released_at || null,
    }));

    return res.render('customer-portal/documents', {
      customerUser: sessionCustomerUser,
      customerName: customer?.name || null,
      documents,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/compliance', async (req, res, next) => {
  try {
    const sessionCustomerUser = req.session.customerUser!;
    const customer = await Customer.findByPk(sessionCustomerUser.customer_id, {
      attributes: ['id', 'name'],
    });

    const complianceSummaries: Array<{
      id: string;
      aircraftRegistration: string;
      itemType: 'AD' | 'SB';
      referenceCode: string;
      title: string;
      status: string;
      dueAt: Date | null;
      completedAt: Date | null;
    }> = [];

    const [workpackRows] = await sequelize.query(
      `
        SELECT DISTINCT
          w.id,
          w.work_order_number,
          a.registration AS aircraft_registration
        FROM customer_aircraft_links cal
        JOIN aircraft a
          ON a.id = cal.aircraft_id
        JOIN workpacks w
          ON w.aircraft_id = a.id
        WHERE cal.customer_id = :customerId
          AND cal.is_current = true
          AND cal.relationship_type IN (:relationshipTypes)
        ORDER BY a.registration ASC, w.work_order_number ASC
      `,
      {
        replacements: {
          customerId: sessionCustomerUser.customer_id,
          relationshipTypes: [...AIRCRAFT_VISIBLE_RELATIONSHIP_TYPES],
        },
      }
    );

    for (const row of workpackRows as any[]) {
      const compliance = await ComplianceService.getComplianceSummaryForWorkpack(
        row.id
      );

      const items = [...compliance.ad_items, ...compliance.sb_items];

      for (const item of items) {
        complianceSummaries.push({
          id: `${row.id}:${item.compliance_item_id}`,
          aircraftRegistration: row.aircraft_registration,
          itemType: item.item_type,
          referenceCode: item.code,
          title: item.title,
          status: 'COMPLETED',
          dueAt: null,
          completedAt: item.completed_at,
        });
      }
    }

    complianceSummaries.sort((left, right) => {
      const aircraftCompare = String(left.aircraftRegistration).localeCompare(
        String(right.aircraftRegistration)
      );

      if (aircraftCompare !== 0) {
        return aircraftCompare;
      }

      const typeCompare = String(left.itemType).localeCompare(String(right.itemType));
      if (typeCompare !== 0) {
        return typeCompare;
      }

      return String(left.referenceCode).localeCompare(String(right.referenceCode));
    });

    return res.render('customer-portal/compliance', {
      customerUser: sessionCustomerUser,
      customerName: customer?.name || null,
      complianceSummaries,
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
