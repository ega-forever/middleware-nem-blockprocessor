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
  blockModel = require('./models/blockModel'),
  log = bunyan.createLogger({name: 'nem-blockprocessor'}),
  blockProcessService = require('./services/blockProcessService');

[mongoose.accounts, mongoose.connection].forEach(connection =>
  connection.on('disconnected', function () {
    log.error('mongo disconnected!');
    process.exit(0);
  })
);

const saveBlockHeight = currentBlock =>
  blockModel.findOneAndUpdate({network: config.nis.network}, {
    $set: {
      block: currentBlock,
      created: Date.now()
    }
  }, {upsert: true});

let lastBlockHeight = 0;

const init = async function () {
  let currentBlock = await blockModel.findOne({network: config.nis.network}).sort('-block');
  currentBlock = _.chain(currentBlock).get('block', 0).add(0).value();
  log.info(`Search from block ${currentBlock} for network:${config.nis.network}`);

  // Establishing RabbitMQ connection
  let amqpInstance = await amqp.connect(config.rabbit.url)
    .catch(() => {
      log.error('Rabbitmq process has finished!');
      process.exit(0);
    });

  let channel = await amqpInstance.createChannel();

  channel.on('close', () => {
    log.error('Rabbitmq process has finished!');
    process.exit(0);
  });

  try {
    await channel.assertExchange('events', 'topic', {durable: false});
  } catch (e) {
    log.error(e);
    channel = await amqpInstance.createChannel();
  }

  /**
   * Recursive routine for processing incoming blocks.
   * @return {undefined}
   */
  let processBlock = async () => {
    try {
      let filteredTxs = await Promise.resolve(blockProcessService(currentBlock)).timeout(20000);

      log.info(`Publishing ${filteredTxs.length} transactions from block (${currentBlock + 1})`);

      for (let tx of filteredTxs) {
        for (let address of tx.participants) {
          const payload = JSON.stringify(_.omit(tx, ['participants']));
          await channel.publish('events', `${config.rabbit.serviceName}_transaction.${address}`, new Buffer(payload));
        }
      }

      await saveBlockHeight(currentBlock + 1);

      currentBlock++;
      processBlock();
    } catch (err) {
      if (err instanceof Promise.TimeoutError) {
        log.error('Timeout processing the block');
        return processBlock();
      }

      if (_.get(err, 'code') === 0) {
        if (lastBlockHeight !== currentBlock)
          log.info('Awaiting for next block');

        lastBlockHeight = currentBlock;
        return setTimeout(processBlock, 10000);
      }


      if (_.get(err, 'code') === 2) {
        log.info(`Skipping the block (${currentBlock + 1})`);
        await saveBlockHeight(currentBlock + 1);
      }

      currentBlock++;
      processBlock();
    }
  };

  processBlock();
};
module.exports = init();
