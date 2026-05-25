import { Op } from 'sequelize';
import { Router } from 'express';
import {
  Aircraft,
  Customer,
  SerializedComponent,
  Workpack,
  WorkpackSnag,
  WorkpackStatus,
} from '../models/index.js';

const router = Router();

/**
 * Middleware: Blocks access if no Passport session exists
 */
const ensureAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
};

/**
 * Root Dashboard
 */
router.get('/', ensureAuthenticated, async (req, res) => {
  const metrics: Record<string, number | null> = {
    totalAircraft: null,
    activeAircraft: null,
    openWorkpacks: null,
    awaitingCertification: null,
    openSnags: null,
    serializedComponents: null,
    activeCustomers: null,
  };

  let metricsWarning: string | null = null;

  try {
    const [closedStatus, inProgressStatus] = await Promise.all([
      WorkpackStatus.findOne({
        where: { code: 'CLOSED' },
        attributes: ['id'],
      }),
      WorkpackStatus.findOne({
        where: { code: 'IN_PROGRESS' },
        attributes: ['id'],
      }),
    ]);

    const countTasks = {
      totalAircraft: Aircraft.count(),
      activeAircraft: Aircraft.count({ where: { status: 'ACTIVE' } }),
      openWorkpacks: closedStatus
        ? Workpack.count({
            where: {
              status_id: {
                [Op.ne]: closedStatus.id,
              },
            },
          })
        : Promise.resolve(null),
      awaitingCertification: inProgressStatus
        ? Workpack.count({
            where: { status_id: inProgressStatus.id },
          })
        : Promise.resolve(null),
      openSnags: WorkpackSnag.count({
        where: {
          status: {
            [Op.ne]: 'CLOSED',
          },
        },
      }),
      serializedComponents: SerializedComponent.count(),
      activeCustomers: Customer.count({
        where: { status: 'ACTIVE' },
      }),
    };

    const entries = Object.entries(countTasks) as Array<
      [keyof typeof metrics, Promise<number | null>]
    >;
    const settled = await Promise.allSettled(entries.map(([, promise]) => promise));

    settled.forEach((result, index) => {
      const entry = entries[index];
      if (!entry) {
        return;
      }

      const [key] = entry;
      if (result.status === 'fulfilled') {
        metrics[key] = result.value;
      }
    });

    if (settled.some((result) => result.status === 'rejected')) {
      metricsWarning =
        'Some operational counts are temporarily unavailable. Navigation remains fully available.';
    }
  } catch {
    metricsWarning =
      'Operational counts could not be loaded right now. Navigation remains fully available.';
  }

  res.render('dashboard/index', {
    metrics,
    metricsWarning,
  });
});

export default router;
