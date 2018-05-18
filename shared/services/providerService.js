/** 
 *  @class ProviderService
 * 
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */
const Promise = require('bluebird'),
  Provider = require('../models/provider'),
  EventEmitter = require('events'),
  _  = require('lodash'),
  bunyan = require('bunyan'),
  log = bunyan.createLogger({name: 'shared.services.providerService'});

const MIN_HEIGHT = 0,
  DISABLE_TIME = 10000;


class ProviderService {
  /**
   * Creates an instance of ProviderService.
   * @param {Array of Object {ws, http} configProviders 
   * @param {Function} getHeightForProvider (String providerUri) => Number height
   * 
   * @memberOf ProviderService
   */
  constructor (configProviders, getHeightForProvider) {
    this._configProviders = configProviders;
    this._disableProviders = [];
    this.events = new EventEmitter();
    this.getHeightForProvider = getHeightForProvider;
  }

  /**
   * @param {Provider} provider 
   * 
   * @memberOf ProviderService
   */
  disableProvider (provider) {
    this._provider = undefined;
    log.info('disable provider ' + provider.getHttp());    
    this._disableProviders.push(provider);
    setTimeout(this.enableProvider.bind(this, provider), DISABLE_TIME);
  }



  /**
   * 
   * @memberOf ProviderService
   */
  async selectProvider () {
    const providers = await this.getEnableProvidersWithNewHeights();
    if (providers.length === 0) {
      log.error('not found enabled http/ws providers');
      process.exit(0);
    }

    const maxProvider = _.maxBy(providers, provider => provider.getHeight());
    if (this.isNewProvider(maxProvider))  
      this.replaceProvider(maxProvider);
    else
      this._provider = maxProvider;
  }


  /**
   * 
   * 
   * @returns {Promise return Provider}
   * 
   * @memberOf ProviderService
   */
  async getProvider () {
    if (this._provider === undefined)
      await this.selectProvider();
    return this._provider;
  }

  async getEnableProvidersWithNewHeights () {
    const providers = await Promise.map(this.getEnableConfigProviders(), this.createProviderWithHeight.bind(this));
    return _.filter(
      providers,
      provider => provider.getHeight() > 0
    );
  }

  async createProviderWithHeight (configProvider, key) {
    const height = await this.getHeightForProvider(configProvider.http).catch(() => -1);
    return new Provider(key, configProvider.ws, configProvider.http, height || MIN_HEIGHT);
  }

  isNewProvider (provider) {
    return (this._provider === undefined || provider.getKey() !== this._provider.getKey());
  }

  replaceProvider (provider) {
    this._provider = provider;
    this.events.emit('change', provider);
    log.info('select provider ' + provider.getHttp());    
  }

  enableProvider (provider) {
    _.pull(this._disableProviders, provider);
  }

  isEnableConfigProvider (configProvider) {
    return _.find(this._disableProviders, provider => {
      return (provider.getWs() === configProvider.ws && provider.getHttp() === configProvider.http);
    }) === undefined;
  }

  getEnableConfigProviders () {
    return _.filter(this._configProviders, this.isEnableConfigProvider.bind(this));
  }
}

module.exports = ProviderService;