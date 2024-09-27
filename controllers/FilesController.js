import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = Queue('fileQueue');

export default class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    const _id = await redisClient.get(`auth_${token}`);
    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: new ObjectId(_id) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const acceptedTypes = ['folder', 'file', 'image'];

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !acceptedTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parent = await dbClient.db
        .collection('files')
        .findOne({ _id: new ObjectId(parentId) });

      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    if (type === 'folder') {
      const folderData = {
        userId: _id,
        name,
        type,
        isPublic,
        parentId,
      };

      const result = await dbClient.db
        .collection('files')
        .insertOne(folderData);

      delete folderData._id;

      return res.status(201).json({ id: result.insertedId, ...folderData });
    }

    // If type is file or image
    const storingFolderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(storingFolderPath)) {
      fs.mkdirSync(storingFolderPath, { recursive: true });
    }

    const fileName = uuidv4();
    const localPath = path.join(storingFolderPath, fileName);
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    const fileData = {
      userId: _id,
      name,
      type,
      isPublic,
      parentId,
      localPath,
    };

    const result = await dbClient.db.collection('files').insertOne(fileData);
    delete fileData._id;
    delete fileData.localPath;

    if (type === 'image') {
      fileQueue.add({
        userId: _id,
        fileId: result.insertedId,
      });
    }

    return res.status(201).json({ id: result.insertedId, ...fileData });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const file = await dbClient.db
      .collection('files')
      .findOne(
        { _id: new ObjectId(id), userId },
        { projection: { _id: 0, localPath: 0 } },
      );

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json({ id, ...file });
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || undefined;
    const foldersWithParentId = await dbClient.db
      .collection('files')
      .find({ _id: parentId, type: 'folder' });

    if (!foldersWithParentId) return [];

    const page = parseInt(req.query.page, 10) || 0;

    const query = parentId ? { parentId, userId } : { userId };

    const pipeline = [
      {
        $match: query,
      },
      { $skip: page * 20 },
      { $limit: 20 },
      {
        $project: {
          id: '$_id',
          userId: 1,
          name: 1,
          type: 1,
          isPublic: 1,
          parentId: 1,
        },
      },
    ];

    const files = await dbClient.db
      .collection('files')
      .aggregate(pipeline)
      .toArray();

    const response = files.map((file) => ({
      id: file._id.toString(),
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));

    return res.json(response);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    let file = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectId(id), userId });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db
      .collection('files')
      .updateOne(
        { _id: new ObjectId(id), userId },
        { $set: { isPublic: true } },
      );

    file = await dbClient.db
      .collection('files')
      .findOne(
        { _id: new ObjectId(id), userId },
        { projection: { localPath: 0 } },
      );

    delete file._id;
    return res.json({ id, ...file });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    let file = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectId(id), userId });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await dbClient.db
      .collection('files')
      .updateOne(
        { _id: new ObjectId(id), userId },
        { $set: { isPublic: false } },
      );

    file = await dbClient.db
      .collection('files')
      .findOne(
        { _id: new ObjectId(id), userId },
        { projection: { localPath: 0 } },
      );

    delete file._id;
    return res.json({ id, ...file });
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    const { id } = req.params;
    const { size } = req.query;

    const file = await dbClient.db
      .collection('files')
      .findOne({ _id: new ObjectId(id) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    let { localPath } = file;

    if (file.type === 'image' && size && ['500', '250', '100'].includes(size)) {
      localPath = `${file.localPath}_${size}`;
    }

    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name) || 'application/octet-stream';

    try {
      const data = fs.readFileSync(localPath);
      res.setHeader('Content-Type', mimeType);
      return res.send(data);
    } catch (error) {
      return res.status(500).json({ error: 'Error reading file' });
    }
  }
}
