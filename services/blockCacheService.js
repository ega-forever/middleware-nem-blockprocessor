const config = require('../config'),
  bunyan = require('bunyan'),
  _ = require('lodash'),
  Promise = require('bluebird'),
  EventEmitter = require('events'),
  blockModel = require('../models/blockModel'),
  nis = require('./nisRequestService'),
  nem = require('nem-sdk').default,
  log = bunyan.createLogger({name: 'app.services.blockCacheService'});

/**
 * @service
 * @description filter txs by registered addresses
 * @param block - an array of txs
 * @returns {Promise.<*>}
 */

class BlockCacheService {

  constructor (endpoint) {
    this.endpoint = endpoint;
    this.events = new EventEmitter();
    this.currentHeight = 0;
    this.lastBlocks = [];
    this.isSyncing = false;
    this.pendingTxCallback = (err, tx) => this.UnconfirmedTxEvent(err, tx);
  }

  async startSync () {
    if (this.isSyncing)
      return;

    await this.indexCollection();
    this.isSyncing = true;

    await blockModel.remove({number: -1});

    const currentBlocks = await blockModel.find({network: config.nis.network}).sort('-number').limit(config.consensus.lastBlocksValidateAmount);
    this.currentHeight = _.chain(currentBlocks).get('0.number', -1).add(1).value();
    log.info(`caching from block:${this.currentHeight} for network:${config.nis.network}`);
    this.lastBlocks = _.chain(currentBlocks).map(block => block.hash).compact().reverse().value();
    this.doJob();
    //this.web3.eth.filter('pending').watch(this.pendingTxCallback); todo rewrite

  }

  async doJob () {
    while (this.isSyncing) {
      try {
        let block = await this.processBlock();
        console.log(block)
        await blockModel.findOneAndUpdate({number: block.number}, block, {upsert: true});
        await blockModel.update({number: -1}, {
          $pull: {
            transactions: {
              hash: {
                $in: block.transactions.map(tx => tx.hash)
              }
            }
          }
        });

        this.currentHeight++;
        _.pullAt(this.lastBlocks, 0);
        this.lastBlocks.push(block.hash);
        this.events.emit('block', block);
      } catch (err) {

        console.log(err)
/*        if (_.has(err, 'cause') && err.toString() === web3Errors.InvalidConnection('on IPC').toString())
          return process.exit(-1);*/

        if (_.get(err, 'code') === 0) {
          log.info(`await for next block ${this.currentHeight + 1}`);
          await Promise.delay(10000);
        }

        if (_.get(err, 'code') === 1) {
          let lastCheckpointBlock = await blockModel.findOne({hash: this.lastBlocks[0]});
          log.info(`wrong sync state!, rollback to ${lastCheckpointBlock.number - 1} block`);
          await blockModel.remove({hash: {$in: this.lastBlocks}});
          const currentBlocks = await blockModel.find({network: config.nis.network}).sort('-number').limit(config.consensus.lastBlocksValidateAmount);
          this.lastBlocks = _.chain(currentBlocks).map(block => block.hash).reverse().value();
          this.currentHeight = lastCheckpointBlock - 1;
        }
      }
    }
  }

  async UnconfirmedTxEvent (err) {

    if (err)
      return;

    const block = await Promise.promisify(this.web3.eth.getBlock)('pending', true);
    let currentUnconfirmedBlock = await blockModel.findOne({number: -1}) || {
        number: -1,
        hash: null,
        timestamp: 0,
        txs: []
      };

    _.merge(currentUnconfirmedBlock, {transactions: _.get(block, 'transactions', [])});

    await blockModel.findOneAndUpdate({number: -1}, _.omit(currentUnconfirmedBlock, ['_id', '__v']), {upsert: true});
  }

  async stopSync () {
    this.isSyncing = false;
    //this.web3.eth.filter.stopWatching(this.pendingTxCallback);
  }

  async processBlock () {

    let block = await nis.blockHeight();

    if (block === this.currentHeight) //heads are equal
      return Promise.reject({code: 0});

/*    if (block === 0) {
      let syncState = await Promise.promisify(this.web3.eth.getSyncing)();
      if (syncState.currentBlock !== 0)
        return Promise.reject({code: 0});
    }*/

    if (block < this.currentHeight)
      return Promise.reject({code: 1}); //head has been blown off

    const lastBlocks = await nis.getLast10BlocksFromHeight(this.currentHeight - 9 < 1 ? 1 : this.currentHeight - 9);

    //const lastBlockHashes = await Promise.mapSeries(this.lastBlocks, async blockHash => await Promise.promisify(this.web3.eth.getBlock)(blockHash, false));

    const filtered = _.filter(lastBlocks, block=>this.lastBlocks.includes(block.hash));

    if (filtered.length !== this.lastBlocks.length)
      return Promise.reject({code: 1}); //head has been blown off

    /**
     * Get raw block
     * @type {Object}
     */

    let rawBlock = _.chain(lastBlocks)
      .find(item=>item.block.height === this.currentHeight)
      .thru(item=>
        _.merge(item.block, {
          number: item.block.height,
          hash: item.hash,
          transactions: item.txes.map(tx=>
            _.merge(tx, {
              sender:  nem.model.address.toAddress(tx.signer, config.nis.network)
            })
          ),
          network: config.nis.network
        }))
      .value();

    return rawBlock;
  }

  async indexCollection () {
    log.info('indexing...');
    await blockModel.init();
    log.info('indexation completed!');
  }

  async isSynced () {
    const height = await Promise.promisify(this.web3.eth.getBlockNumber)();
    return this.currentHeight >= height - config.consensus.lastBlocksValidateAmount;
  }

}

module.exports = BlockCacheService;
