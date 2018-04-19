/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const request = require('request-promise'),
  config = require('../config'),
  _ = require('lodash'),
  {URL} = require('url'),
  bunyan = require('bunyan'),
  Promise = require('bluebird'),
  hashes = require('./hashes'),
  log = bunyan.createLogger({name: 'app.services.nodeRequests'});


const get = async query => await makeRequest(query, 'GET');


const makeRequest = async (path, method, body) => {
  const options = {
    method,
    body,
    json: true
  };

  return await Promise.any(config.node.http.map(async (server) => {
    return await request(_.merge(options, {
      uri: new URL(path, server)
    }));
  })).timeout(10000).catch(async e => errorHandler(e));
};

const postWithoutError = async (path, body) => {
  const options = {
    method: 'POST',
    body,
    json: true
  };

  return await Promise.any(config.node.http.map(async (server) => {
    return await request(_.merge(options, {
      uri: new URL(path, server)
    }));
  })).timeout(10000).catch(() => {});
};


const errorHandler = async (err) => {
  if (err.name && err.name === 'StatusCodeError') 
    await Promise.delay(10000);
  
  log.error(err);
};

const createBlock = (block) => {
  if (!block.height) 
    return {};
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
    return {};
  
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
