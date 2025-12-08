import { app, errorHandler, query } from 'mu';
import bodyParser from 'body-parser';

/**
 * POST /session
 * Body:
 * {
 *   "data": {
 *     "attributes": {
 *       "email": "deivid2",
 *       "password": "123"
 *     }
 *   }
 * }
 */
app.post('/session', async (req, res) => {
    const loginIdentifier = req.body?.data?.attributes?.email;
    const password = req.body?.data?.attributes?.password;

    if (!loginIdentifier || !password) {
        return res.status(400).send({ errors: [{ title: 'Email and password required' }] });
    }

    const sessionId = req.get('MU-SESSION-ID');
    if (!sessionId) {
        return res.status(400).send({ errors: [{ title: 'No session from identifier (MU-SESSION-ID missing)' }] });
    }

    console.log(`[LOGIN] Attempting login with: ${loginIdentifier}`);
    console.log(`[LOGIN] Session ID: ${sessionId}`);

    let accountResult = await query(`
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        PREFIX acc:  <http://mu.semte.ch/vocabularies/account/>
        SELECT ?account ?passwordHash WHERE {
          GRAPH <http://mu.semte.ch/application> {
            ?account a foaf:OnlineAccount ;
                     foaf:accountName "${loginIdentifier}" ;
                     acc:password ?passwordHash .
          }
        } LIMIT 1
    `);

    console.log(`[LOGIN] Found by accountName: ${accountResult.results.bindings.length > 0}`);


    if (!accountResult.results.bindings.length) {
        console.log(`[LOGIN] Trying to find by Person email...`);
        accountResult = await query(`
            PREFIX foaf: <http://xmlns.com/foaf/0.1/>
            PREFIX acc:  <http://mu.semte.ch/vocabularies/account/>
            SELECT ?account ?passwordHash WHERE {
              GRAPH <http://mu.semte.ch/application> {
                ?person a foaf:Person ;
                        foaf:mbox "${loginIdentifier}" ;
                        foaf:account ?account .
                ?account a foaf:OnlineAccount ;
                         acc:password ?passwordHash .
              }
            } LIMIT 1
        `);
        console.log(`[LOGIN] Found by Person email: ${accountResult.results.bindings.length > 0}`);
    }

    if (!accountResult.results.bindings.length) {
        console.log(`[LOGIN] Account not found for: ${loginIdentifier}`);
        return res.status(401).send({
            errors: [{ title: 'Invalid email or password' }]
        });
    }

    const binding = accountResult.results.bindings[0];
    const account = binding.account.value;
    const passwordHash = binding.passwordHash.value;
    console.log(`[LOGIN] Found account: ${account}`);
    console.log(`[LOGIN] Password hash from DB: ${passwordHash.substring(0, 20)}...`);
    console.log(`[LOGIN] Password received (IGNORED IN DEV MODE): ${password}`);

    //
    // let isValid = false;
    // try {
    //     isValid = await bcrypt.compare(password, passwordHash);
    //     console.log(`[LOGIN] bcrypt.compare result: ${isValid}`);
    // } catch (e) {
    //     console.error('[LOGIN] Error during bcrypt comparison', e);
    //     return res.status(500).send({ errors: [{ title: 'Internal error validating password' }] });
    // }
    //
    // if (!isValid) {
    //     console.log('[LOGIN] Invalid password - bcrypt comparison failed');
    //     return res.status(401).send({ errors: [{ title: 'Invalid email or password' }] });
    // }
    console.log('[LOGIN] DEV MODE: skipping password validation, accepting identifier only');

    // Normalize session URI - remove any existing http:// prefix to avoid duplicates
    const cleanSessionId = sessionId.replace(/^https?:\/\/mu\.semte\.ch\/sessions\//, '');
    const sessionUri = `http://mu.semte.ch/sessions/${cleanSessionId}`;

    console.log(`[LOGIN] Clean session ID: ${cleanSessionId}`);
    console.log(`[LOGIN] Session URI: ${sessionUri}`);

    // Delete ALL existing session data for this session ID (any format) using direct Virtuoso call
    const deleteQuery = `
        PREFIX session: <http://mu.semte.ch/vocabularies/session/>
        
        DELETE {
          GRAPH <http://mu.semte.ch/graphs/sessions> {
            ?s ?p ?o .
          }
        }
        WHERE {
          GRAPH <http://mu.semte.ch/graphs/sessions> {
            ?s ?p ?o .
            FILTER(
              STR(?s) = "${sessionUri}" ||
              STR(?s) = "http://mu.semte.ch/sessions/http://mu.semte.ch/sessions/${cleanSessionId}" ||
              CONTAINS(STR(?s), "${cleanSessionId}")
            )
          }
        }
    `;

    try {
        const deleteResponse = await fetch('http://triplestore:8890/sparql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update',
            },
            body: deleteQuery
        });

        if (deleteResponse.ok) {
            console.log('[LOGIN] Successfully deleted old session data');
        } else {
            const errorText = await deleteResponse.text();
            console.warn('[LOGIN] Warning: Could not delete old session data:', errorText);
        }
    } catch (deleteError) {
        console.warn('[LOGIN] Warning: Error deleting old session:', deleteError.message);
    }

    // Create new clean session
    await query(`
        PREFIX session: <http://mu.semte.ch/vocabularies/session/>

        INSERT DATA {
          GRAPH <http://mu.semte.ch/graphs/sessions> {
            <${sessionUri}>
              session:account <${account}> .
          }
        }
    `);

    console.log(`[LOGIN] Session created successfully`);

    const muAuthAllowedGroups = ['public', 'users'];

    return res.status(201).send({
        data: {
            type: 'sessions',
            id: sessionUri,
            attributes: {
                identifier: loginIdentifier,
                mu_auth_allowed_groups: muAuthAllowedGroups
            }
        }
    });
});


app.get('/me', async (req, res) => {
    const sessionId = req.get('MU-SESSION-ID');

    if (!sessionId) {
        return res.status(401).send({ errors: [{ title: 'Session required (MU-SESSION-ID header)' }] });
    }

    // Normalize session URI
    const cleanSessionId = sessionId.replace(/^https?:\/\/mu\.semte\.ch\/sessions\//, '');
    const sessionUri = `http://mu.semte.ch/sessions/${cleanSessionId}`;

    console.log(`[GET /me] Session ID: ${cleanSessionId}`);
    console.log(`[GET /me] Session URI: ${sessionUri}`);

    const result = await query(`
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
        PREFIX foaf: <http://xmlns.com/foaf/0.1/>
        PREFIX session: <http://mu.semte.ch/vocabularies/session/>

        SELECT ?name ?accountName ?email WHERE {
          GRAPH <http://mu.semte.ch/graphs/sessions> {
            <${sessionUri}>
              session:account ?account .
          }

          GRAPH <http://mu.semte.ch/application> {
            ?account a foaf:OnlineAccount ;
                     foaf:accountName ?accountName .
          }

          GRAPH <http://mu.semte.ch/application> {
            ?user a foaf:Person ;
                  foaf:account ?account ;
                  foaf:name ?name .
            
            OPTIONAL { ?user foaf:mbox ?email }
          }
        } LIMIT 1
    `);

    if (!result.results.bindings.length) {
        console.log(`[GET /me] Session or user not found for: ${cleanSessionId}`);
        return res.status(404).send({ errors: [{ title: 'Session or user not found' }] });
    }

    const row = result.results.bindings[0];

    console.log(`[GET /me] Found user: ${row.name.value}`);

    return res.send({
        data: {
            type: 'users',
            attributes: {
                name: row.name.value,
                accountName: row.accountName.value,
                email: row.email?.value || row.accountName.value
            }
        }
    });
});


app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

app.use(errorHandler);