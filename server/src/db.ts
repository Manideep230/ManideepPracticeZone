import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://manideepjuvvala215_db_user:aeWhCDDKOpXeGg8b@cluster0.aqcfcn9.mongodb.net/?retryWrites=true&w=majority';

// Global connection caching across serverless function invocations
let cachedClient: MongoClient | null = null;
let indexesCreated = false;

export async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const options = {
    maxPoolSize: 100,               // Connection pool size for 5000+ users
    minPoolSize: 10,                // Keep active connections warm
    maxIdleTimeMS: 30000,           // Close idle connections
    connectTimeoutMS: 10000,        // Connection timeout
    serverSelectionTimeoutMS: 10000,// Server selection timeout
    tls: true,
    tlsAllowInvalidCertificates: true,
    tlsInsecure: true,
    retryWrites: true,
    w: 'majority'
  };

  try {
    const client = new MongoClient(MONGO_URI, options);
    await client.connect();
    cachedClient = client;
  } catch (err) {
    console.warn('Standard connection fallback retry...', err);
    const fallbackClient = new MongoClient(MONGO_URI, {
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 15000,
      tlsAllowInvalidCertificates: true,
      tlsInsecure: true
    });
    await fallbackClient.connect();
    cachedClient = fallbackClient;
  }

  // Create performance indexes once on startup
  if (!indexesCreated && cachedClient) {
    try {
      const appDb = cachedClient.db('manideep_practice_app');
      const usersColl = appDb.collection('users');
      await usersColl.createIndex({ rollNumber: 1 }, { unique: true });
      await usersColl.createIndex({ mobileNumber: 1 }, { unique: true });
      indexesCreated = true;
    } catch {
      // Indexes may already exist
    }
  }

  return cachedClient!;
}
