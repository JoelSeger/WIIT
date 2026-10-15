const express = require('express');
const app = express();
const knex = require('knex')(require('./knexfile').development);
const { createEadExportRouter } = require('./src/ead/exportRoute');

// Tillfällig mock tills SSO/AD finns – loggar in som första användaren i databasen
const requireRole = () => async (req, res, next) => {
    const user = await knex('users').first('id');
    req.user = { id: user ? user.id : null };
    next();
};

app.use('/api', createEadExportRouter({ knex, requireRole }));

app.get('/', (req, res) => {
    res.send('Servern körs!');
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});