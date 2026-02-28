import type { Knex } from 'knex';

export const seed = async function (knex: Knex): Promise<void> {
  console.log('🌱 Starting Identity Seed...');

  // ✅ Dynamic import works in ESM + ts-node
  const { hashPassword } = await import(
    '../src/modules/auth/password.util.ts'
  );

  const roles = await knex('rf_role')
    .whereIn('code', ['ADMIN', 'ENGINEER', 'MECHANIC', 'PLANNER', 'VIEWER']);

  const roleMap = Object.fromEntries(roles.map(r => [r.code, r]));

  if (!roleMap.ADMIN) {
    throw new Error('SEED ERROR: rf_role must be seeded first.');
  }

  const usersToCreate = [
    { email: 'admin@jupiter.aero', password: 'admin', full_name: 'System Administrator', roleCode: 'ADMIN' },
    { email: 'eng@jupiter.aero', password: 'eng', full_name: 'Lead Engineer', roleCode: 'ENGINEER' },
    { email: 'mec@jupiter.aero', password: 'mec', full_name: 'Maintenance Mechanic', roleCode: 'MECHANIC' },
    { email: 'pln@jupiter.aero', password: 'pln', full_name: 'Maintenance Planner', roleCode: 'PLANNER' },
    { email: 'vew@jupiter.aero', password: 'vew', full_name: 'Read-Only Viewer', roleCode: 'VIEWER' }
  ];

  for (const u of usersToCreate) {
    const role = roleMap[u.roleCode];
    if (!role) continue;

    const hashedPassword = await hashPassword(u.password);

    const existingUser = await knex('users')
      .where({ email: u.email })
      .first();

    let userId: string;

    if (!existingUser) {
      const [inserted] = await knex('users')
        .insert({
          email: u.email,
          password_hash: hashedPassword,
          full_name: u.full_name,
          is_active: true
        })
        .returning('id');

      userId = inserted.id;
      console.log(`👤 Created: ${u.email}`);
    } else {
      userId = existingUser.id;

      await knex('users')
        .where({ id: userId })
        .update({
          password_hash: hashedPassword,
          full_name: u.full_name,
          is_active: true
        });

      console.log(`🔄 Updated: ${u.email}`);
    }

    const existingMapping = await knex('user_roles')
      .where({ user_id: userId, role_id: role.id })
      .first();

    if (!existingMapping) {
      await knex('user_roles').insert({
        user_id: userId,
        role_id: role.id
      });
    }
  }

  console.log('--------------------------------------------------');
  console.log('✅ Identity Seed Complete');
  console.log('--------------------------------------------------');
};