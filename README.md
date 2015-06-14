#indexeddb-promised

This library implements an interface for indexedDB where all the functions return a promise for the result of the underlying indexedDB function they call.

It also uses the builder pattern to configure the database schema and return an object to interact with it.

##Getting started
###Using browserify

##Creating an instance of indexeddb and a database schema

```javascript
var builder = new Builder('myApp')
.setVersion(1)
.addObjectStore(
  {
    name: 'users',
    keyType: {keyPath: 'id'},
    indexes: [
      {
        name: 'email',
        keyPath: 'email',
        {unique: true}
      }
    ]
  })
.addObjectStore(
  {name: 'orders',
  keyType: {autoIncrement: true}
  })
.addObjectStore(
  {name: 'products',
  keyType: {keyPath: 'id'}
  });

var myAppDB = builder.build();

var user1 = myAppDB.users.get(25);
var user2 = myAppDB.usersByEmail.get('user@example.com');

```

###Functions
####Builder Constructor: new Builder(dbname)
*dbname* string represents the name of the database that is going to be opened or created in indexedDB.
####addObjectStore(storeDefinitionObject)
*storeDefinitionObject*:
**name:** name of the store in indexedDB. Also used to expose an objectStore with the same name in the db object:

```javascript
myApp.users.add({id: 32, email: 'user2@example.com'});
```
**keyType:** can be {autoIncrement: true}, {keyPath: key}, both, or undefined for out of line keys.

**indexes:** contains index definition objects:

  **name:** makes access to the index available through objectStoreByName.
  ```javascript
  var user = myAppDB.usersByEmail.get('user@example.com');
  ```
  **keyPath:** name of the key in the value object used for the index to lookup data.

  **indexOptions:** see [the Mozilla documentation on createIndex](https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/createIndex). Example: ```{unique: false}```

Example:
```javascript
var builder = new Builder('myApp')
.setVersion(1)
.addObjectStore(
  {
    name: 'users',
    keyType: {keyPath: 'id'},
    indexes: [
      {
        name: 'email',
        keyPath: 'email',
        {unique: true}
      }
    ]
  })
.build();
```

####setVersion(number)
*number* must be an integer. Changes in the builder, like adding objectStores or indexes to existing objectStores, must be accompanied with an increase in the version number in the setVersion() function in order for the schema changes to take effect.

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

```javascript
function operation(transaction) {
  // Perform operations using indexedDB's API
  ...
  var request = objectStore.get(1);
  return request;
}
```

Operations take a transaction as a parameter that can be use to retrieve objectStores and indexes. They can return a request if the result is useful. Falsy values are accumulated as *null*.
