/**
 * Block processor
 * @module services/blockProcess
 */

const _ = require('lodash'),
  nis = require('./nisRequestService'),
  utils = require('../utils'),
  accountModel = require('../models/accountModel'),
  txsProcessService = require('./txsProcessService'),
  Promise = require('bluebird');

module.exports = async (currentBlock) => {
  /**
   * Get latest block number from network
   * @type {number}
   */
  const blockHeight = await nis.blockHeight();

  if (!blockHeight || blockHeight <= currentBlock)
    return Promise.reject({code: 0});

  let block = await nis.getBlock(currentBlock + 1);

  if (!block)
    return Promise.reject({code: 0});

  if (!_.get(block, 'transactions') || _.isEmpty(block.transactions)) {
    return Promise.reject({code: 2});
  }

  return await txsProcessService(block.transactions);

};
