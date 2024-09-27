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
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import express from 'express';
import { ObjectId } from 'mongodb';
import {
  before,
  beforeEach,
} from 'mocha';
import UsersController from '../../controllers/UsersController'; // Adjust the path as needed
import dbClient from '../../utils/db';
import redisClient from '../../utils/redis';

const { expect } = chai;
chai.use(chaiHttp);

describe('UsersController', () => {
  let app;
  let dbStub;
  let redisStub;

  before(() => {
    app = express();
    app.use(express.json());
    app.post('/users/new', UsersController.postNew);
    app.get('/users/me', UsersController.getMe);
  });

  beforeEach(() => {
    sinon.restore();
    dbStub = sinon.stub(dbClient.db.collection('users'));
    redisStub = sinon.stub(redisClient);
  });

  describe('postNew', () => {
    it('should return 400 if email is missing', (done) => {
      chai
        .request(app)
        .post('/users/new')
        .send({ password: 'password123' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.deep.equal({ error: 'Missing email' });
          done();
        });
    });

    it('should return 400 if password is missing', (done) => {
      chai
        .request(app)
        .post('/users/new')
        .send({ email: 'test@example.com' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.deep.equal({ error: 'Missing password' });
          done();
        });
    });

    it.skip('should return 400 if email already exists', (done) => {
      dbStub.countDocuments.resolves(1);

      chai
        .request(app)
        .post('/users/new')
        .send({ email: 'test@example.com', password: 'password123' })
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.deep.equal({ error: 'Already exist' });
          done();
        });
    });

    it.skip('should create a new user and return 201', (done) => {
      dbStub.countDocuments.resolves(0);
      dbStub.insertOne.resolves();
      dbStub.findOne.resolves({ _id: new ObjectId('64b8cbe0f8994a08e0a3eeba'), email: 'test@example.com' });

      chai
        .request(app)
        .post('/users/new')
        .send({ email: 'test@example.com', password: 'password123' })
        .end((err, res) => {
          expect(res).to.have.status(201);
          expect(res.body).to.have.property('id');
          expect(res.body).to.have.property('email', 'test@example.com');
          done();
        });
    });
  });

  describe('getMe', () => {
    it('should return 401 if token is invalid', (done) => {
      redisStub.get.resolves(null);
      dbStub.findOne.resolves(null);

      chai
        .request(app)
        .get('/users/me')
        .set('X-Token', 'invalid-token')
        .end((err, res) => {
          expect(res).to.have.status(401);
          expect(res.body).to.deep.equal({ error: 'Unauthorized' });
          done();
        });
    });

    it.skip('should return user data if token is valid', (done) => {
      const fakeUserId = '64b8cbe0f8994a08e0a3eeba';
      const fakeUser = { _id: new ObjectId(fakeUserId), email: 'test@example.com' };

      redisStub.get.resolves(fakeUserId);
      dbStub.findOne.resolves(fakeUser);

      chai
        .request(app)
        .get('/users/me')
        .set('X-Token', 'valid-token')
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('id', fakeUserId);
          expect(res.body).to.have.property('email', 'test@example.com');
          done();
        });
    });
  });
});
