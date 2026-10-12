require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function expectFail(label, fn) {
    try {
        await fn();
        console.log(` ${label}: was ALLOWED (should fail)`);
    } catch (e) {
        console.log(` ${label}: blocked → ${e.message.split('\n')[0].slice(0, 90)}`);
    }
}

(async () => {
    await expectFail('Delete parent with children', () =>
        knex('nodes').where('reference_code', 'F').del());

    await expectFail('Delete node with relation', () =>
        knex('nodes').where('reference_code', 'F2').del());

    const hylla = await knex('nodes').where('reference_code', 'A-3').first('id');
    await expectFail('Move child into another tree', () =>
        knex('nodes').where('reference_code', 'F2:1').update({ parent_id: hylla.id }));

    await knex.destroy();
})();