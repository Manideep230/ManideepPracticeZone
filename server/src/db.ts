import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://manideepjuvvala215_db_user:aeWhCDDKOpXeGg8b@cluster0.aqcfcn9.mongodb.net/?retryWrites=true&w=majority';

// Global connection caching across serverless function invocations
let cachedClient: MongoClient | null = null;
let indexesCreated = false;

export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(MONGO_URI, {
    maxPoolSize: 100,               // Connection pool size for 5000+ users
    minPoolSize: 10,                // Keep active connections warm
    maxIdleTimeMS: 30000,           // Close idle connections
    connectTimeoutMS: 10000,        // Connection timeout
    serverSelectionTimeoutMS: 10000,// Server selection timeout
    tls: true,
    tlsAllowInvalidCertificates: true,
    retryWrites: true,
    w: 'majority'
  });

  await client.connect();
  cachedClient = client;

  // Create performance indexes once on startup
  if (!indexesCreated) {
    try {
      const appDb = client.db('manideep_practice_app');
      const usersColl = appDb.collection('users');
      await usersColl.createIndex({ rollNumber: 1 }, { unique: true });
      await usersColl.createIndex({ mobileNumber: 1 }, { unique: true });
      indexesCreated = true;
    } catch {
      // Indexes may already exist
    }
  }

  return cachedClient;
}
