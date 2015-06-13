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

  this.add = function(store, record, key) {
    var deferTransaction = Q.defer();
    var deferAdd = Q.defer();
    var resultAdd;

    db.then(function(db) {
      return db.transaction(store, "readwrite");
    })
    .then(function(transaction) {
      transaction.oncomplete = function(event) {
        deferTransaction.resolve(resultAdd);
      };

      transaction.onerror = function(event) {
        defer.reject(event.target.errorCode);
      };

      var objectStore = transaction.objectStore(store);

      var request = objectStore.add(record, key);
      request.onsuccess = function(event) {
        resultAdd = event.target.result;
        deferAdd.resolve(event.target.result);
      };

    });

    return deferTransaction.promise;
  }

  this.get = function(store, key) {
    var getDefer = Q.defer();

    return db.then(function(db) {
      var request = db.transaction([store]).objectStore(store).get(key);
      request.onerror = function(event) {
        getDefer.reject(event.target.errorCode);
      };
      request.onsuccess = function(event) {
        getDefer.resolve(event.target.result);
      };

      return getDefer.promise;
    });
  };

  this.delete = function(store, key) {
    var defer = Q.defer();

    return db.then(function(db) {
      var request = db.transaction([store], 'readwrite')
      .objectStore(store)
      .delete(key);

      request.onerror = function(event) {
        defer.reject(event.target.errorCode);
      };
      request.onsuccess = function(event) {
        defer.resolve(event.target.result);
      };

      return defer.promise;
    });
  };

  this.put = function(store, record, key) {
    var deferTransaction = Q.defer();
    var deferPut = Q.defer();
    var resultPut;

    db.then(function(db) {
      return db.transaction(store, "readwrite");
    })
    .then(function(transaction) {
      transaction.oncomplete = function(event) {
        deferTransaction.resolve(resultPut);
      };

      transaction.onerror = function(event) {
        defer.reject(event.target.errorCode);
      };

      var objectStore = transaction.objectStore(store);

      var request = objectStore.put(record, key);
      request.onsuccess = function(event) {
        resultPut = event.target.result;
        deferPut.resolve(event.target.result);
      };

    });

    return deferTransaction.promise;
  }

  this.getAll = function(store) {
    var defer = Q.defer();
    var result = [];

    db.then(function(db) {
      db.transaction(store)
      .objectStore(store)
      .openCursor()
      .onsuccess = function(event) {
        var cursor = event.target.result;
        if(cursor) {
          result.push(cursor.value);
          cursor.continue();
        } else {
          defer.resolve(result);
        }
      };
    });

    return defer.promise;
  };

  return this;
}
