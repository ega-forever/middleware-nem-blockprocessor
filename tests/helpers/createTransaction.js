/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const config = require('../config'),
  nem = require('nem-sdk').default;


module.exports = async (accountTo, sum, privateKey ) => {
  // Create an NIS endpoint object
  const servArr = config.dev.httpForTransaction.split(/:/);
  const endpoint = nem.model.objects.create('endpoint')(
    servArr[0] + ':' + servArr[1], servArr[2]
  );
  const common = nem.model.objects.create('common')('',  privateKey);

  // Create an un-prepared transfer transaction object
  const transferTransaction = nem.model.objects.create('transferTransaction')(accountTo, sum, 'Hello');

  // Prepare the transfer transaction object
  const transactionEntity = nem.model.transactions.prepare('transferTransaction')(
    common, 
    transferTransaction, 
    config.node.network
  );

  // Serialize transfer transaction and announce
  const ll = await nem.model.transactions.send(common, transactionEntity, endpoint);
  ll.timeStamp = transactionEntity.timeStamp;
  return ll;
};

