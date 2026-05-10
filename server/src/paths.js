import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const repoRoot = path.join(__dirname, '..', '..');

/** Каталог для загружаемых медиа: `<корень репозитория>/storage`. */
export const storageDir = path.join(repoRoot, 'storage');
