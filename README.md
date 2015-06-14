#indexeddb-promised

This library implements an interface for indexedDB where all the functions return a promise for the result of the underlying indexedDB function they call.

It also uses the builder pattern to configure the database schema and return an object to interact with it.

##Getting started
###Using browserify


##API
###indexeddb.objectStore.add(record[, key])
*record* can be any type of object. If not using the keyPath key type in the object store, then it can also be a primitive.

Returns a promise for the key of the record. Useful when using key type autoIncrement: true.

###indexeddb.objectStore.get(key)
Return a promise for the value of the record identified by *key*.

###indexeddb.objectStore.delete(key)
Returns a promise resolved with *null*.

###indexeddb.objectStore.put(record[, key])
Similar as *add()*, but replaces existing records. The *key* parameter is not required if keyPath key type is used and the record has the property used as keyPath populated.

###indexeddb.objectStore.getAll()
Returns a promise for an array with all values from all records.

###indexeddb.objectStore.getAllKeys()
Returns a promise for an array with the keys of all records.

###indexeddb.execTransaction(operations,objectStores[, mode])
Low level method to execute a transaction in the database. The first parameter is an array of functions where each function is an operation that is to be executed in the transaction. The second array contains strings with the names of the obectStores used in the transaction. The last parameter is the transaction mode which can be "readonly" (default) or "readwrite".

The function returns a promise for an array with the accumulated results of each operation.

The operations are defined as follows:

'''javascript
function operation(transaction) {
  // Perform operations using indexedDB's API
  ...
  var request = objectStore.get(1);
  return request;
}
'''

Operations take a transaction as a parameter that can be use to retrieve objectStores and indexes. They can return a request if the result is useful. Falsy values are accumulated as *null*.
