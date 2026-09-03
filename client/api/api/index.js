
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const JSON5 = require('json5');
const { MongoClient, ObjectId } = require('mongodb');
const vm = require('vm');


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
  colleges: ['GMRIT College, Vizianagaram'],
  branches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & DS', 'CSE (Data Science)'],
  years: ['I Year', 'II Year', 'III Year', 'IV Year']
};

function splitMongoCommands(script) {
  const commands = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;
  let current = '';

  const str = script.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const next = i + 1 < str.length ? str[i + 1] : '';
    const prev = i > 0 ? str[i - 1] : '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (!inString) {
      if (ch === '/' && next === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    if (inString) {
      current += ch;
      if (ch === stringChar && prev !== '\\') inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '{' || ch === '[') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
      current += ch;
      continue;
    }

    if (ch === ';' && depth === 0) {
      if (current.trim()) commands.push(current.trim());
      current = '';
      continue;
    }

    if (ch === '\n' && depth === 0) {
      const remaining = str.slice(i + 1).trimStart();
      if (
        remaining.startsWith('db.') ||
        remaining.startsWith('show ') ||
        remaining.startsWith('use ') ||
        remaining.startsWith('help')
      ) {
        if (current.trim()) commands.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) commands.push(current.trim());
  return commands;
}

function parseMongoValue(val) {
  const trimmed = val.trim();
  if (!trimmed) return undefined;

  try {
    return JSON5.parse(trimmed);
  } catch {
    try {
      const sandbox = {
        ObjectId: (id) => id ? new ObjectId(id) : new ObjectId(),
        ISODate: (d) => d ? new Date(d) : new Date(),
        Date: Date,
        NumberInt: (n) => parseInt(n, 10),
        NumberLong: (n) => parseInt(n, 10),
        NumberDecimal: (n) => parseFloat(n),
        RegExp: RegExp
      };
      return vm.runInNewContext(`(${trimmed})`, sandbox, { timeout: 1000 });
    } catch {
      return trimmed;
    }
  }
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

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
      current += ch;
      continue;
    }

    if (ch === ',' && depth === 0) {
      if (current.trim()) args.push(parseMongoValue(current.trim()));
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) args.push(parseMongoValue(current.trim()));
  return args;
}

function parseMongoCommand(commandStr) {
  let cmd = commandStr.trim().replace(/;\s*$/, '');

  if (!cmd.startsWith('db.')) {
    throw new Error('Invalid command format. Commands must start with "db." (e.g. db.students.find())');
  }

  const parts = [];
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let current = '';

  const rest = cmd.slice(3);

  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    const prev = i > 0 ? rest[i - 1] : '';

    if (inString) {
      current += ch;
      if (ch === stringChar && prev !== '\\') inString = false;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '{' || ch === '[') {
      depth++;
      current += ch;
      continue;
    }

    if (ch === ')' || ch === '}' || ch === ']') {
      depth--;
      current += ch;
      continue;
    }

    if (ch === '.' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  if (parts.length === 0) {
    throw new Error('Empty database command');
  }

  let collection = '';
  let operation = '';
  let args = [];
  const chain = [];

  let startIndex = 0;
  if (parts[0].startsWith('getCollection(')) {
    const m = parts[0].match(/^getCollection\(([\s\S]*)\)$/);
    if (m) {
      collection = m[1].replace(/^["'`]|["'`]$/g, '').trim();
      startIndex = 1;
    }
  } else if (!parts[0].includes('(')) {
    collection = parts[0];
    startIndex = 1;
  } else {
    collection = '';
    startIndex = 0;
  }

  if (startIndex >= parts.length) {
    throw new Error(`Invalid command: incomplete expression after "db.${collection}"`);
  }

  const opPart = parts[startIndex];
  const opMatch = opPart.match(/^(\w+)\s*\(([\s\S]*)\)$/);
  if (!opMatch) {
    throw new Error(`Invalid method call: ${opPart}`);
  }

  operation = opMatch[1];
  args = parseArgs(opMatch[2]);

  for (let i = startIndex + 1; i < parts.length; i++) {
    const chainPart = parts[i];
    const cMatch = chainPart.match(/^(\w+)\s*\(([\s\S]*)\)$/);
    if (cMatch) {
      chain.push({
        method: cMatch[1],
        args: parseArgs(cMatch[2])
      });
    }
  }

  return { collection, operation, args, chain };
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
        colleges: (opt.colleges && opt.colleges.length > 0) ? opt.colleges : DEFAULT_OPTIONS.colleges,
        branches: (opt.branches && opt.branches.length > 0) ? opt.branches : DEFAULT_OPTIONS.branches,
        years: (opt.years && opt.years.length > 0) ? opt.years : DEFAULT_OPTIONS.years
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

    // If only 1 college is placed, automatically update all existing students to this official college
    if (Array.isArray(colleges) && colleges.length === 1 && colleges[0]) {
      const usersColl = client.db('manideep_practice_app').collection('users');
      await usersColl.updateMany(
        { isAdmin: { $ne: true }, collegeName: { $ne: colleges[0] } },
        { $set: { collegeName: colleges[0], updatedAt: new Date() } }
      );
    }

    res.json({ success: true, message: 'Dropdown options saved & student colleges updated successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update options: ' + error.message });
  }
});

// ADMIN: Explicitly Sync All Students to Current Active College Option
router.post('/admin/students/sync-college', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const { targetCollege, fromCollege } = req.body;
    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');
    const optionsColl = client.db('manideep_practice_app').collection('options');

    let collegeToSet = targetCollege;
    if (!collegeToSet) {
      const optDoc = await optionsColl.findOne({ _id: 'dropdown_options' });
      collegeToSet = optDoc?.colleges?.[0] || 'GMRIT College, Vizianagaram';
    }

    const filter = { isAdmin: { $ne: true } };
    if (fromCollege) {
      filter.collegeName = fromCollege;
    }

    const resUpdate = await usersColl.updateMany(filter, {
      $set: { collegeName: collegeToSet, updatedAt: new Date() }
    });

    res.json({
      success: true,
      message: `Successfully synchronized ${resUpdate.modifiedCount} student(s) to "${collegeToSet}"`,
      modifiedCount: resUpdate.modifiedCount,
      college: collegeToSet
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to sync students: ' + error.message });
  }
});

// Presence: Heartbeat endpoint
router.post('/heartbeat', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    const { lastActive, isIdle } = req.body;
    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');

    const now = new Date();
    const activeDate = lastActive ? new Date(lastActive) : now;

    await usersColl.updateOne(
      { rollNumber: session.rollNumber },
      {
        $set: {
          lastHeartbeat: now,
          lastActive: activeDate,
          isIdle: !!isIdle,
          isOnline: true
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/heartbeat/offline', async (req, res) => {
  try {
    let token = req.body && req.body.token;
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    const session = parseToken(token);
    if (session) {
      const client = await getMongoClient();
      const usersColl = client.db('manideep_practice_app').collection('users');
      await usersColl.updateOne(
        { rollNumber: session.rollNumber },
        { $set: { isOnline: false, lastHeartbeat: new Date(0) } }
      );
    }
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// 6. Admin students with Live Presence Tracking & Workout Stats
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
    const historyColl = client.db('manideep_practice_app').collection('command_histories');
    const optionsColl = client.db('manideep_practice_app').collection('options');

    const optDoc = await optionsColl.findOne({ _id: 'dropdown_options' });
    const currentColleges = (optDoc?.colleges && optDoc.colleges.length > 0) ? optDoc.colleges : DEFAULT_OPTIONS.colleges;
    const singleCollege = currentColleges.length === 1 ? currentColleges[0] : null;

    const students = await usersColl.find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray();

    // Aggregate workout statistics per student
    let workoutStats = [];
    try {
      workoutStats = await historyColl.aggregate([
        {
          $group: {
            _id: { $toUpper: '$rollNumber' },
            totalCommands: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$success', true] }, 1, 0] } },
            failCount: { $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } },
            lastWorkout: { $max: '$timestamp' }
          }
        }
      ]).toArray();
    } catch {}

    const workoutMap = new Map();
    workoutStats.forEach(w => {
      if (w._id) workoutMap.set(String(w._id).toUpperCase(), w);
    });

    const nowMs = Date.now();
    const studentsWithPresence = students.map(s => {
      const lastHbMs = s.lastHeartbeat ? new Date(s.lastHeartbeat).getTime() : 0;
      const lastActMs = s.lastActive ? new Date(s.lastActive).getTime() : lastHbMs;

      const isHeartbeatActive = (nowMs - lastHbMs) < 65000 && s.isOnline !== false;
      const idleMs = Math.max(0, nowMs - lastActMs);
      const idleMins = Math.floor(idleMs / 60000);

      let presenceStatus = 'offline';
      if (isHeartbeatActive) {
        if (s.isIdle || idleMs >= 5 * 60 * 1000) {
          presenceStatus = 'idle';
        } else {
          presenceStatus = 'online';
        }
      }

      const cleanRoll = String(s.rollNumber).trim().toUpperCase();
      const w = workoutMap.get(cleanRoll) || { totalCommands: 0, successCount: 0, failCount: 0, lastWorkout: null };

      let resolvedCollege = s.collegeName;
      if (singleCollege && (!resolvedCollege || resolvedCollege === 'PBR VITS' || !currentColleges.includes(resolvedCollege))) {
        resolvedCollege = singleCollege;
      }

      return {
        ...s,
        collegeName: resolvedCollege,
        presenceStatus,
        idleMinutes: idleMins,
        lastActiveTime: s.lastActive || s.lastHeartbeat || s.createdAt,
        workout: {
          total: w.totalCommands,
          success: w.successCount,
          failed: w.failCount,
          lastWorkoutTime: w.lastWorkout
        }
      };
    });

    res.json({ success: true, students: studentsWithPresence });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch students: ' + error.message });
  }
});

// ADMIN: Get Individual Student Command History (Case-insensitive)
router.get('/admin/students/:roll/history', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const { roll } = req.params;
    const cleanRoll = String(roll).trim();
    const client = await getMongoClient();
    const historyColl = client.db('manideep_practice_app').collection('command_histories');
    const history = await historyColl
      .find({
        rollNumber: { $regex: new RegExp(`^${cleanRoll}$`, 'i') }
      })
      .sort({ timestamp: -1 })
      .limit(500)
      .toArray();

    res.json({ success: true, rollNumber: cleanRoll.toUpperCase(), history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch student history: ' + error.message });
  }
});

// ADMIN: Live Workout Stream of All Students
router.get('/admin/workouts', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const client = await getMongoClient();
    const historyColl = client.db('manideep_practice_app').collection('command_histories');
    const { roll, limit = '150' } = req.query;

    const query = {};
    if (roll && typeof roll === 'string' && roll.trim() && roll !== 'all') {
      query.rollNumber = { $regex: new RegExp(`^${roll.trim()}$`, 'i') };
    }

    const workouts = await historyColl
      .find(query)
      .sort({ timestamp: -1 })
      .limit(Math.min(parseInt(limit, 10) || 150, 500))
      .toArray();

    res.json({ success: true, workouts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch workouts: ' + error.message });
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

async function executeSingleCommand(cmdStr, session, overrideDb) {
  const startTime = Date.now();
  const lowerCmd = cmdStr.toLowerCase();

  try {
    const mongoClient = await getMongoClient();
    const cleanRoll = session.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '_');
    let activeDbName = overrideDb || `user_db_${cleanRoll}`;
    let db = mongoClient.db(activeDbName);

    let result;
    let message = 'Executed successfully';
    let documentCount;

    // 1. Show Databases
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
    // 2. Show Collections
    else if (lowerCmd === 'show collections' || lowerCmd === 'show tables') {
      const collections = await db.listCollections().toArray();
      const names = collections.map(c => c.name).filter(n => !n.startsWith('system.'));
      result = names.length > 0 ? names.join('\n') : '(No collections found)';
      message = `Found ${names.length} collection(s) in "${activeDbName}"`;
    }
    // 3. Show Current Database
    else if (lowerCmd === 'db') {
      result = activeDbName;
      message = `Active Database: ${activeDbName}`;
    }
    // 4. Show Users
    else if (lowerCmd === 'show users') {
      const usersColl = mongoClient.db('manideep_practice_app').collection('users');
      result = await usersColl.find({}, { projection: { password: 0 } }).toArray();
      message = `Found ${result.length} user(s)`;
    }
    // 5. Help
    else if (lowerCmd === 'help' || lowerCmd === 'db.help()') {
      result = `MongoDB Shell Help & Commands Reference:
• db.createCollection("<name>") — Create a new collection
• db.<coll>.insertOne({ ... }) — Insert a single document
• db.<coll>.insertMany([ { ... } ]) — Insert multiple documents
• db.<coll>.find(<filter>, <proj>).sort({ field: 1 }).limit(n) — Query & sort documents
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
    // 6. Switch Database
    else if (lowerCmd.startsWith('use ')) {
      const targetDb = cmdStr.substring(4).trim();
      activeDbName = targetDb;
      db = mongoClient.db(activeDbName);
      result = `switched to db ${targetDb}`;
      message = `Active database: ${targetDb}`;
    }
    // 7. Server Status / Info
    else if (lowerCmd === 'db.serverstatus()' || lowerCmd === 'db.serverbuildinfo()') {
      result = { host: 'cluster0.aqcfcn9.mongodb.net', version: '7.0.12', process: 'mongod', ok: 1 };
      message = 'Server information fetched from Atlas';
    }
    // 8. Database level ops
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
      const commandObj = parsed.args[0];
      if (!commandObj) throw new Error('runCommand requires a command object');
      result = await db.command(commandObj);
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
      const userObj = parsed.args[0];
      result = { ok: 1, user: userObj?.user || 'created' };
      message = 'User created successfully';
    }
    else if (cmdStr.startsWith('db.dropUser')) {
      const parsed = parseMongoCommand(cmdStr);
      result = { ok: 1, user: parsed.args[0] };
      message = `User "${parsed.args[0]}" dropped`;
    }
    else if (cmdStr.startsWith('db.getCollectionNames') || cmdStr.startsWith('db.listCollections')) {
      const collections = await db.listCollections().toArray();
      result = collections.map(c => c.name);
      message = `Found ${result.length} collection(s)`;
    }
    // 9. Collection & Query level operations
    else {
      const { collection: collName, operation, args, chain } = parseMongoCommand(cmdStr);

      if (!collName && operation !== 'help') {
        throw new Error(`Unsupported database command: ${cmdStr}`);
      }

      const collection = db.collection(collName);

      switch (operation) {
        case 'help': {
          result = `Collection methods for db.${collName}:\n• find(), findOne()\n• insertOne(), insertMany()\n• updateOne(), updateMany(), replaceOne()\n• deleteOne(), deleteMany()\n• aggregate()\n• createIndex(), getIndexes(), dropIndex()\n• stats(), drop()`;
          message = `Help for collection ${collName}`;
          break;
        }

        case 'createCollection': {
          const targetName = (args[0] && typeof args[0] === 'string') ? args[0] : collName;
          if (!targetName) throw new Error('createCollection requires a collection name string');
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
            if (cm.method === 'count' || cm.method === 'countDocuments') {
              const allDocs = await cursor.toArray();
              result = allDocs.length;
              message = `Count: ${result}`;
              break;
            }
            if (cm.method === 'explain') {
              result = await cursor.explain(cm.args[0] || 'queryPlanner');
              message = 'Query explain execution plan fetched';
              break;
            }
          }

          if (result === undefined) {
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

        case 'findOneAndUpdate': {
          const filter = args[0] || {};
          const update = args[1];
          const options = args[2] || {};
          result = await collection.findOneAndUpdate(filter, update, options);
          message = 'findOneAndUpdate executed';
          break;
        }

        case 'findOneAndDelete': {
          const filter = args[0] || {};
          const options = args[1] || {};
          result = await collection.findOneAndDelete(filter, options);
          message = 'findOneAndDelete executed';
          break;
        }

        case 'findOneAndReplace': {
          const filter = args[0] || {};
          const replacement = args[1];
          const options = args[2] || {};
          result = await collection.findOneAndReplace(filter, replacement, options);
          message = 'findOneAndReplace executed';
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
          const options = args[2] || {};
          if (!update) throw new Error('updateOne requires filter and update arguments');
          const res = await collection.updateOne(filter, update, options);
          result = { acknowledged: res.acknowledged, matchedCount: res.matchedCount, modifiedCount: res.modifiedCount, upsertedId: res.upsertedId };
          message = `Matched ${res.matchedCount}, modified ${res.modifiedCount} document(s)`;
          break;
        }

        case 'updateMany': {
          const filter = args[0] || {};
          const update = args[1];
          const options = args[2] || {};
          if (!update) throw new Error('updateMany requires filter and update arguments');
          const res = await collection.updateMany(filter, update, options);
          result = { acknowledged: res.acknowledged, matchedCount: res.matchedCount, modifiedCount: res.modifiedCount, upsertedId: res.upsertedId };
          message = `Matched ${res.matchedCount}, modified ${res.modifiedCount} document(s)`;
          break;
        }

        case 'replaceOne': {
          const filter = args[0] || {};
          const replacement = args[1];
          const options = args[2] || {};
          if (!replacement) throw new Error('replaceOne requires filter and replacement arguments');
          const res = await collection.replaceOne(filter, replacement, options);
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

        case 'bulkWrite': {
          const ops = args[0];
          if (!Array.isArray(ops)) throw new Error('bulkWrite requires an array of operations');
          const res = await collection.bulkWrite(ops, args[1] || {});
          result = res;
          message = `Bulk write executed (${res.insertedCount || 0} inserted, ${res.modifiedCount || 0} modified, ${res.deletedCount || 0} deleted)`;
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

        case 'countDocuments':
        case 'count': {
          const filter = args[0] || {};
          result = await collection.countDocuments(filter);
          message = `Count: ${result}`;
          break;
        }

        case 'distinct': {
          const field = args[0];
          const filter = args[1] || {};
          if (!field) throw new Error('distinct requires a field name string');
          result = await collection.distinct(field, filter);
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

    const executionTime = Date.now() - startTime;

    try {
      const appDb = mongoClient.db('manideep_practice_app');
      await appDb.collection('command_histories').insertOne({
        rollNumber: String(session.rollNumber).trim().toUpperCase(),
        command: cmdStr,
        timestamp: new Date(),
        success: true,
        executionTime,
        message,
        documentCount: documentCount !== undefined ? documentCount : (Array.isArray(result) ? result.length : undefined)
      });
    } catch {}

    return {
      success: true,
      command: cmdStr,
      result,
      message,
      documentCount,
      executionTime
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;

    try {
      const mongoClient = await getMongoClient();
      const appDb = mongoClient.db('manideep_practice_app');
      await appDb.collection('command_histories').insertOne({
        rollNumber: String(session.rollNumber).trim().toUpperCase(),
        command: cmdStr,
        timestamp: new Date(),
        success: false,
        executionTime,
        error: error.message || String(error)
      });
    } catch {}

    return {
      success: false,
      command: cmdStr,
      error: error.message || String(error),
      executionTime
    };
  }
}

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

  const commands = splitMongoCommands(command);
  if (commands.length === 0) {
    res.json({ success: false, error: 'No valid command found.', executionTime: 0 });
    return;
  }

  // Single command execution
  if (commands.length === 1) {
    const outcome = await executeSingleCommand(commands[0], session, overrideDb);
    res.json(outcome);
    return;
  }

  // Multi-command sequential execution
  const totalStart = Date.now();
  const multipleResults = [];
  let lastResult = null;
  let allSuccess = true;
  let successCount = 0;

  for (const cmd of commands) {
    const outcome = await executeSingleCommand(cmd, session, overrideDb);
    multipleResults.push(outcome);
    if (outcome.success) {
      successCount++;
      lastResult = outcome.result;
    } else {
      allSuccess = false;
    }
  }

  const totalTime = Date.now() - totalStart;

  res.json({
    success: allSuccess,
    command: commands.join(';\n'),
    message: `Executed ${successCount}/${commands.length} command(s) successfully`,
    result: lastResult !== null ? lastResult : multipleResults.map(r => r.result || r.message || r.error),
    multipleResults,
    executionTime: totalTime
  });
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
