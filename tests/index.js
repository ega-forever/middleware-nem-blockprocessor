const mongoose = require('mongoose'),
  Promise = require('bluebird'),
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
  accountModel = require('../models/accountModel'),
  WebSocket = require('ws'),
  hashes = require('../services/hashes'),
  expect = require('chai').expect,
  amqp = require('amqplib'),
  
  Stomp = require('webstomp-client');

let amqpInstance, blockHeight,  accounts = config.dev.accounts;

describe('core/block processor', function () {


  before(async () => {
    await saveAccountForAddress(accounts[0]);
    amqpInstance = await amqp.connect(config.rabbit.url);
    await clearQueues(amqpInstance);
  });

  after(async() => {
    await amqpInstance.close();
    await mongoose.disconnect();
  });

  afterEach(async () => {
    await clearQueues(amqpInstance);
  })


  it('check for blockHashing -- just drop database and check that get new block', async () => {
    await blockModel.remove();
    await Promise.delay(5000);
    const block = await blockModel.findOne({network: config.node.network}).sort('-number');
    expect(block.number).to.be.greaterThan(0);
  });

  it('check for rollback blockHashing -- just write in db wrong blocks and check t', async () => {
    await blockModel.remove();
    const block = {timeStamp: 1, type: 257, hash: 'sdfsdfsdf'};
    await blockModel.findOneAndUpdate({number: 2}, block,{upsert: true});
    await Promise.delay(5000);
    const blockAfter = await blockModel.findOne({network: config.node.network}).sort('-number');
    expect(blockAfter.number).to.be.greaterThan(1);
  });

  it('send some nem from account0 to account1 and validate countMessages(2) and structure message', async () => {


    const checkMessage = function (content) {
      expect(content).to.contain.all.keys(
        'amount',
        'timeStamp',
        'signature',
        'fee',
        'recipient',
        'type',
        'deadline',
        'message',
        'version',
        'signer',
        'unconfirmed'
      );
      expect(content.recipient).to.be.equal(accounts[0]);
      expect(content.type).to.be.equal(257);
    };

    return await Promise.all([
      (async() => {
        const tx =await createTransaction(accounts[0], 0.000001);
        if (tx.code == 5) {
          throw new Error('Account has not balance');
        }
      })(),
      (async () => {
        const channel = await amqpInstance.createChannel();  
        await connectToQueue(channel);
        return await consumeMessages(1, channel, (message) => {
          const content = JSON.parse(message.content);
          if (content.recipient === accounts[0]) {
              checkMessage(content);
              return true;
          }
          return false;
        });
      })(),
      (async () => {
        const ws = new WebSocket('ws://localhost:15674/ws');
        const client = Stomp.over(ws, {heartbeat: false, debug: false});
        await consumeStompMessages(1, client, (message) => {
          const body = JSON.parse(message.body);
          if (body.recipient === accounts[0]) {
              checkMessage(body);
              return true;
          }
          return false;
        });
        return await client.disconnect();
      })()
    ]);
  });

  it('delete accounts and send transfer transaction and after delay 0 messages', async () => {

    await accountModel.remove();
    let tx =await createTransaction(accounts[0], 0.000001);
    if (tx.code == 5) {
        throw new Error('Account has not balance');
    }
    await Promise.delay(1000);
    const channel = await amqpInstance.createChannel();  
    const queue =await connectToQueue(channel); 
    expect(queue.messageCount).to.equal(0);
  });

});
