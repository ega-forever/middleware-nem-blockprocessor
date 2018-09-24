/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const bunyan = require('bunyan'),
  models = require('../../models'),
  _ = require('lodash'),
  transformTx = require('./transformTx'),
  config = require('../../config'),
  log = bunyan.createLogger({name: 'utils.txs.addUnconfirmedTx', level: config.logs.level});

/**
 * @function
 * @description add unconfirmed tx to cache
 * @param tx - unconfirmed transaction
 * @returns {Promise.<*>}
 */

module.exports = async (tx) => {

  tx = transformTx(tx, -1);
  const toSaveTx = _.chain({})
    .merge(tx, {_id: tx.hash, timestamp: tx.timeStamp})
    .omit(['hash', 'timeStamp'])
    .value();

  log.info(`inserting unconfirmed tx ${tx.hash}`);
  await models.txModel.create(toSaveTx);
  return tx;

};
