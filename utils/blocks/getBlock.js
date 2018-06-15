/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const Promise = require('bluebird'),
  hashes = require('../hashes/hashes'),
  transformTx = require('../txs/transformTx'),
  providerService = require('../../services/providerService'),
  _ = require('lodash');

module.exports = async (blockNumber) => {

  /**
   * Get raw block
   * @type {Object}
   */

  let apiProvider = await providerService.get();

  let rawBlock = await apiProvider.getBlockByNumber(blockNumber);

  if(!rawBlock)
    return Promise.reject({code: 2});

  const txs = rawBlock.transactions.map(tx => transformTx(tx, rawBlock.number));

  return {
    number: rawBlock.height,
    timeStamp: rawBlock.time || Date.now(),
    hash: hashes.calculateBlockHash(rawBlock),
    type: rawBlock.type,
    signature: rawBlock.signature,
    version: rawBlock.version,
    signer: rawBlock.signer,
    txs: txs,
    prevBlockHash: rawBlock.prevBlockHash.data
  };

};
