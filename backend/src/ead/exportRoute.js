/**
 * Express routes for EAD3 export.
 *
 *   GET /api/structures/:id/export/ead3            → public part only (no login needed)
 *   GET /api/structures/:id/export/ead3?full=true  → everything, incl. unpublished nodes
 *                                                     and is_public = 0 fields (needs editor/admin)
 *
 * Every export is logged in transfer_jobs (Arkivlagen: traceability of what left the system).
 *
 * Usage in app.js:
 *   const { createEadExportRouter } = require('./ead/exportRoute');
 *   app.use('/api', createEadExportRouter({ knex, requireRole }));
 *
 * requireRole(role) is your auth middleware (mock now, SSO/AD later). It must set req.user.id.
 */

const express = require('express');
const { loadStructure } = require('./loadStructure');
const { buildEad3 } = require('./buildEad3');

function createEadExportRouter({ knex, requireRole }) {
  const router = express.Router();

  // Decide public vs full BEFORE auth, so the public export works without login
  const chooseMode = (req, res, next) => {
    if (req.query.full === 'true') return requireRole('editor')(req, res, next);
    return next();
  };

  router.get('/structures/:id/export/ead3', chooseMode, async (req, res, next) => {
    const structureId = Number(req.params.id);
    if (!Number.isInteger(structureId) || structureId <= 0) {
      return res.status(400).json({ error: 'Ogiltigt struktur-id' });
    }
    const publicOnly = req.query.full !== 'true';
    const userId = req.user?.id ?? null;

    let jobId = null;
    try {
      // Must exist before logging: transfer_jobs.structure_id is a foreign key
      const exists = await knex('structures').where({ id: structureId }).first('id');
      if (!exists) return res.status(404).json({ error: 'Strukturen finns inte eller är inte publicerad' });

      const [job] = await knex('transfer_jobs').insert({
        direction: 'export', format: 'ead3', structure_id: structureId,
        status: 'running', created_by: userId,
      }, ['id']);
      jobId = job.id ?? job;

      const loaded = await loadStructure(knex, structureId, { publicOnly });
      if (!loaded) {
        await finish(knex, jobId, 'failed', 0, 'Strukturen finns inte eller är inte publicerad');
        return res.status(404).json({ error: 'Strukturen finns inte eller är inte publicerad' });
      }

      const xml = buildEad3(loaded, { publicOnly });
      const fileName = `${loaded.structure.code}${publicOnly ? '' : '-full'}.ead3.xml`;
      await finish(knex, jobId, 'done', countNodes(loaded.roots), null, fileName);

      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(xml);
    } catch (err) {
      if (jobId) await finish(knex, jobId, 'failed', null, String(err.message).slice(0, 4000)).catch(() => {});
      return next(err);
    }
  });

  return router;
}

function finish(knex, id, status, nodeCount, message, fileName) {
  return knex('transfer_jobs').where({ id }).update({
    status, node_count: nodeCount, message, file_name: fileName ?? null, finished_at: knex.fn.now(),
  });
}

function countNodes(nodes) {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

module.exports = { createEadExportRouter, countNodes };
