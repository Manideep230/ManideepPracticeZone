import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://manideepjuvvala215_db_user:aeWhCDDKOpXeGg8b@cluster0.aqcfcn9.mongodb.net/?retryWrites=true&w=majority';

// Global connection caching across serverless function invocations
let cachedClient: MongoClient | null = null;
let indexesCreated = false;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'mpz_salt_2026').digest('hex');
}

export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(MONGO_URI, {
    maxPoolSize: 500,               // High-concurrency connection pool for 100,000+ students
    minPoolSize: 10,                // Warm pool connections
    maxIdleTimeMS: 60000,           // Close idle connections after 60s
    connectTimeoutMS: 10000,        // Connection timeout
    serverSelectionTimeoutMS: 10000,// Server selection timeout
    retryWrites: true,
    w: 'majority'
  });

  await client.connect();
  cachedClient = client;

  // Run lazy seed indexes and default options asynchronously in the background
  if (!indexesCreated) {
    indexesCreated = true;
    (async () => {
      try {
        const appDb = client.db('manideep_practice_app');
        const usersColl = appDb.collection('users');
        await usersColl.createIndex({ rollNumber: 1 }, { unique: true });
        await usersColl.createIndex({ mobileNumber: 1 }, { unique: true });
        await usersColl.createIndex({ isAdmin: 1, rollNumber: 1 });
        await usersColl.createIndex({ isOnline: 1, lastHeartbeat: -1 });
        await usersColl.createIndex({ lastActive: -1 });
        await usersColl.createIndex({ collegeName: 1, branch: 1, year: 1 });

        const historyColl = appDb.collection('command_histories');
        await historyColl.createIndex({ rollNumber: 1, timestamp: -1 });
        await historyColl.createIndex({ timestamp: -1 });
        await historyColl.createIndex({ success: 1 });

        const optionsColl = appDb.collection('options');
        const opt = await optionsColl.findOne({ _id: 'dropdown_options' as any });
        if (!opt) {
          await optionsColl.insertOne({
            _id: 'dropdown_options',
            colleges: ['PBR VITS', 'JNTUA', 'KL University', 'SRM University', 'Vignan University'],
            branches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & DS', 'CSE (Data Science)'],
            years: ['I Year', 'II Year', 'III Year', 'IV Year']
          } as any);
        }

        const adminUser = await usersColl.findOne({ rollNumber: '22KT1A4245' });
        if (!adminUser) {
          await usersColl.insertOne({
            rollNumber: '22KT1A4245',
            mobileNumber: '9999999999',
            password: hashPassword('manideep'),
            collegeName: 'Admin Portal',
            branch: 'CSE',
            year: 'IV Year',
            isAdmin: true,
            userDbName: 'user_db_22kt1a4245',
            createdAt: new Date()
          });
        }
      } catch {
        // Indexes may already exist
      }
    })().catch(() => {});
  }

  return cachedClient;
}
