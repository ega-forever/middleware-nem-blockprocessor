/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const mongoose = require('mongoose'),
 Promise = require('bluebird'),
 { spawn } = require('child_process'),
 config = require('./config');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const saveAccountForAddress = require('./helpers/saveAccountForAddress'),
  connectToQueue = require('./helpers/connectToQueue'),
  clearQueues = require('./helpers/clearQueues'),
  consumeMessages = require('./helpers/consumeMessages'),
  createTransaction = require('./helpers/createTransaction'),
  consumeStompMessages = require('./helpers/consumeStompMessages'),
  blockModel = require('../models/blockModel'),
  txModel = require('../models/txModel'),
  accountModel = require('../models/accountModel'),
  WebSocket = require('ws'),
  expect = require('chai').expect,
  amqp = require('amqplib'),
  
  Stomp = require('webstomp-client');

let amqpInstance,  accounts = config.dev.accounts;

describe('core/block processor -  change provider', function () {


  before(async () => {
    await saveAccountForAddress(accounts[0]);
    amqpInstance = await amqp.connect(config.rabbit.url);
    await clearQueues(amqpInstance);
  });

  after(async () => {
    await amqpInstance.close();
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await clearQueues(amqpInstance);
  });


  it('send some nem from account0 to account1 and check provider', async () => {
    let tx;
    return await Promise.all([
      (async () => {
        tx =await createTransaction(accounts[1], 0.000001);
        if (tx.code === 5) 
          throw new Error('Account has not balance');
        
      })(),
      (async () => {
        const channel = await amqpInstance.createChannel();  
        await channel.assertExchange('events', 'topic', {durable: false});
        const balanceQueue = await channel.assertQueue(`app_${config.rabbit.serviceName}_test.check`);
        await channel.bindQueue(`app_${config.rabbit.serviceName}_test.check`, 'events', `${config.rabbit.serviceName}_test.check`);
        return new Promise(res => {
          channel.consume(queueName, async (message) => {
            console.log(message);
            if (message = 8010) {
              res();
            }
          }, {noAck: true});
        });
      })()
    ]);
  });

});