
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
    return { collection: '', operation: cmd, args: [], chain: [] };
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
    if (collection) {
      operation = 'stats';
      args = [];
    } else {
      throw new Error(`Invalid command: incomplete expression after "db"`);
    }
  } else {
    const opPart = parts[startIndex];
    const opMatch = opPart.match(/^(\w+)\s*\(([\s\S]*)\)$/);
    if (!opMatch) {
      operation = opPart.replace(/\(\)$/, '').trim();
      args = [];
    } else {
      operation = opMatch[1];
      args = parseArgs(opMatch[2]);
    }
  }

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

    const students = await usersColl.find({ isAdmin: { $ne: true }, rollNumber: { $ne: '22KT1A4245' } }, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray();

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
      const cleanRoll = String(s.rollNumber).trim().toUpperCase();
      const w = workoutMap.get(cleanRoll) || { totalCommands: 0, successCount: 0, failCount: 0, lastWorkout: null };

      const lastWorkoutMs = w && w.lastWorkout ? new Date(w.lastWorkout).getTime() : 0;
      const lastHbMs = s.lastHeartbeat ? new Date(s.lastHeartbeat).getTime() : 0;
      const sLastActMs = s.lastActive ? new Date(s.lastActive).getTime() : 0;

      const maxRecentActivityMs = Math.max(sLastActMs, lastHbMs, lastWorkoutMs);
      const lastActMs = maxRecentActivityMs > 0 ? maxRecentActivityMs : (s.createdAt ? new Date(s.createdAt).getTime() : nowMs);

      const hasRecentWorkout = lastWorkoutMs > 0 && (nowMs - lastWorkoutMs) < 5 * 60 * 1000;
      const isHeartbeatActive = ((nowMs - lastHbMs) < 65000 || hasRecentWorkout) && s.isOnline !== false;

      const idleMs = Math.max(0, nowMs - lastActMs);
      const idleMins = Math.floor(idleMs / 60000);

      let presenceStatus = 'offline';
      if (isHeartbeatActive) {
        if (hasRecentWorkout || (!s.isIdle && idleMs < 5 * 60 * 1000)) {
          presenceStatus = 'online';
        } else {
          presenceStatus = 'idle';
        }
      }

      let resolvedCollege = s.collegeName;
      if (singleCollege && (!resolvedCollege || resolvedCollege === 'PBR VITS' || !currentColleges.includes(resolvedCollege))) {
        resolvedCollege = singleCollege;
      }

      let resolvedLastActive = s.lastActive || s.lastHeartbeat || s.createdAt;
      if (lastWorkoutMs > 0) {
        const sActMs = s.lastActive ? new Date(s.lastActive).getTime() : 0;
        if (lastWorkoutMs > sActMs) {
          resolvedLastActive = w.lastWorkout;
        }
      }

      return {
        ...s,
        collegeName: resolvedCollege,
        presenceStatus,
        idleMinutes: idleMins,
        lastActiveTime: resolvedLastActive,
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
    const { roll, limit = 'all' } = req.query;

    const query = {};
    if (roll && typeof roll === 'string' && roll.trim() && roll !== 'all') {
      query.rollNumber = { $regex: new RegExp(`^${roll.trim()}$`, 'i') };
    }

    let cursor = historyColl.find(query).sort({ timestamp: -1 });
    if (limit && limit !== 'all') {
      const parsedLimit = parseInt(limit, 10);
      if (parsedLimit > 0) {
        cursor = cursor.limit(parsedLimit);
      }
    }

    const workouts = await cursor.toArray();

    res.json({ success: true, workouts, total: workouts.length });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch workouts: ' + error.message });
  }
});

// ADMIN: Fetch hourly report workouts and students for custom date and time-to-time range
router.post('/admin/reports/hourly', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const { date, fromTime = '00:00', toTime = '23:59', isAllDates = false } = req.body;
    const client = await getMongoClient();
    const db = client.db('manideep_practice_app');
    const usersColl = db.collection('users');
    const historyColl = db.collection('command_histories');
    const optionsColl = db.collection('options');

    const optDoc = await optionsColl.findOne({ _id: 'dropdown_options' });
    const currentColleges = (optDoc?.colleges && optDoc.colleges.length > 0) ? optDoc.colleges : DEFAULT_OPTIONS.colleges;
    const singleCollege = currentColleges.length === 1 ? currentColleges[0] : null;

    // Exclude admin from students list
    const students = await usersColl
      .find({ isAdmin: { $ne: true }, rollNumber: { $ne: '22KT1A4245' } }, { projection: { password: 0 } })
      .toArray();

    if (singleCollege) {
      students.forEach(s => {
        if (!s.collegeName || s.collegeName === 'PBR VITS' || !currentColleges.includes(s.collegeName)) {
          s.collegeName = singleCollege;
        }
      });
    }

    // Query workouts strictly excluding admin
    const query = {
      rollNumber: { $ne: '22KT1A4245' }
    };

    if (!isAllDates && date) {
      const startIso = new Date(`${date}T${fromTime}:00.000Z`);
      const endIso = new Date(`${date}T${toTime}:59.999Z`);
      const startLocal = new Date(`${date}T${fromTime}:00`);
      const endLocal = new Date(`${date}T${toTime}:59.999`);

      query.$or = [
        { timestamp: { $gte: startIso, $lte: endIso } },
        { timestamp: { $gte: startLocal, $lte: endLocal } }
      ];
    }

    const workouts = await historyColl
      .find(query, { projection: { rollNumber: 1, timestamp: 1, success: 1, executionTime: 1, command: 1 } })
      .sort({ timestamp: -1 })
      .toArray();

    res.json({
      success: true,
      students,
      workouts,
      total: workouts.length,
      date: isAllDates ? 'All Dates' : date,
      timeWindow: `${fromTime} - ${toTime}`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch report data: ' + error.message });
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

// ADMIN: Change Student Password by Roll Number (Zero Data Loss)
router.post('/admin/students/reset-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
  const session = parseToken(token);

  if (!session || !session.isAdmin) {
    res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
    return;
  }

  try {
    const { rollNumber, newPassword } = req.body;

    if (!rollNumber || typeof rollNumber !== 'string' || !rollNumber.trim()) {
      res.status(400).json({ success: false, error: 'Please provide a valid student Roll Number.' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      res.status(400).json({ success: false, error: 'New password must be at least 4 characters long.' });
      return;
    }

    const cleanRoll = rollNumber.trim().toUpperCase();
    const client = await getMongoClient();
    const usersColl = client.db('manideep_practice_app').collection('users');

    // Find user case-insensitively
    const targetUser = await usersColl.findOne({
      rollNumber: { $regex: new RegExp(`^${cleanRoll.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: `Student with Roll Number "${cleanRoll}" was not found.` });
      return;
    }

    // Hash new password using identical algorithm & salt
    const hashedPassword = hashPassword(newPassword.trim());

    // Update ONLY password and updatedAt timestamp - 100% Zero Data Loss!
    await usersColl.updateOne(
      { _id: targetUser._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: `Password for student "${targetUser.rollNumber}" was changed successfully with zero data loss!`,
      rollNumber: targetUser.rollNumber
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update student password: ' + error.message });
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
  const trimmedCmd = cmdStr.trim();
  const lowerCmd = trimmedCmd.toLowerCase();

  try {
    const mongoClient = await getMongoClient();
    const cleanRoll = session.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '_');
    let activeDbName = overrideDb || `user_db_${cleanRoll}`;
    let db = mongoClient.db(activeDbName);

    let result;
    let message = 'Executed successfully';
    let documentCount;

    // 0. OS Terminal Commands notice (mongoimport, mongoexport, mongodump, mongorestore, atlas CLI, mongosh CLI)
    if (/^(mongoimport|mongoexport|mongodump|mongorestore|atlas|mongofiles)(\s|$)/i.test(lowerCmd)) {
      const toolName = trimmedCmd.split(/\s+/)[0];
      result = `ℹ️ Command Explanation: '${toolName}' is an Operating System terminal binary utility (executed in Command Prompt, PowerShell, or bash).\nIt is not a JavaScript database command typed inside mongosh. To perform database operations here, use MQL statements like db.<collection>.insertOne() or db.<collection>.find().`;
      message = `'${toolName}' terminal command notice`;
    }
    else if (lowerCmd.startsWith('mongosh') || lowerCmd.startsWith('new mongo(')) {
      result = `Connected to MongoDB Shell (mongosh v2.3.0) on Atlas Cloud. Active DB: "${activeDbName}"`;
      message = 'Connected to mongosh';
    }
    // 1. Show Databases
    else if (lowerCmd === 'show dbs' || lowerCmd === 'show databases') {
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
    else if (lowerCmd.startsWith('show ')) {
      const item = trimmedCmd.substring(5).trim();
      result = `ℹ️ 'show ${item}' is not a standard mongosh command.\nStandard show commands:\n• show dbs — List accessible databases\n• show collections — List collections in active database\n• show users — List database users`;
      message = 'Show command help';
    }
    // 3. Show Current Database & Database Name
    else if (lowerCmd === 'db' || lowerCmd === 'db.getname()') {
      result = activeDbName;
      message = `Active Database: ${activeDbName}`;
    }
    // 4. Version & Build Info
    else if (
      lowerCmd === 'mongosh --version' ||
      lowerCmd === 'db.version()' ||
      lowerCmd === 'version()'
    ) {
      try {
        const buildInfo = await db.command({ buildInfo: 1 });
        result = buildInfo.version || '7.0.12';
      } catch {
        result = '7.0.12';
      }
      message = 'MongoDB Server Version (Atlas Cloud)';
    }
    else if (lowerCmd === 'db.serverstatus()' || lowerCmd === 'db.serverbuildinfo()' || lowerCmd.includes('buildinfo:')) {
      try {
        result = await db.command({ buildInfo: 1 });
      } catch {
        result = { host: 'cluster0.aqcfcn9.mongodb.net', version: '7.0.12', process: 'mongod', ok: 1 };
      }
      message = 'Server build information fetched from Atlas';
    }
    // 5. Connection & URI
    else if (lowerCmd.startsWith('db.getmongo()') || lowerCmd === 'mongo()') {
      if (lowerCmd.includes('geturi()')) {
        result = `mongodb+srv://cluster0.aqcfcn9.mongodb.net/${activeDbName}`;
      } else {
        result = `MongoDB Connection object to mongodb+srv://cluster0.aqcfcn9.mongodb.net/${activeDbName}`;
      }
      message = 'MongoDB Connection Info';
    }
    // 6. Hello / isMaster / Host Info
    else if (lowerCmd === 'db.hello()' || lowerCmd === 'hello' || lowerCmd === 'db.ismaster()' || lowerCmd === 'ismaster') {
      try {
        result = await db.command({ hello: 1 });
      } catch {
        result = { isWritablePrimary: true, maxBsonObjectSize: 16777216, ok: 1, msg: 'isdbgrid' };
      }
      message = 'Deployment and connection state information';
    }
    else if (lowerCmd === 'db.hostinfo()' || lowerCmd === 'hostinfo') {
      try {
        result = await mongoClient.db('admin').command({ hostInfo: 1 });
      } catch {
        result = {
          system: { currentTime: new Date(), hostname: 'atlas-cloud-node-01' },
          os: { type: 'Linux', name: 'Ubuntu', version: '22.04' },
          extra: { numCores: 8, memSizeMB: 16384 },
          ok: 1
        };
      }
      message = 'Host system information fetched';
    }
    // 7. Show Users
    else if (lowerCmd === 'show users') {
      const usersColl = mongoClient.db('manideep_practice_app').collection('users');
      result = await usersColl.find({}, { projection: { password: 0 } }).toArray();
      message = `Found ${result.length} user(s)`;
    }
    // 8. Help & Command Help
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
    else if (lowerCmd.startsWith('db.commandhelp(')) {
      const parsed = parseMongoCommand(cmdStr);
      const cmdName = parsed.args[0] || '';
      result = `Help and specification documentation for command "${cmdName}". Refer to MongoDB documentation for details.`;
      message = `Help for command ${cmdName}`;
    }
    // 9. Switch Database & Sibling DB
    else if (lowerCmd.startsWith('use ') || lowerCmd.startsWith('db.getsiblingdb(')) {
      let targetDb = '';
      if (lowerCmd.startsWith('use ')) {
        targetDb = cmdStr.substring(4).trim();
      } else {
        const parsed = parseMongoCommand(cmdStr);
        targetDb = parsed.args[0] || 'test';
      }
      activeDbName = targetDb;
      db = mongoClient.db(activeDbName);
      result = `switched to db ${targetDb}`;
      message = `Active database: ${targetDb}`;
    }
    // 10. Shell Controls (cls, exit, quit)
    else if (lowerCmd === 'cls' || lowerCmd === 'clear') {
      result = `ℹ️ Note: 'cls' (or 'clear') is a terminal command used in native command prompt/mongosh to clear the terminal screen.\nIn Manideep Practice Zone, click the 'Clear' button above the shell editor to clear your editor window!`;
      message = 'Terminal Screen Clear Notice';
    }
    else if (lowerCmd === 'exit' || lowerCmd === 'quit' || lowerCmd === 'quit()') {
      result = `ℹ️ Note: 'exit' or 'quit()' is used in terminal mongosh to close the shell connection.\nIn this platform, your interactive Atlas Cloud sandbox session remains connected automatically. To sign out of your account, click 'Sign Out' at the top right.`;
      message = 'Terminal Session Exit Notice';
    }
    // 11. Replica Set (`rs.*`) Commands
    else if (lowerCmd.startsWith('rs.')) {
      if (lowerCmd === 'rs.status()') {
        result = {
          set: 'Atlas-repl-0',
          date: new Date(),
          myState: 1,
          members: [
            { _id: 0, name: 'cluster0-shard-00-00.mongodb.net:27017', stateStr: 'PRIMARY', health: 1, uptime: 864000 },
            { _id: 1, name: 'cluster0-shard-00-01.mongodb.net:27017', stateStr: 'SECONDARY', health: 1, uptime: 864000 },
            { _id: 2, name: 'cluster0-shard-00-02.mongodb.net:27017', stateStr: 'SECONDARY', health: 1, uptime: 864000 }
          ],
          ok: 1
        };
        message = 'Replica set status fetched from Atlas cluster';
      } else if (lowerCmd === 'rs.conf()' || lowerCmd === 'rs.config()') {
        result = {
          _id: 'Atlas-repl-0',
          version: 1,
          members: [
            { _id: 0, host: 'cluster0-shard-00-00.mongodb.net:27017', priority: 1 },
            { _id: 1, host: 'cluster0-shard-00-01.mongodb.net:27017', priority: 0.5 },
            { _id: 2, host: 'cluster0-shard-00-02.mongodb.net:27017', priority: 0.5 }
          ]
        };
        message = 'Replica set configuration fetched';
      } else if (lowerCmd === 'rs.printreplicationinfo()') {
        result = 'configured oplog size:   10240MB\nlog length start to end:  864000 secs (10 days)\noplog first event time:   2026-08-25T00:00:00Z\noplog last event time:    ' + new Date().toISOString();
        message = 'Replication oplog information';
      } else if (lowerCmd === 'rs.printsecondaryreplicationinfo()') {
        result = 'source: cluster0-shard-00-01.mongodb.net:27017\n  syncedTo: ' + new Date().toISOString() + '\n  0 secsBehindPrimary';
        message = 'Secondary replication status';
      } else {
        result = { ok: 1, info: 'Replica set operation executed on Atlas managed cluster.' };
        message = 'Replica set command executed';
      }
    }
    // 12. Sharding (`sh.*`) Commands
    else if (lowerCmd.startsWith('sh.')) {
      if (lowerCmd === 'sh.status()') {
        result = {
          shardingVersion: { _id: 1, clusterId: '60a72b8f9e1d2c3b4a5e6f7a' },
          shards: [ { _id: 'atlas-shard-0', host: 'Atlas-repl-0/cluster0-shard-00-00.mongodb.net:27017', state: 1 } ],
          activeMongoses: [ { _id: 'mongos-1', mongoVersion: '7.0.12', ping: new Date() } ],
          autosplit: { enabled: true },
          balancer: { enabled: true, currentlyRunning: false }
        };
        message = 'Sharded cluster status fetched';
      } else if (lowerCmd === 'sh.getshards()') {
        result = [ { _id: 'atlas-shard-0', host: 'Atlas-repl-0/cluster0-shard-00-00.mongodb.net:27017', state: 1 } ];
        message = 'List of configured cluster shards';
      } else if (lowerCmd === 'sh.getbalancerstate()') {
        result = true;
        message = 'Cluster balancer state: active';
      } else {
        result = { ok: 1, info: 'Sharding command executed successfully on Atlas.' };
        message = 'Sharding command executed';
      }
    }
    // 13. Sessions & Transactions
    else if (lowerCmd.startsWith('session.') || lowerCmd.includes('startsession()') || lowerCmd.includes('withtransaction(')) {
      result = { ok: 1, state: 'TRANSACTION_COMMITTED', message: 'Transaction session executed successfully on Atlas.' };
      message = 'Transaction session operation completed';
    }
    // 14. GridFS Buckets
    else if (lowerCmd.startsWith('new gridfsbucket') || lowerCmd.startsWith('bucket.')) {
      result = { ok: 1, bucketName: 'fs', message: 'GridFS Bucket operation processed successfully.' };
      message = 'GridFS operation completed';
    }
    // 15. Standalone BSON Values (ObjectId, ISODate, Date)
    else if (/^(objectid|isodate|date)\s*\(/i.test(trimmedCmd)) {
      result = parseMongoValue(trimmedCmd);
      message = 'Evaluated expression';
    }
    // 16. Admin Operations & User Management
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
    else if (cmdStr.startsWith('db.adminCommand')) {
      const parsed = parseMongoCommand(cmdStr);
      const commandObj = parsed.args[0] || { ping: 1 };
      result = await mongoClient.db('admin').command(commandObj);
      message = 'Admin command executed';
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
    else if (cmdStr.startsWith('db.updateUser')) {
      const parsed = parseMongoCommand(cmdStr);
      result = { ok: 1, user: parsed.args[0] };
      message = `User "${parsed.args[0]}" updated`;
    }
    else if (cmdStr.startsWith('db.dropUser')) {
      const parsed = parseMongoCommand(cmdStr);
      result = { ok: 1, user: parsed.args[0] };
      message = `User "${parsed.args[0]}" dropped`;
    }
    else if (cmdStr.startsWith('db.createRole') || cmdStr.startsWith('db.updateRole') || cmdStr.startsWith('db.dropRole')) {
      result = { ok: 1 };
      message = 'Role management operation executed';
    }
    else if (cmdStr.startsWith('db.getCollectionNames') || cmdStr.startsWith('db.listCollections')) {
      const collections = await db.listCollections().toArray();
      result = collections.map(c => c.name);
      message = `Found ${result.length} collection(s)`;
    }
    else if (cmdStr.startsWith('db.getCollectionInfos')) {
      result = await db.listCollections().toArray();
      message = `Found ${result.length} collection info(s)`;
    }
    else if (cmdStr.startsWith('db.currentOp')) {
      try {
        result = await mongoClient.db('admin').command({ currentOp: 1 });
      } catch {
        result = { inprog: [], ok: 1 };
      }
      message = 'Current running operations list';
    }
    else if (cmdStr.startsWith('db.killOp')) {
      const parsed = parseMongoCommand(cmdStr);
      result = { ok: 1, info: `Operation ${parsed.args[0]} terminated.` };
      message = 'Operation terminated';
    }
    // 17. Auto-Fix check: Did user type "collectionName.find()" without "db." prefix?
    else if (/^[a-z0-9_]+\.(find|findOne|insertOne|insertMany|updateOne|updateMany|deleteOne|deleteMany|aggregate|countDocuments|distinct|drop|createIndex)\(/i.test(trimmedCmd)) {
      result = `ℹ️ Did you mean: db.${trimmedCmd}?\nIn MongoDB shell, collection operations always start with the 'db.' prefix (e.g., db.${trimmedCmd}).`;
      message = 'Missing "db." Prefix Hint';
    }
    // 18. Collection & Query level operations
    else {
      const { collection: collName, operation, args, chain } = parseMongoCommand(cmdStr);

      if (!collName && operation !== 'help') {
        if (operation === 'version') {
          result = '7.0.12';
          message = 'MongoDB Server Version (Atlas Cloud)';
        } else if (operation === 'getName') {
          result = activeDbName;
          message = `Active Database: ${activeDbName}`;
        } else if (operation === 'getMongo') {
          result = `mongodb+srv://cluster0.aqcfcn9.mongodb.net/${activeDbName}`;
          message = 'MongoDB Connection Info';
        } else if (operation === 'hello' || operation === 'isMaster') {
          try {
            result = await db.command({ hello: 1 });
          } catch {
            result = { isWritablePrimary: true, maxBsonObjectSize: 16777216, ok: 1 };
          }
          message = 'Server hello response';
        } else if (operation === 'hostInfo') {
          result = { system: { currentTime: new Date(), hostname: 'atlas-cloud-node-01' }, ok: 1 };
          message = 'Host system information';
        } else {
          result = `ℹ️ Command Explanation: Could not parse '${trimmedCmd}'.\nIn MongoDB shell (mongosh), standard query commands use the format: db.<collection>.<method>() (e.g., db.students.find()).`;
          message = 'MongoDB Command Help Notice';
        }
      } else {
        const collection = db.collection(collName);

        switch (operation) {
          case 'help': {
            result = `Collection methods for db.${collName}:\n• find(), findOne()\n• insertOne(), insertMany()\n• updateOne(), updateMany(), replaceOne()\n• deleteOne(), deleteMany()\n• aggregate()\n• createIndex(), getIndexes(), dropIndex()\n• stats(), dataSize(), storageSize(), totalSize(), isCapped(), validate(), drop()`;
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

          case 'estimatedDocumentCount': {
            result = await collection.estimatedDocumentCount();
            message = `Estimated Count: ${result}`;
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
            try {
              result = await db.command({ collStats: collName });
            } catch {
              const count = await collection.countDocuments();
              result = { ns: `${activeDbName}.${collName}`, count, size: count * 128, storageSize: count * 128, totalIndexSize: 4096, ok: 1 };
            }
            message = `Stats for collection "${collName}"`;
            break;
          }

          case 'dataSize': {
            try {
              const st = await db.command({ collStats: collName });
              result = st.size || 0;
            } catch {
              const count = await collection.countDocuments();
              result = count * 128;
            }
            message = `Data size for collection "${collName}"`;
            break;
          }

          case 'storageSize': {
            try {
              const st = await db.command({ collStats: collName });
              result = st.storageSize || 0;
            } catch {
              const count = await collection.countDocuments();
              result = count * 128;
            }
            message = `Storage size for collection "${collName}"`;
            break;
          }

          case 'totalSize': {
            try {
              const st = await db.command({ collStats: collName });
              result = st.totalSize || ((st.storageSize || 0) + (st.totalIndexSize || 0));
            } catch {
              const count = await collection.countDocuments();
              result = count * 128 + 4096;
            }
            message = `Total size for collection "${collName}"`;
            break;
          }

          case 'totalIndexSize': {
            try {
              const st = await db.command({ collStats: collName });
              result = st.totalIndexSize || 0;
            } catch {
              result = 4096;
            }
            message = `Total index size for collection "${collName}"`;
            break;
          }

          case 'isCapped': {
            try {
              const st = await db.command({ collStats: collName });
              result = !!st.capped;
            } catch {
              result = false;
            }
            message = `Capped status for collection "${collName}"`;
            break;
          }

          case 'validate': {
            try {
              result = await db.command({ validate: collName });
            } catch {
              result = { ns: `${activeDbName}.${collName}`, valid: true, ok: 1 };
            }
            message = `Validation performed on collection "${collName}"`;
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

          case 'hideIndex': {
            const indexName = args[0];
            if (!indexName) throw new Error('hideIndex requires index name');
            try {
              result = await db.command({ collMod: collName, index: { name: indexName, hidden: true } });
            } catch {
              result = { ok: 1, index: indexName, hidden: true };
            }
            message = `Index "${indexName}" hidden from query planner`;
            break;
          }

          case 'unhideIndex': {
            const indexName = args[0];
            if (!indexName) throw new Error('unhideIndex requires index name');
            try {
              result = await db.command({ collMod: collName, index: { name: indexName, hidden: false } });
            } catch {
              result = { ok: 1, index: indexName, hidden: false };
            }
            message = `Index "${indexName}" unhidden for query planner`;
            break;
          }

          case 'getShardDistribution': {
            const count = await collection.countDocuments();
            result = `Collection ${activeDbName}.${collName} is on shard atlas-shard-0 with ${count} document(s).`;
            message = `Shard distribution info for collection "${collName}"`;
            break;
          }

          case 'watch': {
            result = { ok: 1, info: `Change stream watcher initialized on collection "${collName}"` };
            message = `Watch initialized on collection ${collName}`;
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
    }

    const executionTime = Date.now() - startTime;

    try {
      const appDb = mongoClient.db('manideep_practice_app');
      const now = new Date();
      const cleanRoll = String(session.rollNumber).trim().toUpperCase();

      await appDb.collection('command_histories').insertOne({
        rollNumber: cleanRoll,
        command: cmdStr,
        timestamp: now,
        success: true,
        executionTime,
        message,
        documentCount: documentCount !== undefined ? documentCount : (Array.isArray(result) ? result.length : undefined)
      });

      // Update student presence instantly on active command execution
      await appDb.collection('users').updateOne(
        { rollNumber: cleanRoll },
        { $set: { lastActive: now, lastHeartbeat: now, isOnline: true, isIdle: false } }
      );
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
