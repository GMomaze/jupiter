import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';

/**
 * Validates that a Component Model exists.
 * Often used in routes like /library/models/:modelId/requirements
 */
export const validateComponentModel = async (req: Request, res: Response, next: NextFunction) => {
  const { modelId } = req.params;
  
  if (!modelId) return next();

  try {
    const result = await pool.query('SELECT id FROM component_models WHERE id = $1', [modelId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component Model not found' });
    }
    
    next();
  } catch (error) {
    console.error('Validation Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Ensures an asset type code is valid.
 * Used when creating or filtering assets.
 */
export const validateAssetType = (req: Request, res: Response, next: NextFunction) => {
  const type = req.body.asset_type || req.query.type;
  
  if (!type) return next();

  const validTypes = ['AIRCRAFT', 'ENGINE', 'APU', 'LANDING_GEAR'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid Asset Type: ${type}` });
  }
  
  next();
};

export default {
  validateComponentModel,
  validateAssetType
};