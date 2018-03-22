const request = require('request-promise'),
  config = require('../config'),
  _ = require('lodash'),
  {URL} = require('url'),
  bunyan = require('bunyan'),
  Promise = require('bluebird'),
  log = bunyan.createLogger({name: 'nemBlockprocessor.requestService'});

const blockHeight = async () => {
  const res = await get('/chain/height');
  return _.get(res, 'height');
};


const getLastBlock = async () => {
  return await get('/chain/last-block');
};

const getBlock = async (blockHeight) => post('/block/at/public', {height: blockHeight > 1 ? blockHeight : 1});



const get = query => makeRequest(query, 'GET');
const post = (query, body) => makeRequest(query, 'POST', body);

const makeRequest = (path, method, body) => {
  const options = {
    method,
    body,
    uri: new URL(path, config.nis.server),
    json: true
  };
  return request(options).catch(async (e) => await errorHandler(e));
};

const errorHandler = async (err) => {
  if (err.name && err.name === 'StatusCodeError') {
    await Promise.delay(10000);
  }
  log.error(err);
};

module.exports = {
  blockHeight,
  getLastBlock,
  getBlock,
};
