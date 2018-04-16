# middleware-nem-blockprocessor [![Build Status](https://travis-ci.org/ChronoBank/middleware-nem-blockprocessor.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-nem-blockprocessor)

Middleware service for handling incoming transactions

### Installation

This module is a part of middleware services. You can install it in 2 ways:

1) through core middleware installer  [middleware installer](https://github.com/ChronoBank/middleware)
2) by hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

#### About
This module is used for updating balances for registered accounts (see a description of accounts in [block processor](https://github.com/ChronoBank/middleware-nem-blockprocessor)).


#### How does it work?

Block processor connects to ipc, fetch blocks one by one and cache them in mongodb.

Which txs block processor filter?

Block processor filter txs by specified user accounts (addresses). The addresses are presented in "nemaccounts" collection with the following format:
```
{
    "_id" : ObjectId("599fd82bb9c86c7b74cc809c"),
    "address" : "0x1cc5ceebda535987a4800062f67b9b78be0ef419",
    "balance" : 0.0,
    "created" : 1503647787853,
    "isActive": true,
    mosaics: ["0x1cc5ceebda5359": 0.0]
}
```

So, when someone, for instance do a transaction (sample from stomp client):
```
/* nem.accounts[0] - "0x1cc5ceebda535987a4800062f67b9b78be0ef419" */
nem.sendTransaction({signer: nem.accounts[0], recipient: nem.accounts[1], value: 200})
```

this tx is going to be included in next blocks. Block parser fetch these blocks, and filter by "recipient" and "signer" recipients.
If one of them is presented in nemaccounts collection in mongo, then this transaction will be broadcasted via rabbitmq.

```
{
    "hash" : "0xb432ff1b436ab7f2e6f611f6a52d3a44492c176e1eb5211ad31e21313d4a274f",
    "block" : "3",
    "unconfirmed": "false",
    "timeStamp": ISODate("2017-08-25T08:04:57.389Z"),
    "hash": "0x1cc5ceebda535987a4800062f67b9b78be0ef419",
    "amount": "100",
    "signature": "0x1cc5ceebda535987a4800062f67b9b78be0ef419",
    "fee": "10.0",
    "recipient": "0x1cc5ceebda535987a4800062f67b9b78be0ef419",
    "sender": "0x48bf12c5650d87007b81e2b1a91bdf6e3d6ede03",
    "type": "4",
    "deadline": ISODate("2017-08-25T08:04:57.389Z"),
    "newPart": "0x1cc5ceebda535987a4800062f67b9b78be0ef419",
    "version": 20,
    "signer":  "0x48bf12c5650d87007b81e2b1a91bdf6e3d6ede03",
    "message": {"payload": "0x1cc5ceebda535987a4", "type": 1},
    "mosaics": [{}
      "quantity": 1,
      "type": "257",      
      "supplyType": "2",
      "delta": "24",
      "fee": "20.0",
      "deadline": "23423423423423",
      "version": 2,
      "signature": "0x1cc5ceebda535987a4800062f67b9b78be0ef419",
      "timestamp": ISODate("2017-08-25T08:04:57.389Z"),
      "mosaicId": {
        "namespaceId": "0x1cc5ceebda5",
        "name": "asdasdasdasd"
      }
    }],
}
```

Why do we use rabbitmq?


Rabbitmq is used for 2 main reasons - the first one for inner communication between different core modules. And the second one - is for notification purpose. When a new transaction arrives and it satisfies the filter - block processor notiffy others about it though rabbitmq exhange strategy. The exchage is called 'events', and it has different kinds of routing keys. For a new tx the routing key is looked like so:

```
<RABBIT_SERVICE_NAME>_transaction.{address}
```
Where address is to or from address. Also, you can subscribe to all nem_transactions events by using wildcard:
```
<RABBIT_SERVICE_NAME>_transaction.*
```

All in all, in order to be subscribed, you need to do the following:
1) check that exchange 'events exist'
2) assert a new queue (this should be your own unique queue)
3) bind your queue to 'events' exchange with appropriate routing key
4) consume (listen) your queue


But be aware of it - when a new tx arrives, the block processor sends 2 messages for the same one transaction - for both addresses, who participated in transaction (from and to recepients). The sent message represent the payload field from transaction object (by this unique field you can easely fetch the raw transaction from mongodb for your own purpose).



##### сonfigure your .env

To apply your configuration, create a .env file in root folder of repo (in case it's not present already).
Below is the expamle configuration:

```
MONGO_ACCOUNTS_URI=mongodb://localhost:27017/data
MONGO_ACCOUNTS_COLLECTION_PREFIX=nem

MONGO_DATA_URI=mongodb://localhost:27017/data
MONGO_DATA_COLLECTION_PREFIX=nem

RABBIT_URI=amqp://localhost:5672
RABBIT_SERVICE_NAME=app_nem
NETWORK=development

SYNC_SHADOW=1
NIS=http://192.3.61.243:7890
WEBSOCKET_NIS=http://192.3.61.243:7778
```

The options are presented below:

| name | description|
| ------ | ------ |
| MONGO_URI   | the URI string for mongo connection
| MONGO_COLLECTION_PREFIX   | the default prefix for all mongo collections. The default value is 'nem'
| MONGO_ACCOUNTS_URI   | the URI string for mongo connection, which holds users accounts (if not specified, then default MONGO_URI connection will be used)
| MONGO_ACCOUNTS_COLLECTION_PREFIX   | the collection prefix for accounts collection in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| MONGO_DATA_URI   | the URI string for mongo connection, which holds data collections (for instance, processed block's height). In case, it's not specified, then default MONGO_URI connection will be used)
| MONGO_DATA_COLLECTION_PREFIX   | the collection prefix for data collections in mongo (If not specified, then the default MONGO_COLLECTION_PREFIX will be used)
| RABBIT_URI   | rabbitmq URI connection string
| RABBIT_SERVICE_NAME   | namespace for all rabbitmq queues, like 'app_nem_transaction'
| NETWORK   | network name (alias)- is used for connecting via ipc (see block processor section)
| SYNC_SHADOW   | sync blocks in background
| NIS   | the paths to node rest api
| WEBSOCKET_NIS   | the path to node websocket 

License
----
 [GNU AGPLv3](LICENSE)

Copyright
----
LaborX PTY