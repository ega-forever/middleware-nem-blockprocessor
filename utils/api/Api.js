const EventEmitter = require('events'),
  hashes = require('../hashes/hashes'),
  Promise = require('bluebird'),
  _ = require('lodash'),
  request = require('request-promise'),
  URL = require('url').URL,
  SockJS = require('sockjs-client'),
  Stomp = require('webstomp-client');

class Api {

  constructor(URI) {
    this.http = URI.http;
    this.ws = URI.ws;
    this.events = new EventEmitter();
    this.wsProvider = this.buildWSProvider();
  }


  buildWSProvider() {
    const ws = new SockJS(`${this.ws}/w/messages`);
    const client = Stomp.over(ws, {heartbeat: true, debug: false});
    ws.onclose = () => this.events.emit('disconnect');
    ws.onerror = () => this.events.emit('disconnect');
    return client;
  }

  async openWSProvider(){
    return await new Promise((res, rej)=>{
      this.wsProvider.connect({}, res, rej);
    });
  }

  async _makeRequest(url, method = 'GET', body) {
    const options = {
      method: method,
      body: body,
      uri: new URL(url, this.http),
      json: true
    };
    return Promise.resolve(request(options)).timeout(10000);
  }

  async getBlockByNumber(height) {
    const block = await this._makeRequest('block/at/public', 'POST', {height: (height > 1 ? height : 1)});

    if (!block || !block.height)
      return {};

    return _.merge(block, {
      hash: hashes.calculateBlockHash(block),
      number: Number(block.height)
    });
  }


  async getHeight() {
    const data = await this._makeRequest('chain/height');
    return data.height;
  }


}

module.exports = Api;