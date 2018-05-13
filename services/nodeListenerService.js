/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const bunyan = require('bunyan'),
  Promise = require('bluebird'),
  SockJS = require('sockjs-client'),
  Stomp = require('webstomp-client'),
  log = bunyan.createLogger({name: 'app.services.nodeListenerService'});

const MAX_WAIT_TIME = 5000;

class NodeListenerService {
  /**
   * @param {ProviderService} providers
   * @memberOf NodeListenerService
   */
  constructor (providerService) {
    this.providerService = providerService;
    this.client = undefined;    
    this.subscribedCallback = undefined;


    this.providerService.events.on('change', this.selectClient.bind(this));
    
  }

  async start () {
    await this.selectClient();
  }

  async selectClient () {
    const provider = await this.providerService.getProvider(),
      onError = this.processError.bind(this, provider);

    try{
      this.client = this.createStompClient(provider.getWs(), onError);
      await new Promise((res, rej) => this.client.connect({}, res, rej)).timeout(MAX_WAIT_TIME);
    } catch(e) {
      log.error(e);
      if (onError) await onError();
      return;   
    }

    if (this.isSubscribed())
      this.subscribe();
  }

  isSubscribed () {
    return (this.subscribedCallback !== undefined && this.client !== undefined);
  }



  createStompClient (uri, onError) {
    const ws = new SockJS(`${uri}/w/messages`);
    const client =  Stomp.over(ws, {heartbeat: true, debug: false});
    
    ws.onclose = async () => {
      await onError();
    };
    ws.onerror = async () => {
      await onError();
    };

    return client;
  }

  async processError (provider) {
    log.info('error on ws/stomp client, disable currebt provider');
    this.providerService.disableProvider(provider);
    await this.providerService.selectProvider();
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


  /**
   * 
   * @memberOf NodeListenerService
   */
  async stop () {
    this.subscribedCallback = undefined; 
    if (this.client)   
      this.client.unsubscribe(this.subscribeUnconfirmedTxId);
  }
}

module.exports = NodeListenerService;
