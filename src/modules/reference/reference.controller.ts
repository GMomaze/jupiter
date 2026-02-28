import { Request, Response } from 'express';
import { BaseReferenceService } from './BaseReferenceService';

export const listReference = (tableName: string) => async (req: Request, res: Response) => {
  const service = new BaseReferenceService(tableName);
  const items = await service.getAllActive();
  
  // Rule 1.5: If request is from HTMX, return only the partial table body
  if (req.headers['hx-request']) {
    return res.render('partials/reference-table-body', { items, tableName });
  }
  res.render('reference/list', { items, tableName });
};

export const updateReference = (tableName: string) => async (req: Request, res: Response) => {
  const service = new BaseReferenceService(tableName);
  const { id } = req.params;
  const { label, description } = req.body;

  // Rule 1.5: Edit label/description only
  await service.update(id, { label, description });

  // Rule 1.5: HTMX reload on save (triggers a refresh of the list)
  res.setHeader('HX-Trigger', 'referenceUpdated');
  res.status(204).send();
};