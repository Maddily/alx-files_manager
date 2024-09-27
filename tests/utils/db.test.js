/* eslint-disable jest/no-hooks */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */
/* eslint-disable jest/no-test-callback */
/* eslint-disable jest/prefer-expect-assertions */
/* eslint-disable jest/lowercase-name */
/* eslint-disable jest/valid-expect */
import chai from 'chai';
import sinon from 'sinon';
import {
  before,
  after,
  beforeEach,
} from 'mocha';
import dbClient from '../../utils/db';

const { expect } = chai;

describe('dbClient', () => {
  let sandbox;
  let countDocumentsStub;

  before(() => {
    sandbox = sinon.createSandbox();

    countDocumentsStub = sandbox.stub().resolves(5);

    const dbStub = {
      db: () => ({
        collection: () => ({
          countDocuments: countDocumentsStub,
        }),
      }),
    };

    sandbox.stub(dbClient, 'client').value(dbStub);
  });

  after(() => {
    sandbox.restore();
  });

  describe('isAlive', () => {
    it('should return true when connected', () => {
      expect(dbClient.isAlive()).to.be.true;
    });

    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should return false when disconnected', () => {
      dbClient.connected = false;
      expect(dbClient.isAlive()).to.be.false;
    });
  });

  describe('nbUsers', () => {
    beforeEach(() => {
      countDocumentsStub.reset();
      countDocumentsStub.resolves(5);
    });

    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should return the number of user documents', async () => {
      const nbUsers = await dbClient.nbUsers();
      expect(nbUsers).to.equal(5);
    });
  });

  describe('nbFiles', () => {
    beforeEach(() => {
      countDocumentsStub.reset();
      countDocumentsStub.resolves(5);
    });

    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should return the number of file documents', async () => {
      const nbFiles = await dbClient.nbFiles();
      expect(nbFiles).to.equal(5);
    });
  });
});
