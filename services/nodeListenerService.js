/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
class NodeListenerService {
  /**
   * 
   * 
   * @param {StompClient} client 
   * 
   * @memberOf NodeListenerService
   */
  constructor (client) {

    this.client = client;
  }

  /**
   * 
   * @param {any} callback function (tx)
   * 
   * @memberOf NodeListenerService
   */
  async onMessage (callback) {
    this.subscribeUnconfirmedTxId = this.client.subscribe('/unconfirmed', 
      (message) => callback(JSON.parse(message.body), message.headers));   
  }


  async stop () {
    this.client.unsubscribe(this.subscribeUnconfirmedTxId);
  }
}

module.exports = NodeListenerService;
