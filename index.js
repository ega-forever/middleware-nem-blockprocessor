/**
 * Middleware service for handling NEM transactions on Chronobank platform
 * @module Chronobank/nem-blockprocessor
 * @requires config
 * @requires models/blockModel
 * @requires services/blockProcessService
 */


const config = require('./config'),
  Promise = require('bluebird'),
  mongoose = require('mongoose');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const _ = require('lodash'),
  bunyan = require('bunyan'),
  amqp = require('amqplib'),
  log = bunyan.createLogger({name: 'nem-blockprocessor'}),
  SockJS = require('sockjs-client'),
  Stomp = require('webstomp-client'),
  nem = require('nem-sdk').default,
  BlockCacheService = require('./services/blockCacheService'),
  txsProcessService = require('./services/txsProcessService');

[mongoose.accounts, mongoose.connection].forEach(connection =>
  connection.on('disconnected', function () {
    log.error('mongo disconnected!');
    process.exit(0);
  })
);

const init = async function () {

  const amqpInstance = await amqp.connect(config.rabbit.url)
    .catch(() => {
      log.error('Rabbitmq process has finished!');
      process.exit(0);
    });

  let channel = await amqpInstance.createChannel();

  channel.on('close', () => {
    log.error('Rabbitmq process has finished!');
    process.exit(0);
  });

  await channel.assertExchange('events', 'topic', {durable: false});

  const ws = new SockJS(`${config.nis.websocket}/w/messages`);
  const client = Stomp.over(ws, {heartbeat: true, debug: false});
  await new Promise(res =>
    client.connect({}, res, () => {
      log.error('NIS process has finished!');
      process.exit(0);
    })
  );

  const blockCacheService = new BlockCacheService(client);

  blockCacheService.events.on('block', async (block) => {
    log.info('block height=%d added to cache.', block.number);
    const filteredTxs = await txsProcessService(block.transactions).catch(() => []);
    for (let tx of filteredTxs) {
      if (tx && tx.signer) {
        tx.sender = nem.model.address.toAddress(tx.signer, config.nis.network);
      }

      const payload = _.chain(tx)
        .omit(['participants'])
        .merge({unconfirmed: false})
        .value();

      const addresses = _.chain([tx.recipient, tx.sender])
        .uniq()
        .value();

      for (let address of addresses) {
        await channel.publish('events', `${config.rabbit.serviceName}_transaction.${address}`, new Buffer(JSON.stringify(payload)));
      }
    }
  });


  blockCacheService.events.on('unconfirmed', async (transaction, destination, hashData) => {
    const address = destination.replace('/unconfirmed/', '');

    const filteredTxs = await txsProcessService([transaction]).catch(() => []);
    for (let tx of filteredTxs) {

      if (tx && tx.signer) {
        tx.sender = nem.model.address.toAddress(tx.signer, config.nis.network);
      }

      let payload = _.chain(tx)
        .omit(['participants'])
        .merge({unconfirmed: true, hash: hashData})
        .value();

      await channel.publish('events', `${config.rabbit.serviceName}_transaction.${address}`, new Buffer(JSON.stringify(payload)));

    }
  });

  blockCacheService.startSync();
  

};
module.exports = init();
