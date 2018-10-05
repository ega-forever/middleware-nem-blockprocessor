/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const models = require('../../models'),
  config = require('../config'),
  sender = require('../utils/sender'),
  expect = require('chai').expect,
  Promise = require('bluebird'),
  _ = require('lodash'),
  spawn = require('child_process').spawn,
  providerService = require('../../services/providerService');

module.exports = (ctx) => {

  before(async () => {
    await models.blockModel.remove({});
    await models.txModel.remove({});
    await models.accountModel.remove({});


    ctx.blockProcessorPid = spawn('node', ['index.js'], {
      env: _.merge({PROVIDERS: ctx.providers.join(',')}, process.env),
      stdio: 'ignore'
    });
    await Promise.delay(10000);
  });

  it('validate block event', async () => {
    const instance = await providerService.get();
    const nextBlock = await instance.getHeight() + 2;
    await Promise.all([
      (async () => {
        await ctx.amqp.channel.assertQueue(`app_${config.rabbit.serviceName}_test_features.block`, {
          autoDelete: true,
          durable: false
        });
        await ctx.amqp.channel.bindQueue(`app_${config.rabbit.serviceName}_test_features.block`, 'events', `${config.rabbit.serviceName}_block`);
        await new Promise(res =>
          ctx.amqp.channel.consume(`app_${config.rabbit.serviceName}_test_features.block`, async data => {
            if (!data)
              return;

            const message = JSON.parse(data.content.toString());
            expect(message).to.have.all.keys('block');

            expect(message.block).to.lessThan(nextBlock);
            await ctx.amqp.channel.deleteQueue(`app_${config.rabbit.serviceName}_test_features.block`);
            res();
          }, {noAck: true, autoDelete: true})
        );
      })(),
      (async () => {
        await sender.sendTransaction(ctx.accounts, 0.000001);
      })()
    ]);
  });

  it('validate transaction event for registered user', async () => {
    await new models.accountModel({address: ctx.accounts[1].address}).save();

    let tx;

    return await Promise.all([
      (async () => {
        await ctx.amqp.channel.assertQueue(`app_${config.rabbit.serviceName}_test_features.transaction`);
        await ctx.amqp.channel.bindQueue(`app_${config.rabbit.serviceName}_test_features.transaction`, 'events', `${config.rabbit.serviceName}_transaction.${ctx.accounts[1].address}`);
        await new Promise(res =>
          ctx.amqp.channel.consume(`app_${config.rabbit.serviceName}_test_features.transaction`, async data => {
            if (!data)
              return;

            const message = JSON.parse(data.content.toString());

            expect(message).to.have.all.keys(
              'blockNumber',
              'timeStamp',
              'amount',
              'hash',
              'recipient',
              'fee',
              'messagePayload',
              'messageType',
              'mosaics',
              'sender',
              'address'
            );

            if (tx && message.timeStamp !== tx.timeStamp)
              return;

            await ctx.amqp.channel.deleteQueue(
              `app_${config.rabbit.serviceName}_test_features.transaction`);
            res();
          }, {noAck: true, autoDelete: true})
        );
      })(),
      (async () => {
        tx = await sender.sendTransaction(ctx.accounts, 0.000001);
      })()
    ]);
  });


  it('validate transaction event for not registered user', async () => {
    let tx;

    return await Promise.all([
      (async () => {
        await ctx.amqp.channel.assertQueue(`app_${config.rabbit.serviceName}_test_features.transaction`);
        await ctx.amqp.channel.bindQueue(`app_${config.rabbit.serviceName}_test_features.transaction`, 'events', `${config.rabbit.serviceName}_transaction.${ctx.accounts[0].address}`);
        await new Promise((res, rej) => {
          ctx.amqp.channel.consume(`app_${config.rabbit.serviceName}_test_features.transaction`, (data) => {
            if (data)
              rej();
          }, {noAck: true, autoDelete: true});

          let checkInterval = setInterval(async () => {

            if (!tx)
              return;

            let txExist = await models.txModel.count({timestamp: tx.timeStamp});

            if (!txExist)
              return;

            clearInterval(checkInterval);
            await ctx.amqp.channel.deleteQueue(`app_${config.rabbit.serviceName}_test_features.transaction`);
            res();

          }, 2000);

        });
      })(),
      (async () => {
        tx = await sender.sendTransaction(ctx.accounts, 0.000001);
      })()
    ]);
  });

  after('kill environment', async () => {
    ctx.blockProcessorPid.kill();
  });


};
