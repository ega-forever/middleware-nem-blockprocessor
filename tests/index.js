require('dotenv/config');

const mongoose = require('mongoose'),
  Promise = require('bluebird'),
  config = require('../config');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const expect = require('chai').expect,
  blockModel = require('../models/blockModel'),
  blockProcessService = require('../services/blockProcessService'),
  accountModel = require('../models/accountModel'),
  nis = require('../services/nisRequestService'),
  amqp = require('amqplib'),
  ctx = {},
  utils = require('../utils');

let blockHeight = 0;

describe('core/block processor', function () {
  before(async () => {
    blockHeight = await nis.blockHeight();
    expect(blockHeight).that.is.a('number');
  });

  after(() => {
    return mongoose.disconnect();
  });

  it('validate block number is not equal to 0', async () => {
    ctx.block = await blockModel.findOne({});
    expect(ctx.block).to.have.property('block');
    expect(ctx.block.block).to.be.above(0);
  });

  it('find future block with transactions', async () => {

    let findBlock = async (height) => {
      let block = await nis.getBlock(ctx.block.block + height);
      if (block.transactions.length === 0)
        return await findBlock(height + 1);
      return block;
    };

    let block = await findBlock(700);

    expect(block).to.have.property('transactions');
    ctx.block = block;
  });

  it('add recipient from first tx of found block', async () => {
    await new accountModel({address: ctx.block.transactions[0].recipient}).save();
  });

  it('validate notification via amqp about new tx', async () => {

    let amqpInstance = await amqp.connect(config.rabbit.url);
    let channel = await amqpInstance.createChannel();

    try {
      await channel.assertExchange('events', 'topic', {durable: false});
      await channel.assertQueue(`app_${config.rabbit.serviceName}_test.transaction`);
      await channel.bindQueue(`app_${config.rabbit.serviceName}_test.transaction`, 'events', `${config.rabbit.serviceName}_transaction.*`);
    } catch (e) {
      channel = await amqpInstance.createChannel();
    }

    return await new Promise(res => {
      channel.consume(`app_${config.rabbit.serviceName}_test.transaction`, data => {
        amqpInstance.close();
        res();
      }, {noAck: true})
    });
  });

});