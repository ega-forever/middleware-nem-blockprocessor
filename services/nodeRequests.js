const request = require('request-promise'),
  config = require('../config'),
  _ = require('lodash'),
  {URL} = require('url'),
  bunyan = require('bunyan'),
  Promise = require('bluebird'),
  hashes = require('./hashes'),
  log = bunyan.createLogger({name: 'app.services.nodeRequests'});


const get = query => makeRequest(query, 'GET');
const makeRequest = (path, method, body) => {
  const options = {
    method,
    body,
    uri: new URL(path, config.node.server),
    json: true
  };
  return request(options).catch(async (e) => await errorHandler(e));
};

const postWithoutError = (path, body) => {
  const options = {
    method: 'POST',
    body,
    uri: new URL(path, config.node.server),
    json: true
  };
  return request(options);
};


const errorHandler = async (err) => {
  if (err.name && err.name === 'StatusCodeError') {
    await Promise.delay(10000);
  }
  log.error(err);
};

const createBlock = (block) => {
  if (!block.height) 
  {return {};}
  return _.merge(block, {
    hash: hashes.calculateBlockHash(block),
    number: Number(block.height)
  });
};


/**
 * @return {Promise return Number}
 */
const getLastBlockNumber = async () => {
  const res = await get('/chain/height');
  return _.get(res, 'height', 0);
};

/**
 * 
 * @param {Number} height 
 * @return {Promise return Object}
 */
const getBlockByNumber = async (height) => {
  const block = await postWithoutError('block/at/public', {
    height: (height > 1 ? height : 1)
  }).catch(() => {});
  if (!block.height) 
  {return {};}
  
  return createBlock(block); 
};



/**
 * 
 * @param {Array of Number} numbers 
 * @return {Promise return Object[]}
 */
const getBlocksByNumbers = async (numbers) => {
  return _.filter(await Promise.map(numbers, 
    async (number) => await getBlockByNumber(number)
  ), block => block.height !== undefined);
};


module.exports = {
  getBlockByNumber,
  getBlocksByNumbers,
  getLastBlockNumber,

};
