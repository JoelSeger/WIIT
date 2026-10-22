// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import knex from 'knex';
import knexConfig from './config/knexConfig';
import { setRoutes } from './routes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const db = knex(knexConfig.development);

// Tillfällig mock tills SSO/AD finns – loggar in som första användaren i databasen
const requireRole = () => async (req: Request, _res: Response, next: NextFunction) => {
  const user = await db('users').first<{ id: number }>('id');
  req.user = { id: user ? user.id : null };
  next();
};

setRoutes(app);

// Ta bort kommentarer när export är portat :D
// import { createEadExportRouter } from './ead/exportRoute';
// app.use('/api', createEadExportRouter({ knex: db, requireRole }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
