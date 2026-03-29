import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  console.log('🌱 Identity Seed Starting...');

  const { hashPassword } = await import('../src/modules/auth/password.util.ts');

  // 🔹 Load roles
  const roles = await knex('rf_role')
    .whereIn('code', ['ADMIN', 'ENGINEER', 'MECHANIC', 'PLANNER', 'VIEWER', 'QA', 'SUPERVISOR']);

  const roleMap = Object.fromEntries(roles.map(r => [r.code, r]));

  const requiredRoleCodes = ['ADMIN', 'ENGINEER', 'MECHANIC', 'PLANNER', 'VIEWER', 'QA', 'SUPERVISOR'];
  const missingRoles = requiredRoleCodes.filter(code => !roleMap[code]);

  if (missingRoles.length > 0) {
    throw new Error(`❌ Missing rf_role rows: ${missingRoles.join(', ')}`);
  }

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
    const password_hash = await hashPassword(u.password);

    // 🔹 Upsert user
    const [user] = await knex('users')
      .insert({
        email: u.email,
        password_hash,
        full_name: u.full_name,
        is_active: true
      })
      .onConflict('email')
      .merge({
        password_hash,
        full_name: u.full_name,
        is_active: true
      })
      .returning('*');

    // Reset role mappings for deterministic seed output.
    await knex('user_roles')
      .where({ user_id: user.id })
      .del();

    // Ensure role mapping
    for (const roleCode of u.roles) {
      const role = roleMap[roleCode];

      await knex('user_roles')
        .insert({
          user_id: user.id,
          role_id: role.id
        })
        .onConflict(['user_id', 'role_id'])
        .ignore();
    }

    console.log(`👤 Seeded: ${u.email}`);
  }

  console.log('✅ Identity Seed Complete');
}
