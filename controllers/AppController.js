import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AppController {
  static getStatus(_, res) {
    res.json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  static async getStats(_, res) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();

    res.json({ users, files });
  }
}
