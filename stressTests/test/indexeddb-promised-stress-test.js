var chai = require("chai");
var should = chai.should();
var expect = chai.expect;
chai.use(require('chai-fuzzy'));
var Builder = require("../../js/indexeddb-promised");
var Q = require('q');
var _ = require('lodash');

var testCount = 1;
var log = function(msg) {
  console.log(testCount + ": " + msg);
};

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

    return indexeddb;
  };

  beforeEach('preparing test database', function() {
    indexeddb = createDbWithTestObjStore();

    return indexeddb.getDb();
  });

  afterEach('increasing test count', function() {
    testCount++;
    return Q(null);
  });

  describe('Cursors', function() {

    it('should create a cursor and iterate the object store in reverse order', function() {
      log('STARTING create a cursor and iterate the object store in reverse order test.');
      var numberOfRecords = 70;
      var LENGTH = 2 * Math.pow(10, 6); // 2MB
      var addPromises = createAddPromises(numberOfRecords, LENGTH);

      function test() {
        return indexeddb.testObjStore.openCursor(null, 'prev').then(function(cursor) {
          var results = [];

          for(var record of cursor) {
            results.push(record);

            var blob = record.value.data;
            checkData(blob);

            log('Iterating over record: ' + record.key + " | " + record.value.description + " | data");
          }

          var keys = _.pluck(results, 'key');
          var values = _.pluck(results, 'value.description');

          var expectedKeys = [];
          var expectedValues = [];
          for(var i=numberOfRecords;i >= 1;i--) {
            expectedKeys.push(i);
            expectedValues.push('testValue'+i);
          }

          keys.should.eql(expectedKeys);
          values.should.eql(expectedValues);

        });
      }

      return Q.all(addPromises)
      .tap(function() {
        log('Done adding records.');
      })
      .then(test)
      .thenResolve("COMPLETED create a cursor and iterate the object store in reverse order test.")
      .then(log);
    });

  });

  describe('Progessive Cursors', function() {
    it('should create a cursor and be able to retrieve data while it becomes available', function() {
      log('STARTING create and use cursor and retrieve data while it becomes available test.');

      var numberOfRecords = 60;
      var LENGTH = 8.7 * Math.pow(10, 6); // 8.7MB
      var addPromises = createAddPromises(numberOfRecords, LENGTH);

      function test() {
        return indexeddb.testObjStore.openProgressiveCursor(null, 'prev').then(function(cursor) {
          var results = [];
          var promises = [];

          for(var recordPromise of cursor) {
            promises.push(recordPromise);
            recordPromise.then(function(record) {
              results.push(record);
              log('Received record: ' + record.key + " | " + record.value.description + " | data");

              var blob = record.value.data;
              checkData(blob);
            });
          }

          return Q.all(promises).then(function() {
            var keys = _.pluck(results, 'key');
            var values = _.pluck(results, 'value.description');

            var expectedKeys = [];
            var expectedValues = [];
            for(var i=numberOfRecords;i >= 1;i--) {
              expectedKeys.push(i);
              expectedValues.push('testValue'+i);
            }

            keys.should.eql(expectedKeys);
            values.should.eql(expectedValues);
          });

        });
      }

      return Q.all(addPromises)
      .tap(function() {
        log('Done adding records.');
      })
      .then(test)
      .thenResolve("COMPLETED create and use cursor and retrieve data while it becomes available test.")
      .then(log);
    });

  });

  function createAddPromises(numberOfRecords, lengthOfDataInBytes) {
    var addPromises = [];
    for(var i=1;i <= numberOfRecords;i++) {
      var rawData = new ArrayBuffer(lengthOfDataInBytes);
      var dataAccess = new Uint32Array(rawData);
      for(var j=0;j < dataAccess.length;j++) {
        dataAccess[j] = j;
      }
      var blob = new Blob([dataAccess], {type: 'application/octet-binary'});
      addPromises.push(
        indexeddb.testObjStore.add({description: "testValue" + i, data: blob})
      );
    }

    return addPromises;
  }

  function checkData(blob) {
    var reader = new FileReader();
    reader.addEventListener("loadend", function() {
       //var data = [];
       var rawData = reader.result;
       var dataAccess = new Uint32Array(rawData);
       for(var i=0;i < dataAccess.length;i++) {
         //data.push(dataAccess[i]);
         dataAccess[i].should.equal(i);
       }
       //log('data: ' + data);
    });
    reader.readAsArrayBuffer(blob);
  }

});
