const config = require('../config'),
    nem = require('nem-sdk').default;


module.exports = async (accountTo, sum) => {
    // Create an NIS endpoint object
    const servArr = config.nis.server.split(/:/);
    const endpoint = nem.model.objects.create("endpoint")(
        servArr[0] + ':' + servArr[1], servArr[2]
       );
    const common = nem.model.objects.create("common")("",  config.dev.privateKey);

    // Create an un-prepared transfer transaction object
    const transferTransaction = nem.model.objects.create("transferTransaction")(accountTo, sum, 'Hello');

    // Prepare the transfer transaction object
    const transactionEntity = nem.model.transactions.prepare("transferTransaction")(
        common, 
        transferTransaction, 
        config.nis.network
    );

    // Serialize transfer transaction and announce
    const ll = await nem.model.transactions.send(common, transactionEntity, endpoint);
    console.log(transactionEntity);
    return ll;
};
