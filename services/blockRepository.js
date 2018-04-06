const config = require('../config'),
  _ = require('lodash'),
  sem = require('semaphore')(1),
  nem = require('nem-sdk').default,
  hashes = require('./hashes'),

  blockModel = require('../models/blockModel'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'app.services.blockRepository'});

/**
 * @return {Promise return blockModels}
 */
const findLastBlocks = async () => {
  return await blockModel.find({
    network: config.node.network,
    timestamp: {
      $ne: 0
    }
  }).sort({
    number: -1
  }).limit(config.consensus.lastBlocksValidateAmount);
};

/**
 * @return {Promise return blockModel}
 */
const findUnconfirmedBlock = async () => {
  return await blockModel.findOne({
    number: -1
  }) || new blockModel({
    number: -1,
    hash: null,
    timestamp: 0,
    transactions: []
  });
};

/**
 * @param {Array of String} hashes
 * @return {Array of blockModel}
 */
const findBlocksByHashes = async (hashes) => {
  if (hashes.length === 0) 
  {return [];}
  const blocks = await blockModel.find({
    hash: {
      $in: hashes
    }
  }, {
    number: 1
  });
  return blocks;
};

/**
 * @return {Promise}
 */
const removeUnconfirmedBlock = async () => {
  return await blockModel.remove({
    number: -1
  });
};

/**
 * 
 * @param {blockModel} block 
 * @return {Promise}
 */
const saveUnconfirmedBlock = async (block) => {
  return await blockModel.findOneAndUpdate({
    number: -1
  }, _.omit(block.toObject(), '_id', '__v'), {
    upsert: true
  });
};


/**
 * 
 * @param {blockModel} block 
 * @param {Array of transactions || null} txs
 * @return {blockModel} 
 */
const createBlock = (block) => {
  return _.merge(block, {
    network: config.node.network,
    number: block.height,
    hash: hashes.calculateBlockHash(block),
    timestamp: block.time || Date.now(),
    
    transactions: block.transactions.map(tx => 
      _.merge(tx, {
        sender:  nem.model.address.toAddress(tx.signer, config.node.network)
      })
    )
  });
};

/**
 * @return {Promise}
 */
const initModels = async () => {
  await blockModel.init();  
};

/**
 * 
 * @param {Array of blockModel.transaction} txs 
 * @return {Promise return Array of blockModel.transaction}
 */
const createTransactions = async (txs) => {
  return txs;
};

/**
 * @param {blockModel} block
 * @param {function return Promise} afterSave
 * @return {Promise}
 * 
 **/
const saveBlock = async (block, afterSave = () => {}) => {
  if (block.txs) 
  {block.txs = await createTransactions(block.txs);}
  block = createBlock(block);

  return new Promise(async (res) => {
    sem.take(async () => {
      try {
        await updateDbStateWithBlock(block);
        await afterSave(null);
      } catch (e) {
        await afterSave(e, null);
      }
      sem.leave();
      res();
    });
  });
};

/**
 * 
 * @param {Number} startNumber 
 * @param {Number} limit 
 * @return {Promise}
 */
const removeBlocksForNumbers = async (startNumber, limit) => {
  await blockModel.remove({
    $or: [
      {hash: {$lte: startNumber, $gte: startNumber - limit}},
      {number: {$gte: startNumber}}
    ]
  }).catch(log.error);
};

const updateDbStateWithBlock = async (block) => {
  await blockModel.findOneAndUpdate({number: block.number}, block, {upsert: true});

  await blockModel.update({number: -1}, {
    $pull: {
      transactions: {
        hash: {
          $in: block.transactions.map(tx => tx.hash)
        }
      }
    }
  }).catch(log.error);
};

/**
 * @return {Promise return Number}
 */
const findLastBlockNumber = async () => {
  return await blockModel.findOne({network: config.node.network}, {number: 1}, {sort: {number: -1}});
};

/**
 * 
 * @param {Array of Number} blockNumberChunk 
 * @return {Promise return Array of blockModel}
 */
const countBlocksForNumbers = async (blockNumberChunk) => {
  return await blockModel.count({network: config.node.network, number: {$in: blockNumberChunk}});
};


module.exports = {
  initModels,
  
  createBlock,
  createTransactions,


  findLastBlocks,
  findBlocksByHashes,
  findLastBlockNumber,
  countBlocksForNumbers,

  saveBlock,
  removeBlocksForNumbers,

  findUnconfirmedBlock,  
  saveUnconfirmedBlock,   
  removeUnconfirmedBlock  
};
