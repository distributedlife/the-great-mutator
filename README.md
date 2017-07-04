# The Great Mutator

> Describe mutations, get results! With batching and a change log.

The great mutator is an wrapper around a state tree. It could be called a store. It's really an object.

You can use this wrapper to describe mutations that will be staged until applied as a single change.

Choose your backing structure:

```javascript
import theGreatMutator from 'the-great-mutator';
```

And create a great mutator.

```javascript
const initialState = {
  top: 'level',
  such: {
    nested: 'wow'
  },
  array: [{id: 1. prop: true}],
  counter: 0
};

const state = theGreatMutator(initialState);
```

# Mutating
With this wrapper you can send in your mutations, like this:

```javascript
state.mutate({ top: 'changed' });
state.get('top'); //level
```

Except that our state has not changed yet. It's only staged.

```javascript
state.applyPendingMerges();
state.get('top'); //changed
```

This also works:

```javascript
state.mutate(['such.nested', 'very'])
state.get('such.nested'); //wow
state.applyPendingMerges();
state.get('such.nested'); //very
```

And you can apply multiple mutations at once. Using any of the given syntax.

```javascript
state.mutate([
  ['such.nested', 'very'],
  [{top: 'changed' }]
]);
```

It can handle modifying arrays in clever ways:

```javascript
// This replaces the existing value of 'array'
state.mutate(['array', [1,2,3,4]]);

// This pushes a record onto the array
state.mutate(['array+', { this: 'element', is: 'pushed', onto: 'the', array: true }]);

// This replaces the element with the matching id.
state.mutate(['array!', { id:1, prop: false }]);

// While this only modifies what is passed in.
state.mutate(['array:4', { prop: false }])

// And you could have done this:
state.mutate(['array:4.prop', false])
```

You can pass in a function:

```javascript
const increment = (current) => current + 1;

state.mutate(['counter', increment]);
state.get('counter') //1
state.applyPendingMerges();
state.get('counter') //2
```

But it also considers things that have been staged. So this works too:

```javascript
state.mutate(['counter', 0]);
state.applyPendingMerges();
state.get('counter') //0

state.mutate(['counter', increment]);
state.mutate(['counter', increment]);
state.mutate(['counter', increment]);
state.get('counter') //0

state.applyPendingMerges();
state.get('counter') //3
```

As do promises:

```javascript
state.mutate(['top', Promise.resolve('only applied on resolution and after batching')]);
state.get('top') //changed
state.applyPendingMerges();
state.get('top') //only applied on resolution and after batching
```

# Things you should know

- It won't mutate `_id`, even if you ask nicely.
- It relies on array elements having an `id` property.

# Reading Values

You can get the root object by asking for `all`. Or read a specific value using `get`. Get uses [ok-selector](https://github.com/distributedlife/ok-selector) under the hood so you can use `dot.strings.to.state` as well as `reference.arrays:1.items`.

```javascript
state.all();
state.get('path.to.some.state');
```

# Getting the changes

The `flushChanges` method returns an array of changes as well as emptying out the change array. Changes are the result of `applyPendingMerges` calls.

```javascript
state.mutate(['counter', 0]);
state.flushChanges() // []
state.applyPendingMerges();
state.get('counter') //0
state.flushChanges() // [{counter: 0}]

state.mutate(['counter', increment]);
state.mutate(['counter', increment]);
state.mutate(['counter', increment]);
state.flushChanges() // []
state.applyPendingMerges();
state.flushChanges() // [{counter: 3}]

state.mutate(['counter', increment]);
state.applyPendingMerges();
state.mutate(['counter', increment]);
state.applyPendingMerges();
state.mutate(['counter', increment]);
state.applyPendingMerges();
state.flushChanges() // [{counter: 4}, {counter: 5}, {counter: 6}]
```

## Disabling change recording
You can disable recording of changes by passing in configuration option as the second parameter of `the great mutator` constructor. The `flushChanges` method always returns an empty array.

```javascript
const state = theGreatMutator({}, { trackChanges; false });
state.mutate(['counter', increment]);
state.mutate(['counter', increment]);
state.mutate(['counter', increment]);
state.applyPendingMerges();
state.flushChanges() // []
```
