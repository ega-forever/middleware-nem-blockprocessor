/**
 * Block processor
 * @module services/blockProcess
 */

const _ = require('lodash'),
  utils = require('../utils'),
  config = require('../config'),
  nem = require('nem-sdk').default,
  accountModel = require('../models/accountModel');

module.exports = async (txs) => {
  if (txs.length === 0)
  {return [];}
  /**
   * Search for tx's address occurence in DB
   * @type {string}
   */
  let query = {
    isActive: {
      $ne: false
    },
    address: {
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
    return [];
  }
  

  /**
   * Filtering for customer's transactions
   * @type {Array}
   */
  const filtered =  _.chain(txs)
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


  return _.chain(filtered).map(tx=> {


    const addresses = [tx.recipient];
    if (tx.signer) {
      tx.sender = nem.model.address.toAddress(tx.signer, config.node.network);
      addresses.push(tx.sender);
    } 

    const payload = _.chain(tx)
      .omit(['participants'])
      .value();

    return _.chain(addresses).uniq().map(addr => {
      return _.merge(payload, {'address': addr});
    }).value();
  }).flattenDeep().value();
};
