import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getMongoClient } from '../db.js';

const router = Router();
const ADMIN_ROLL = '22KT1A4245';
const ADMIN_PASS = 'manideep';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'mpz_salt_2026').digest('hex');
}

function generateToken(rollNumber: string, isAdmin: boolean = false): string {
  const payload = JSON.stringify({ rollNumber, isAdmin, timestamp: Date.now() });
  return Buffer.from(payload).toString('base64');
}

export function parseToken(token?: string): { rollNumber: string; isAdmin: boolean } | null {
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

// Default dropdown options
const DEFAULT_OPTIONS = {
  _id: 'dropdown_options',
  colleges: ['GMRIT College, Vizianagaram'],
  branches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & DS', 'CSE (Data Science)'],
  years: ['I Year', 'II Year', 'III Year', 'IV Year']
};

export function createAuthRouter(): Router {

  // Public: Get Sign Up dropdown options
  router.get('/options', async (_req: Request, res: Response) => {
    try {
      const client = await getMongoClient();
      const optionsColl = client.db('manideep_practice_app').collection('options');
      let opt: any = await optionsColl.findOne({ _id: 'dropdown_options' as any });
      if (!opt) opt = DEFAULT_OPTIONS;
      
      res.json({
        success: true,
        options: {
          colleges: (opt?.colleges && opt.colleges.length > 0) ? opt.colleges : DEFAULT_OPTIONS.colleges,
          branches: (opt?.branches && opt.branches.length > 0) ? opt.branches : DEFAULT_OPTIONS.branches,
          years: (opt?.years && opt.years.length > 0) ? opt.years : DEFAULT_OPTIONS.years
        }
      });
    } catch {
      res.json({ success: true, options: DEFAULT_OPTIONS });
    }
  });

  // Sign Up
  router.post('/auth/signup', async (req: Request, res: Response) => {
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
        res.status(400).json({
          success: false,
          error: 'Please enter a valid 10-digit mobile number.'
        });
        return;
      }

      const client = await getMongoClient();
      const usersColl = client.db('manideep_practice_app').collection('users');

      // Check duplicate roll / mobile
      const existingUser = await usersColl.findOne({
        $or: [{ rollNumber: cleanRoll }, { mobileNumber: cleanMobile }]
      });

      if (existingUser) {
        if (existingUser.rollNumber === cleanRoll) {
          res.status(400).json({
            success: false,
            error: 'An account with this Roll Number already exists. Please Sign In.'
          });
          return;
        }
        res.status(400).json({
          success: false,
          error: 'An account with this Mobile Number already exists. Please Sign In.'
        });
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

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to create account: ' + (error.message || String(error))
      });
    }
  });

  // Sign In (Diverts admin 22KT1A4245 automatically)
  router.post('/auth/signin', async (req: Request, res: Response) => {
    try {
      const { rollNumber, password } = req.body;

      if (!rollNumber || !password) {
        res.status(400).json({
          success: false,
          error: 'Please enter your Roll Number / Mobile Number and Password.'
        });
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
        res.status(401).json({
          success: false,
          error: 'Invalid Roll Number / Mobile Number or Password.'
        });
        return;
      }

      if (user.isDisabled) {
        res.status(403).json({
          success: false,
          error: 'Your account has been disabled by the administrator. Please contact your instructor.'
        });
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

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Authentication failed: ' + (error.message || String(error))
      });
    }
  });

  // Verify Session Token
  router.get('/auth/me', async (req: Request, res: Response) => {
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

  // ADMIN: Update Dropdown Options
  router.post('/admin/options', async (req: Request, res: Response) => {
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
        { _id: 'dropdown_options' as any },
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to update options: ' + error.message });
    }
  });

  // ADMIN: Explicitly Sync All Students to Current Active College Option
  router.post('/admin/students/sync-college', async (req: Request, res: Response) => {
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
        const optDoc: any = await optionsColl.findOne({ _id: 'dropdown_options' as any });
        collegeToSet = optDoc?.colleges?.[0] || 'GMRIT College, Vizianagaram';
      }

      const filter: any = { isAdmin: { $ne: true } };
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to sync students: ' + error.message });
    }
  });

  // Presence: Heartbeat endpoint
  router.post('/heartbeat', async (req: Request, res: Response) => {
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/heartbeat/offline', async (req: Request, res: Response) => {
    try {
      let token = req.body?.token;
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

  // ADMIN: List Registered Students with Live Presence & Workout Stats
  router.get('/admin/students', async (req: Request, res: Response) => {
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

      const optDoc: any = await optionsColl.findOne({ _id: 'dropdown_options' as any });
      const currentColleges: string[] = (optDoc?.colleges && optDoc.colleges.length > 0) ? optDoc.colleges : DEFAULT_OPTIONS.colleges;
      const singleCollege = currentColleges.length === 1 ? currentColleges[0] : null;

      const students = await usersColl.find({ isAdmin: { $ne: true }, rollNumber: { $ne: ADMIN_ROLL } }, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray();

      // Aggregate workout statistics per student
      let workoutStats: any[] = [];
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

      const workoutMap = new Map<string, any>();
      workoutStats.forEach((w: any) => {
        if (w._id) workoutMap.set(String(w._id).toUpperCase(), w);
      });

      const nowMs = Date.now();
      const studentsWithPresence = students.map((s: any) => {
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

        let presenceStatus: 'online' | 'idle' | 'offline' = 'offline';
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to fetch students: ' + error.message });
    }
  });

  // ADMIN: Get Individual Student Command History (Case-insensitive)
  router.get('/admin/students/:roll/history', async (req: Request, res: Response) => {
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to fetch student history: ' + error.message });
    }
  });

  // ADMIN: Live Workout Stream of All Students
  router.get('/admin/workouts', async (req: Request, res: Response) => {
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

      const query: any = {};
      if (roll && typeof roll === 'string' && roll.trim() && roll !== 'all') {
        query.rollNumber = { $regex: new RegExp(`^${roll.trim()}$`, 'i') };
      }

      let cursor = historyColl.find(query).sort({ timestamp: -1 });
      if (limit && limit !== 'all') {
        const parsedLimit = parseInt(limit as string, 10);
        if (parsedLimit > 0) {
          cursor = cursor.limit(parsedLimit);
        }
      }

      const workouts = await cursor.toArray();

      res.json({ success: true, workouts, total: workouts.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to fetch workouts: ' + error.message });
    }
  });

  // ADMIN: Fetch hourly report workouts and students for a custom date and time-to-time range (excluding admin)
  router.post('/admin/reports/hourly', async (req: Request, res: Response) => {
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

      const optDoc: any = await optionsColl.findOne({ _id: 'dropdown_options' as any });
      const currentColleges: string[] = (optDoc?.colleges && optDoc.colleges.length > 0) ? optDoc.colleges : DEFAULT_OPTIONS.colleges;
      const singleCollege = currentColleges.length === 1 ? currentColleges[0] : null;

      // Exclude admin from students list
      const students = await usersColl
        .find({ isAdmin: { $ne: true }, rollNumber: { $ne: ADMIN_ROLL } }, { projection: { password: 0 } })
        .toArray();

      if (singleCollege) {
        students.forEach((s: any) => {
          if (!s.collegeName || s.collegeName === 'PBR VITS' || !currentColleges.includes(s.collegeName)) {
            s.collegeName = singleCollege;
          }
        });
      }

      // Query workouts strictly excluding admin
      const query: any = {
        rollNumber: { $ne: ADMIN_ROLL }
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to fetch report data: ' + error.message });
    }
  });

  // ADMIN: Toggle Disable / Enable Student
  router.patch('/admin/students/:id/status', async (req: Request, res: Response) => {
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

      let query: any;
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to update student status: ' + error.message });
    }
  });

  // ADMIN: Change Student Password by Roll Number (Zero Data Loss)
  router.post('/admin/students/reset-password', async (req: Request, res: Response) => {
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

      // Hash the new password using the exact same salt & algorithm
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
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to update student password: ' + error.message });
    }
  });

  // ADMIN: Delete / Remove Student
  router.delete('/admin/students/:id', async (req: Request, res: Response) => {
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

      let query: any;
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

      // Clean up student sandbox db if it exists
      if (targetUser.userDbName) {
        try {
          await client.db(targetUser.userDbName).dropDatabase();
        } catch {}
      }

      res.json({ success: true, message: `Student ${targetUser.rollNumber} removed successfully.` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to remove student: ' + error.message });
    }
  });

  return router;
}
