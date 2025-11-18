import { app, errorHandler, query, uuid } from 'mu';

/**
 * POST /session - Login simple por email
 * Usa la sesión que identifier ya creó, solo la vincula con el account
 */
app.post('/session', async (req, res) => {
  const email = req.body?.data?.attributes?.email;
  if (!email) return res.status(400).send({ errors: [{ title: 'Email required' }] });

  const sessionId = req.get('MU-SESSION-ID');
  if (!sessionId) return res.status(400).send({ errors: [{ title: 'No session from identifier' }] });


  const result = await query(`
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    SELECT ?account WHERE {
      GRAPH <http://mu.semte.ch/graphs/public> {
        ?account a foaf:OnlineAccount ;
                 foaf:accountName "${email}" .
      }
    } LIMIT 1
  `);

  if (!result.results.bindings.length) {
    return res.status(404).send({ errors: [{ title: 'Account not found' }] });
  }

  const account = result.results.bindings[0].account.value;

  // Vincular el sessionId del identifier con el account (hacer login)
  await query(`
    PREFIX session: <http://mu.semte.ch/vocabularies/session/>
    
    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/sessions> {
        <http://mu.semte.ch/sessions/${sessionId}>
          session:account <${account}> .
      }
    }
  `);

  res.status(201).send({ data: { type: 'sessions', id: sessionId } });
});


app.get('/me', async (req, res) => {
  const sessionId = req.get('MU-SESSION-ID');
  if (!sessionId) return res.status(401).send({ errors: [{ title: 'Session required' }] });

  const result = await query(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX session: <http://mu.semte.ch/vocabularies/session/>
    SELECT ?name ?email WHERE {
      GRAPH <http://mu.semte.ch/graphs/sessions> {
        ?s session:account ?account ;
           mu:uuid "${sessionId}" .
      }
      GRAPH <http://mu.semte.ch/graphs/public> {
        ?account foaf:accountName ?email .
      }
      GRAPH <http://mu.semte.ch/graphs/users> {
        ?account foaf:account ?user .
      }
      GRAPH <http://mu.semte.ch/graphs/public> {
        ?user foaf:name ?name .
      }
    } LIMIT 1
  `);

  if (!result.results.bindings.length) {
    return res.status(404).send({ errors: [{ title: 'Session not found' }] });
  }

  const user = result.results.bindings[0];
  res.send({
    data: {
      type: 'users',
      attributes: {
        name: user.name.value,
        email: user.email.value
      }
    }
  });
});

app.use(errorHandler);


