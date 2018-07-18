#!/usr/bin/python3

import json
import re
import subprocess
import sqlite3


CLO_BINARY = '/usr/local/bin/geth'
RICHLIST_DB = '/home/ubuntu/richlist/richlist.db'
RICHLIST_JS = '/home/ubuntu/clo-explorer/public/views/richlist.js'
RICHLIST_TMP = '/home/ubuntu/richlist/richlist.tmp'


def clo_call(cmd):
    result = subprocess.run([CLO_BINARY, '--callisto', '--exec', cmd, 'attach'], stdout=subprocess.PIPE)
    return re.sub(r"\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGK]", "", result.stdout.decode('utf-8'))


def get_latest_block_db(sqlite):
    c = sqlite.cursor()
    c.execute('SELECT value FROM data WHERE key="last_block"')
    return c.fetchone()[0]


def set_latest_block_db(block, sqlite):
    sqlite.execute('UPDATE data SET value=%s WHERE key="last_block"' % block)
    sqlite.commit()


def get_addresses(start_block, end_block):
    command = """
      arr = [];
      for (var i = %i; i <= %i; i++) {
        var block = eth.getBlock(i);
        if (block != null) {
          if (block.transactions != null && block.transactions.length != 0) {
            for(var j=0; j< block.transactions.length; j++) {
              var tx = eth.getTransaction(block.transactions[j]);
              if(arr.indexOf(tx.from) == -1)
                arr.push(tx.from);
              if(arr.indexOf(tx.to) == -1)
                arr.push(tx.to);
              }
            }
          }
        }
        arr;
        """ % (start_block, end_block)
    command = command.replace('\n', ' ')
    return json.loads(clo_call(command))


def fetchall_iter(cursor):
    """Returns generator to iterate over rows of given 'cursor'"""
    while True:
        row = cursor.fetchone()
        if row is None:
            break
        yield row


def remove_last_line_from_string(s):
    return s[:s.rfind('\n')]


def main():
    sqlite = sqlite3.connect(RICHLIST_DB)
    sqlite.execute('CREATE TABLE IF NOT EXISTS addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, address STRING, UNIQUE(address))')
    sqlite.execute('CREATE TABLE IF NOT EXISTS data (id INTEGER PRIMARY KEY AUTOINCREMENT, key STRING, value STRING, UNIQUE(key))')
    sqlite.execute('INSERT OR IGNORE INTO data(key, value) VALUES ("last_block", 0)')
    sqlite.commit()
    latest_block = int(clo_call('eth.getBlock("latest").number'))
    latest_block_db = get_latest_block_db(sqlite)

    addresses = get_addresses(latest_block_db, latest_block)

    for address in addresses:
        sqlite.execute('INSERT OR IGNORE INTO addresses (address) VALUES ("%s")' % address)
        sqlite.execute('DELETE FROM addresses WHERE address LIKE "None"')
    sqlite.commit()

    address_list = ''
    c = sqlite.cursor()
    c.execute('SELECT address FROM addresses')
    for address in fetchall_iter(c):
        address_list += '"%s",' % address

    command = """
    function sortFunc(a,b) {
        return b[1]-a[1];
    }
    var arr = [%s];
    var arr2 = [];
    for(var i=0; i<arr.length; i++)
    {
        arr2.push([arr[i], web3.fromWei(eth.getBalance(arr[i]), "ether")]);
    }
    arr2.sort(sortFunc);
    console.log("var dataSet = [");
    var accounts_count = Math.min(10000, arr2.length);
    for(var i=0; i<accounts_count; i++)
    {
        console.log('["' + arr2[i][0] + '",' + arr2[i][1] + '],');
    }
    console.log("];");
    """ % address_list

    with open(RICHLIST_TMP, 'w') as f:
        f.write(command)

    output = clo_call('loadScript("%s")' % RICHLIST_TMP)[:-1]

    with open(RICHLIST_JS, 'w') as f:
        f.write(remove_last_line_from_string(output))

    set_latest_block_db(latest_block-2, sqlite)

    sqlite.close()


while True:
    main()
