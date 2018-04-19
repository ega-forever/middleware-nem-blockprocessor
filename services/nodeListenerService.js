/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const bunyan = require('bunyan'),
  config = require('../config'),
  Promise = require('bluebird'),
  SockJS = require('sockjs-client'),
  Stomp = require('webstomp-client'),
  log = bunyan.createLogger({name: 'app.services.nodeListenerService'});


class NodeListenerService {
  /**
   * 
   * 
   * 
   * @memberOf NodeListenerService
   */
  constructor () {



    this.client = undefined;    
    this.subscribedCallback = undefined;
    
  }

  async start () {
    await this.selectClient();
  }

  createStompClient (uri) {
    const ws = new SockJS(`${uri}/w/messages`);
    const client =  Stomp.over(ws, {heartbeat: true, debug: false});
    
    ws.onclose = () => {
      this.processError(client);
    };
    ws.onerror = () => {
      this.processError(client);
    };

    return client;
  }

  async selectClient () {
    try{
      this.client = await Promise.any(config.node.websocket.map(uri => {
        const client = this.createStompClient(uri);

        return new Promise(res => client.connect(
          {}, () => res(client), this.processError.bind(this)
        ));
      })).timeout(3000);

    } catch(e) {
      log.error(e);
      log.error('all stomp clients not responsed, refreshing clients');
      setTimeout(this.selectClient.bind(this), 5000);
      return;   
    }

    log.info('set new ws provider');
    if (this.subscribedCallback !== undefined && this.client !== undefined)
      this.subscribe();
  }

  async processError (errorClient) {
    if ((this.client === undefined) || (this.client.connected === false) || (errorClient.ws.url === this.client.ws.url)) {
      log.info('error on stomp client, refreshing clients');
      await this.selectClient();
    }
  }

  subscribe () {
    if (this.client !== undefined)
      this.subscribeUnconfirmedTxId = this.client.subscribe('/unconfirmed', 
        (message) => this.subscribedCallback(JSON.parse(message.body), message.headers));
  }

  /**
   * 
   * @param {any} callback function (tx)
   * 
   * @memberOf NodeListenerService
   */
  async onMessage (callback) {
    this.subscribedCallback = callback; 
    this.subscribe();   
  }


  async stop () {
    this.subscribedCallback = undefined;    
    this.client.unsubscribe(this.subscribeUnconfirmedTxId);
  }
}

module.exports = NodeListenerService;
