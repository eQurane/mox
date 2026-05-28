import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const serverRoot = path.join(__dirname, '..');

/** Каталог для загружаемых медиа: `<server>/storage`. */
export const storageDir = path.join(serverRoot, 'storage');
