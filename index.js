/**
 * Middleware service for handling NEM transactions on Chronobank platform
 * @module Chronobank/nem-blockprocessor
 * @requires config
 * @requires models/blockModel
 * @requires services/blockProcessService
 *
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */


const config = require('./config'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  _ = require('lodash'),
  bunyan = require('bunyan'),
  amqp = require('amqplib'),
  models = require('./models'),
  log = bunyan.createLogger({name: 'nem-blockprocessor'}),
  MasterNodeService = require('middleware-common-components/services/blockProcessor/MasterNodeService'),
  BlockWatchingService = require('./services/blockWatchingService'),
  SyncCacheService = require('./services/syncCacheService'),
  providerService = require('./services/providerService'),
  filterTxsByAccountsService = require('./services/filterTxsByAccountsService');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const init = async () => {


  [mongoose.accounts, mongoose.connection].forEach(connection =>
    connection.on('disconnected', () => {
      throw new Error('mongo disconnected!');
    })
  );

  models.init();


  let amqpInstance = await amqp.connect(config.rabbit.url);

  let channel = await amqpInstance.createChannel();

  channel.on('close', () => {
    throw new Error('rabbitmq process has finished!');
  });

  await channel.assertExchange('events', 'topic', {durable: false});
  await channel.assertExchange('internal', 'topic', {durable: false});
  await channel.assertQueue(`${config.rabbit.serviceName}_current_provider.get`, {durable: false});
  await channel.bindQueue(`${config.rabbit.serviceName}_current_provider.get`, 'internal', `${config.rabbit.serviceName}_current_provider.get`);


  const masterNodeService = new MasterNodeService(channel, config.rabbit.serviceName);
  await masterNodeService.start();

  providerService.events.on('provider_set', providerURI => {
    let providerIndex = _.findIndex(config.node.providers, providerURI);
    if (providerIndex !== -1)
      channel.publish('internal', `${config.rabbit.serviceName}_current_provider.set`, new Buffer(JSON.stringify({index: providerIndex})));
  });

  channel.consume(`${config.rabbit.serviceName}_current_provider.get`, async () => {
    let providerInstance = await providerService.get();
    let providerIndex = _.findIndex(config.node.providers, provider => provider.http === providerInstance.http);
    if (providerIndex !== -1)
      channel.publish('internal', `${config.rabbit.serviceName}_current_provider.set`, new Buffer(JSON.stringify({index: providerIndex})));
  }, {noAck: true});


  const syncCacheService = new SyncCacheService();

  let blockEventCallback = async block => {
    log.info(`${block.hash} (${block.number}) added to cache.`);
    let filtered = await filterTxsByAccountsService(block.txs);
    await Promise.all(filtered.map(item =>
      channel.publish('events', `${config.rabbit.serviceName}_transaction.${item.address}`, new Buffer(JSON.stringify(Object.assign(item))))
    ));
  };

  let txEventCallback = async tx => {
    let filtered = await filterTxsByAccountsService([tx]);
    await Promise.all(filtered.map(item =>
      channel.publish('events', `${config.rabbit.serviceName}_transaction.${item.address}`, new Buffer(JSON.stringify(Object.assign(item))))
    ));
  };


  syncCacheService.events.on('block', blockEventCallback);

  let endBlock = await syncCacheService.start();

  await new Promise(res => {
    if (config.sync.shadow)
      return res();

    syncCacheService.events.on('end', () => {
      log.info(`cached the whole blockchain up to block: ${endBlock}`);
      res();
    });
  });

  const blockWatchingService = new BlockWatchingService(endBlock);
  blockWatchingService.events.on('block', blockEventCallback);
  blockWatchingService.events.on('tx', txEventCallback);

  await blockWatchingService.startSync();

};

module.exports = init().catch(err => {
  if (_.get(err, 'code') === 0)
    log.info('nodes are down or not synced!');
  else
    log.error(err);

  process.exit(0);
});
