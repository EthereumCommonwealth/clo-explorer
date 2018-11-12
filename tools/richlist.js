#!/usr/bin/env node
/**
 * Tool for calculating richlist by hackyminer
 */

var _ = require('lodash');
var Web3 = require('web3');
var BigNumber = require('bignumber.js');
var mongoose = require('mongoose');

var Account = require('../db.js').Account;

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/blockDB');

const makeParityRichList = async () => {
  data = {}
  Account.find().exec("find", async (err, accounts) => {
    for (let account of accounts) {
      let balance = await web3.eth.getBalance(account.address);
      balance = web3.utils.fromWei(balance, 'ether');
      Account.collection.update(
        { "address": account.address },
        { $set: {"balance": parseFloat(balance)} }, { upsert: false }, (err, updated) => {
          if (err) {
            console.error(err);
          }
          console.log(account.address + " has been updated. New balance: " + balance);
      });
    }
  });
}

/**
 * Start config for node connection and sync
 */
var config = { nodeAddr: 'localhost', 'gethPort': 8545 };
// load the config.json file
try {
  var loaded = require('../config.json');
  _.extend(config, loaded);
  console.log('config.json found.');
} catch (error) {
  console.log('No config file found.');
  throw error;
  process.exit(1);
}

// temporary turn on some debug
//config.quiet = false;
//mongoose.set('debug', true);

console.log('Connecting ' + config.nodeAddr + ':' + config.gethPort + '...');

var web3 = new Web3(new Web3.providers.HttpProvider('http://' + config.nodeAddr + ':' + config.gethPort.toString()));

var useParity = false;
// if (web3.version.node.split('/')[0].toLowerCase().includes('parity')) {
//   // load parity extension
//   web3 = require("../lib/trace.js")(web3);
//   useParity = true;
// }

var latestBlock = web3.eth.blockNumber;

// run
console.log("* latestBlock = " + latestBlock);

makeParityRichList()
