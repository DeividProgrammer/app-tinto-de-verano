// see https://github.com/mu-semtech/mu-javascript-template for more info

import { app, query, errorHandler } from 'mu';

function resolvedPeriod() {
    const now = new Date();
    const tmp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = tmp.getUTCDay() || 7;
    if (dayNum !== 1) {
        tmp.setUTCDate(tmp.getUTCDate() + (1 - dayNum));
    }
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    const weekStr = week.toString().padStart(2, '0');
    return `${tmp.getUTCFullYear()}-W${weekStr}`;
}

app.get('/groups/:id/leaderboard', async function (req, res) {
    const muSessionId = req.get('MU-SESSION-ID');
    if (!muSessionId) {
        return res.status(401).send({
            errors: [{ title: 'Session required (MU-SESSION-ID header)' }],
        });
    }

    const groupId = req.params.id;
    if (!groupId) {
        return res.status(400).send({
            errors: [{ title: 'Group id is required in path' }],
        });
    }

    const period = req.query.period || resolvedPeriod();
    const groupUri = `http://tinto.app/groups/${groupId}`;

    try {
        const sparqlResult = await query(`
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX schema: <http://schema.org/>
      PREFIX ext:  <http://mu.semte.ch/vocabularies/ext/>
      PREFIX mu:   <http://mu.semte.ch/vocabularies/core/>

      SELECT ?user ?userName ?count
      WHERE {
        GRAPH <http://mu.semte.ch/application> {
          <${groupUri}> a schema:Organization ;
                        schema:member ?user .

          ?user a foaf:Person ;
                foaf:name ?userName .

          ?wc a ext:WeeklyCount ;
              ext:user ?user ;
              ext:period "${period}" ;
              ext:count ?count .
        }
      }
      ORDER BY DESC(?count)
    `);

        const rows = sparqlResult.results.bindings.map((binding, index) => ({
            rank: index + 1, // ya viene ordenado desde SPARQL
            userUri: binding.user.value,
            userName: binding.userName.value,
            count: parseInt(binding.count.value, 10),
        }));

        const data = rows.map((row) => ({
            type: 'leaderboard-entry',
            id: `${row.rank}`,
            attributes: {
                rank: row.rank,
                userUri: row.userUri,
                userName: row.userName,
                count: row.count,
                period,
            },
        }));

        return res.status(200).send({
            data,
            meta: {
                groupId,
                groupUri,
                period,
            },
        });
    } catch (e) {
        console.error('[LEADERBOARD] Error while executing SPARQL', e);
        return res.status(500).send({
            errors: [{ title: 'Error building leaderboard' }],
        });
    }
});

app.use(errorHandler);
