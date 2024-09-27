import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

export default class AuthController {
  static async getConnect(req, res) {
    const b64Auth = (req.headers.authorization || '').split(' ')[1] || '';
    const strAuth = Buffer.from(b64Auth, 'base64').toString();
    // eslint-disable-next-line no-unused-vars
    const [_, email, password] = strAuth.match(/(.*?):(.*)/) || [];

    const user = await dbClient.db
      .collection('users')
      .findOne({ email, password: sha1(password) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    await redisClient.set(`auth_${token}`, user._id.toString(), 24 * 3600);

    return res.json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    const _id = await redisClient.get(`auth_${token}`);
    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(_id) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);
    return res.status(204).json();
  }
}
