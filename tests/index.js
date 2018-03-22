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
  awaitLastBlock = require('./helpers/awaitLastBlock'),
  createTransaction = require('./helpers/createTransaction'),
  consumeStompMessages = require('./helpers/consumeStompMessages'),
  blockModel = require('../models/blockModel'),
  net = require('net'),
  WebSocket = require('ws'),
  nis = require('../services/nisRequestService'),
  expect = require('chai').expect,
  amqp = require('amqplib'),
  nem = require('nem-sdk').default,
  
  Stomp = require('webstomp-client');

let accounts = config.dev.accounts, amqpInstance, blockHeight;

describe('core/block processor', function () {


  before(async () => {
    await saveAccountForAddress(accounts[0]);

    amqpInstance = await amqp.connect(config.rabbit.url);
    
    await clearQueues(amqpInstance);
  });

  after(async () => {
    return mongoose.disconnect();
  });

  afterEach(async () => {
    await clearQueues(amqpInstance);
  })

   it('check for blockHashing -- just drop database and check that get block', async () => {
     await blockModel.remove({});
     await Promise.delay(10000);
     const block = await blockModel.findOne({network: config.nis.network}).sort('-number');
     expect(block.number).to.be.greaterThan(0);
   });

  it('send some nem from account0 to account1 and validate countMessages(2) and structure message', async () => {


    const checkMessage = function (content) {
      console.log(content);      
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
        'sender',
        'unconfirmed'
      );
      expect(content.recipient).to.be.equal(accounts[0]);
      expect(content.type).to.be.equal(257);
    };

    return await Promise.all([
      (async() => {
        let tx =await createTransaction(accounts[0], 0.000001);
        if (tx.code == 5) {
          throw new Error('Account has not balance');
        }
      })(),
      (async () => {
        const channel = await amqpInstance.createChannel();  
        await connectToQueue(channel);
        return consumeMessages(1, channel, (message) => {
          const content = JSON.parse(message.content);
          if (content.recipient === accounts[0]) {
              checkMessage(content);
              return true;
          }
          return false;
        });
      })(),
       (async () => {
         const ws = new WebSocket('ws://localhost:5672/ws');
         const client = Stomp.over(ws, {heartbeat: false, debug: false});
         return await consumeStompMessages(1, client, (message) => {
           checkMessage(JSON.parse(message.body));
         });
       })()
    ]);
  });

   it('delete accounts and send transfer transaction and after delay 0 messages', async () => {

    await accountModel.remove();
    let tx =await createTransaction(accounts[0], 0.000001);
    if (tx.code == 5) {
        throw new Error('Account has not balance');
    }
    Promise.delay(1000, async() => {
      const channel = await amqpInstance.createChannel();  
      const queue =await connectToQueue(channel); 
      expect(queue.messageCount).to.equal(0);
    });
   });

});
