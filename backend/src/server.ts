import express from 'express';
import dotenv from 'dotenv';
import { db } from './config/db';
import { createUserRouter } from './routers/userRoutes'; // Match your file name
import { createIndexRouter } from './routers/indexRoutes';
import { createEadExportRouter } from './ead/exportRoute';
import { createEadImportRouter } from './ead/importRoute';


dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use('/', createIndexRouter());

app.use('/mau-arkiv/users', createUserRouter(db));

app.use('/api', createEadExportRouter({ knex: db, requireRole }));
app.use('/api', createEadImportRouter({ knex: db, requireRole }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
