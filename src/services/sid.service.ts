import { CessnaSid } from '../models/index.js';

export const createSid = async (data: any) => {
  return CessnaSid.create(data);
};

export const getSidByNumber = async (sidNumber: string) => {
  return CessnaSid.findAll({
    where: { sid_number: sidNumber },
  });
};
