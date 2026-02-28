import { AbilityBuilder, Ability } from '@casl/ability';

export const defineReferenceAbility = (user: any) => {
  const { can, cannot, build } = new AbilityBuilder(Ability);

  if (user.role === 'ADMIN') {
    can('manage', 'all'); // Admin can do everything
  } else {
    // Standard Users
    can('read', 'all'); // Everyone can see categories/status
    cannot('create', 'all'); // Mechanics/Engineers cannot add new reference types
    cannot('deactivate', 'all');
  }

  return build();
};