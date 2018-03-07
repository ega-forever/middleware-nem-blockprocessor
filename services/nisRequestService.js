const request = require('request-promise'),
  config = require('../config'),
  _ = require('lodash'),
  {URL} = require('url'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'nemBlockprocessor.requestService'});

const blockHeight = async () => {
  const res = await get('/chain/height');
  return _.get(res, 'height');
};

const getBlock = async (blockHeight) => post('/block/at/public', {height: blockHeight});

const getLast10BlocksFromHeight = async (blockHeight) => {
  let res = await post('/local/chain/blocks-after', {height: blockHeight});
  return _.get(res, 'data');
};

const getIncomingTransactions = async (address) => {
  const res = await get(`/account/transfers/incoming?address=${address}`);
  return _.get(res, 'data');
};

const get = query => makeRequest(query, 'GET');
const post = (query, body) => makeRequest(query, 'POST', body);

const makeRequest = (path, method, body) => {
  const options = {
    method,
    body,
    uri: new URL(path, config.nis.server),
    json: true
  };
  return request(options).catch(e => errorHandler(e));
};

const errorHandler = err => {
  log.error(err);
};

module.exports = {
  blockHeight,
  getBlock,
  getIncomingTransactions,
  getLast10BlocksFromHeight
};
