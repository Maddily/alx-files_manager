import chai from 'chai';
import { createClient } from 'redis';
import sinon from 'sinon';
import { before, after, beforeEach } from 'mocha';
import redisClient from '../../utils/redis';

const { expect } = chai;

describe('redisClient', () => {
  let redisStore = {};
  let redisClientInstance;

  before(() => {
    redisClientInstance = createClient();

    sinon.stub(redisClientInstance, 'get').callsFake((key, callback) => {
      if (Object.prototype.hasOwnProperty.call(redisStore, key)) {
        callback(null, redisStore[key]);
      } else {
        callback(null, null);
      }
    });

    sinon
      .stub(redisClientInstance, 'setex')
      .callsFake((key, lifetime, value) => {
        redisStore[key] = value;
        setTimeout(() => {
          delete redisStore[key];
        }, lifetime * 1000);
      });

    sinon.stub(redisClientInstance, 'del').callsFake((key) => {
      delete redisStore[key];
    });

    redisClient.redisClient = redisClientInstance;
  });

  after(() => {
    sinon.restore();
  });

  // eslint-disable-next-line jest/no-hooks
  beforeEach(() => {
    redisStore = {};
  });

  describe('isAlive', () => {
    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should return true when connected', () => {
      // eslint-disable-next-line no-unused-expressions, jest/valid-expect
      expect(redisClient.isAlive()).to.be.true;
    });

    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should return false when disconnected', () => {
      redisClient.connected = false;
      // eslint-disable-next-line no-unused-expressions, jest/valid-expect
      expect(redisClient.isAlive()).to.be.false;
    });
  });

  describe('get', () => {
    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should return value for existing key', async () => {
      redisStore.existingKey = 'value';
      const value = await redisClient.get('existingKey');
      // eslint-disable-next-line no-unused-expressions, jest/valid-expect
      expect(value).to.equal('value');
    });

    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should return null for non-existing key', async () => {
      const value = await redisClient.get('nonExistingKey');
      // eslint-disable-next-line no-unused-expressions, jest/valid-expect
      expect(value).to.be.null;
    });
  });

  describe('set', () => {
    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should set a value with expiration', async () => {
      await redisClient.set('key', 'value', 1);
      // eslint-disable-next-line no-unused-expressions, jest/valid-expect
      expect(redisStore.key).to.equal('value');

      await new Promise((resolve) => setTimeout(resolve, 1100));
      // eslint-disable-next-line no-unused-expressions, jest/valid-expect
      expect(redisStore.key).to.be.undefined;
    });
  });

  describe('del', () => {
    // eslint-disable-next-line jest/prefer-expect-assertions
    it('should delete a key', async () => {
      redisStore.key = 'value';
      await redisClient.del('key');
      // eslint-disable-next-line no-unused-expressions, jest/valid-expect
      expect(redisClient.key).to.be.undefined;
    });
  });
});
