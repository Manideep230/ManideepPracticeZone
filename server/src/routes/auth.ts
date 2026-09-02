import { Router, Request, Response } from 'express';
import crypto from 'crypto';
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
  colleges: ['PBR VITS', 'JNTUA', 'KL University', 'SRM University', 'Vignan University'],
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
          colleges: opt?.colleges || DEFAULT_OPTIONS.colleges,
          branches: opt?.branches || DEFAULT_OPTIONS.branches,
          years: opt?.years || DEFAULT_OPTIONS.years
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

      res.json({ success: true, message: 'Dropdown options updated successfully!' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to update options: ' + error.message });
    }
  });

  // ADMIN: List Registered Students
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
      const students = await usersColl.find({}, { projection: { password: 0 } }).sort({ createdAt: -1 }).toArray();

      res.json({ success: true, students });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to fetch students: ' + error.message });
    }
  });

  return router;
}
