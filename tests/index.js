require('dotenv/config');

const mongoose = require('mongoose'),
  Promise = require('bluebird'),
  config = require('../config');

mongoose.Promise = Promise; // Use custom Promises
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri);

const expect = require('chai').expect,
  blockModel = require('../models/blockModel'),
  blockProcessService = require('../services/blockProcessService'),
  accountModel = require('../models/accountModel'),
  nis = require('../services/nisRequestService'),
  utils = require('../utils');

let blockHeight = 0;

describe('core/block processor', function () {
  before(async () => {
    blockHeight = await nis.blockHeight();
    expect(blockHeight).that.is.a('number');
  });

  after(() => {
    return mongoose.disconnect();
  });

  it('add account to mongo', async () =>
    await new accountModel({
      address: 'TDEK3DOKN54XWEVUNXJOLWDJMYEF2G7HPK2LRU5W'
    }).save()
  );

  it('process test block', async () => {
    let block = await nis.getBlock(1218231);
    expect(block).to.have.property('transactions');
    expect(block.transactions).to.be.an('array').to.have.lengthOf(3);
  });

});