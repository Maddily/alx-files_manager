/* eslint-disable jest/no-disabled-tests */
/* eslint-disable prefer-template */
/* eslint-disable jest/no-hooks */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */
/* eslint-disable jest/no-test-callback */
/* eslint-disable jest/prefer-expect-assertions */
/* eslint-disable jest/lowercase-name */
/* eslint-disable jest/valid-expect */

import chai from 'chai';
import sinon from 'sinon';
import chaiHttp from 'chai-http';
import express from 'express';
import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import {
  before,
  beforeEach,
  afterEach,
} from 'mocha';
import AuthController from '../../controllers/AuthController'; // Adjust the path as needed
import dbClient from '../../utils/db';
import redisClient from '../../utils/redis';

const { expect } = chai;
chai.use(chaiHttp);

describe('AuthController', () => {
  let app;
  let dbStub;
  let redisStub;

  before(() => {
    app = express();
    app.use(express.json());
    app.get('/connect', AuthController.getConnect);
    app.get('/disconnect', AuthController.getDisconnect);
  });

  beforeEach(() => {
    sinon.restore();
    dbStub = sinon.stub(dbClient.db.collection('users'), 'findOne');
    redisStub = {
      get: sinon.stub(),
      set: sinon.stub(),
      del: sinon.stub(),
    };
    sinon.replace(redisClient, 'get', redisStub.get);
    sinon.replace(redisClient, 'set', redisStub.set);
    sinon.replace(redisClient, 'del', redisStub.del);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getConnect', () => {
    it('should return 401 for invalid user credentials', (done) => {
      dbStub.resolves(null);

      chai
        .request(app)
        .get('/connect')
        .set('Authorization', 'Basic ' + Buffer.from('wrong@example.com:wrongpassword').toString('base64'))
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.deep.equal({ error: 'Unauthorized' });
          done();
        });
    });

    it.skip('should return a token for valid user credentials', (done) => {
      const fakeUser = { _id: new ObjectId('64b8cbe0f8994a08e0a3eeba'), email: 'test@example.com' };
      dbStub.withArgs({ email: 'test@example.com', password: sha1('password') }).resolves(fakeUser);
      redisStub.set.resolves();

      chai
        .request(app)
        .get('/connect')
        .set('Authorization', 'Basic ' + Buffer.from('test@example.com:password').toString('base64'))
        .end((err, res) => {
          console.log('Response body:', res.body);
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('token');
          done();
        });
    });
  });

  describe('getDisconnect', () => {
    it('should return 401 for an invalid token', (done) => {
      redisStub.get.resolves(null);

      chai
        .request(app)
        .get('/disconnect')
        .set('X-Token', 'invalid-token')
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.deep.equal({ error: 'Unauthorized' });
          done();
        });
    });

    it.skip('should return 204 and disconnect user with a valid token', (done) => {
      const fakeUserId = '64b8cbe0f8994a08e0a3eeba';
      const fakeUser = { _id: new ObjectId(fakeUserId) };
      redisStub.get.withArgs('auth_valid-token').resolves(fakeUserId);
      dbStub.withArgs({ _id: new ObjectId(fakeUserId) }).resolves(fakeUser);
      redisStub.del.resolves();

      chai
        .request(app)
        .get('/disconnect')
        .set('X-Token', 'valid-token')
        .end((err, res) => {
          console.log('Response body:', res.body);
          expect(res).to.have.status(204);
          expect(res.body).to.be.empty;
          done();
        });
    });
  });
});
