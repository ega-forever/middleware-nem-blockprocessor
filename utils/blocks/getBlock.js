/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const Promise = require('bluebird'),
  hashes = require('../hashes/hashes'),
  transformTx = require('../txs/transformTx'),
  providerService = require('../../services/providerService');

/**
 * @function
 * @description get block from the node
 * @param blockNumber
 * @return {Promise<{number: *, timestamp: *, hash: *, signer: *, txs: *}>}
 */
module.exports = async (blockNumber) => {

  let apiProvider = await providerService.get();

  let rawBlock = await apiProvider.getBlockByNumber(blockNumber);

  if(!rawBlock)
    return Promise.reject({code: 2});

  const txs = rawBlock.transactions.map(tx => transformTx(tx, rawBlock.number));

  return {
    number: rawBlock.height,
    timestamp: rawBlock.timeStamp || Date.now(),
    hash: hashes.calculateBlockHash(rawBlock),
    signer: rawBlock.signer,
    txs: txs
  };

};
