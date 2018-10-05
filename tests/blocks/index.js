/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const models = require('../../models'),
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
  spawn = require('child_process').spawn,
  providerService = require('../../services/providerService');

module.exports = (ctx) => {

  describe('hashes', () => hashesTests(ctx));

  before(async () => {
    await models.blockModel.remove({});
    await models.txModel.remove({});
    await models.accountModel.remove({});
  });


  it('get block', async () => {
    const instance = await providerService.get();
    const height = await instance.getHeight();
    const blockFromNode = await instance.getBlockByNumber(height - 1);

    const block = await getBlock(height - 1);

    expect(block).to.have.keys('number', 'hash', 'signer', 'timestamp', 'txs');
    expect(block.hash).to.equal(hashes.calculateBlockHash(blockFromNode));

    for (let tx of block.txs)
      expect(tx).to.have.keys('hash', 'blockNumber', 'timeStamp', 'amount', 'recipient',
        'messagePayload',
        'messageType',
        'mosaics',
        'fee', 'sender'
      );

  });

  it('add block', async () => {

    const instance = await providerService.get();
    const height = await instance.getHeight();

    const block = await getBlock(height - 1);
    const blockCopy = _.cloneDeep(block);
    await addBlock(block);

    expect(_.isEqual(block, blockCopy)).to.equal(true); //check that object hasn't been modified

    const isBlockExists = await models.blockModel.count({_id: block.hash});
    expect(isBlockExists).to.equal(1);
  });

  it('find missed blocks', async () => {

    ctx.blockProcessorPid = spawn('node', ['index.js'], {
      env: _.merge({PROVIDERS: ctx.providers.join(',')}, process.env),
      stdio: 'ignore'
    });
    await Promise.delay(30000);
    ctx.blockProcessorPid.kill();

    const instance = await providerService.get();
    const height = await instance.getHeight();

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

    expect(_.intersection(blocksToFetch, blocksToRemove).length).to.equal(blocksToRemove.length);

  });

  it('add unconfirmed tx', async () => {

    let oldTx = await models.txModel.findOne();

    if (!oldTx)
      await new Promise(res => {

        ctx.blockProcessorPid = spawn('node', ['index.js'], {
          env: _.merge({PROVIDERS: ctx.providers.join(',')}, process.env),
          stdio: 'ignore'
        });

        let interval = setInterval(async () => {

          let txCount = await models.txModel.count();

          if (!txCount)
            return;

          clearInterval(interval);
          ctx.blockProcessorPid.kill();
          res();
        }, 5000);
      });

    const instance = await providerService.get();
    oldTx = await models.txModel.findOne();
    const oldTxRaw = await instance.getTransaction(oldTx.sender, oldTx._id);

    const newTxRaw = _.cloneDeep(oldTxRaw);
    newTxRaw.timeStamp = Date.now();

    const newTx = await addUnconfirmedTx(newTxRaw);

    let isTxExists = await models.txModel.count({_id: oldTx._id});
    expect(isTxExists).to.equal(1);

    isTxExists = await models.txModel.count({_id: newTx.hash});
    expect(isTxExists).to.equal(1);
  });

  it('check filterTxsByAccountsService', async () => {
    const instance = await providerService.get();
    const height = await instance.getHeight();
    for (let i = 0; i < 2; i++) {
      let block = await getBlock(height - i);
      await addBlock(block);
    }
    const tx = await models.txModel.findOne();
    await models.accountModel.create({address: tx.sender});

    let filtered = await filterTxsByAccountsService([tx]);
    expect(!!_.find(filtered, {sender: tx.sender})).to.eq(true);


    await models.accountModel.remove();
    filtered = await filterTxsByAccountsService([tx]);
    expect(!!_.find(filtered, {sender: tx.sender})).to.eq(false);
  });

};
