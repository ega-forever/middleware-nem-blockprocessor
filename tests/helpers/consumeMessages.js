/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const config = require('../../config');
module.exports = async (maxCount = 1, channel, parseMessage, queueName = `${config.rabbit.serviceName}_test.transaction`) => {
  return new Promise(res  => {
    let messageCount = 1;
    channel.consume(queueName, async (message) => {
      if (parseMessage(message)) 
        if (messageCount === maxCount) {
          await channel.cancel(message.fields.consumerTag);
          res();
        } else {
          messageCount++;
        }
      
    }, {noAck: true});
  });
};

