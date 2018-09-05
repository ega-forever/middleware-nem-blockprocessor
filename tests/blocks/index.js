/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const models = require('../../models'),
  config = require('../../config'),
  sender = require('../utils/sender'),
  hashes = require('../../utils/hashes/hashes'),
  hashesTests = require('./hashes'),
  _ = require('lodash'),
  filterTxsByAccountsService = require('../../services/filterTxsByAccountsService'),
  getBlock = require('../../utils/blocks/getBlock'),
  addBlock = require('../../utils/blocks/addBlock'),
  allocateBlockBuckets = require('../../utils/blocks/allocateBlockBuckets'),
  addUnconfirmedTx = require('../../utils/txs/addUnconfirmedTx'),
  expect = require('chai').expect,
  Promise = require('bluebird'),
  transformTx = require('../../utils/txs/transformTx'),
  spawn = require('child_process').spawn,
  providerService = require('../../services/providerService');

module.exports = (ctx) => {

  //describe('hashes', () => hashesTests(ctx));

  before(async () => {
    await models.blockModel.remove({});
    await models.txModel.remove({});
    await models.accountModel.remove({});
  });

  it('generate some blocks', async () => {
    let tx;
    await Promise.all([
      (async () => {
        tx = await sender.sendTransaction(ctx.accounts, 0.000001);
      })(),
      (async () => {
        await ctx.amqp.channel.assertQueue(`app_${config.rabbit.serviceName}_test_blocks.transaction`);
        await ctx.amqp.channel.bindQueue(`app_${config.rabbit.serviceName}_test_blocks.transaction`, 'events', `${config.rabbit.serviceName}_transaction.${address}`);
        await new Promise(res =>
          ctx.amqp.channel.consume(`app_${config.rabbit.serviceName}_test_blocks.transaction`, async data => {
            if(!data)
              return;
            const body = JSON.parse(data.content.toString());
            if (!tx.timeStamp || body.timeStamp !== tx.timeStamp) 
              return;
            await ctx.amqp.channel.deleteQueue(`app_${config.rabbit.serviceName}_test_blocks.transaction`);
            res();
          }, {noAck: true})
        );
      })()
    ]);

    ctx.nemTx = await models.txModel.findOne({timeStamp: tx.timeStamp});
  });


  it('get block', async () => {
    const instance = providerService.getConnectorFromURI(config.node.providers[0].uri);
    const height = await instance.getHeight();
    const blockFromNode = await instance.getBlockByNumber(height - 1);

    const block = await getBlock(height - 1);

    expect(block).to.have.keys('number', 'hash', 'signer', 'timestamp', 'txs');
    expect(block.hash).to.equal(hashes.calculateBlockHash(blockFromNode));

    for (let tx of block.txs) 
      expect(tx).to.have.keys('hash', 'blockNumber', 'timeStamp', 'amount', 'recipient', 
        'fee', 'sender'
      );

  });

  it('add block', async () => {

    const instance = providerService.getConnectorFromURI(config.node.providers[0].uri);
    const height = await instance.getHeight();

    const block = await getBlock(height - 1);
    const blockCopy = _.cloneDeep(block);
    await addBlock(block);

    expect(_.isEqual(block, blockCopy)).to.equal(true); //check that object hasn't been modified

    const isBlockExists = await models.blockModel.count({_id: block.hash});
    expect(isBlockExists).to.equal(1);
  });

  it('find missed blocks', async () => {

    ctx.blockProcessorPid = spawn('node', ['index.js'], {env: process.env, stdio: 'ignore'});
    await Promise.delay(30000);
    ctx.blockProcessorPid.kill();

    const instance = providerService.getConnectorFromURI(config.node.providers[0].uri);
    const height = await instance.getHeight();

    const blockCount = await models.blockModel.count({});
    expect(blockCount).to.equal(height + 1);

    let blocks = [];
    for (let i = 0; i < height - 2; i++)
      blocks.push(i);

    blocks = _.shuffle(blocks);

    const blocksToRemove = _.take(blocks, 50);

    await models.blockModel.remove({number: {$in: blocksToRemove}});

    const buckets = await allocateBlockBuckets();

    expect(buckets.height).to.equal(height - 1);


    let blocksToFetch = [];

    for (let bucket of buckets.missedBuckets) {

      if (bucket.length === 1) {
        blocksToFetch.push(...bucket);
        continue;
      }

      for (let blockNumber = _.last(bucket); blockNumber >= bucket[0]; blockNumber--)
        blocksToFetch.push(blockNumber);
    }

    expect(_.isEqual(_.sortBy(blocksToRemove), _.sortBy(blocksToFetch))).to.equal(true);

  });

  // it('add unconfirmed tx', async () => {
  //   await sender.sendTransaction(ctx.accounts, 0.000001);

  //   const tx = ctx.nemTx;
  //   const txCopy = _.cloneDeep(ctx.nemTx);

  //   await addUnconfirmedTx(tx);
  //   expect(_.isEqual(tx, txCopy)).to.equal(true); //check that object hasn't been modified

  //   const isTxExists = await models.txModel.count({_id: tx.hash});
  //   expect(isTxExists).to.equal(1);
  // });

  // it('check filterTxsByAccountsService', async () => {
  //   await models.accountModel.create({address: ctx.accounts[0]['address']});
  //   const instance = providerService.getConnectorFromURI(config.node.providers[0].uri);
  //   const height = await instance.getHeight();
  //   for (let i = 0; i < 2; i++) {
  //     let block = await getBlock(height - i);
  //     await addBlock(block);
  //   }
  //   const filtered = await filterTxsByAccountsService([ctx.nemTx]);

  //   expect(!!_.find(filtered, {sender: ctx.nemTx.sender})).to.eq(true);
  //   expect(!!_.find(filtered, {recipient: ctx.nemTx.recipient})).to.eq(false);
  // });

};
