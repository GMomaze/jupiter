import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import app from '../../app.js';
import { LibraryService } from './library.service.js';
import {
  AssetType,
  Role,
  User,
} from '../../models/index.js';
import { hashPassword } from '../auth/password.util.js';

describe('LibraryService asset type creation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an asset type with normalized uppercase code', async () => {
    vi.spyOn(AssetType, 'findOne').mockResolvedValue(null);
    const createSpy = vi.spyOn(AssetType, 'create').mockResolvedValue({
      id: 'asset-1',
      code: 'ENGINE',
      label: 'Engine',
    } as any);

    await LibraryService.createAssetType({
      code: ' engine ',
      label: ' Engine ',
      description: ' Powerplant ',
      is_installable_on_aircraft: 'on',
      is_required_for_aircraft: 'on',
      required_quantity: '2',
      is_active: 'on',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ENGINE',
        label: 'Engine',
        description: 'Powerplant',
        is_installable_on_aircraft: true,
        is_required_for_aircraft: true,
        required_quantity: 2,
        is_active: true,
        system_locked: false,
      })
    );
  });

  it('blocks duplicate asset type codes with a clear message', async () => {
    vi.spyOn(AssetType, 'findOne').mockResolvedValue({ id: 'existing' } as any);

    await expect(
      LibraryService.createAssetType({
        code: 'ENGINE',
        label: 'Engine',
      })
    ).rejects.toThrow(/Asset type code already exists/);
  });

  it('validates required quantity as a non-negative integer', async () => {
    vi.spyOn(AssetType, 'findOne').mockResolvedValue(null);

    await expect(
      LibraryService.createAssetType({
        code: 'PROP',
        label: 'Propeller',
        required_quantity: '-1',
      })
    ).rejects.toThrow(/Required quantity must be a non-negative whole number/);

    await expect(
      LibraryService.createAssetType({
        code: 'APU',
        label: 'APU',
        required_quantity: '1.5',
      })
    ).rejects.toThrow(/Required quantity must be a non-negative whole number/);
  });

  it('requires positive quantity when required on aircraft', async () => {
    vi.spyOn(AssetType, 'findOne').mockResolvedValue(null);

    await expect(
      LibraryService.createAssetType({
        code: 'WHEEL',
        label: 'Wheel',
        is_installable_on_aircraft: 'on',
        is_required_for_aircraft: 'on',
        required_quantity: '0',
      })
    ).rejects.toThrow(/required quantity greater than 0/);
  });

  it('forces required false and quantity zero when not installable', async () => {
    vi.spyOn(AssetType, 'findOne').mockResolvedValue(null);
    const createSpy = vi.spyOn(AssetType, 'create').mockResolvedValue({
      id: 'asset-2',
      code: 'TOOL',
      label: 'Tool',
    } as any);

    await LibraryService.createAssetType({
      code: 'TOOL',
      label: 'Tool',
      is_installable_on_aircraft: 'false',
      is_required_for_aircraft: 'on',
      required_quantity: '4',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        is_installable_on_aircraft: false,
        is_required_for_aircraft: false,
        required_quantity: 0,
      })
    );
  });
});

describe('Library asset type routes', () => {
  async function createLoggedInAdminAgent() {
    const agent = request.agent(app);
    const password = 'password123';
    const userId = uuid();
    const [role] = await Role.findOrCreate({
      where: { code: 'ADMIN' },
      defaults: {
        id: uuid(),
        label: 'Admin',
      },
    });

    const user = await User.create({
      id: userId,
      email: `asset-type-${userId}@test.com`,
      password_hash: await hashPassword(password),
      full_name: 'Asset Type Admin',
      is_active: true,
    });

    await (user as any).addRole(role);

    const loginResponse = await agent
      .post('/auth/login')
      .set('Accept', 'application/json')
      .send({ email: user.email, password });

    expect(loginResponse.status).toBe(200);
    return agent;
  }

  it('renders the asset type create form route', async () => {
    const agent = await createLoggedInAdminAgent();

    const response = await agent.get('/library/asset-types/new');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Create Asset Type');
    expect(response.text).toContain('name="code"');
    expect(response.text).toContain('name="_csrf"');
  });

  it('creates an asset type from the POST route', async () => {
    const agent = await createLoggedInAdminAgent();
    const code = `route_${uuid().slice(0, 8)}`;

    const response = await agent
      .post('/library/asset-types')
      .send({
        code,
        label: 'Route Asset',
        description: 'Created through route test.',
        is_installable_on_aircraft: 'true',
        is_required_for_aircraft: 'true',
        required_quantity: '1',
        is_active: 'true',
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/library');

    const stored = await AssetType.findOne({
      where: { code: code.toUpperCase() },
    });

    expect(stored).toEqual(
      expect.objectContaining({
        code: code.toUpperCase(),
        label: 'Route Asset',
        is_installable_on_aircraft: true,
        is_required_for_aircraft: true,
        required_quantity: 1,
        is_active: true,
      })
    );
  });
});
