require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

(async () => {
    const rows = await knex.raw(`
        SELECT
            n.id,
            n.title,
            p.title  AS parent,
            t.name   AS type,
            t.ead_level,
            s.name   AS tree
        FROM nodes n
                 JOIN      node_types t ON t.id = n.node_type_id
                 JOIN      structures s ON s.id = n.structure_id
                 JOIN nodes      p ON p.id = n.parent_id
        ORDER BY n.id`);
    console.table(rows);
    await knex.destroy();
})();