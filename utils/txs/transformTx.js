const hashes = require('../hashes/hashes'),
  nem = require('nem-sdk').default,
  config = require('../../config'),
  _ = require('lodash');

/**
 * @function
 * @description transform transaction object
 * @param tx - the transaction
 * @param blockNumber - tx's blockNumber
 * @return {{
 *  blockNumber: *,
 *  timestamp: number,
 *  amount: (number|null),
 *  hash: *,
 *  recipient: string,
 *  fee: number,
 *  messagePayload: *,
 *  messageType: *,
 *  mosaics: (*|null)
 *  }}
 */
module.exports = (tx, blockNumber) => {

  const transformedTx = {
    blockNumber: blockNumber,
    timestamp: tx.timeStamp,
    amount: tx.amount || null,
    hash: hashes.calculateTransactionHash(tx),
    recipient: tx.recipient,
    fee: tx.fee,
    messagePayload: _.get(tx, 'message.payload', null),
    messageType: _.get(tx, 'message.type', null),
    mosaics: tx.mosaics || null
  };

  if (tx.otherTrans) {
    transformedTx.coSigner = nem.model.address.toAddress(tx.signer, config.node.network);

    transformedTx.messagePaload = _.get(tx.otherTrans, 'message.payload', null);
    transformedTx.messageType = _.get(tx.otherTrans, 'message.type', null);
    transformedTx.amount = transformedTx.amount || null;
    transformedTx.fee = transformedTx.fee || tx.fee;
    transformedTx.recipient = tx.otherTrans.recipient;
    transformedTx.sender = nem.model.address.toAddress(tx.otherTrans.signer, config.node.network);
  } else 
    transformedTx.sender = nem.model.address.toAddress(tx.signer, config.node.network);
  

  return transformedTx;
};
