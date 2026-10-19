
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import  { makeRequireRole } from './middleware/auth';
import { makeApiRouter } from './routes';
import { db} from './config/db';

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT)|| 3000;

app.use(express.json());

//requireRole from auth.ts
const requireRole = makeRequireRole(db);

//Endpoints for processes/ and archives/
app.use('/api/mau-arkiv', makeApiRouter({db, requireRole}));

//The export we had already
import { createEadExportRouter } from './ead/exportRoute';
app.use('/api', createEadExportRouter({ knex: db, requireRole }));

app.get('/', (_req: Request, res: Response) => {
  res.send('Servern körs!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


/*
This is the previous file! I was not sure I could delete it all but AI 
  explained fto me that having a factory for requireRole was better and the 
  auth could be moved to the auth.ts file

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import knex from 'knex';
import knexConfig from '../knexfile';

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

// Ta bort kommentarer när export är portat :D
// import { createEadExportRouter } from './ead/exportRoute';
// app.use('/api', createEadExportRouter({ knex: db, requireRole }));
*/
