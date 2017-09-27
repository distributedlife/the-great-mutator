import isObject from 'lodash/isObject';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';
import isEqual from 'lodash/isEqual';
import merge from 'lodash/mergeWith';
import set from 'lodash/set';
import includes from 'lodash/includes';
import replace from 'lodash/replace';
import isEmpty from 'lodash/isEmpty';
import isFunction from 'lodash/isFunction';
import read from 'ok-selector';
import clone from 'lodash/cloneDeep';
import isPromise from 'is-promise';

const replaceArrayDontMerge = (a, b) => isArray(a) ? b : undefined;

function isValidDotStringResult(result) {
  if (result.length !== 2) {
    console.error(result, 'Dot.String support for state mutation expects an array of length 2.');
    return false;
  }
  if (!isString(result[0])) {
    console.error(result, 'Dot.String support for state mutation requires the first entry be a string.');
    return false;
  }
  if (result[1] === null) {
    return false;
  }
  if (isEqual(result[1], {})) {
    return false;
  }

  return true;
}

function ignoreResult (result) {
  if (result === undefined) {
    return true;
  }
  if (result === null) {
    return true;
  }
  if (isEqual(result, {})) {
    return true;
  }
  if (isEqual(result, [])) {
    return true;
  }

  return false;
}

const ImmutableThings = ['_id'];
function stripOutAttemptsToMutateTrulyImmutableThings (result) {
  ImmutableThings.forEach((immutableProp) => {
    if (result[immutableProp]) {
      delete result[immutableProp];
    }
  });

  return result;
}

const readNoWarning = (node, key) => isFunction(key) ? key(node) : read(node, key);

function readAndWarnAboutMissingState (node, key) {
  const prop = readNoWarning(node, key);

  if (prop === undefined) {
    console.error({ key }, 'Attempted to get state for dot.string and the result was undefined. The Great Mutator is based on a no-undefineds premise. Ensure your initial state mutation sets this property');
  }

  return prop;
}

function accessAndCloneState (node, key) {
  const prop = readAndWarnAboutMissingState(node, key);

  if (isObject(prop)) {
    return clone(prop);
  }

  return prop;
}

const defaults = {
  trackChanges: true
}

export default function mutator (initialState = {}, options = defaults) {
  let root = initialState;
  let pendingMerge = {};
  const changes = [];

  const unwrap = (path) => accessAndCloneState(root, path);

  function applyPendingMerges () {
    if (isEqual(pendingMerge, {})) {
      return;
    }

    if (options.trackChanges) {
      changes.push(pendingMerge);
    }

    merge(root, pendingMerge, replaceArrayDontMerge);
    pendingMerge = {};
  }

  let applyResult;
  function applyPushAction (dotString, entries, value) {
    const applyTo = readNoWarning(pendingMerge, dotString) || entries;
    return applyResult(dotString, applyTo.concat([value]));
  }

  function applyPopAction (dotString, entries, value) {
    const matchingValue = (entry) => entry.id !== value.id;
    const applyTo = readNoWarning(pendingMerge, dotString) || entries;
    return set({}, dotString, applyTo.filter(matchingValue));
  }

  function applyReplaceAction (dotString, entries, value) {
    const mod = entries.map((entry) => entry.id === value.id ? value : entry);
    return set({}, dotString, mod);
  }

  function applyOnArrayElement (dotString, value) {
    const pathToArray = dotString.split(':')[0];
    const id = parseInt(dotString.split(':')[1], 10);
    const restOfPath = replace(dotString.split(':')[1], /^[0-9]+\.?/, '');

    const applyChangeToElement = (entry) => {
      if (entry.id !== id) {
        return entry;
      }

      const nv = isFunction(value) ? value(
        isEmpty(restOfPath) ? entry : read(entry, restOfPath)
      ) : value;

      return isEmpty(restOfPath) ? merge(entry, nv) : set(entry, restOfPath, nv);
    };

    const fromPending = readNoWarning(pendingMerge, pathToArray);
    if (fromPending) {
      return set({}, pathToArray, fromPending.map(applyChangeToElement));
    }

    const fromRoot = readAndWarnAboutMissingState(root, pathToArray);
    return set({}, pathToArray, fromRoot.map(applyChangeToElement));
  }

  const trailingHandlers = {
    '+': applyPushAction,
    '-': applyPopAction,
    '!': applyReplaceAction
  };

  applyResult = function (dotString, value) {
    const modifierSymbol = dotString[dotString.length - 1];
    const dotStringSansModifier = dotString.split(modifierSymbol)[0];

    const handler= trailingHandlers[modifierSymbol];
    if (handler) {
      const entries = unwrap(dotStringSansModifier);

      if (isFunction(value)) {
        console.error({dotString, prior: entries}, `Using a function on the ${modifierSymbol} operator is not supported. Remove the ${modifierSymbol} operator to achieve desired effect.`);

        return {};
      }

      return handler(dotStringSansModifier, entries, value);
    } else if (includes(dotString, ':')) {
      return applyOnArrayElement(dotString, value);
    }

    let valueToApply = value;
    if (isFunction(value)) {
      const fromPending = readNoWarning(pendingMerge, dotString);
      valueToApply = value(fromPending ? fromPending : unwrap(dotString));
    }

    return set({}, dotString, valueToApply);
  };

  function mutateNonArray (toApply) {
    let result = toApply;
    if (isArray(result)) {
      if (!isValidDotStringResult(result)) {
        return;
      }

      result = applyResult(result[0], result[1]);
    }

    result = stripOutAttemptsToMutateTrulyImmutableThings(result);

    merge(pendingMerge, result, replaceArrayDontMerge);
  }

  const isArrayOfArrays = (result) => isArray(result) && result.filter(isArray).length === result.length;

  let mutate;
  function mutateArrayOfArrays (result) {
    result.forEach((resultItem) => mutate(resultItem));
  }

  mutate = (result) => {
    if (ignoreResult(result)) {
      return undefined;
    }

    if (isArrayOfArrays(result)) {
      return mutateArrayOfArrays(result);
    } else if (isPromise(result)) {
      return result.then((value) => mutate(value));
    }

    return mutateNonArray(result);
  };

  const mutateSync = (result) => {
    mutate(result);
    applyPendingMerges();
  };

  const mutateBatch = (results) => {
    results.forEach(mutate);
  };

  const mutateBatchSync = (results) => {
    mutateBatch(results);
    applyPendingMerges();
  };

  return {
    all: () => root,
    applyPendingMerges,
    flushChanges: () => changes.splice(0),
    get: (key) => readAndWarnAboutMissingState(root, key),
    mutate: options.sync ? mutateSync : mutate,
    mutateSync,
    mutateAsync: mutate,
    mutateBatch: options.sync ? mutateBatchSync: mutateBatch,
    mutateBatchSync,
    mutateBatchASync: mutateBatch,
    set: (newRoot) => (root = newRoot)
  };
}
