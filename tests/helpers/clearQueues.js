/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const config = require('../../config');

module.exports = async (amqpInstance, queueName = `${config.rabbit.serviceName}_test.transaction`) => {
  const channel = await amqpInstance.createChannel();
  channel.assertQueue(queueName, {autoDelete: true, durable: false});
  return await channel.purgeQueue(queueName);
};
