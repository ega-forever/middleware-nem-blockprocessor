/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const bunyan = require('bunyan'),
  sem = require('semaphore')(3),
  _ = require('lodash'),
  Promise = require('bluebird'),
  config = require('../../config'),
  models = require('../../models'),
  removeUnconfirmedTxs = require('../txs/removeUnconfirmedTxs'),
  log = bunyan.createLogger({name: 'utils.blocks.addBlock', level: config.logs.level});

/**
 * @function
 * @description add block to the cache
 * @param block - prepared block with full txs
 * @param removePending - remove pending transactions
 * @returns {Promise.<*>}
 */

const addBlock = async (block, removePending = false) => {

  return new Promise((res, rej) => {

    sem.take(async () => {
      try {
        await updateDbStateWithBlock(block, removePending);
        res();
      } catch (err) {
        log.error(err);
        await rollbackStateFromBlock(block);
        rej(err);
      }
      sem.leave();
    });

  });
};

/**
 * @function
 * @description add new block, txs and coins to the cache
 * @param block
 * @param removePending
 * @return {Promise<void>}
 */
const updateDbStateWithBlock = async (block, removePending) => {

  const txs = block.txs.map(tx => {
    return _.chain({})
      .merge(tx, {_id: tx.hash, timestamp: tx.timeStamp})
      .omit(['hash', 'timeStamp'])
      .value();
  });

  let bulkOps = txs.map(tx => {
    return {
      updateOne: {
        filter: {_id: tx._id},
        update: tx,
        upsert: true
      }
    };
  });

  if (bulkOps.length)
    await models.txModel.bulkWrite(bulkOps);

  if (removePending)
    await removeUnconfirmedTxs();

  const toSaveBlock = {
    _id: block.hash,
    number: block.number,
    timestamp: block.timestamp,
    signer: block.signer
  };
  return await models.blockModel.findOneAndUpdate({number: toSaveBlock.number}, toSaveBlock, {upsert: true});
};

/**
 * @function
 * @description rollback the cache to previous block
 * @param block - current block
 * @return {Promise<void>}
 */
const rollbackStateFromBlock = async (block) => {

  log.info('rolling back txs state');
  await models.txModel.remove({blockNumber: block.number});

  log.info('rolling back blocks state');
  await models.blockModel.remove({number: block.number});
};


module.exports = addBlock;
