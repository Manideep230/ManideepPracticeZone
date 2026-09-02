const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://manideepjuvvala215_db_user:aeWhCDDKOpXeGg8b@cluster0.aqcfcn9.mongodb.net/?retryWrites=true&w=majority';
let cachedClient = null;

const DEFAULT_OPTIONS = {
  _id: 'dropdown_options',
  colleges: ['PBR VITS', 'JNTUA', 'KL University', 'SRM University', 'Vignan University'],
  branches: ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AI & DS', 'CSE (Data Science)'],
  years: ['I Year', 'II Year', 'III Year', 'IV Year']
};

async function fetchOptionsWithTimeout() {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Atlas connection timeout')), 2500)
  );

  const fetchPromise = (async () => {
    if (!cachedClient) {
      cachedClient = new MongoClient(MONGO_URI, { 
        connectTimeoutMS: 2500,
        serverSelectionTimeoutMS: 2500
      });
      await cachedClient.connect();
    }
    const optionsColl = cachedClient.db('manideep_practice_app').collection('options');
    let opt = await optionsColl.findOne({ _id: 'dropdown_options' });
    return opt || DEFAULT_OPTIONS;
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const opt = await fetchOptionsWithTimeout();
    res.status(200).json({
      success: true,
      options: {
        colleges: opt.colleges || DEFAULT_OPTIONS.colleges,
        branches: opt.branches || DEFAULT_OPTIONS.branches,
        years: opt.years || DEFAULT_OPTIONS.years
      }
    });
  } catch (e) {
    res.status(200).json({
      success: true,
      options: DEFAULT_OPTIONS,
      cached: true,
      warning: String(e.message || e)
    });
  }
};
