import { app, query, errorHandler } from 'mu';
import { v4 as uuid } from 'uuid';

async function getUserBySession(sessionId) {
  const cleanSessionId = sessionId.replace(/^https?:\/\/mu\.semte\.ch\/sessions\//, '');
  const sessionUri = `http://mu.semte.ch/sessions/${cleanSessionId}`;

  const result = await query(`
    PREFIX session: <http://mu.semte.ch/vocabularies/session/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    
    SELECT ?user ?account ?name
    WHERE {
      GRAPH <http://mu.semte.ch/graphs/sessions> {
        <${sessionUri}> session:account ?account .
      }
      GRAPH <http://mu.semte.ch/application> {
        ?user a foaf:Person ;
              foaf:account ?account ;
              foaf:name ?name .
      }
    }
    LIMIT 1
  `);

  if (result.results.bindings.length === 0) {
    return null;
  }

  const binding = result.results.bindings[0];
  return {
    uri: binding.user.value,
    account: binding.account.value,
    name: binding.name.value
  };
}

async function isUserMemberOfGroup(userUri, groupUri) {
  const result = await query(`
    PREFIX schema: <http://schema.org/>
    
    SELECT ?membership
    WHERE {
      GRAPH <http://mu.semte.ch/application> {
        <${userUri}> schema:memberOf <${groupUri}> .
      }
    }
  `);

  return result.results.bindings.length > 0;
}

async function getGroupUsers(groupId) {
  const result = await query(`
    PREFIX schema: <http://schema.org/>
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    
    SELECT ?user ?userName ?userUuid
    WHERE {
      GRAPH <http://mu.semte.ch/application> {
        ?group a schema:Organization ;
               mu:uuid "${groupId}" ;
               schema:member ?user .
        
        ?user a foaf:Person ;
              foaf:name ?userName ;
              mu:uuid ?userUuid .
      }
    }
    ORDER BY ?userName
  `);

  return result.results.bindings.map(binding => ({
    type: 'users',
    id: binding.userUuid.value,
    attributes: {
      uri: binding.user.value,
      name: binding.userName.value
    }
  }));
}

app.get('/groups', async (req, res) => {
  try {
    const result = await query(`
      PREFIX schema: <http://schema.org/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
      
      SELECT ?group ?uuid ?name ?status
      WHERE {
        GRAPH <http://mu.semte.ch/application> {
          ?group a schema:Organization ;
                 mu:uuid ?uuid ;
                 schema:name ?name ;
                 ext:status ?status .
        }
      }
      ORDER BY ?name
    `);

    const groups = result.results.bindings.map(binding => ({
      data: {
        type: 'groups',
        id: binding.uuid.value,
        attributes: {
          uri: binding.group.value,
          name: binding.name.value,
          status: binding.status.value
        }
      }
    }));

    res.json({ data: groups.map(g => g.data) });
  } catch (e) {
    console.error('[ERROR] GET /groups:', e);
    res.status(500).json({ errors: [{ title: 'Error fetching groups' }] });
  }
});

app.get('/groups/:id', async (req, res) => {
  try {
    const groupId = req.params.id;

    const result = await query(`
      PREFIX schema: <http://schema.org/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
      
      SELECT ?group ?name ?status
      WHERE {
        GRAPH <http://mu.semte.ch/application> {
          ?group a schema:Organization ;
                 mu:uuid "${groupId}" ;
                 schema:name ?name ;
                 ext:status ?status .
        }
      }
    `);

    if (result.results.bindings.length === 0) {
      return res.status(404).json({ errors: [{ title: 'Group not found' }] });
    }

    const binding = result.results.bindings[0];
    const members = await getGroupUsers(groupId);

    res.json({
      data: {
        type: 'groups',
        id: groupId,
        attributes: {
          uri: binding.group.value,
          name: binding.name.value,
          status: binding.status.value
        },
        relationships: {
          members: {
            data: members
          }
        }
      }
    });
  } catch (e) {
    console.error('[ERROR] GET /groups/:id:', e);
    res.status(500).json({ errors: [{ title: 'Error fetching group' }] });
  }
});

app.post('/groups', async (req, res) => {
  try {
    const sessionId = req.headers['mu-session-id'];
    if (!sessionId) {
      return res.status(401).json({ errors: [{ title: 'Session required' }] });
    }

    const user = await getUserBySession(sessionId);
    if (!user) {
      return res.status(401).json({ errors: [{ title: 'User not found' }] });
    }

    const { name, status } = req.body.data.attributes;
    if (!name) {
      return res.status(400).json({ errors: [{ title: 'Group name is required' }] });
    }

    const groupUuid = uuid();
    const groupUri = `http://tinto.app/groups/${groupUuid}`;
    const groupStatus = status || 'http://mu.semte.ch/vocabularies/ext/Active';

    await query(`
      PREFIX schema: <http://schema.org/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
      
      INSERT DATA {
        GRAPH <http://mu.semte.ch/application> {
          <${groupUri}> a schema:Organization ;
                        mu:uuid "${groupUuid}" ;
                        schema:name "${name}" ;
                        ext:status <${groupStatus}> ;
                        schema:member <${user.uri}> .
          
          <${user.uri}> schema:memberOf <${groupUri}> .
        }
      }
    `);

    res.status(201).json({
      data: {
        type: 'groups',
        id: groupUuid,
        attributes: {
          uri: groupUri,
          name: name,
          status: groupStatus
        }
      }
    });
  } catch (e) {
    console.error('[ERROR] POST /groups:', e);
    res.status(500).json({ errors: [{ title: 'Error creating group' }] });
  }
});


app.post('/groups/:id/join', async (req, res) => {
  try {
    const sessionId = req.headers['mu-session-id'];
    console.log('[JOIN] Session ID received:', sessionId);

    if (!sessionId) {
      return res.status(401).json({ errors: [{ title: 'Session required' }] });
    }

    const user = await getUserBySession(sessionId);
    console.log('[JOIN] User resolved from session:', user);

    if (!user) {
      return res.status(401).json({ errors: [{ title: 'User not found' }] });
    }

    const groupId = req.params.id;

    const groupResult = await query(`
      PREFIX schema: <http://schema.org/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      
      SELECT ?group
      WHERE {
        GRAPH <http://mu.semte.ch/application> {
          ?group a schema:Organization ;
                 mu:uuid "${groupId}" .
        }
      }
    `);

    if (groupResult.results.bindings.length === 0) {
      return res.status(404).json({ errors: [{ title: 'Group not found' }] });
    }

    const groupUri = groupResult.results.bindings[0].group.value;
    console.log('[JOIN] Group URI:', groupUri);

    const isMember = await isUserMemberOfGroup(user.uri, groupUri);
    console.log('[JOIN] Is user already member?', isMember);
    console.log('[JOIN] User URI:', user.uri);

    if (isMember) {
      return res.status(400).json({ errors: [{ title: 'Already a member of this group' }] });
    }

    await query(`
      PREFIX schema: <http://schema.org/>
      
      INSERT DATA {
        GRAPH <http://mu.semte.ch/application> {
          <${user.uri}> schema:memberOf <${groupUri}> .
          <${groupUri}> schema:member <${user.uri}> .
        }
      }
    `);

    res.json({
      data: {
        type: 'memberships',
        attributes: {
          user: user.uri,
          group: groupUri,
          message: 'Successfully joined group'
        }
      }
    });
  } catch (e) {
    console.error('[ERROR] POST /groups/:id/join:', e);
    res.status(500).json({ errors: [{ title: 'Error joining group' }] });
  }
});

app.get('/groups/:id/members', async (req, res) => {
  try {
    const groupId = req.params.id;

    const result = await query(`
      PREFIX schema: <http://schema.org/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      
      SELECT ?group ?user ?userName ?userUuid
      WHERE {
        GRAPH <http://mu.semte.ch/application> {
          ?group a schema:Organization ;
                 mu:uuid "${groupId}" ;
                 schema:member ?user .
          
          ?user a foaf:Person ;
                foaf:name ?userName ;
                mu:uuid ?userUuid .
        }
      }
      ORDER BY ?userName
    `);

    if (result.results.bindings.length === 0) {
      const groupCheck = await query(`
        PREFIX schema: <http://schema.org/>
        PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
        
        SELECT ?group
        WHERE {
          GRAPH <http://mu.semte.ch/application> {
            ?group a schema:Organization ;
                   mu:uuid "${groupId}" .
          }
        }
      `);

      if (groupCheck.results.bindings.length === 0) {
        return res.status(404).json({ errors: [{ title: 'Group not found' }] });
      }

      return res.json({ data: [] });
    }

    const members = result.results.bindings.map(binding => ({
      type: 'users',
      id: binding.userUuid.value,
      attributes: {
        uri: binding.user.value,
        name: binding.userName.value
      }
    }));

    res.json({ data: members });
  } catch (e) {
    console.error('[ERROR] GET /groups/:id/members:', e);
    res.status(500).json({ errors: [{ title: 'Error fetching group members' }] });
  }
});

app.delete('/groups/:id/leave', async (req, res) => {
  try {
    const sessionId = req.headers['mu-session-id'];

    if (!sessionId) {
      return res.status(401).json({ errors: [{ title: 'Session required' }] });
    }

    const user = await getUserBySession(sessionId);
    console.log('[LEAVE] User resolved from session:', user);

    if (!user) {
      console.log('[LEAVE] ERROR: User not found for session:', sessionId);
      return res.status(401).json({ errors: [{ title: 'User not found' }] });
    }

    const groupId = req.params.id;

    const groupResult = await query(`
      PREFIX schema: <http://schema.org/>
      PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
      
      SELECT ?group
      WHERE {
        GRAPH <http://mu.semte.ch/application> {
          ?group a schema:Organization ;
                 mu:uuid "${groupId}" .
        }
      }
    `);

    if (groupResult.results.bindings.length === 0) {
      return res.status(404).json({ errors: [{ title: 'Group not found' }] });
    }

    const groupUri = groupResult.results.bindings[0].group.value;

    const isMember = await isUserMemberOfGroup(user.uri, groupUri);

    if (!isMember) {
      console.log('[LEAVE] ERROR: User is not a member of this group');
      return res.status(400).json({ errors: [{ title: 'Not a member of this group' }] });
    }

    console.log('[LEAVE] Proceeding to delete membership...');

    await query(`
      PREFIX schema: <http://schema.org/>
      
      DELETE DATA {
        GRAPH <http://mu.semte.ch/application> {
          <${user.uri}> schema:memberOf <${groupUri}> .
          <${groupUri}> schema:member <${user.uri}> .
        }
      }
    `);

    console.log('[LEAVE] Membership deleted successfully.');

    res.status(204).send();
  } catch (e) {
    console.error('[ERROR] DELETE /groups/:id/leave:', e);
    res.status(500).json({ errors: [{ title: 'Error leaving group' }] });
  }
});

app.use(errorHandler);

