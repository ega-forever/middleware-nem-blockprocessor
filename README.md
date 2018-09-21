# middleware-nem-blockprocessor [![Build Status](https://travis-ci.org/ChronoBank/middleware-nem-blockprocessor.svg?branch=master)](https://travis-ci.org/ChronoBank/middleware-nem-blockprocessor)

Middleware service for handling incoming transactions

### Installation

This module is a part of middleware services. You can install it in 2 ways:

1) through core middleware installer  [middleware installer](https://github.com/ChronoBank/middleware)
2) by hands: just clone the repo, do 'npm install', set your .env - and you are ready to go

#### About
This module is used for watching new blocks and txs for registered on platform users (please, check out - how you can register new user via [rest api](https://github.com/ChronoBank/middleware-nem-rest)).


#### How does it work?

Block processor connects to ws / http endpoint, fetch blocks one by one and cache them in mongodb.

Which txs block processor filter?

Block processor filter txs by specified user accounts (addresses). The addresses are presented in "nemaccounts" collection with the following format:
```
{
    "_id" : ObjectId("5afd110e6b3ffd0becc3ffb1"),
    "address" : "TAHZD4PLMR4OX3OLNMJCC726PNLXCJMCFWR2JI3D",
    "__v" : 0,
    "balance" : {
        "unconfirmed" : NumberLong(6099957),
        "vested" : NumberLong(6099905),
        "confirmed" : NumberLong(6099957)
    },
    "mosaics" : {
        "nem:xem" : {
            "unconfirmed" : 6099957,
            "confirmed" : 6099957
        }
    }
}
```

So, when someone, for instance do a transaction (sample from stomp client):
```
/* nem.accounts[0] - "TAHZD4PLMR4OX3OLNMJCC726PNLXCJMCFWR2JI3D" */
nem.sendTransaction({signer: nem.accounts[0], recipient: nem.accounts[1], value: 200})
```

this tx is going to be included in next blocks. Block parser fetch these blocks, and filter by "recipient" and "signer" recipients.
If one of them is presented in nemaccounts collection in mongo, then this transaction will be broadcasted via rabbitmq.

```
{
  blockNumber: 1494527,
  timeStamp: 100607022,
  amount: 1,
  hash: '7cca311d117c9e67c658513ac032219945115af437928552f99ed03d5d3accae',
  recipient: 'TAHZD4PLMR4OX3OLNMJCC726PNLXCJMCFWR2JI3D',
  fee: 100000,
  messagePayload: '48656c6c6f',
  messageType: 1,
  mosaics: null,
  sender: 'TAX7OUHMQSTDXOMYJIKHFILRKOLVYGECG47FPKGQ',
  address: 'TAHZD4PLMR4OX3OLNMJCC726PNLXCJMCFWR2JI3D'
  }
```

#### Why do we use rabbitmq?


Rabbitmq is used for 2 main reasons - the first one for inner communication between different core modules. And the second one - is for notification purpose. When a new transaction arrives and it satisfies the filter - block processor notiffy others about it though rabbitmq exhange strategy. The exchage is called 'events', and it has different kinds of routing keys. For a new tx the routing key is looked like so:

```
<rabbitmq_service_name>_transaction.{address}
```
Where address is to or from address. Also, you can subscribe to all nem_transactions events by using wildcard:
```
<rabbitmq_service_name>_transaction.*
```

All in all, in order to be subscribed, you need to do the following:
1) check that exchange 'events exist'
2) assert a new queue (this should be your own unique queue)
3) bind your queue to 'events' exchange with appropriate routing key
4) consume (listen) your queue


But be aware of it - when a new tx arrives, the block processor sends 2 messages for the same one transaction - for both addresses, who participated in transaction (from and to recepients). The sent message represent the payload field from transaction object (by this unique field you can easely fetch the raw transaction from mongodb for your own purpose).

#### cache system
In order to make it possible to work with custom queries (in [rest](https://github.com/ChronoBank/middleware-nem-rest)), or perform any kind of analytic tasks, we have introduced the caching system. This system stores all blocks and txs in mongodb under the specific collections: blocks, txes.


##### nemblocks
The nemblocks collection stores only the most valuable information about the block. Here is the example of block:
```
    "_id" : "b18c32cc3a9edbc48efba91aec0a1821f029015b31235e0021d970d9fa4d1471",
    "number" : 1468951,
    "signer" : "f60ab8a28a42637062e6ed43a20793735c58cb3e8f3a0ab74148d591a82eba4d",
    "timeStamp" : 1526646899001.0
```

Here is the description:

| field name | index | description
| ------ | ------ | ------ |
| _id   | true | the block hash
| number   | true | block number
| signer | false | address of signer
| timeStamp   | true | date, when block has been mined



##### nemtxes
The nemtxes collection stores only the most valuable information about the transaction. Here is the example of transaction:
```
    "_id" : "e9fca736f3d55aecabe1702c5af00bc91baf10cacd073fcf904739ed551c626c",
    "amount" : 10000000,
    "blockNumber" : 1468766,
    "fee" : 50000,
    "messagePayload" : null,
    "messageType" : null,
    "mosaics" : null,
    "recipient" : "TAXMDILHBIIY3K7C4OVKOCOXLOSFM6KYQLG554FI",
    "sender" : "TDTE3ROXOFL5KMYLBG7A7LV4JWGT6QTXCAISAMZL",
    "timeStamp" : 99047707
```

Here is the description:

| field name | index | description|
| ------ | ------ | ------ |
| _id   | true | the hash of transaction
| blockNumber   | true | the block number
| timeStamp   | true | the timestamp when tx has been mined
| amount | false | amount of transfer
| recipient | true | address of recipient
| sender | true | address of sender
| fee | false | fee
| messagePaload | false | message payload
| messageType | false | message type
| mosaics.quantity | false | mosaics quantity
| mosaics.mosaicId.namespaceId | false | mosaicId namespaceId
| mosaics.mosaicId.name | false | mosaicId name


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
NETWORK=-104

SYNC_SHADOW=1
PROVIDERS=http://192.3.61.243:7890@http://192.3.61.243:7778
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
| NETWORK   | network type
| SYNC_SHADOW   | sync blocks in background
| NIS(deprecated) | address of res api endpoint
| WEBSOCKET_NIS(deprecated) | address of node websocket endpoint
| PROVIDERS   | 'the path to node rest api'@'the path to node websocket'
| SYSTEM_RABBIT_URI   | rabbitmq URI connection string for infrastructure
| SYSTEM_RABBIT_SERVICE_NAME   | rabbitmq service name for infrastructure
| SYSTEM_RABBIT_EXCHANGE   | rabbitmq exchange name for infrastructure
| CHECK_SYSTEM | check infrastructure or not (default = true)

License
----
 [GNU AGPLv3](LICENSE)

Copyright
----
LaborX PTY
