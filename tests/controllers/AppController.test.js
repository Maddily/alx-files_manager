/* eslint-disable consistent-return */
/* eslint-disable jest/no-hooks */
/* eslint-disable no-unused-vars */
/* eslint-disable jest/no-test-callback */
/* eslint-disable jest/prefer-expect-assertions */
/* eslint-disable jest/lowercase-name */
/* eslint-disable jest/valid-expect */
import chai from 'chai';
import chaiHttp from 'chai-http';
import sinon from 'sinon';
import { beforeEach, afterEach } from 'mocha';
import dbClient from '../../utils/db';
import app from '../../server';

const { expect } = chai;
chai.use(chaiHttp);

describe('AppController', () => {
  let sandbox;
  let server;
  let port;

  beforeEach((done) => {
    sandbox = sinon.createSandbox();
    server = app.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterEach((done) => {
    sandbox.restore();
    server.close(() => done());
  });

  describe('GET /status', () => {
    it('should return status 200 and correct structure', (done) => {
      chai
        .request(`http://localhost:${port}`)
        .get('/status')
        .end((error, res) => {
          if (error) return done(error);
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('redis');
          expect(res.body).to.have.property('db');
          done();
        });
    });
  });

  describe('GET /stats', () => {
    let nbUsersStub;
    let nbFilesStub;

    beforeEach(() => {
      nbUsersStub = sandbox.stub(dbClient, 'nbUsers').resolves(10);
      nbFilesStub = sandbox.stub(dbClient, 'nbFiles').resolves(5);
    });

    afterEach(() => {
      nbUsersStub.restore();
      nbFilesStub.restore();
    });

    it('should return status 200 and correct structure', (done) => {
      chai
        .request(`http://localhost:${port}`)
        .get('/stats')
        .end((error, res) => {
          if (error) return done(error);
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('users', 10);
          expect(res.body).to.have.property('files', 5);
          done();
        });
    });
  });
});
