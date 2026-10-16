const express = require('express');
const app = express();
const knex = require('knex')(require('./knexfile').development);

const eadRoutes = require('./src/routes/ead.routes');

const { createEadExportRouter } = require('./src/ead/exportRoute');
app.use(express.json());

// Tillfällig mock tills SSO/AD finns – loggar in som första användaren i databasen
const requireRole = () => async (req, res, next) => {
    const user = await knex('users').first('id');
    req.user = { id: user ? user.id : null };
    next();
};

app.post("/api/ead/test", (req, res) => {
  console.log("[TEST] Endpoint reached");

  return res.status(200).json({
    message: "EAD route is working",
  });
});

app.use('/api/ead', eadRoutes);
app.use('/api', createEadExportRouter({ knex, requireRole }));

app.get('/', (req, res) => {
    res.send('Servern körs!');
});
app.use((error, req, res, next) => {
  console.error("\n========== EAD ERROR ==========");
  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Name:", error.name);
  console.error("Message:", error.message);
  console.error("Stack:", error.stack);
  console.error("================================\n");

  if (res.headersSent) {
    return next(error);
  }

  let status = error.status || error.statusCode || 500;

  // Multer errors, such as file-size or file-count limits
  if (error.name === "MulterError") {
    status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  }

  return res.status(status).json({
    message: error.message || "Unknown server error.",
    errorName: error.name,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:3000`);
});