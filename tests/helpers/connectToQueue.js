/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const config = require('../../config');

module.exports = async (channel, queueName = `${config.rabbit.serviceName}_test.transaction`) => {
  const balanceQueue = await channel.assertQueue(queueName, {autoDelete: true, durable: false});
  await channel.bindQueue(queueName, 'events', `${config.rabbit.serviceName}_transaction.*`);
  return balanceQueue;
};
