const config = require('../../config'),
    nem = require('nem-sdk').default;


module.exports = async (accountFrom, accountTo, sum) => {
    // Create an NIS endpoint object
    const endpoint = nem.model.objects.create("endpoint")(config.nis.server, config.nis.port);

    // Create a common object holding key
    // Create random bytes from PRNG
    const rBytes = nem.crypto.nacl.randomBytes(32);

    // Convert the random bytes to hex
    const privateKey = nem.utils.convert.ua2hex(rBytes);
    const common = nem.model.objects.create("common")("", privateKey);

    // Create an un-prepared transfer transaction object
    const transferTransaction = nem.model.objects.create("transferTransaction")(accountTo, 10, "Hello");

    // Prepare the transfer transaction object
    const transactionEntity = nem.model.transactions.prepare("transferTransaction")(common, transferTransaction, nem.model.network.data.testnet.id);

    // Serialize transfer transaction and announce
    return await nem.model.transactions.send(common, transactionEntity, endpoint);
};
