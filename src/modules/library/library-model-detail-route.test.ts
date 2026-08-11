import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import libraryRoutes from './library.routes.js';
import { LibraryService } from './library.service.js';
import { AdRelevanceService } from './ad-relevance.service.js';

vi.mock('../../middleware/auth.middleware.js', () => ({
  ensureAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

function createTestApp() {
  const app = express();
  app.use((_req, res, next) => {
    res.render = ((view: string) => res.status(200).send(`render:${view}`)) as typeof res.render;
    next();
  });
  app.use('/library', libraryRoutes);
  return app;
}

describe('GET /library/model/:id', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders model-detail for an existing component model', async () => {
    const model = {
      id: '96e6415b-8536-4834-a9b2-274df7c4b83c',
      model_name: 'Existing Model',
    };
    vi.spyOn(LibraryService, 'getModelById').mockResolvedValue(model as any);
    vi.spyOn(LibraryService, 'getModelRequirements').mockResolvedValue([] as any);
    vi.spyOn(LibraryService, 'getModelServiceBulletins').mockResolvedValue([] as any);
    vi.spyOn(LibraryService, 'getAttachableServiceBulletins').mockResolvedValue([] as any);
    vi.spyOn(LibraryService, 'getModelSids').mockResolvedValue([] as any);
    vi.spyOn(LibraryService, 'getModelApplicabilityAssignments').mockResolvedValue({
      assignedAirworthinessDirectives: [],
    } as any);
    vi.spyOn(AdRelevanceService, 'getReadOnlyRelevanceForModel').mockResolvedValue({} as any);

    const response = await request(createTestApp()).get(`/library/model/${model.id}`);

    expect(response.status).toBe(200);
    expect(response.text).toBe('render:library/model-detail');
  });

  it('returns 404 without rendering or calling downstream model queries when the model is missing', async () => {
    const missingId = '26a294de-72d4-4a1f-93b9-0092ec5307ea';
    vi.spyOn(LibraryService, 'getModelById').mockResolvedValue(null);
    const requirementsSpy = vi.spyOn(LibraryService, 'getModelRequirements');
    const serviceBulletinsSpy = vi.spyOn(LibraryService, 'getModelServiceBulletins');
    const attachableSpy = vi.spyOn(LibraryService, 'getAttachableServiceBulletins');
    const sidsSpy = vi.spyOn(LibraryService, 'getModelSids');
    const applicabilitySpy = vi.spyOn(LibraryService, 'getModelApplicabilityAssignments');
    const relevanceSpy = vi.spyOn(AdRelevanceService, 'getReadOnlyRelevanceForModel');

    const response = await request(createTestApp()).get(`/library/model/${missingId}`);

    expect(response.status).toBe(404);
    expect(response.text).toBe('Component model not found.');
    expect(response.text).not.toContain('render:library/model-detail');
    expect(requirementsSpy).not.toHaveBeenCalled();
    expect(serviceBulletinsSpy).not.toHaveBeenCalled();
    expect(attachableSpy).not.toHaveBeenCalled();
    expect(sidsSpy).not.toHaveBeenCalled();
    expect(applicabilitySpy).not.toHaveBeenCalled();
    expect(relevanceSpy).not.toHaveBeenCalled();
  });
});
