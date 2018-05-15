/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */
const mongoose = require('mongoose'),
  Promise = require('bluebird'),
  config = require('./config');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const saveAccountForAddress = require('./helpers/saveAccountForAddress'),
  connectToQueue = require('./helpers/connectToQueue'),
  clearQueues = require('./helpers/clearQueues'),
  _ = require('lodash'),
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

describe('core/block processor', function () {


  before(async () => {
    console.log('1');
    await saveAccountForAddress(accounts[0]);
    console.log('2');
    amqpInstance = await amqp.connect(config.rabbit.url);
    console.log('3');
    await clearQueues(amqpInstance);
    console.log('4');
  });

  after(async () => {
    console.log('21');
    await amqpInstance.close();
    console.log('22');
    await mongoose.disconnect();
    console.log('23');
  });

  afterEach(async () => {
    await clearQueues(amqpInstance);
  });


  it('check for blockHashing -- check that get new block', async () => {
    console.log('31');
    const block = await blockModel.findOne({}).sort('-number');
    console.log('32');
    expect(block.number).to.be.greaterThan(0);
    console.log('33');
    const tx = await txModel.findOne({}).sort('-blockNumber');
    console.log('34');
    expect(tx.blockNumber).to.be.greaterThan(0);
    console.log('35');
  });



  it('send some nem from account0 to account1 and validate messages and db', async () => {
    const channel = await amqpInstance.createChannel();  
    await connectToQueue(channel);

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
        'blockNumber'
      );
      expect(content.sender).to.be.equal(accounts[0]);

      expect(content.recipient).to.be.equal(accounts[1]);

      expect(content.amount).to.be.equal(1);
      expect(content.type).to.be.equal(257);
      return true;
    };

    const checkDb = async function (transaction) {
      if (transaction.blockNumber !== -1)  {
        const block = await blockModel.findOne({number: transaction.blockNumber});
        expect(block.number).to.equal(transaction.blockNumber);
        expect(block.txs).to.not.empty;
        const txHash = _.find(block.txs, hash => hash === transaction.hash);
        expect(txHash).to.not.undefined;
      }

      const tx = await txModel.findOne({hash: transaction.hash});
      expect(tx.amount).to.equal(transaction.amount);
      expect(tx.sender).to.equal(transaction.sender);
      expect(tx.recipient).to.equal(transaction.recipient);
      return true;
    };

    let tx;

    return await Promise.all([
      (async () => {
        tx =await createTransaction(accounts[1], 0.000001, config.dev.privateKey);
        if (tx.code === 5) {
          tx =await createTransaction(accounts[0], 0.000001, config.dev.privateKeyTwo);          
          if (tx.code === 5) 
            throw new Error('Account has not balance');
        }
      })(),
      (async () => {
        return await consumeMessages(1, channel, (message) => {
          const content = JSON.parse(message.content);
          if (tx.timeStamp && content.timeStamp === tx.timeStamp) {
            checkMessage(content);
            checkDb(content);
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
          if (tx.timeStamp && body.timeStamp === tx.timeStamp) {
            checkMessage(body);
            checkDb(body);
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
    let tx =await createTransaction(accounts[1], 0.000001, config.dev.privateKey);
    if (tx.code === 5) {
      tx =await createTransaction(accounts[0], 0.000001, config.dev.privateKeyTwo);          
      if (tx.code === 5) 
        throw new Error('Account has not balance');
    }
    
    await Promise.delay(8000);
    const channel = await amqpInstance.createChannel();  
    const queue =await connectToQueue(channel); 
    expect(queue.messageCount).to.equal(0);
  });


});
