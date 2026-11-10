import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import { db, dbRaw } from './config/db';
import { attachUser, requireRole } from './middleware/auth';
import { createUserRouter } from './routers/userRoutes';
import { createIndexRouter } from './routers/indexRoutes';
import { createEadExportRouter } from './ead/exportRoute';
import { createEadImportRouter } from './ead/importRoute';
import { createNodeRouter } from './routers/nodeRoutes';
import { createSearchRouter } from './routers/searchRoutes';
import { createStructureRouter } from './routers/structureRoutes';
import logger from './config/logger';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET ?? 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
}));
app.use(attachUser);

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({ method: req.method, url: req.originalUrl, status: res.statusCode,
      ms: Date.now() - start, userId: req.user?.id }, 'request');
  });
  next();
});

app.use('/', createIndexRouter());
app.use('/api/users', createUserRouter(db));
app.use('/api/node', createNodeRouter(db))
app.use('/api/search', createSearchRouter(db));
app.use('/api', createEadExportRouter({ knex: dbRaw, requireRole }));
app.use('/api', createEadImportRouter({ knex: dbRaw, requireRole }));
app.use('/api/structures', createStructureRouter(db));

app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, method: req.method, url: req.originalUrl, userId: req.user?.id }, 'Unhandled error');
  res.status(err.status ?? 500).json({ success: false, error: err.message });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
