
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const JSON5 = require('json5');
const { MongoClient, ObjectId } = require('mongodb');


const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://manideepjuvvala215_db_user:aeWhCDDKOpXeGg8b@cluster0.aqcfcn9.mongodb.net/?retryWrites=true&w=majority';
const ADMIN_ROLL = '22KT1A4245';
const ADMIN_PASS = 'manideep';

let cachedClient = null;
let indexesCreated = false;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'mpz_salt_2026').digest('hex');
}

function generateToken(rollNumber, isAdmin = false) {
  const payload = JSON.stringify({ rollNumber, isAdmin, timestamp: Date.now() });
  return Buffer.from(payload).toString('base64');
}

function parseToken(token) {
  if (!token) return null;
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8');
    const data = JSON.parse(json);
    if (data && data.rollNumber) return { rollNumber: data.rollNumber, isAdmin: !!data.isAdmin };
    return null;
  } catch {
    return null;
  }
}

async function getMongoClient() {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(MONGO_URI, {
    maxPoolSize: 100,
    minPoolSize: 0,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    retryWrites: true,
    w: 'majority'
  });

  await client.connect();
  cachedClient = client;

  if (!indexesCreated) {
    indexesCreated = true;
    (async () => {
      try {
        const appDb = client.db('manideep_practice_app');
        const usersColl = appDb.collection('users');
        await usersColl.createIndex({ rollNumber: 1 }, { unique: true });
        await usersColl.createIndex({ mobileNumber: 1 }, { unique: true });

        const optionsColl = appDb.collection('options');
        const opt = await optionsColl.findOne({ _id: 'dropdown_options' });
        if (!opt) {
          await optionsColl.insertOne({
            _id: 'dropdown_options',
            colleges: ['PBR VITS', 'JNTUA', 'KL University', 'SRM University', 'Vignan University'],
            branches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & DS', 'CSE (Data Science)'],
            years: ['I Year', 'II Year', 'III Year', 'IV Year']
          });
        }

        const adminUser = await usersColl.findOne({ rollNumber: ADMIN_ROLL });
        if (!adminUser) {
          await usersColl.insertOne({
            rollNumber: ADMIN_ROLL,
            mobileNumber: '9999999999',
            password: hashPassword(ADMIN_PASS),
            collegeName: 'Admin Portal',
            branch: 'CSE',
            year: 'IV Year',
            isAdmin: true,
            userDbName: 'user_db_22kt1a4245',
            createdAt: new Date()
          });
        }
      } catch {
        // Ignore existing index duplicates
      }
    })().catch(() => {});
  }

  return cachedClient;
}

const DEFAULT_OPTIONS = {
  _id: 'dropdown_options',
  colleges: ['PBR VITS', 'JNTUA', 'KL University', 'SRM University', 'Vignan University'],
  branches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & DS', 'CSE (Data Science)'],
  years: ['I Year', 'II Year', 'III Year', 'IV Year']
};

function parseMongoCommand(command) {
  let cmd = command.trim().replace(/;\s*$/, '');

  const match = cmd.match(/^db\.(\w+)\.(\w+)\s*\(([\s\S]*)\)$/);
  if (match) {
    const [, collection, operation, argsStr] = match;
    return { collection, operation, args: parseArgs(argsStr), chain: [] };
  }

  const chainMatch = cmd.match(/^db\.(\w+)\.(\w+)\s*\(([\s\S]*?)\)\s*\.([\s\S]+)$/);
  if (chainMatch) {
    const [, collection, operation, argsStr, chainStr] = chainMatch;
    return { collection, operation, args: parseArgs(argsStr), chain: parseChain(chainStr) };
  }

  const dbMatch = cmd.match(/^db\.(\w+)\s*\(([\s\S]*)\)$/);
  if (dbMatch) {
    const [, operation, argsStr] = dbMatch;
    return { collection: '', operation, args: parseArgs(argsStr), chain: [] };
  }

  throw new Error('Invalid command format. Example: db.my_collection.find()');
}

function parseChain(chainStr) {
  const methods = [];
  const regex = /(\w+)\s*\(([\s\S]*?)\)/g;
  let m;
  while ((m = regex.exec(chainStr)) !== null) {
    const [, method, argsStr] = m;
    methods.push({ method, args: parseArgs(argsStr) });
  }
  return methods;
}

function parseArgs(argsStr) {
  const trimmed = argsStr.trim();
  if (!trimmed) return [];

  const args = [];
  let depth = 0;
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const prev = i > 0 ? trimmed[i - 1] : '';

    if (inString) {
      current += ch;
      if (ch === stringChar && prev !== '\\') inString = false;
      continue;
    }

    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; current += ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; current += ch; continue; }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; current += ch; continue; }

    if (ch === ',' && depth === 0) {
      if (current.trim()) args.push(parseValue(current.trim()));
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) args.push(parseValue(current.trim()));
  return args;
}

function parseValue(val) {
  try { return JSON5.parse(val); } catch { return val; }
}

const router = express.Router();

// 1. Options
router.get('/options', async (_req, res) => {
  try {
    const client = await getMongoClient();
    const optionsColl = client.db('manideep_practice_app').collection('options');
    let opt = await optionsColl.findOne({ _id: 'dropdown_options' });
    if (!opt) opt = DEFAULT_OPTIONS;

    res.json({
      success: true,
      options: {
        colleges: opt.colleges || DEFAULT_OPTIONS.colleges,
        branches: opt.branches || DEFAULT_OPTIONS.branches,
        years: opt.years || DEFAULT_OPTIONS.years
      }
    });
  } catch {
    res.json({ success: true, options: DEFAULT_OPTIONS });
  }
});

// 2. Sign Up
router.post('/auth/signup', async (req, res) => {
  try {
    const { rollNumber, mobileNumber, password, collegeName, branch, year } = req.body;

    if (!rollNumber || !mobileNumber || !password || !collegeName || !branch || !year) {
      res.status(400).json({
        success: false,
        error: 'Please fill in all required fields: Roll Number, Mobile Number, College, Branch, Year, and Password.'
      });
      return;
    }

    const cleanRoll = String(rollNumber).trim().toUpperCase();
    const cleanMobile = String(mobileNumber).trim();

    if (cleanMobile.length < 10) {
      res.status(400).json({ success: false, error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }

    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');

    const existingUser = await usersColl.findOne({
      $or: [{ rollNumber: cleanRoll }, { mobileNumber: cleanMobile }]
    });

    if (existingUser) {
      if (existingUser.rollNumber === cleanRoll) {
        res.status(400).json({ success: false, error: 'An account with this Roll Number already exists. Please Sign In.' });
        return;
      }
      res.status(400).json({ success: false, error: 'An account with this Mobile Number already exists. Please Sign In.' });
      return;
    }

    const userDbName = `user_db_${cleanRoll.replace(/[^A-Z0-9]/gi, '_').toLowerCase()}`;
    const isAdmin = cleanRoll === ADMIN_ROLL;

    const newUser = {
      rollNumber: cleanRoll,
      mobileNumber: cleanMobile,
      password: hashPassword(password),
      collegeName: String(collegeName).trim(),
      branch: String(branch).trim(),
      year: String(year).trim(),
      isAdmin,
      userDbName,
      createdAt: new Date()
    };

    await usersColl.insertOne(newUser);
    const token = generateToken(cleanRoll, isAdmin);

    res.json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        rollNumber: cleanRoll,
        mobileNumber: cleanMobile,
        collegeName: newUser.collegeName,
        branch: newUser.branch,
        year: newUser.year,
        isAdmin,
        userDbName
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create account: ' + (error.message || String(error)) });
  }
});

// 3. Sign In
router.post('/auth/signin', async (req, res) => {
  try {
    const { rollNumber, password } = req.body;

    if (!rollNumber || !password) {
      res.status(400).json({ success: false, error: 'Please enter your Roll Number / Mobile Number and Password.' });
      return;
    }

    const cleanInput = String(rollNumber).trim();
    const hashedPassword = hashPassword(password);

    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');

    const user = await usersColl.findOne({
      $or: [
        { rollNumber: cleanInput.toUpperCase() },
        { mobileNumber: cleanInput }
      ],
      password: hashedPassword
    });

    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid Roll Number / Mobile Number or Password.' });
      return;
    }

    if (user.isDisabled) {
      res.status(403).json({ success: false, error: 'Your account has been disabled by the administrator. Please contact your instructor.' });
      return;
    }

    const isAdmin = user.rollNumber === ADMIN_ROLL || !!user.isAdmin;
    const token = generateToken(user.rollNumber, isAdmin);

    res.json({
      success: true,
      message: isAdmin ? 'Welcome Admin! Redirecting to Admin Dashboard...' : 'Signed in successfully!',
      token,
      user: {
        rollNumber: user.rollNumber,
        mobileNumber: user.mobileNumber,
        collegeName: user.collegeName || 'N/A',
        branch: user.branch || 'N/A',
        year: user.year || 'N/A',
        isAdmin,
        userDbName: user.userDbName
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Authentication failed: ' + (error.message || String(error)) });
  }
});

// 4. Session check
router.get('/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');
    const user = await usersColl.findOne({ rollNumber: session.rollNumber });

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.isDisabled) {
      res.status(403).json({ success: false, error: 'Account disabled' });
      return;
    }

    const isAdmin = user.rollNumber === ADMIN_ROLL || !!user.isAdmin;

    res.json({
      success: true,
      user: {
        rollNumber: user.rollNumber,
        mobileNumber: user.mobileNumber,
        collegeName: user.collegeName || 'N/A',
        branch: user.branch || 'N/A',
        year: user.year || 'N/A',
        isAdmin,
        userDbName: user.userDbName
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Database connection error' });
  }
});

// 5. Admin options
router.post('/admin/options', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const { colleges, branches, years } = req.body;
    const client = await getMongoClient();
    const optionsColl = client.db('manideep_practice_app').collection('options');

    await optionsColl.updateOne(
      { _id: 'dropdown_options' },
      { $set: { colleges, branches, years, updatedAt: new Date() } },
      { upsert: true }
    );

    res.json({ success: true, message: 'Dropdown options updated successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update options: ' + error.message });
  }
});

// 6. Admin students
router.get('/admin/students', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');
    const students = await usersColl.find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray();

    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch students: ' + error.message });
  }
});

// ADMIN: Toggle student disabled / enabled status
router.patch('/admin/students/:id/status', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const { id } = req.params;
    const { isDisabled } = req.body;
    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');

    let query;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { rollNumber: id };
    }

    const targetUser = await usersColl.findOne(query);
    if (!targetUser) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }

    if (targetUser.rollNumber === ADMIN_ROLL || targetUser.isAdmin) {
      res.status(400).json({ success: false, error: 'Cannot disable administrator account.' });
      return;
    }

    const newDisabledState = typeof isDisabled === 'boolean' ? isDisabled : !targetUser.isDisabled;
    await usersColl.updateOne(query, {
      $set: { isDisabled: newDisabledState, updatedAt: new Date() }
    });

    res.json({
      success: true,
      message: `Student account ${newDisabledState ? 'disabled' : 'enabled'} successfully!`,
      isDisabled: newDisabledState
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update student status: ' + error.message });
  }
});

// ADMIN: Delete student
router.delete('/admin/students/:id', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const { id } = req.params;
    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');

    let query;
    try {
      query = { _id: new ObjectId(id) };
    } catch {
      query = { rollNumber: id };
    }

    const targetUser = await usersColl.findOne(query);
    if (!targetUser) {
      res.status(404).json({ success: false, error: 'Student not found.' });
      return;
    }

    if (targetUser.rollNumber === ADMIN_ROLL || targetUser.isAdmin) {
      res.status(400).json({ success: false, error: 'Cannot remove administrator account.' });
      return;
    }

    await usersColl.deleteOne(query);

    if (targetUser.userDbName) {
      try {
        await client.db(targetUser.userDbName).dropDatabase();
      } catch {}
    }

    res.json({ success: true, message: `Student ${targetUser.rollNumber} removed successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove student: ' + error.message });
  }
});

// 7. Execute MongoDB Command
router.post('/execute', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session) {
    res.status(401).json({ success: false, error: 'Please sign in to execute MongoDB commands.', executionTime: 0 });
    return;
  }

  const { command, targetDb: overrideDb } = req.body;
  if (!command || typeof command !== 'string' || !command.trim()) {
    res.json({ success: false, error: 'No command provided.', executionTime: 0 });
    return;
  }

  const startTime = Date.now();
  const cmdStr = command.trim().replace(/;\s*$/, '');
  const lowerCmd = cmdStr.toLowerCase();

  try {
    const mongoClient = await getMongoClient();
    const cleanRoll = session.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '_');
    let activeDbName = overrideDb || `user_db_${cleanRoll}`;
    let db = mongoClient.db(activeDbName);

    let result;
    let message = 'Executed successfully';
    let documentCount;

    if (lowerCmd === 'show dbs' || lowerCmd === 'show databases') {
      if (session.isAdmin) {
        try {
          const adminDb = mongoClient.db('admin');
          const dbsList = await adminDb.admin().listDatabases();
          result = dbsList.databases.map(d => `${d.name.padEnd(28)} ${((d.sizeOnDisk || 0) / 1024 / 1024).toFixed(2)} MiB`).join('\n');
          message = `Found ${dbsList.databases.length} database(s) on Atlas`;
        } catch {
          result = `${activeDbName}    0.01 MiB\nmanideep_practice_app    0.02 MiB`;
          message = 'Atlas Database List fetched';
        }
      } else {
        result = `${activeDbName}    0.01 MiB`;
        message = 'Command executed successfully';
      }
    }
    else if (lowerCmd === 'show collections' || lowerCmd === 'show tables') {
      const collections = await db.listCollections().toArray();
      const names = collections.map(c => c.name).filter(n => !n.startsWith('system.'));
      result = names.length > 0 ? names.join('\n') : '(No collections found)';
      message = `Found ${names.length} collection(s) in "${activeDbName}"`;
    }
    else if (lowerCmd === 'db') {
      result = activeDbName;
      message = `Active Database: ${activeDbName}`;
    }
    else if (lowerCmd === 'show users') {
      const usersColl = mongoClient.db('manideep_practice_app').collection('users');
      result = await usersColl.find({}, { projection: { password: 0 } }).toArray();
      message = `Found ${result.length} user(s)`;
    }
    else if (lowerCmd === 'help' || lowerCmd === 'db.help()') {
      result = `MongoDB Shell Help & Commands Reference:
• db.createCollection("<name>") — Create a new collection
• db.<coll>.insertOne({ ... }) — Insert a single document
• db.<coll>.insertMany([ { ... } ]) — Insert multiple documents
• db.<coll>.find(<filter>, <proj>) — Query documents
• db.<coll>.findOne(<filter>) — Find one matching document
• db.<coll>.updateOne(<filter>, <update>) — Update one document
• db.<coll>.updateMany(<filter>, <update>) — Update multiple documents
• db.<coll>.deleteOne(<filter>) — Delete one document
• db.<coll>.deleteMany(<filter>) — Delete multiple documents
• db.<coll>.aggregate([ <stages> ]) — Perform aggregation pipeline
• db.<coll>.createIndex({ field: 1 }) — Create an index
• db.<coll>.getIndexes() — View indexes
• db.<coll>.drop() — Drop collection
• db.stats() — Database statistics`;
      message = 'Help documentation displayed';
    }
    else if (lowerCmd.startsWith('use ')) {
      const targetDb = cmdStr.substring(4).trim();
      activeDbName = targetDb;
      db = mongoClient.db(activeDbName);
      result = `switched to db ${targetDb}`;
      message = `Active database: ${targetDb}`;
    }
    else if (lowerCmd === 'db.serverstatus()' || lowerCmd === 'db.serverbuildinfo()') {
      result = { host: 'cluster0.aqcfcn9.mongodb.net', version: '7.0.12', process: 'mongod', ok: 1 };
      message = 'Server information fetched from Atlas';
    }
    else if (cmdStr.startsWith('db.createCollection')) {
      const parsed = parseMongoCommand(cmdStr);
      const collName = parsed.args[0];
      const options = parsed.args[1] || {};
      if (!collName || typeof collName !== 'string') throw new Error('createCollection requires a collection name string');
      await db.createCollection(collName, options);
      result = { ok: 1 };
      message = `Collection "${collName}" created successfully on Atlas (${activeDbName})`;
    }
    else if (cmdStr.startsWith('db.runCommand')) {
      const parsed = parseMongoCommand(cmdStr);
      result = await db.command(parsed.args[0]);
      message = 'Database command executed';
    }
    else if (cmdStr.startsWith('db.stats')) {
      result = await db.stats();
      message = 'Database statistics fetched';
    }
    else if (cmdStr.startsWith('db.dropDatabase')) {
      await db.dropDatabase();
      result = { ok: 1 };
      message = `Database "${activeDbName}" dropped successfully`;
    }
    else if (cmdStr.startsWith('db.createUser')) {
      const parsed = parseMongoCommand(cmdStr);
      result = { ok: 1, user: parsed.args[0]?.user || 'created' };
      message = 'User created successfully';
    }
    else if (cmdStr.startsWith('db.dropUser')) {
      const parsed = parseMongoCommand(cmdStr);
      result = { ok: 1, user: parsed.args[0] };
      message = `User "${parsed.args[0]}" dropped`;
    }
    else {
      const { collection: collName, operation, args, chain } = parseMongoCommand(cmdStr);
      if (!collName && operation !== 'help') throw new Error(`Unsupported database command: ${cmdStr}`);

      const collection = db.collection(collName);

      switch (operation) {
        case 'help':
          result = `Collection methods for db.${collName}:\n• find(), findOne()\n• insertOne(), insertMany()\n• updateOne(), updateMany(), replaceOne()\n• deleteOne(), deleteMany()\n• aggregate()\n• createIndex(), getIndexes(), dropIndex()\n• stats(), drop()`;
          message = `Help for collection ${collName}`;
          break;

        case 'createCollection': {
          const targetName = (args[0] && typeof args[0] === 'string') ? args[0] : collName;
          await db.createCollection(targetName, args[1] || {});
          result = { ok: 1 };
          message = `Collection "${targetName}" created successfully on Atlas (${activeDbName})`;
          break;
        }

        case 'find': {
          const filter = args[0] || {};
          const projection = args[1] ? { projection: args[1] } : {};
          let cursor = collection.find(filter, projection);

          for (const cm of chain) {
            if (cm.method === 'sort' && cm.args[0]) cursor = cursor.sort(cm.args[0]);
            if (cm.method === 'limit' && cm.args[0] !== undefined) cursor = cursor.limit(cm.args[0]);
            if (cm.method === 'skip' && cm.args[0] !== undefined) cursor = cursor.skip(cm.args[0]);
            if (cm.method === 'explain') {
              result = await cursor.explain(cm.args[0] || 'queryPlanner');
              message = 'Query explain execution plan fetched';
              break;
            }
          }

          if (!result) {
            result = await cursor.toArray();
            documentCount = result.length;
            message = `Found ${result.length} document(s)`;
          }
          break;
        }

        case 'findOne': {
          const filter = args[0] || {};
          const projection = args[1] ? { projection: args[1] } : {};
          result = await collection.findOne(filter, projection);
          documentCount = result ? 1 : 0;
          message = result ? 'Found 1 document' : 'No document found';
          break;
        }

        case 'insertOne': {
          const doc = args[0];
          if (!doc) throw new Error('insertOne requires a document object');
          const res = await collection.insertOne(doc);
          result = { acknowledged: res.acknowledged, insertedId: res.insertedId };
          message = `Document inserted successfully into Atlas (${activeDbName})`;
          break;
        }

        case 'insertMany': {
          const docs = args[0];
          if (!docs || !Array.isArray(docs)) throw new Error('insertMany requires an array of documents');
          const res = await collection.insertMany(docs);
          result = { acknowledged: res.acknowledged, insertedCount: res.insertedCount, insertedIds: res.insertedIds };
          message = `${res.insertedCount} document(s) inserted into Atlas (${activeDbName})`;
          break;
        }

        case 'updateOne': {
          const filter = args[0] || {};
          const update = args[1];
          if (!update) throw new Error('updateOne requires filter and update arguments');
          const res = await collection.updateOne(filter, update, args[2] || {});
          result = { acknowledged: res.acknowledged, matchedCount: res.matchedCount, modifiedCount: res.modifiedCount, upsertedId: res.upsertedId };
          message = `Matched ${res.matchedCount}, modified ${res.modifiedCount} document(s)`;
          break;
        }

        case 'updateMany': {
          const filter = args[0] || {};
          const update = args[1];
          if (!update) throw new Error('updateMany requires filter and update arguments');
          const res = await collection.updateMany(filter, update, args[2] || {});
          result = { acknowledged: res.acknowledged, matchedCount: res.matchedCount, modifiedCount: res.modifiedCount, upsertedId: res.upsertedId };
          message = `Matched ${res.matchedCount}, modified ${res.modifiedCount} document(s)`;
          break;
        }

        case 'replaceOne': {
          const filter = args[0] || {};
          const replacement = args[1];
          if (!replacement) throw new Error('replaceOne requires filter and replacement arguments');
          const res = await collection.replaceOne(filter, replacement, args[2] || {});
          result = { acknowledged: res.acknowledged, matchedCount: res.matchedCount, modifiedCount: res.modifiedCount };
          message = `Replaced document on Atlas`;
          break;
        }

        case 'deleteOne': {
          const filter = args[0] || {};
          const res = await collection.deleteOne(filter);
          result = { acknowledged: res.acknowledged, deletedCount: res.deletedCount };
          message = `Deleted ${res.deletedCount} document(s)`;
          break;
        }

        case 'deleteMany': {
          const filter = args[0] || {};
          const res = await collection.deleteMany(filter);
          result = { acknowledged: res.acknowledged, deletedCount: res.deletedCount };
          message = `Deleted ${res.deletedCount} document(s)`;
          break;
        }

        case 'aggregate': {
          const pipeline = args[0];
          if (!pipeline || !Array.isArray(pipeline)) throw new Error('aggregate requires a pipeline array');
          result = await collection.aggregate(pipeline).toArray();
          documentCount = result.length;
          message = `Aggregation returned ${result.length} document(s)`;
          break;
        }

        case 'countDocuments': {
          result = await collection.countDocuments(args[0] || {});
          message = `Count: ${result}`;
          break;
        }

        case 'distinct': {
          const field = args[0];
          if (!field) throw new Error('distinct requires a field name string');
          result = await collection.distinct(field, args[1] || {});
          message = `Found ${result.length} distinct value(s)`;
          break;
        }

        case 'stats': {
          result = await db.command({ collStats: collName });
          message = `Stats for collection "${collName}"`;
          break;
        }

        case 'renameCollection': {
          const newName = args[0];
          if (!newName || typeof newName !== 'string') throw new Error('renameCollection requires a new name string');
          await collection.rename(newName);
          result = { ok: 1 };
          message = `Collection "${collName}" renamed to "${newName}"`;
          break;
        }

        case 'createIndex': {
          const keys = args[0];
          if (!keys) throw new Error('createIndex requires index keys');
          result = await collection.createIndex(keys, args[1] || {});
          message = `Index "${result}" created`;
          break;
        }

        case 'getIndexes': {
          result = await collection.indexes();
          message = `Found ${result.length} index(es)`;
          break;
        }

        case 'dropIndex': {
          const indexName = args[0];
          if (!indexName) throw new Error('dropIndex requires index name');
          await collection.dropIndex(indexName);
          result = { ok: 1 };
          message = `Index "${indexName}" dropped`;
          break;
        }

        case 'dropIndexes': {
          await collection.dropIndexes();
          result = { ok: 1 };
          message = `All indexes dropped on collection "${collName}"`;
          break;
        }

        case 'drop': {
          await collection.drop();
          result = true;
          message = `Collection "${collName}" dropped from Atlas`;
          break;
        }

        default:
          throw new Error(`Unsupported operation: db.${collName}.${operation}()`);
      }
    }

    // Save execution history to MongoDB permanently
    try {
      const appDb = mongoClient.db('manideep_practice_app');
      await appDb.collection('command_histories').insertOne({
        rollNumber: session.rollNumber,
        command: cmdStr,
        timestamp: new Date(),
        success: true
      });
    } catch {}

    res.json({
      success: true,
      result,
      message,
      documentCount,
      executionTime: Date.now() - startTime
    });

  } catch (error) {
    // Save failed execution history to MongoDB permanently
    try {
      const mongoClient = await getMongoClient();
      const appDb = mongoClient.db('manideep_practice_app');
      await appDb.collection('command_histories').insertOne({
        rollNumber: session.rollNumber,
        command: cmdStr,
        timestamp: new Date(),
        success: false
      });
    } catch {}

    res.json({
      success: false,
      error: error.message || String(error),
      executionTime: Date.now() - startTime
    });
  }
});

router.get('/history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
    const session = parseToken(token);
    if (!session) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

    const mongoClient = await getMongoClient();
    const appDb = mongoClient.db('manideep_practice_app');
    const histories = await appDb.collection('command_histories')
      .find({ rollNumber: session.rollNumber })
      .sort({ timestamp: -1 })
      .limit(1000)
      .toArray();

    const formatted = histories.map(h => ({
      id: h._id.toString(),
      command: h.command,
      timestamp: h.timestamp,
      success: !!h.success
    }));

    res.json({ success: true, history: formatted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch history' });
  }
});


// 8. Database collections explorer
router.get('/collections', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
    const session = parseToken(token);
    if (!session) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const mongoClient = await getMongoClient();
    const cleanRoll = session.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const userDbName = `user_db_${cleanRoll}`;
    const userDb = mongoClient.db(userDbName);

    const collections = await userDb.listCollections().toArray();
    const filtered = collections.filter(c => !c.name.startsWith('system.'));

    const collectionInfo = await Promise.all(
      filtered.map(async (col) => {
        const count = await userDb.collection(col.name).countDocuments();
        return { name: col.name, count };
      })
    );

    res.json({ success: true, dbName: userDbName, collections: collectionInfo });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to list collections.' });
  }
});

router.get('/collections/:name', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
    const session = parseToken(token);
    if (!session) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { name } = req.params;
    const limitParam = req.query.limit ? parseInt(req.query.limit) : 0;
    const mongoClient = await getMongoClient();
    const cleanRoll = session.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const userDb = mongoClient.db(`user_db_${cleanRoll}`);

    const cursor = limitParam > 0
      ? userDb.collection(name).find({}).limit(limitParam)
      : userDb.collection(name).find({});
    const documents = await cursor.toArray();
    const count = await userDb.collection(name).countDocuments();

    res.json({ success: true, documents, count, collection: name });
  } catch {
    res.status(500).json({ success: false, message: `Failed to fetch documents from "${req.params.name}".` });
  }
});

// 9. Health Check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', storage: 'MongoDB Atlas', mode: 'Vercel Serverless Function' });
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api', router);
app.use('/', router);

module.exports = app;
