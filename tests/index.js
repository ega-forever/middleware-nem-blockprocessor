require('dotenv/config');

const mongoose = require('mongoose'),
  Promise = require('bluebird'),
  config = require('../config');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const saveAccountForAddress = require('./helpers/saveAccountForAddress'),
  connectToQueue = require('./helpers/connectToQueue'),
  clearQueues = require('./helpers/clearQueues'),
  consumeMessages = require('./helpers/consumeMessages'),
  awaitLastBlock = require('./helpers/awaitLastBlock'),
  createTransaction = require('./helpers/createTransaction'),
  findBlockWithTransactions = require('./helpers/findBlockWithTransactions'),
  consumeStompMessages = require('./helpers/consumeStompMessages'),
  net = require('net'),
  WebSocket = require('ws'),
  nis = require('../services/nisRequestService'),
  expect = require('chai').expect,
  amqp = require('amqplib'),
  Stomp = require('webstomp-client');

let accounts = [], amqpInstance, blockHeight;

describe('core/block processor', function () {


  before(async () => {
    //await awaitLastBlock();

    const block = await findBlockWithTransactions(700, 0);
    accounts.push(await saveAccountForAddress(block.transactions[0].recipient));
    accounts.push(await saveAccountForAddress(block.transactions[0].sender));

    amqpInstance = await amqp.connect(config.rabbit.url);
    
    await clearQueues(amqpInstance);
  });

  after(async () => {
    return mongoose.disconnect();
  });

  it('send some nem from account0 to account1 and validate countMessages(2) and structure message', async () => {


    const checkMessage = function (content) {
      expect(content).to.contain.all.keys(
        'hash',
        'nonce',
        'number',
        'sender',
        'recipient',
        'type',
        'deadline',
        'timeStamp',
        'unconfirmed'
      );
    };

    return await Promise.all([
      (async() => {
        await createTransaction(accounts[0], accounts[1], 100);
      })(),
      // (async () => {
      //   const channel = await amqpInstance.createChannel();  
      //   await connectToQueue(channel);
      //   return await consumeMessages(1, channel, (message) => {
      //     checkMessage(JSON.parse(message.content));
      //   });
      // })(),
      // (async () => {
      //   const ws = new WebSocket('ws://localhost:5672/ws');
      //   const client = Stomp.over(ws, {heartbeat: false, debug: false});
      //   return await consumeStompMessages(1, client, (message) => {
      //     checkMessage(JSON.parse(message.body));
      //   });
      // })()
    ]);
  });

  // it('validate notification via amqp about new tx', async () => {

  //   let amqpInstance = await amqp.connect(config.rabbit.url);
  //   let channel = await amqpInstance.createChannel();

  //   try {
  //     await channel.assertExchange('events', 'topic', {durable: false});
  //     await channel.assertQueue(`app_${config.rabbit.serviceName}_test.transaction`);
  //     await channel.bindQueue(`app_${config.rabbit.serviceName}_test.transaction`, 'events', `${config.rabbit.serviceName}_transaction.*`);
  //   } catch (e) {
  //     channel = await amqpInstance.createChannel();
  //   }

  //   return await new Promise(res => {
  //     channel.consume(`app_${config.rabbit.serviceName}_test.transaction`, data => {
  //       amqpInstance.close();
  //       res();
  //     }, {noAck: true})
  //   });
  // });

});