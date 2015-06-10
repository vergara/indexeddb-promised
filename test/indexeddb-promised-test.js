var chai = require("chai");
var should = chai.should();
chai.use(require('chai-fuzzy'));
chai.use(require('chai-things'));
var IndexedDb = require("../js/indexeddb-promised");
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

    var indexeddb = new IndexedDb('testdb' + testCount, 1, doUpgrade);
    log('created indexeddb object.');

    return indexeddb;
  };

  beforeEach('preparing test database', function() {
    log('creating new indexeddb...');
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
});
