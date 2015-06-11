module.exports = function(dbName) {
    var version;
    var doUpgrade;
    var objectStores;
    var debug = false;

    this.setDebug = function() {
      debug = true;
      return this;
    };

    this.setVersion = function(pVersion) {
      version = pVersion;
      return this;
    };

    this.setDoUpgrade = function(pDoUpgrade) {
      doUpgrade = pDoUpgrade;
      return this;
    };

    this.addObjectStore = function(name) {
      if(!objectStores) {
        objectStores = [];
      }

      objectStores.push(name);
      return this;
    };

    this.build = function() {
      if(!doUpgrade) {
        doUpgrade = function(db) {
          objectStores.forEach(function(objStore) {
            db.createObjectStore(objStore.name, objStore.keyType);
          });
        };
      }
      var indexeddb = new Indexeddb(dbName, version, doUpgrade);
      if(debug) {
        window['indexeddbPromised_'+dbName] = indexeddb;
      }
      return indexeddb;
    };

    return this;
  };

var Indexeddb = function(dbName, version, doUpgrade) {
  var Q = require('q');
  var openDbDeferred = Q.defer();

  var db = openDbDeferred.promise;

  var request;

  if(version) {
    request = window.indexedDB.open(dbName, version);
  } else {
    request = window.indexedDB.open(dbName);
  }

  request.onupgradeneeded = function (event) {
    var db = event.target.result;
    if(doUpgrade) {
      doUpgrade(db);
    }
  };
  request.onerror = function(event) {
    console.log('onerror: failed to create db for indexeddb object.');
    openDbDeferred.reject("Failed to open indexeddb: "+event.target.errorCode+".");
  };
  request.onsuccess = function(event) {
    //console.log('onsuccess: successfully created db for indexeddb object.');
    openDbDeferred.resolve(this.result);
  };

  this.getDb = function() {
    return db;
  };

  this.cleanup = function() {
    var cleanDB = function() {
      db.done();
      db = null
      return null;
    }
    return db.then(cleanDB);
  }

  this.execTransaction = function(operations, objectStores, mode) {

    var execute = function(db) {
      var queue = Q([]);
      var tx = db.transaction(objectStores, mode);

      operations.forEach(function(operation) {
        var deferred = Q.defer();
        queue = queue.then(function(resultsAccumulator) {
          resultsAccumulator.push(deferred.promise)
          return resultsAccumulator;
        });
        var request = operation(tx);

        if(!request) {
          deferred.resolve(null);
        } else if('onsuccess' in request && 'onerror' in request) {
          request.onsuccess = function(event) {
            //console.log('onsuccess: about to resolve '+operation.operationName+': result: '+JSON.stringify(event.target.result));
            deferred.resolve(event.target.result);
          };
          request.oncomplete = function(event) {
            //console.log('oncomplete: about to resolve '+operation.operationName+': result: '+JSON.stringify(event.target.result));
            deferred.resolve(event.target.result);
          };
          request.onerror = function(event) {
            deferred.reject(new Error('IndexedDB transaction error: ' + event.target.errorCode));
          };
        } else {
          //console.log('request is result: about to resolve '+operation.operationName+': result: '+JSON.stringify(request));
          deferred.resolve(request);
        }
      });

      return Q.all(queue);
    };

    return db
    .then(execute);
  };

  return this;
}
