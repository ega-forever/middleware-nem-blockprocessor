/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const config = require('../../config');

module.exports = async (amqpInstance, queueName = `app_${config.rabbit.serviceName}_test.transaction`) => {
  const channel = await amqpInstance.createChannel();
  channel.assertQueue(queueName);
  return await channel.purgeQueue(queueName);
};
