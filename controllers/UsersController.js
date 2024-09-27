import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = Queue('userQueue');

export default class UsersController {
  static async postNew(req, res) {
    if (!('email' in req.body)) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!('password' in req.body)) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const { email } = req.body;

    const emailExists = await dbClient.db
      .collection('users')
      .countDocuments({ email });
    if (emailExists > 0) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const { password } = req.body;
    const hashedPassword = sha1(password);

    const userData = { email, password: hashedPassword };

    await dbClient.db.collection('users').insertOne(userData);

    const retrievedUser = await dbClient.db
      .collection('users')
      .findOne({ email }, { projection: { password: 0 } });

    const id = retrievedUser._id;
    delete retrievedUser._id;

    userQueue.add({ userId: id });

    return res.status(201).json({ id, ...retrievedUser });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    const id = await redisClient.get(`auth_${token}`);
    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    delete user._id;

    return res.json({ id, ...user });
  }
}
