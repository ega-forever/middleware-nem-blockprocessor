/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const EXCHANGE_NAME = 'events';


class ProviderNodeService {
  /**
   * Creates an instance of ProviderNodeService.
   * @param {AmqpChannel} channel 
   * @param {ProvierService} providerService 
   * @param {String} rabbitPrefix 
   * 
   * @memberOf ProviderNodeService
   */
  constructor (channel, providerService, rabbitPrefix) {
    this.channel = channel;
    this.providerService = providerService;
    this.providerService.events.on('change', this.sendChangeProvider.bind(this));
    
    this.providerRoute = `${rabbitPrefix}_provider`;
    this.whatProviderRoute = `${rabbitPrefix}_what_provider`;
  }

  /**
   * 
   * @memberOf ProviderNodeService
   */
  async start () {
    await this.channel.assertQueue(this.whatProviderRoute, {durable: false});
    await this.channel.bindQueue(this.whatProviderRoute, EXCHANGE_NAME, this.whatProviderRoute);
    this.channel.consume(this.whatProviderRoute, async () => {
      await this.sendChangeProvider();
    }, {noAck: true});
  }

  async sendChangeProvider () {
    const provider = await this.providerService.getProvider();
    const keyString = provider.getKey().toString();
    await this.channel.publish(EXCHANGE_NAME, this.providerRoute, new Buffer(keyString));
  }
}


module.exports = ProviderNodeService;
