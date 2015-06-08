var chai = require("chai");
var should = chai.should();
chai.use(require('chai-fuzzy'));
chai.use(require('chai-things'));
var IndexedDb = require("../js/indexeddb-promised");
var Q = require('q');

var testCount = 1;

var increaseTestCount = function(testName) {
  return testCount++ + ": " + testName + " finished executing.";
};

describe('indexeddb-promised', function() {

  var createDbWithTestObjStore = function() {
    var doUpgrade = function(db) {
      db.createObjectStore('testObjStore', { autoIncrement : true });
    };

    var indexeddb = new IndexedDb('testdb', 1, doUpgrade);
    console.log(testCount+': created indexeddb object.');

    return indexeddb;
  };

  beforeEach('cleaning databases', function() {
    console.log(testCount + ': cleaning db...');
    var defer1 = Q.defer();
    var defer2 = Q.defer();

    (function(defer1, defer2){
      var request1 = window.indexedDB.deleteDatabase('testdb');
      request1.onsuccess = function(event) {
        console.log(testCount + ': successfully deleted testdb.');
        defer1.resolve(null);
      };
      request1.oncomplete = function(event) {
        console.log(testCount + ': oncomplete: successfully deleted testdb.');
        defer1.resolve(null);
      };
      request1.onerror = function(event) {
        console.log(testCount + ': error while deleting testdb.');
        defer1.resolve(null);
      };

      var request2 = window.indexedDB.deleteDatabase('testEmptyDb');
      request2.onsuccess = function(event) {
        console.log(testCount + ': successfully deleted testEmptyDb.');
        defer2.resolve(null);
      };
      request2.oncomplete = function(event) {
        console.log(testCount + ': oncomplete: successfully deleted testEmptyDb.');
        defer2.resolve(null);
      };
      request2.onerror = function(event) {
        console.log(testCount + ': error while deleting testEmptyDb.');
        defer2.resolve(null);
      };

      setTimeout(function() {
        if(defer1.promise.isPending()) {
          console.log(testCount + ': calling timeout for testdb.');
          defer1.resolve(null);
        }
        if(defer2.promise.isPending()) {
          console.log(testCount + ': calling timeout for testEmptyDb.');
          defer2.resolve(null);
        }
      }, 500);
    })(defer1, defer2);

    console.log(testCount + ': Finished assigning onsuccess and onerror');

    return Q.all([defer1.promise, defer2.promise])
    .then(function(result) {
      console.log(testCount + ": beforeEach done.");
      return null;
    }, function(result) {
      return null;
    });

  });

  // beforeEach('cleaning databases', function() {
  //   console.log('Executing beforeEach().');
  // });

  describe('#constructor', function() {
    it('should create an object that has a database', function() {
      setTimeout(function() {
        var indexeddb = new IndexedDb('testEmptyDb');
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
        .thenResolve("Create DB")
        .then(increaseTestCount)
        .then(console.log)
        .thenResolve(indexeddb)
        .then(function(indexeddb) {
          return indexeddb.cleanup();
        });
      }, 0);
    });

    it('should create an objectStore in the database', function() {
      setTimeout(function() {
        var indexeddb = createDbWithTestObjStore();
        var db = indexeddb.getDb();

        var hasTestObjStore = function(db) {
          //console.log("objectStoreNames: " + JSON.stringify(db.objectStoreNames, null, 2));
          db.objectStoreNames.should.containOneLike('testObjStore');
          //done();
        };

        return db.then(hasTestObjStore)
        .thenResolve("Create ObjectStore")
        .then(increaseTestCount)
        .then(console.log)
        .thenResolve(indexeddb)
        .then(function(indexeddb) {
          return indexeddb.cleanup();
        });
      }, 0);
    });
  });

  describe('#execTransaction()', function() {
    it('should execute a transaction that creates a record, gets the record, and then deletes the record', function() {
      setTimeout(function() {
        console.log(testCount+': execTransaction started.');
        var testRecord = {testKey: "testValue"};
        var indexeddb = createDbWithTestObjStore();
        console.log(testCount+': database created.');

        var addRecord = function(tx) {
          console.log('adding record...');
          var objectStore = tx.objectStore("testObjStore");
          var request = objectStore.add(testRecord);
          return request;
        };

        var getRecord = function(tx) {
          console.log('reading...');
          var objectStore = tx.objectStore("testObjStore");
          var records = [];

          objectStore.openCursor().onsuccess = function(event) {
            var cursor = event.target.result;
            var result;
            if (cursor) {
              var record = {};
              record.key = cursor.key;
              record.value = cursor.value;
              //console.log('found record: '+JSON.stringify(record, null, 2));
              records.push(record);
              cursor.continue();
            }
          };

          return records;
        };

        var deleteRecord = function(tx) {
          console.log('deleting record...');
          var objectStore = tx.objectStore("testObjStore");
          var request = objectStore.delete(2);
          return request;
        };

        console.log(testCount+': executing transaction now.');
        return indexeddb.execTransaction([addRecord, getRecord, deleteRecord],
          ['testObjStore'], "readwrite")
        .tap(JSON.stringify)
        .tap(console.log)
        .then(function(results) {
          results.should.have.length(3);
          results[0].should.be.a('number');

          results[1][0].should.eql({key: 1, value: {testKey: "testValue"}});
          //done();
        })
        .thenResolve("Execute transaction")
        .then(increaseTestCount)
        .then(console.log)
        .thenResolve(indexeddb)
        .then(function(indexeddb) {
          return indexeddb.cleanup();
        });
      }, 0);
    });
  });

  // describe('#get()', function() {
  //   var indexeddb = createDbWithTestObjStore();
  //   indexeddb.add('testObjStore', );
  // });
});
