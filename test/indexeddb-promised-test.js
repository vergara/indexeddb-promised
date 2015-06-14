var chai = require("chai");
var should = chai.should();
var expect = chai.expect;
chai.use(require('chai-fuzzy'));
chai.use(require('chai-things'));
var Builder = require("../js/indexeddb-promised");
var Q = require('q');

var testCount = 1;
var log = function(msg) {
  console.log(testCount + ": " + msg);
}

describe('indexeddb-promised', function() {

  var indexeddb;

  before('Get latest testdb version', function() {
    var defer = Q.defer();

    indexedDB.webkitGetDatabaseNames().onsuccess = function(event) {
      var databases = event.target.result;
      var max = 0;
      for(var i=0;i < databases.length;i++) {
        var databaseName = databases[i];
        var dbNumber = databaseName.replace(/^testdb/, '');
        dbNumber = new Number(dbNumber);
        //console.log('dbNumber: '+dbNumber);
        if(dbNumber > max) {
          max = dbNumber;
        }
      }

      defer.resolve(max);
    };

    return defer.promise
    .then(function(max) {
      testCount = max + 1;
    });
  });

  var createDbWithTestObjStore = function() {
    var doUpgrade = function(db) {
      db.createObjectStore('testObjStore', { autoIncrement : true });
    };

    var builder = new Builder('testdb' + testCount);
    builder.setVersion(1);
    builder.addObjectStore({name: 'testObjStore', keyType: {autoIncrement: true}});

    var indexeddb = builder.build();
    //log('created indexeddb object.');

    return indexeddb;
  };

  beforeEach('preparing test database', function() {
    //log('creating new indexeddb...');
    indexeddb = createDbWithTestObjStore();

    return indexeddb.getDb();
  });

  afterEach('increasing test count', function() {
    testCount++;
    return Q(null);
  });

  describe('#constructor', function() {
    it('should create an object that has a database', function() {
      log('STARING Create DB test.')
      should.exist(indexeddb);
      indexeddb.should.have.property('getDb');
      indexeddb.getDb.should.be.a('function');

      var hasObjectStore = function(db) {
        should.exist(db);
        db.should.have.property('createObjectStore');
        //done();
      }

      return indexeddb.getDb()
      .then(hasObjectStore)
      .thenResolve("COMPLETED Create DB test.")
      .then(log);
    });

    it('should create an objectStore in the database', function() {
      log('STARTING Create ObjectStore test.');
      var db = indexeddb.getDb();

      var hasTestObjStore = function(db) {
        //log("objectStoreNames: " + JSON.stringify(db.objectStoreNames, null, 2));
        db.objectStoreNames.should.containOneLike('testObjStore');
      };

      return db.then(hasTestObjStore)
      .thenResolve("COMPLETED Create ObjectStore test.")
      .then(log);
    });

    it('should create an objectStore with autoIncrement key in the database without upgrade function', function() {
      log('STARTING Create ObjectStore with autoIncrement key without upgrade function test.');
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore({name: 'testObjStore', keyType: {autoIncrement : true}});

      var db = builder.build().getDb();

      var hasTestObjStore = function(db) {
        //log("objectStoreNames: " + JSON.stringify(db.objectStoreNames, null, 2));
        db.objectStoreNames.should.containOneLike('testObjStore');
      };

      return db.then(hasTestObjStore)
      .thenResolve("COMPLETED Create ObjectStore with autoIncrement key without upgrade function test.")
      .then(log);
    });

    it('should create an objectStore with keyPath key in the database without upgrade function', function() {
      log('STARTING Create ObjectStore with keyPath key without upgrade function test.');
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore({name: 'testObjStore1', keyType: {autoIncrement: true}})
      .addObjectStore({name: 'testObjStore2', keyType: {keyPath: 'id'}})
      .addObjectStore({name: 'testObjStore3', keyType: {autoIncrement: 'id'}})
      .setDebug();

      var db = builder.build().getDb();

      var hasTestObjStore = function(db) {
        //log("objectStoreNames: " + JSON.stringify(db.objectStoreNames, null, 2));
        db.objectStoreNames.should.containOneLike('testObjStore1');
        db.objectStoreNames.should.containOneLike('testObjStore2');
        db.objectStoreNames.should.containOneLike('testObjStore3');
      };

      return db.then(hasTestObjStore)
      .thenResolve("COMPLETED Create ObjectStore with keyPath key without upgrade function test.")
      .then(log);
    });
  });

  describe('#execTransaction()', function() {
    it('should execute a transaction that creates a record, gets the record, and then deletes the record', function() {
      log('STARTING execTransaction.');
      var testRecord = {testKey: "testValue"};

      var addRecord = function(tx) {
        log('adding record...');
        var objectStore = tx.objectStore("testObjStore");
        var request = objectStore.add(testRecord);
        return request;
      };

      var getRecord = function(tx) {
        log('reading...');
        var objectStore = tx.objectStore("testObjStore");
        var records = [];

        objectStore.openCursor().onsuccess = function(event) {
          var cursor = event.target.result;
          var result;
          if (cursor) {
            var record = {};
            record.key = cursor.key;
            record.value = cursor.value;
            //log('found record: '+JSON.stringify(record, null, 2));
            records.push(record);
            cursor.continue();
          }
        };

        return records;
      };

      var deleteRecord = function(tx) {
        log('deleting record...');
        var objectStore = tx.objectStore("testObjStore");
        var request = objectStore.delete(1);
        return request;
      };

      log('executing transaction now.');
      var transactions = [addRecord, getRecord, deleteRecord];
      return indexeddb.execTransaction(transactions,
        ['testObjStore'], "readwrite")
      .tap(function(results) {
        log(JSON.stringify(results));
      })
      .then(function(results) {
        results.should.have.length(transactions.length);
        results[0].should.be.a('number');

        results[1][0].should.eql({key: 1, value: {testKey: "testValue"}});
      })
      .thenResolve("COMPLETED Execute transaction test.")
      .then(log);
    });
  });

  describe('CRUD operations', function() {
    it('should add a record in the db', function() {
      log('STARTING add test');
      var testRecord = {testKey: "testValue"};

      var test = function(resultKey) {
        resultKey.should.eql(1);
        return indexeddb.get('testObjStore', 1).then(function(result) {
          result.should.eql(testRecord);
        });
      };

      return indexeddb.add('testObjStore', testRecord)
      .then(test)
      .thenResolve("COMPLETED add test.")
      .then(log);
    });

    it('should delete a record in the db', function() {
      log('STARTING delete test');
      var testRecord = {testKey: "testValue"};

      var testAdded = function(resultKey) {
        resultKey.should.eql(1);
        return indexeddb.get('testObjStore', 1).then(function(result) {
          result.should.eql(testRecord);
        });
      };

      var deleteRecord = function() {
        return indexeddb.delete('testObjStore', 1);
      }

      var testDeleted = function() {
        return indexeddb.get('testObjStore', 1).then(function(result) {
          expect(result).to.not.be.ok;
        });
      };

      return indexeddb.add('testObjStore', testRecord)
      .then(testAdded)
      .then(deleteRecord)
      .then(testDeleted)
      .thenResolve("COMPLETED delete test.")
      .then(log);
    });

    it('should update a record in the db', function() {
      log('STARTING update test');
      var testRecord = {testKey: "testValue"};
      var updatedRecord = {testKey: "updatedValue"};

      var testAdded = function(resultKey) {
        resultKey.should.eql(1);
        return indexeddb.get('testObjStore', 1).then(function(result) {
          result.should.eql(testRecord);
        });
      };

      var updateRecord = function() {
        return indexeddb.put('testObjStore', updatedRecord, 1);
      }

      var testUpdated = function() {
        return indexeddb.get('testObjStore', 1).then(function(result) {
          result.should.eql(updatedRecord);
        });
      };

      return indexeddb.add('testObjStore', testRecord)
      .then(testAdded)
      .then(updateRecord)
      .then(testUpdated)
      .thenResolve("COMPLETED update test.")
      .then(log);
    });

    it('should update a record in the db using keyPath', function() {
      log('STARTING update using keyPath test');
      var testRecord = {id: 1, testKey: "testValue"};
      var updatedRecord = {id: 1, testKey: "updatedValue"};
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore({name: 'testObjStore', keyType: {keyPath : 'id'}});
      var indexeddb2 = builder.build();

      var testAdded = function(resultKey) {
        resultKey.should.eql(1);
        return indexeddb2.get('testObjStore', 1).then(function(result) {
          result.should.eql(testRecord);
        });
      };

      var updateRecord = function() {
        return indexeddb2.put('testObjStore', updatedRecord);
      }

      var testUpdated = function() {
        return indexeddb2.get('testObjStore', 1).then(function(result) {
          result.should.eql(updatedRecord);
        });
      };

      return indexeddb2.add('testObjStore', testRecord)
      .then(testAdded)
      .then(updateRecord)
      .then(testUpdated)
      .thenResolve("COMPLETED update using keyPath test.")
      .then(log);
    });

    it('should get all records in the database', function() {
      log('STARTING get all records in the database test');
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore({name: 'testObjStore', keyType: {keyPath : 'id'}});
      var indexeddb2 = builder.build();

      var test = function() {
        return indexeddb2.getAll('testObjStore')
        .tap(function(result) {
          log('getAll(): ' + JSON.stringify(result));
        })
        .then(function(result) {
          result.should.have.length(5);
          for(var i=1;i <= 5;i++) {
            result[i-1].should.eql({id: i, testKey: "testValue" + i});
          }
        });
      };

      var addPromises = [];
      for(var i=1;i <= 5;i++) {
        addPromises.push(
          indexeddb2.add('testObjStore', {id: i, testKey: "testValue" + i})
        );
      }

      return Q.all(addPromises)
      .then(test)
      .thenResolve("COMPLETED get all records in the database test.")
      .then(log);
    });

    it('should get all keys in the database', function() {
      log('STARTING get all keys in the database test');
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore({name: 'testObjStore', keyType: {keyPath : 'id'}});
      var indexeddb2 = builder.build();

      var test = function() {
        return indexeddb2.getAllKeys('testObjStore')
        .tap(function(result) {
          log('getAllKeys(): ' + JSON.stringify(result));
        })
        .then(function(result) {
          result.should.have.length(5);
          for(var i=1;i <= 5;i++) {
            result[i-1].should.eql(i);
          }
        });
      };

      var addPromises = [];
      for(var i=1;i <= 5;i++) {
        addPromises.push(
          indexeddb2.add('testObjStore', {id: i, testKey: "testValue" + i})
        );
      }

      return Q.all(addPromises)
      .then(test)
      .thenResolve("COMPLETED get all keys in the database test.")
      .then(log);
    });

  });

  describe('CRUD operations main interface', function() {
    it('main interface: should add a record in the db', function() {
      log('STARTING main interface add test');

      var testRecord = {testKey: "testValue"};

      var test = function(resultKey) {
        resultKey.should.eql(1);
        return indexeddb.testObjStore.get(1).then(function(result) {
          result.should.eql(testRecord);
        });
      };

      return indexeddb.testObjStore.add(testRecord)
      .then(test)
      .thenResolve("COMPLETED main interface add test.")
      .then(log);
    });

    it('main interface: should delete a record in the db', function() {
      log('STARTING main interface delete test');
      var testRecord = {testKey: "testValue"};

      var testAdded = function(resultKey) {
        resultKey.should.eql(1);
        return indexeddb.testObjStore.get(1).then(function(result) {
          result.should.eql(testRecord);
        });
      };

      var deleteRecord = function() {
        return indexeddb.testObjStore.delete(1);
      }

      var testDeleted = function() {
        return indexeddb.testObjStore.get(1).then(function(result) {
          expect(result).to.not.be.ok;
        });
      };

      return indexeddb.testObjStore.add(testRecord)
      .then(testAdded)
      .then(deleteRecord)
      .then(testDeleted)
      .thenResolve("COMPLETED main interface delete test.")
      .then(log);
    });

    it('main interface: should update a record in the db', function() {
      log('STARTING main interface update test');
      var testRecord = {testKey: "testValue"};
      var updatedRecord = {testKey: "updatedValue"};

      var testAdded = function(resultKey) {
        resultKey.should.eql(1);
        return indexeddb.testObjStore.get(1).then(function(result) {
          result.should.eql(testRecord);
        });
      };

      var updateRecord = function() {
        return indexeddb.testObjStore.put(updatedRecord, 1);
      }

      var testUpdated = function() {
        return indexeddb.testObjStore.get(1).then(function(result) {
          result.should.eql(updatedRecord);
        });
      };

      return indexeddb.testObjStore.add(testRecord)
      .then(testAdded)
      .then(updateRecord)
      .then(testUpdated)
      .thenResolve("COMPLETED main interface update test.")
      .then(log);
    });

    it('main interface: should update a record in the db using keyPath', function() {
      log('STARTING main interface update using keyPath test');
      var testRecord = {id: 1, testKey: "testValue"};
      var updatedRecord = {id: 1, testKey: "updatedValue"};
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore({name: 'testObjStore', keyType: {keyPath : 'id'}});
      var indexeddb2 = builder.build();

      var testAdded = function(resultKey) {
        resultKey.should.eql(1);
        return indexeddb2.get('testObjStore', 1).then(function(result) {
          result.should.eql(testRecord);
        });
      };

      var updateRecord = function() {
        return indexeddb2.put('testObjStore', updatedRecord);
      }

      var testUpdated = function() {
        return indexeddb2.get('testObjStore', 1).then(function(result) {
          result.should.eql(updatedRecord);
        });
      };

      return indexeddb2.add('testObjStore', testRecord)
      .then(testAdded)
      .then(updateRecord)
      .then(testUpdated)
      .thenResolve("COMPLETED main interface update using keyPath test.")
      .then(log);
    });

    it('main interface: should get all records in the database', function() {
      log('STARTING main interface get all records in the database test');
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore({name: 'testObjStore', keyType: {keyPath : 'id'}});
      var indexeddb2 = builder.build();

      var test = function() {
        return indexeddb2.testObjStore.getAll()
        .tap(function(result) {
          log('getAll(): ' + JSON.stringify(result));
        })
        .then(function(result) {
          result.should.have.length(5);
          for(var i=1;i <= 5;i++) {
            result[i-1].should.eql({id: i, testKey: "testValue" + i});
          }
        });
      };

      var addPromises = [];
      for(var i=1;i <= 5;i++) {
        addPromises.push(
          indexeddb2.testObjStore.add({id: i, testKey: "testValue" + i})
        );
      }

      return Q.all(addPromises)
      .then(test)
      .thenResolve("COMPLETED main interface get all records in the database test.")
      .then(log);
    });

    it('main interface: should get all keys in the database', function() {
      log('STARTING main interface get all keys in the database test');
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore({name: 'testObjStore', keyType: {keyPath : 'id'}});
      var indexeddb2 = builder.build();

      var test = function() {
        return indexeddb2.testObjStore.getAllKeys()
        .tap(function(result) {
          log('getAllKeys(): ' + JSON.stringify(result));
        })
        .then(function(result) {
          result.should.have.length(5);
          for(var i=1;i <= 5;i++) {
            result[i-1].should.eql(i);
          }
        });
      };

      var addPromises = [];
      for(var i=1;i <= 5;i++) {
        addPromises.push(
          indexeddb2.testObjStore.add({id: i, testKey: "testValue" + i})
        );
      }

      return Q.all(addPromises)
      .then(test)
      .thenResolve("COMPLETED main interface get all keys in the database test.")
      .then(log);
    });

  });

  describe('Indexes', function() {
    it('should create an index and be able to use it', function() {
      log('STARTING create and use index test');
      var builder = new Builder('testdb2_' + testCount)
      .setVersion(1)
      .addObjectStore(
        {
          name: 'testObjStore',
          keyType: {keyPath : 'id'},
          indexes: [
            {
              name: 'testKey',
              keyPath: 'testKey',
              options: {unique: true}
            }
          ]
        }
      )
      .setDebug();

      var indexeddb2 = builder.build();

      var test = function() {
        return indexeddb2.testObjStoreByTestKey.get('testValue3')
        .tap(function(result) {
          log('found: '+JSON.stringify(result))
        })
        .then(function(result) {
          result.should.eql({id: 3, testKey: "testValue3"});
        });
      };

      var addPromises = [];
      for(var i=1;i <= 5;i++) {
        addPromises.push(
          indexeddb2.testObjStore.add({id: i, testKey: "testValue" + i})
        );
      }

      return Q.all(addPromises)
      .then(test)
      .thenResolve("COMPLETED create and use index test.")
      .then(log);
    });
  });

});
