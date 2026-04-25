import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsRoot = path.resolve(__dirname, '..', '..', 'uploads');
const manufacturerLogoDir = path.join(uploadsRoot, 'manufacturers');
const aircraftPhotoDir = path.join(uploadsRoot, 'aircraft');
const serviceBulletinImportDir = path.join(uploadsRoot, 'service-bulletin-imports');

fs.mkdirSync(manufacturerLogoDir, { recursive: true });
fs.mkdirSync(aircraftPhotoDir, { recursive: true });
fs.mkdirSync(serviceBulletinImportDir, { recursive: true });

function sanitizeBaseName(filename: string) {
const extension = path.extname(filename).toLowerCase();
const basename = path
.basename(filename, extension)
.toLowerCase()
.replace(/[^a-z0-9]+/g, '-')
.replace(/^-+|-+$/g, '')
.slice(0, 80);

return {
basename: basename || 'file',
extension: extension || '.bin',
};
}

/* ===============================
MANUFACTURER LOGO UPLOAD
================================ */
const manufacturerLogoStorage = multer.diskStorage({
destination: (_req, _file, cb) => {
cb(null, manufacturerLogoDir);
},
filename: (_req, file, cb) => {
const { basename, extension } = sanitizeBaseName(file.originalname);
cb(null, `${Date.now()}-${basename}${extension}`);
},
});

function imageFileFilter(
_req: Express.Request,
file: Express.Multer.File,
cb: multer.FileFilterCallback
) {
if (file.mimetype.startsWith('image/')) {
cb(null, true);
return;
}

cb(new Error('Only image uploads are allowed for manufacturer logos.'));
}

export const manufacturerLogoUpload = multer({
storage: manufacturerLogoStorage,
fileFilter: imageFileFilter,
limits: {
fileSize: 5 * 1024 * 1024,
files: 1,
},
});

/* ===============================
AIRCRAFT PHOTO UPLOAD
================================ */
const aircraftPhotoStorage = multer.diskStorage({
destination: (_req, _file, cb) => {
cb(null, aircraftPhotoDir);
},
filename: (_req, file, cb) => {
const { basename, extension } = sanitizeBaseName(file.originalname);
cb(null, `${Date.now()}-${basename}${extension}`);
},
});

export const aircraftPhotoUpload = multer({
storage: aircraftPhotoStorage,
fileFilter: imageFileFilter,
limits: {
fileSize: 8 * 1024 * 1024,
files: 1,
},
});

/* ===============================
SERVICE BULLETIN IMPORT (FIXED)
================================ */
const serviceBulletinImportStorage = multer.diskStorage({
destination: (_req, _file, cb) => {
cb(null, serviceBulletinImportDir);
},
filename: (_req, file, cb) => {

  // ✅ FIX: preserve original filename exactly
  cb(null, file.originalname);

},
});

export const serviceBulletinImportUpload = multer({
storage: serviceBulletinImportStorage,
limits: {
fileSize: 20 * 1024 * 1024,
files: 2,
},
});