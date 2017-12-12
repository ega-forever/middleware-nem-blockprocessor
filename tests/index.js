require('dotenv/config');

const expect = require('chai').expect,
	mongoose = require('mongoose'),
	Promise = require('bluebird'),
	blockModel = require('../models/blockModel'),
	blockProcessService = require('../services/blockProcessService'),
	accountModel = require('../models/accountModel'),
	nis = require('../services/nisRequestService'),
	config = require('../config'),
	utils = require('../utils');

let blockHeight = 0;

describe('core/block processor', function () {
	before(async () => {
		mongoose.Promise = Promise;
    mongoose.connect(config.mongo.uri, { useMongoClient: true });
    blockHeight = await nis.blockHeight();

    expect(blockHeight).that.is.a('number');
	});
	
	after(() => {
		return mongoose.disconnect();
	});

	it('add account to mongo', async () => {
		try {
			await new accountModel(
				{address:'0x96efacba41ec096d2f05bb0a1860d7e2686b1d4c', nem:'TDEK3DOKN54XWEVUNXJOLWDJMYEF2G7HPK2LRU5W'}
			).save();
		} catch(e) {
			console.error(e);
		}
	});

	it('process test block', async () => {
		let block = await nis.getBlock(1218231);
		expect(block).to.have.property('transactions');
		expect(block.transactions).to.be.an('array').to.have.lengthOf(3);
	});

});