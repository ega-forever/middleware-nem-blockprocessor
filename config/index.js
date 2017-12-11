require('dotenv').config();

const config = {
  mongo: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/data-nem'
  },
  nis: {
    // server: 'http://go.nem.ninja:7890',
    server: 'http://23.228.67.85:7890',
    network: process.env.NETWORK || 'testnet',
  },
  rabbit: {
    url: process.env.RABBIT_URI || 'amqp://localhost:5672',
    serviceName: process.env.RABBIT_SERVICE_NAME || 'app_nem'
  },
};

module.exports = config;
