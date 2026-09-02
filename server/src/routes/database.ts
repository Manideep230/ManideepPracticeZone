import { Router, Request, Response } from 'express';
import { getMongoClient } from '../db';
import { parseToken } from './auth';

export function createDatabaseRouter(): Router {
  const router = Router();

  async function getUserDb(req: Request) {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : undefined;
    const session = parseToken(token);
    if (!session) return null;

    const mongoClient = await getMongoClient();
    const cleanRoll = session.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return {
      dbName: `user_db_${cleanRoll}`,
      rollNumber: session.rollNumber,
      db: mongoClient.db(`user_db_${cleanRoll}`)
    };
  }

  // Get collections for authenticated user
  router.get('/collections', async (req: Request, res: Response) => {
    try {
      const userSession = await getUserDb(req);
      if (!userSession) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const collections = await userSession.db.listCollections().toArray();
      const filtered = collections.filter(c => !c.name.startsWith('system.'));

      const collectionInfo = await Promise.all(
        filtered.map(async (col) => {
          const count = await userSession.db.collection(col.name).countDocuments();
          return { name: col.name, count };
        })
      );

      res.json({
        success: true,
        dbName: userSession.dbName,
        collections: collectionInfo
      });
    } catch {
      res.status(500).json({ success: false, message: 'Failed to list collections.' });
    }
  });

  // Get documents from a collection
  router.get('/collections/:name', async (req: Request, res: Response) => {
    try {
      const userSession = await getUserDb(req);
      if (!userSession) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }

      const { name } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const documents = await userSession.db.collection(name).find({}).limit(limit).toArray();
      const count = await userSession.db.collection(name).countDocuments();

      res.json({
        success: true,
        documents,
        count,
        collection: name
      });
    } catch {
      res.status(500).json({ success: false, message: `Failed to fetch documents from "${req.params.name}".` });
    }
  });

  return router;
}
