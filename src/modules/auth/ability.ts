import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'deactivate' | 'sign';
export type Subjects = 
  | 'rf_role' | 'rf_task_state' | 'rf_workpack_status' | 'rf_component_condition' 
  | 'rf_signoff_role' | 'rf_aircraft_category' | 'rf_component_type' 
  | 'TaskCard' | 'Component' | 'all'; // Added TaskCard and Component

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineAbilitiesFor(user: any): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!user) {
    cannot('manage', 'all');
    return build();
  }
console.console.log('GGGG--defineAbilitiesFor',user);

  if (user.roles && user.roles.includes('ADMIN')) {
    can('manage', 'all');
  } 
  // ENGINEER / CERTIFYING STAFF
  else if (user.roles && user.roles.includes('ENGINEER')) {
    can('read', 'all');
    can('update', 'TaskCard', { status: 'OPEN' });
    can('sign', 'TaskCard'); // Only engineers can sign
    can('manage', 'Component');
  }
  else {
    can('read', 'all');
    cannot('manage', 'all');
  }

  return build();
}