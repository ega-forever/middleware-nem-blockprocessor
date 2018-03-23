const config = require('../tests/config'),
  bunyan = require('bunyan'),
  _ = require('lodash'),
  Promise = require('bluebird'),
  EventEmitter = require('events'),
  blockModel = require('../models/blockModel'),
  nis = require('./nisRequestService'),
  nem = require('nem-sdk').default,
  log = bunyan.createLogger({name: 'app.services.blockCacheService'}),
  hashes = require('./hashes'),
  DEFAULT_TYPE = 1;

/**
 * @service
 * @description filter txs by registered addresses
 * @param block - an array of txs
 * @returns {Promise.<*>}
 */

class BlockCacheService {

  /**
   * Creates an instance of BlockCacheService.
   * @param {Stomp.client} client webstomp-client Client
   * 
   * @memberOf BlockCacheService
  
   * 
   */
  constructor (client) {
    this.client = client;
    this.events = new EventEmitter();
    this._currentHeight = 0;
    this.isSyncing = false;
    this.subscribeUnconfirmedTxId = undefined;
  }

 


  /**
   * 
   * function for sync blocks in database with node
   * 
   * @returns 
   * 
   * @memberOf BlockCacheService
   */
  async startSync () {
    if (this.isSyncing) return;

    await this._indexCollection();
    this.isSyncing = true;
    await this._delUnconfirmedBlock();
    await this._startFromLastBlock();
    this._doJob();

    this.subscribeUnconfirmedTxId = this.client.subscribe('/unconfirmed', 
      (message) => this._UnconfirmedTxEvent(JSON.parse(message.body), message.headers));
      

  }

  /**
   * 
   * function for do sync job with database and catch errors
   * 
   * @memberOf BlockCacheService
  
   * 
   */
  async _doJob () {
    while (this.isSyncing) {
      try {
        let block = await this._processBlock();
        await this._addBlockToCache(block);
        await this._delTransactionsFromUnconfirmed(block);        
        log.info(`caching from block:${this._currentHeight}  for network:${config.nis.network}`);  
        this.events.emit('block', block);
        
      } catch (err) {

        if (!_.has(err, 'code')) {
          log.error('unknown error on synchronization' + err.toString());
          process.exit(-1);
        }

        if (_.get(err, 'code') === 0) {
          log.info(`await for next block ${this._currentHeight + 1}`);
          await Promise.delay(10000);
        }

        if (_.get(err, 'code') === 1) {
          await this._delLastBlock();
          await this._moveToPrevBlock();
          log.info(`wrong sync state!, rollback to ${this._currentHeight} block`); 
        }
      }
    }
  }



  async _UnconfirmedTxEvent (transaction, headers) {
    const lastBlock =await nis.getLastBlock();

    await blockModel.findOneAndUpdate(
      {number: -1}, 
      {$set: {hash: null, type: DEFAULT_TYPE, timestamp: 0, transactions: lastBlock.transactions}},
      {upsert: true}
    );
    this.events.emit(
      'unconfirmed', transaction, headers.destination, 
      hashes.calculateTransactionHash(transaction)
    );
  }

  /**
   * stop synchronization in database with node
   * 
   * 
   * @memberOf BlockCacheService
   */
  async stopSync () {
    this.isSyncing = false;
    this.client.unsubscribe(this.subscribeUnconfirmedTxId);
  }

  /**
   * 
   * 
   * @returns {Object} block [data for blockModel]
   * 
   * @memberOf BlockCacheService
   */
  async _processBlock () {

    const nodeHeight = await nis.blockHeight();

    if (nodeHeight === this._currentHeight) //heads are equal
    {return Promise.reject({code: 0});}

    if (nodeHeight === 0 || isNaN(nodeHeight)) {
      return Promise.reject({code: 0});
    }

    if (nodeHeight < this._currentHeight) {
      return Promise.reject({code: 1});
    } //head has been blown off

    const newBlock = await nis.getBlock(this._currentHeight+1);
    if (!this._isHashEqualsWithLastBlock(newBlock.prevBlockHash.data)) {
      log.error(`prevBlockHash from ${this._currentHeight+1} ${newBlock.prevBlockHash.data} not equal to hash in our db ${this._lastBlockHash}`);
      return Promise.reject({code: 1});
    }
    /**
     * Get raw block
     * @type {Object}
     */
    return  this._compileBlockFromData(newBlock);
  }

  async _indexCollection () {
    log.info('indexing...');
    await blockModel.init();
    log.info('indexation completed!');
  }

  /**
   * function for check sync blocks in database with node
   * 
   * @returns boolean
   * 
   * @memberOf BlockCacheService
   */
  async isSynced () {
    const height = await nis.blockHeight();
    return this._currentHeight === +height;
  }

  /**
   * 
   * @param {blockModel} block 
   * 
   * save Block to database
   * 
   * @memberOf BlockCacheService
   * 
   */
  async _saveBlockData (block) {
    await blockModel.findOneAndUpdate({number: block.number}, block,{upsert: true});
  }

  /**
   * 
   * del transactions from unconfirmed block to currrent block
   * 
   * @param {blockModel} block 
   * 
   * @memberOf BlockCacheService
   * 
   */
  async _delTransactionsFromUnconfirmed (block) {
    await new Promise(res => {
      blockModel.update({number: -1}, {
        $pull: {
          transactions: {
            hash: {
              $in: block.transactions.map(tx => tx.hash)
            }
          }
        }
      }).then(res).catch(log.error);
    });
  }

  async _delUnconfirmedBlock () {
    await blockModel.remove({number: -1});
  }

  async _startFromLastBlock () {
    const lastBlock = await blockModel.findOne({network: config.nis.network}).sort('-number');
    this._currentHeight = +_.get(lastBlock, 'number', 0);
    this._lastBlockHash = _.get(lastBlock, 'hash', undefined);
  }

  /**
   * 
   * @param {Object} block [data for blockModel] 
   * 
   * @memberOf BlockCacheService
  
   * 
   */
  async _addBlockToCache (block) {
    await this._saveBlockData(block);     
    this._currentHeight++;
    this._lastBlockHash = block.hash;  
  }

  async _delLastBlock () {
    await blockModel.remove({number: this._currentHeight});
  }

  async _moveToPrevBlock () {
    this._currentHeight--; 
    const prevBlock = await blockModel.findOne({number: this._currentHeight});
    this._lastBlockHash = prevBlock.hash;
  }

  _isHashEqualsWithLastBlock (hash) {
    return (this._lastBlockHash === undefined || (hash === this._lastBlockHash));
  }

  _compileBlockFromData (blockData) {
    return _.merge(blockData, {
      number: blockData.height,
      hash: hashes.calculateBlockHash(blockData),
      network: config.nis.network,
      transactions: blockData.transactions.map(tx => 
        _.merge(tx, {
          sender:  nem.model.address.toAddress(tx.signer, config.nis.network)
        })
      )
    });
  }

}

module.exports = BlockCacheService;
