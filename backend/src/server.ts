import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import session from 'express-session';
import { db, dbRaw } from './config/db';
import { attachUser, requireRole } from './middleware/auth';
import { createUserRouter } from './routers/userRoutes';
import { createIndexRouter } from './routers/indexRoutes';
import { createEadExportRouter } from './ead/exportRoute';
import { createEadImportRouter } from './ead/importRoute';
import { createStructureCreationRoutes } from "../src/routers/structureCreationRoute";
import { createNodeRouter } from "../src/routers/nodeRoute";

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

app.use('/', createIndexRouter());
app.use('/mau-arkiv/users', createUserRouter(db));
app.use('/api', createEadExportRouter({ knex: dbRaw, requireRole }));
app.use('/api', createEadImportRouter({ knex: dbRaw, requireRole }));
app.use("/api/structures", createStructureCreationRoutes(db));
app.use("/api/nodes", createNodeRouter(db));
// Routes call next(err) (multer, import errors), so something has to answer
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(err.status ?? 500).json({ success: false, error: err.message });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
