/**
 * Block processor
 * @module services/blockProcess
 *
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */

const _ = require('lodash'),
  models = require('../models');

module.exports = async (txs) => {
  if (txs.length === 0)
    return [];
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
        .map(tx => _.compact([tx.sender, tx.recipient, tx.coSigner]))
        .flattenDeep()
        .uniq()
        .value()
    }
  };

  const accounts = await models.accountModel.find(query);
  const nemAccounts = _.map(accounts, a => a.address);
  if (_.isEmpty(nemAccounts))
    return [];

  /**
   * Filtering for customer's transactions
   * @type {Array}
   */

  return _.transform(txs, (acc, tx) => {

    _.compact([tx.sender, tx.recipient, tx.coSigner]).forEach(address => {
      if (nemAccounts.indexOf(address) !== -1)
        acc.push(_.merge({}, tx, {address}));
    });
  }, []);

};
