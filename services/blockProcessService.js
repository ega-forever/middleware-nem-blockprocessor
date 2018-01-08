/**
 * Block processor
 * @module services/blockProcess
 */

const _ = require('lodash'),
  nis = require('./nisRequestService'),
  utils = require('../utils'),
  accountModel = require('../models/accountModel'),
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

  /**
   * Search for tx's address occurence in DB
   * @type {string}
   */
  let query = {
    address: {
      $exists: true,
      $in: _.chain(block.transactions)
        .map(tx => [utils.toAddress(tx.signer, tx.version >> 24), tx.recipient])
        .flattenDeep()
        .uniq()
        .value()
    }
  };

  const accounts = await accountModel.find(query);
  const nemAccounts = _.map(accounts, a => a.address);

  if (_.isEmpty(nemAccounts)) {
    return Promise.reject({code: 2});
  }

  /**
   * Filtering for customer's transactions
   * @type {Array}
   */
  return _.chain(block.transactions)
    .filter((tx, idx) => {
      if (tx.type !== 257) return false;
      let elems = _.intersection(
        [tx.recipient, utils.toAddress(tx.signer, tx.version >> 24)],
        nemAccounts
      );
      block.transactions[idx].participants = elems;
      return !!elems.length;
    })
    .value();
};
