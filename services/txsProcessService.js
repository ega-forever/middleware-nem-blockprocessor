/**
 * Block processor
 * @module services/blockProcess
 */

const _ = require('lodash'),
  utils = require('../utils'),
  accountModel = require('../models/accountModel'),
  Promise = require('bluebird');

module.exports = async (txs) => {

  /**
   * Search for tx's address occurence in DB
   * @type {string}
   */
  let query = {
    address: {
      $exists: true,
      $in: _.chain(txs)
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
  return _.chain(txs)
    .filter((tx, idx) => {
      if (tx.type !== 257) return false;
      let elems = _.intersection(
        [tx.recipient, utils.toAddress(tx.signer, tx.version >> 24)],
        nemAccounts
      );
      txs[idx].participants = elems;
      return !!elems.length;
    })
    .value();
};
