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
  sender = require('../utils/sender');

module.exports = (ctx) => {

  before(async () => {
    await models.blockModel.remove({});
    await models.txModel.remove({});
    await models.accountModel.remove({});
    ctx.blockProcessorPid = spawn('node', ['index.js'], {env: process.env, stdio: 'ignore'});
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

    ctx.blockProcessorPid = spawn('node', ['index.js'], {env: process.env, stdio: 'ignore'});
    await Promise.delay(60000);
    let newBlockCount = await models.blockModel.count();
    expect(newBlockCount).to.be.greaterThan(oldBlockCount);
  });


  it('kill again, push wrong blocks and restart block processor', async () => {

    ctx.blockProcessorPid.kill();

    let state = {};
    state.blocks = await models.blockModel.find({}).sort({number: -1}).limit(6);
    state.txs = await models.txModel.find({}).sort({number: -1});

    let lastBlocks = await models.blockModel.find({}).sort({number: -1}).limit(6);
    for (let block of lastBlocks) {
      await models.blockModel.remove({number: block.number});
      block = block.toObject();
      await models.blockModel.create(block);

      let txs = await models.txModel.find({blockNumber: block.number});
      await models.txModel.remove({blockNumber: block.number});

      for (let tx of txs) {
        tx = tx.toObject();
        await models.txModel.create(tx);
      }

    }

    ctx.blockProcessorPid = spawn('node', ['index.js'], {env: process.env, stdio: 'ignore'});
    await Promise.delay(10000);

    let newBlocks = await models.blockModel.find({number: {'$lte': state.blocks[0].number}}).sort({number: -1}).limit(6);
    state.blocks = _.chain(state.blocks).sortBy('_id').map(block => _.omit(block.toObject(), ['_id', 'created', '__v'])).value();
    newBlocks = _.chain(newBlocks).sortBy('_id').map(block => _.omit(block.toObject(), ['_id', 'created', '__v'])).value();

    for (let number = 0; number < state.blocks.length; number++) 
      expect(_.isEqual(state.blocks[number], newBlocks[number])).to.eq(true);
    


    let newTxs = await models.txModel.find({blockNumber: {'$lte': state.txs[0].blockNumber}});
    state.txs = _.chain(state.txs).sortBy('_id').map(tx => tx.toObject()).value();
    newTxs = _.chain(newTxs).sortBy('_id').map(tx => tx.toObject()).value();

    for (let number = 0; number < state.txs.length; number++)
      expect(_.isEqual(state.txs[number], newTxs[number])).to.eq(true);
  });


  after(async () => {
    ctx.blockProcessorPid.kill();
  });


};
