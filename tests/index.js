/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */

require('dotenv/config');
process.env.LOG_LEVEL = 'error';

const config = require('./config'),
  models = require('../models'),
  fuzzTests = require('./fuzz'),
  performanceTests = require('./performance'),
  featuresTests = require('./features'),
  blockTests = require('./blocks'),
  Promise = require('bluebird'),
  mongoose = require('mongoose'),
  amqp = require('amqplib'),
  _ = require('lodash'),
  nodeUrls = require('nem-sdk').default.model.nodes.testnet,
  providerService = require('../services/providerService'),
  ctx = {};

mongoose.Promise = Promise;
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
mongoose.accounts = mongoose.createConnection(config.mongo.accounts.uri, {useMongoClient: true});


describe('core/blockProcessor', function () {

  before(async () => {
    models.init();
    ctx.accounts = [{
      key: config.dev.users.Alice.privateKey,
      address: config.dev.users.Alice.address
    }, {
      key: config.dev.users.Bob.privateKey,
      address: config.dev.users.Bob.address
    }];
    ctx.amqp = {};
    ctx.amqp.instance = await amqp.connect(config.rabbit.url);
    ctx.amqp.channel = await ctx.amqp.instance.createChannel();
    await ctx.amqp.channel.assertExchange('events', 'topic', {durable: false});

    ctx.providers = _.chain(nodeUrls)
      .reject(item => /localhost/.test(item.uri))
      .map(item => `${item.uri}:7890@${item.uri}:7778`)
      .value();

    config.node.providers = _.chain(nodeUrls)
      .reject(item => /localhost/.test(item.uri))
      .map(item => ({
        http: `${item.uri}:7890`,
        ws: `${item.uri}:7778`
      }))
      .value();

  });

  after(async () => {
    mongoose.disconnect();
    mongoose.accounts.close();
    providerService.connector.wsProvider.disconnect();
    clearInterval(providerService.findBestNodeInterval);
    clearInterval(providerService.pingIntervalId);
    await ctx.amqp.instance.close();
  });


  describe('block', () => blockTests(ctx));

  describe('performance', () => performanceTests(ctx));

  describe('fuzz', () => fuzzTests(ctx));

  describe('features', () => featuresTests(ctx));

});
