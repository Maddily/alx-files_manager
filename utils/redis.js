import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.redisClient = createClient();
    this.connected = true;

    this.redisClient.on('error', (error) => {
      console.error(error);
      this.connected = false;
    });

    this.redisClient.on('connect', () => {
      this.connected = true;
    });
  }

  isAlive() {
    return this.connected;
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.redisClient.get(key, (error, value) => {
        if (error) {
          reject(error);
        } else {
          resolve(value);
        }
      });
    });
  }

  async set(key, value, lifetime) {
    this.redisClient.setex(key, lifetime, value);
  }

  async del(key) {
    this.redisClient.del(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
