/** 
 *  @class ProviderService
 * 
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */
const Promise = require('bluebird'),
  Provider = require('../models/provider'),
  requests = require('./nodeRequests'),
  EventEmitter = require('events'),
  _  = require('lodash'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'app.services.providerService'});

const MIN_HEIGHT = 0,
  DISABLE_TIME = 10000;


class ProviderService {
  /**
   * Creates an instance of ProviderService.
   * @param {Array of Object {ws, http} configProviders 
   * 
   * @memberOf ProviderService
   */
  constructor (configProviders) {
    this._configProviders = configProviders;
    this._provider = this.createProvider(this._configProviders[0]);
    this._disableProviders = [];
    this.events = new EventEmitter();
  }

  /**
   * @param {Provider} provider 
   * 
   * @memberOf ProviderService
   */
  disableProvider (provider) {
    log.info('disable provider ' + provider.getHttp());    
    this._disableProviders.push(provider);
    setTimeout(this.enableProvider.bind(this, provider), DISABLE_TIME);
  }



  /**
   * 
   * @memberOf ProviderService
   */
  async selectProvider () {
    const providers = _.filter(await Promise.map(this.getEnableProviders(), async configProvider => {
      const height = await requests.getHeightForProvider(configProvider.http);
      return this.createProvider(configProvider, height);
    }), provider => provider !== requests.EMPTY_HEIGHT);

    if (providers.length === 0) {
      log.error('not found enabled http/ws providers');
      process.exit(0);
    }

    this._provider = _.maxBy(providers, provider => provider.getHeight());
    log.info('select provider ' + this._provider.getHttp());    
    this.events.emit('change', this._provider);
  }

  /**
   * 
   * 
   * @returns {Provider}
   * 
   * @memberOf ProviderService
   */
  getProvider () {
    return this._provider;
  }

  createProvider (configProvider, height = MIN_HEIGHT) {
    return new Provider(configProvider.ws, configProvider.http, height);
  }

  enableProvider (provider) {
    _.pull(this._disableProviders, provider);
  }

  isEnableProvider (configProvider) {
    return _.find(this._disableProviders, provider => {
      return (provider.getWs() === configProvider.ws && provider.getHttp() === configProvider.http);
    }) === undefined;
  }

  getEnableProviders () {
    return _.filter(this._configProviders, this.isEnableProvider.bind(this));
  }
}

module.exports = ProviderService;
