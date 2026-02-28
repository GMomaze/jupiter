import { assertPermission } from '../rbac/assertPermission';

export class ComponentModelService {

  static async create(userId: string, payload: any) {
    await assertPermission(userId, 'reference:create');

    // existing create logic
  }

  static async update(userId: string, id: string, payload: any) {
    await assertPermission(userId, 'reference:update');

    // existing update logic
  }

  static async deactivate(userId: string, id: string) {
    await assertPermission(userId, 'reference:deactivate');

    // deactivate logic
  }
}