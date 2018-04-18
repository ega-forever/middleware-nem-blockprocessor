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

  NodeListenerService = require('./services/nodeListenerService'), 
  MasterNodeService = require('./services/MasterNodeService'), 
  blockRepo = require('./services/blockRepository'),
  requests = require('./services/nodeRequests'),


  BlockWatchingService = require('./services/blockWatchingService'),
  SyncCacheService = require('./services/syncCacheService'),
  filterTxsByAccountsService = require('./services/filterTxsByAccountsService');

[mongoose.accounts, mongoose.connection].forEach(connection =>
  connection.on('disconnected', function () {
    log.error('mongo disconnected!');
    process.exit(0);
  })
);

const ws = new SockJS(`${config.node.websocket}/w/messages`);
const client = Stomp.over(ws, {heartbeat: true, debug: false});

const init = async () => {


  try {
    await new Promise((res,rej) => client.connect({}, res, rej)).timeout(10000);
  } catch(e) {
    log.error('NIS process has finished!');
    log.error(e);
    process.exit(0);
  }

  let amqpInstance = await amqp.connect(config.rabbit.url)
    .catch(() => {
      log.error('rabbitmq process has finished!');
      process.exit(0);
    });

  let channel = await amqpInstance.createChannel();

  channel.on('close', () => {
    log.error('rabbitmq process has finished!');
    process.exit(0);
  });

  await channel.assertExchange('events', 'topic', {durable: false});


  const masterNodeService = new MasterNodeService(channel, (msg) => log.info(msg));
  await masterNodeService.start();


  let blockEventCallback = async block => {
    log.info(`${block.hash} (${block.number}) added to cache.`);
    let filtered = await filterTxsByAccountsService(block.transactions);
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

  const listener = new NodeListenerService(client);
  const syncCacheService = new SyncCacheService(requests, blockRepo);


  syncCacheService.events.on('block', blockEventCallback);

  let endBlock = await syncCacheService.start()
    .catch((err) => {
      if (_.get(err, 'code') === 0) {
        log.info('nodes are down or not synced!');
        process.exit(0);
      }
      log.error(err);
    });

  await new Promise((res) => {
    if (config.sync.shadow)
      return res();

    syncCacheService.events.on('end', () => {
      log.info(`cached the whole blockchain up to block: ${endBlock}`);
      res();
    });
  });

  const blockWatchingService = new BlockWatchingService(requests, listener, blockRepo, endBlock);  
  blockWatchingService.events.on('block', blockEventCallback);
  blockWatchingService.events.on('tx', txEventCallback);

  await blockWatchingService.startSync().catch(err => {
    if (_.get(err, 'code') === 0) {
      log.error('no connections available or blockchain is not synced!');
      process.exit(0);
    }
  });

};

module.exports = init();
