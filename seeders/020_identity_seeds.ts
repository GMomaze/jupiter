'use strict';

import argon2 from 'argon2';
import { QueryInterface, QueryTypes, Transaction } from 'sequelize';

type SeededUserDefinition = {
  email: string;
  bootstrapPassword: string;
  fullName: string;
  roles: readonly string[];
};

type RoleRow = {
  id: string;
  code: string;
};

type UserIdRow = {
  id: string;
};

export const SEEDED_USERS: readonly SeededUserDefinition[] = [
  {
    email: 'admin@jupiter.aero',
    bootstrapPassword: 'admin',
    fullName: 'System Administrator',
    roles: [
      'ADMIN',
      'PLANNER',
      'ENGINEER',
      'SUPERVISOR',
      'QA',
      'MECHANIC',
      'VIEWER',
    ],
  },
  {
    email: 'engineer@jupiter.aero',
    bootstrapPassword: 'eng',
    fullName: 'Lead Engineer',
    roles: ['ENGINEER'],
  },
  {
    email: 'mechanic@jupiter.aero',
    bootstrapPassword: 'mec',
    fullName: 'Maintenance Mechanic',
    roles: ['MECHANIC'],
  },
  {
    email: 'mec111@jupiter.aero',
    bootstrapPassword: 'mec',
    fullName: 'Maintenance Mechanic 111',
    roles: ['MECHANIC'],
  },
  {
    email: 'mec222@jupiter.aero',
    bootstrapPassword: 'mec',
    fullName: 'Maintenance Mechanic 222',
    roles: ['MECHANIC'],
  },
  {
    email: 'qaulity@jupiter.aero',
    bootstrapPassword: 'qa',
    fullName: 'Quality Assurance',
    roles: ['QA'],
  },
  {
    email: 'supervisor@jupiter.aero',
    bootstrapPassword: 'sup',
    fullName: 'Maintenance Supervisor',
    roles: ['SUPERVISOR'],
  },
  {
    email: 'planner@jupiter.aero',
    bootstrapPassword: 'pln',
    fullName: 'Maintenance Planner',
    roles: ['PLANNER'],
  },
  {
    email: 'viewer@jupiter.aero',
    bootstrapPassword: 'vwr',
    fullName: 'Read Only',
    roles: ['VIEWER'],
  },
];

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function seedOperationalIdentities(
  queryInterface: QueryInterface,
  transaction: Transaction
): Promise<void> {
  const requiredRoleCodes = [
    'ADMIN',
    'ENGINEER',
    'MECHANIC',
    'PLANNER',
    'VIEWER',
    'QA',
    'SUPERVISOR',
  ];

  const roles = await queryInterface.sequelize.query<RoleRow>(
    `
    SELECT id, code
    FROM rf_role
    WHERE code IN (:roleCodes)
    FOR SHARE;
    `,
    {
      replacements: { roleCodes: requiredRoleCodes },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  const roleMap = new Map(roles.map((role) => [role.code, role]));
  const missingRoles = requiredRoleCodes.filter((code) => !roleMap.has(code));

  if (missingRoles.length > 0) {
    throw new Error(`Missing rf_role rows: ${missingRoles.join(', ')}`);
  }

  for (const definition of SEEDED_USERS) {
    const email = normalizeEmail(definition.email);
    const existingUsers = await queryInterface.sequelize.query<UserIdRow>(
      `
      SELECT id
      FROM users
      WHERE LOWER(BTRIM(email)) = :email
      ORDER BY id
      FOR UPDATE;
      `,
      {
        replacements: { email },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    if (existingUsers.length > 1) {
      throw new Error(`Multiple users resolve to normalized email: ${email}`);
    }

    let userId = existingUsers[0]?.id;

    if (!userId) {
      const passwordHash = await argon2.hash(definition.bootstrapPassword);
      const insertedUsers = await queryInterface.sequelize.query<UserIdRow>(
        `
        INSERT INTO users (
          id,
          email,
          password_hash,
          full_name,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          :email,
          :passwordHash,
          :fullName,
          true,
          NOW(),
          NOW()
        )
        RETURNING id;
        `,
        {
          replacements: {
            email,
            passwordHash,
            fullName: definition.fullName,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      userId = insertedUsers[0]?.id;
    }

    if (!userId) {
      throw new Error(`Unable to resolve seeded user: ${email}`);
    }

    for (const roleCode of definition.roles) {
      const role = roleMap.get(roleCode);

      if (!role) {
        throw new Error(`Missing rf_role row: ${roleCode}`);
      }

      await queryInterface.sequelize.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (:userId, :roleId)
        ON CONFLICT (user_id, role_id) DO NOTHING;
        `,
        {
          replacements: {
            userId,
            roleId: role.id,
          },
          transaction,
        }
      );
    }

    console.log(`Seeded identity: ${email}`);
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    console.log('Identity Seed Starting...');

    await queryInterface.sequelize.transaction(async (transaction) => {
      await seedOperationalIdentities(queryInterface, transaction);
    });

    console.log('Identity Seed Complete');
  },

  async down() {
    // Intentionally non-destructive: seeded identities may be operational records.
  },
};
