/*
  Tool for calculating block stats
*/

const _ = require('lodash');
var Web3 = require('web3');

const mongoose = require( 'mongoose' );
const BlockStat = require( '../db.js' ).BlockStat;
const ActiveAddressesStat = require('../db').ActiveAddressesStat;
const Transaction = require('../db').Transaction;
const CLOTransferredStat = require('../db').CLOTransferredStat;

const updateStats = async (range, interval, rescan) => {
    var latestBlock = await web3.eth.getBlockNumber();

    interval = Math.abs(parseInt(interval));
    if (!range) {
        range = 1000;
    }
    range *= interval;
    if (interval >= 10) {
        latestBlock -= latestBlock % interval;
    }
    getStats(web3, latestBlock, null, latestBlock - range, interval, rescan);
}


const getStats = function(web3, blockNumber, nextBlock, endNumber, interval, rescan) {
    if (endNumber < 0)
        endNumber = 0;
    if (blockNumber <= endNumber) {
        if (rescan) {
            process.exit(9);
        }
        return;
    }

    if(web3.eth.net.isListening()) {

        web3.eth.getBlock(blockNumber, true, function(error, blockData) {
            if(error) {
                console.log('Warning: error on getting block with hash/number: ' +
                    blockNumber + ': ' + error);
            }
            else if(blockData == null) {
                console.log('Warning: null block data received from the block with hash/number: ' +
                    blockNumber);
            }
            else {
                if (nextBlock)
                    checkBlockDBExistsThenWrite(web3, blockData, nextBlock, endNumber, interval, rescan);
                else
                    checkBlockDBExistsThenWrite(web3, blockData, null, endNumber, interval, rescan);
            }
        });
    } else {
        console.log('Error: Aborted due to web3 is not connected when trying to ' +
            'get block ' + blockNumber);
        process.exit(9);
    }
}

/**
  * Checks if the a record exists for the block number
  *     if record exists: abort
  *     if record DNE: write a file for the block
  */
const checkBlockDBExistsThenWrite = function(web3, blockData, nextBlock, endNumber, interval, rescan) {
    BlockStat.find({number: blockData.number}, function (err, b) {
        if (!b.length && nextBlock) {
            // calc hashrate, txCount, blocktime, uncleCount
            var stat = {
                "number": blockData.number,
                "timestamp": blockData.timestamp,
                "difficulty": blockData.difficulty,
                "txCount": blockData.transactions.length,
                "gasUsed": blockData.gasUsed,
                "gasLimit": blockData.gasLimit,
                "miner": blockData.miner,
                "blockTime": (nextBlock.timestamp - blockData.timestamp) / (nextBlock.number - blockData.number),
                "uncleCount": blockData.uncles.length
            }
            new BlockStat(stat).save( function( err, s, count ){
                console.log(s)
                if ( typeof err !== 'undefined' && err ) {
                   console.log('Error: Aborted due to error on ' +
                        'block number ' + blockData.number.toString() + ': ' +
                        err);
                   process.exit(9);
                } else {
                    console.log('DB successfully written for block number ' +
                        blockData.number.toString() );
                    getStats(web3, blockData.number - interval, blockData, endNumber, interval, rescan);
                }
            });
        } else {
            if (rescan || !nextBlock) {
                getStats(web3, blockData.number - interval, blockData, endNumber, interval, rescan);
                if (nextBlock) {
                    console.log('WARN: block number: ' + blockData.number.toString() + ' already exists in DB.');
                }
            } else {
                console.error('Aborting because block number: ' + blockData.number.toString() +
                    ' already exists in DB.');
                return;
            }
        }

    })
}

const calculateActiveAddress = async () => {
    if(!web3.eth.net.isListening()) {
        return;
    }
    const blocksToCalc = 600000; // Around 90 days
    const lastBlockNumber = await web3.eth.getBlockNumber();

    existsStat = await ActiveAddressesStat.find({blockNumber: lastBlockNumber}).limit(1);
    
    if (existsStat.length > 0) {
        return;
    }

    addressesFrom = await Transaction.distinct("from", {blockNumber: {$gte: lastBlockNumber - blocksToCalc}}).exec();
    addressesTo = await Transaction.distinct("to", {blockNumber: {$gte: lastBlockNumber - blocksToCalc}}).exec();

    addresses = _.union(addressesFrom, addressesTo);

    const activeAddresses = {
        blockNumber: lastBlockNumber,
        count: addresses.length
    }
    new ActiveAddressesStat(activeAddresses).save( function( err, s, count ) {
        if(err) {
            console.log(`Error: Aborted due to error on block number ${lastBlockNumber} - ${err}`);
            process.exit(9);
        }

        console.log('Calculate Active Addresses done')
    });
}

const calculateTransferredCLO = async () => {
    if(!web3.eth.net.isListening()) {
        return;
    }
    const blocksToCalc = 6640; // ~24 hours
    const lastBlockNumber = await web3.eth.getBlockNumber();

    transactions = await Transaction.find({blockNumber: {$gte: lastBlockNumber - blocksToCalc}}).exec();

    let txIndex = 0;
    let amountCLO = 0;
    const transactionsArrayLenght = transactions.length;

    for(; txIndex < transactionsArrayLenght; txIndex++) {
        let TransferredValue = transactions[txIndex].value;
        amountCLO = amountCLO + parseFloat(TransferredValue);
    }

    const transferredStat = {
        blockNumber: lastBlockNumber,
        amount: amountCLO
    }

    new CLOTransferredStat(transferredStat).save( function( err, s, count ) {
        if (err) {
            console.log(`Error: Aborted due to error on block number ${lastBlockNumber} - ${err}`);
            process.exit(9);
        }
        console.log('Calculate Transferred CLO done')
    });
}

/** On Startup **/
// geth --rpc --rpcaddr "localhost" --rpcport "8545"  --rpcapi "eth,net,web3"

var minutes = 1;
statInterval = minutes * 60 * 1000;

var rescan = false; /* rescan: true - rescan range */
var range = 1000;
var interval = 100;

/**
 * RESCAN=1000:100000 means interval;range
 *
 * Usage:
 *   RESCAN=1000:100000 node tools/stats.js
 */
if (process.env.RESCAN) {
    var tmp = process.env.RESCAN.split(/:/);
    if (tmp.length > 1) {
        interval = Math.abs(parseInt(tmp[0]));
        if (tmp[1]) {
            range = Math.abs(parseInt(tmp[1]));
        }
    }
    var i = interval;
    var j = 0;
    for (var j = 0; i >= 10; j++) {
        i = parseInt(i / 10);
    }
    interval = Math.pow(10, j);
    console.log('Selected interval = ' + interval);

    rescan = true;
}

// load config.json
var config = { nodeAddr: 'localhost', gethPort: 8545, bulkSize: 100 };
try {
    var local = require('../config.json');
    _.extend(config, local);
    console.log('config.json found.');
} catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
        var local = require('../config.example.json');
        _.extend(config, local);
        console.log('No config file found. Using default configuration... (config.example.json)');
    } else {
        throw error;
        process.exit(1);
    }
}

console.log('Connecting ' + config.nodeAddr + ':' + config.gethPort + '...');

var web3 = new Web3(new Web3.providers.HttpProvider('http://' + config.nodeAddr + ':' + config.gethPort.toString()));

// run
updateStats(range, interval, rescan);
calculateActiveAddress();
calculateTransferredCLO();

if (!rescan) {
    setInterval(function() {
      updateStats(range, interval);
    }, statInterval);
}

setInterval(() => {
    calculateActiveAddress();
}, 600 * 1000)

setInterval(() => {
    calculateTransferredCLO();
}, 300 * 1000)

