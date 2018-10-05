/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const models = require('../../models'),
  _ = require('lodash'),
  expect = require('chai').expect,
  Promise = require('bluebird'),
  spawn = require('child_process').spawn,
  config = require('../config'),
  sender = require('../utils/sender');

module.exports = (ctx) => {

  before(async () => {
    await models.blockModel.remove({});
    await models.txModel.remove({});
    await models.accountModel.remove({});
    ctx.blockProcessorPid = spawn('node', ['index.js'], {
      env: _.merge({PROVIDERS: ctx.providers.join(',')}, process.env),
      stdio: 'ignore'
    });
    await Promise.delay(60000);
  });

  it('validate block processor caching ability', async () => {
    await Promise.delay(60000);
    let blockCount = await models.blockModel.count();
    expect(blockCount).to.be.greaterThan(50);
  });


  it('kill and restart block processor', async () => {
    ctx.blockProcessorPid.kill();

    await Promise.delay(5000);
    const oldBlockCount = await models.blockModel.count();
    await sender.sendTransaction(ctx.accounts, 0.00001);

    ctx.blockProcessorPid = spawn('node', ['index.js'], {
      env: _.merge({PROVIDERS: ctx.providers.join(',')}, process.env),
      stdio: 'ignore'
    });
    await Promise.delay(60000);
    let newBlockCount = await models.blockModel.count();
    expect(newBlockCount).to.be.greaterThan(oldBlockCount);
  });


  it('kill again, delete some blocks and restart block processor', async () => {

    ctx.blockProcessorPid.kill();

    let state = {};
    state.blocks = await models.blockModel.find({}).sort({number: -1}).limit(3);
    state.txs = await models.txModel.find({blockNumber: {$in: state.blocks.map(block => block.number)}});


    await models.blockModel.remove({number: {$in: state.blocks.map(block => block.number)}});
    await models.txModel.remove({blockNumber: {$in: state.blocks.map(block => block.number)}});

    let grabbedBlocksCount = 0;
    let minBlock = _.chain(state.blocks).sortBy('number').head().get('number').value();
    let maxBlock = _.chain(state.blocks).sortBy('number').last().get('number').value();


    ctx.blockProcessorPid = spawn('node', ['index.js'], {
      env: _.merge({PROVIDERS: ctx.providers.join(',')}, process.env),
      stdio: 'ignore'
    });

    const delta = maxBlock - minBlock;
    await ctx.amqp.channel.assertQueue(`app_${config.rabbit.serviceName}_test_features.block`, {autoDelete: true, durable: false});
    await ctx.amqp.channel.bindQueue(`app_${config.rabbit.serviceName}_test_features.block`, 'events', `${config.rabbit.serviceName}_block`);

    if (delta > 0)
      await new Promise(res =>
        ctx.amqp.channel.consume(`app_${config.rabbit.serviceName}_test_features.block`, async data => {

          if (!data)
            return;

          const message = JSON.parse(data.content.toString());

          if (message.block < minBlock || message.block > maxBlock)
            return;

          grabbedBlocksCount++;
          if (grabbedBlocksCount !== delta + 1)
            return;

          await ctx.amqp.channel.deleteQueue(`app_${config.rabbit.serviceName}_test_features.block`);
          res();
        }, {noAck: true, autoDelete: true})
      );


    let newBlocks = await models.blockModel.find({number: {$in: state.blocks.map(block => block.number)}}).limit(6);
    state.blocks = _.chain(state.blocks).sortBy('number').map(block => _.omit(block.toObject(), ['created', '__v'])).value();
    newBlocks = _.chain(newBlocks).sortBy('number').map(block => _.omit(block.toObject(), ['created', '__v'])).value();

    for (let number = 0; number < state.blocks.length; number++) {
      expect(_.isEqual(state.blocks[number], newBlocks[number])).to.eq(true);
    }

    let newTxs = await models.txModel.find({blockNumber: {$in: state.blocks.map(block => block.number)}});
    state.txs = _.chain(state.txs).sortBy('_id').map(tx => tx.toObject()).value();
    newTxs = _.chain(newTxs).sortBy('_id').map(tx => tx.toObject()).value();

    for (let number = 0; number < state.txs.length; number++)
      expect(state.txs[number]._id).to.eq(newTxs[number]._id);
  });


  after(async () => {
    ctx.blockProcessorPid.kill();
  });


};
