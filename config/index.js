/* 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/

const _ = require('lodash');

require('dotenv').config();

const getProviders = (string) => _.chain(string).split(',')
  .map(provider => {
    const data = provider.split('@');
    return {
      http: data[0].trim(),
      ws: data[1].trim()
    };
  })
  .value();

const config = {
  mongo: {
    accounts: {
      uri: process.env.MONGO_ACCOUNTS_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/data',
      collectionPrefix: process.env.MONGO_ACCOUNTS_COLLECTION_PREFIX || process.env.MONGO_COLLECTION_PREFIX || 'nem'
    },
    data: {
      uri: process.env.MONGO_DATA_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/data',
      collectionPrefix: process.env.MONGO_DATA_COLLECTION_PREFIX || process.env.MONGO_COLLECTION_PREFIX || 'nem'
    }
  },
  sync: {
    shadow: parseInt(process.env.SYNC_SHADOW) || true
  },
  node: {
    network: parseInt(process.env.NETWORK) || -104,
    networkName: process.env.NETWORK_NAME || 'testnet',
    providers: _.chain(process.env.PROVIDERS || 'http://192.3.61.243:7890@http://192.3.61.243:7778')
      .split(',')
      .map(provider => {
        const data = provider.split('@');
        return {
          http: data[0].trim(),
          ws: data[1].trim()
        };
      })
      .value()
  },
  consensus: {
    lastBlocksValidateAmount: parseInt(process.env.CONSENSUS_BLOCK_VALIDATE_AMOUNT) || 10
  },
  rabbit: {
    url: process.env.RABBIT_URI || 'amqp://localhost:5672',
    serviceName: process.env.RABBIT_SERVICE_NAME || 'app_nem'
  }
};

module.exports = config;
