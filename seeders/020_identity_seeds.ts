'use strict';

import argon2 from 'argon2';

export default {
  async up(queryInterface, Sequelize) {
    console.log('🌱 Identity Seed Starting...');

    // =========================================
    // LOAD ROLES
    // =========================================
    const roles = await queryInterface.sequelize.query(
      `SELECT * FROM rf_role WHERE code IN ('ADMIN','ENGINEER','MECHANIC','PLANNER','VIEWER','QA','SUPERVISOR')`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const roleMap = Object.fromEntries(roles.map((r: any) => [r.code, r]));

    const requiredRoleCodes = ['ADMIN', 'ENGINEER', 'MECHANIC', 'PLANNER', 'VIEWER', 'QA', 'SUPERVISOR'];
    const missingRoles = requiredRoleCodes.filter(code => !roleMap[code]);

    if (missingRoles.length > 0) {
      throw new Error(`❌ Missing rf_role rows: ${missingRoles.join(', ')}`);
    }

    // =========================================
    // USERS
    // =========================================
    const users = [
      {
        email: 'admin@jupiter.aero',
        password: 'admin',
        full_name: 'System Administrator',
        roles: ['ADMIN', 'PLANNER', 'ENGINEER', 'SUPERVISOR', 'QA', 'MECHANIC', 'VIEWER']
      },
      {
        email: 'engineer@jupiter.aero',
        password: 'eng',
        full_name: 'Lead Engineer',
        roles: ['ENGINEER']
      },
      {
        email: 'mechanic@jupiter.aero',
        password: 'mec',
        full_name: 'Maintenance Mechanic',
        roles: ['MECHANIC']
      },
      {
        email: 'mec111@jupiter.aero',
        password: 'mec',
        full_name: 'Maintenance Mechanic 111',
        roles: ['MECHANIC']
      },
      {
        email: 'mec222@jupiter.aero',
        password: 'mec',
        full_name: 'Maintenance Mechanic 222',
        roles: ['MECHANIC']
      },
      {
        email: 'qaulity@jupiter.aero',
        password: 'qa',
        full_name: 'Quality Assurance',
        roles: ['QA']
      },
      {
        email: 'supervisor@jupiter.aero',
        password: 'sup',
        full_name: 'Maintenance Supervisor',
        roles: ['SUPERVISOR']
      },
      {
        email: 'planner@jupiter.aero',
        password: 'pln',
        full_name: 'Maintenance Planner',
        roles: ['PLANNER']
      },
      {
        email: 'viewer@jupiter.aero',
        password: 'vwr',
        full_name: 'Read Only',
        roles: ['VIEWER']
      }
    ];

    for (const u of users) {
      const password_hash = await argon2.hash(u.password);

      // =========================================
      // UPSERT USER
      // =========================================
      const result: any = await queryInterface.sequelize.query(
        `
        INSERT INTO users (id, email, password_hash, full_name, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), :email, :password_hash, :full_name, true, NOW(), NOW())
        ON CONFLICT (email)
        DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          is_active = true,
          updated_at = NOW()
        RETURNING *;
        `,
        {
          replacements: {
            email: u.email,
            password_hash,
            full_name: u.full_name
          },
          type: Sequelize.QueryTypes.INSERT
        }
      );

      const createdUser = result[0][0];

      // =========================================
      // RESET ROLE MAPPINGS
      // =========================================
      await queryInterface.sequelize.query(
        `DELETE FROM user_roles WHERE user_id = :user_id`,
        {
          replacements: { user_id: createdUser.id }
        }
      );

      // =========================================
      // ASSIGN ROLES
      // =========================================
      for (const roleCode of u.roles) {
        const role = roleMap[roleCode];

        await queryInterface.sequelize.query(
          `
          INSERT INTO user_roles (user_id, role_id)
          VALUES (:user_id, :role_id)
          ON CONFLICT DO NOTHING;
          `,
          {
            replacements: {
              user_id: createdUser.id,
              role_id: role.id
            }
          }
        );
      }

      console.log(`👤 Seeded: ${u.email}`);
    }

    console.log('✅ Identity Seed Complete');
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('user_roles', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};