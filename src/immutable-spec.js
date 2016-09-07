'use strict';

import expect from 'expect';
import Immutable from 'immutable';
import code from './immutable';

describe('immutable specific tests', () => {
  let mutator;

  beforeEach(function () {
    mutator = code({
      controller: {
        start: 0,
        score: 0,
        state: 'ready',
        list: [4],
        idList: [{id: 4}, {id: 3}],
        subPush: [{id: 5, arr: []}],
        child: {
          age: 5,
          siblings: {
            name: 'Geoff'
          }
        }
      },
      players: []
    });

    mutator.applyPendingMerges();
  });

  describe('using shorthand notation', function () {
    it('should support modifying: arrays', function () {
      function addN (item) {
        expect(item.toJS()).toEqual({id: 4});

        return item.set('n', 'h');
      }
      mutator.mutate(['controller.idList:4', addN]);

      mutator.applyPendingMerges();

      expect(mutator.get('controller.idList').toJS()).toEqual([
        {id: 4, n: 'h'},
        {id: 3}
      ]);
    });
  });

  describe('arrays of arrays', function () {
    describe('Immutable Lists not of length 2', function () {
      it('should ignore anything that is not an array of arrays', function () {
        mutator.mutate(Immutable.fromJS([]));
        mutator.mutate(Immutable.fromJS(['controller.child.age']));
        mutator.mutate(Immutable.fromJS(['controller.child.age', 123, 'third']));

        mutator.applyPendingMerges();

        expect(mutator.get('controller.child.age')).toBe(5);
      });

      it('should process arrays of arrays if the subarray is length 2', function () {
        mutator.mutate(Immutable.fromJS([['controller.child.age', 123]]));
        mutator.applyPendingMerges();
        expect(mutator.get('controller.child.age')).toBe(123);

        mutator.mutate(Immutable.fromJS([
          ['controller.child.age', 2321],
          ['controller.start', 2],
          ['controller.score', 4]
        ]));

        mutator.applyPendingMerges();

        expect(mutator.get('controller.child.age')).toBe(2321);
        expect(mutator.get('controller.start')).toBe(2);
        expect(mutator.get('controller.score')).toBe(4);
      });
    });

    describe('Immutable.lists of length 2', function () {
      it('should do nothing if first element of array is not string', function () {
        mutator.mutate(Immutable.fromJS([123, 'controller.child.age']));
        mutator.applyPendingMerges();
        expect(mutator.get('controller.child.age')).toBe(5);
      });

      it('should do nothing if second element of array is undefined', function () {
        mutator.mutate(Immutable.fromJS(['controller.child.age', undefined]));
        mutator.applyPendingMerges();
        expect(mutator.get('controller.child.age')).toBe(5);
      });

      it('should do nothing if second element of array is null', function () {
        mutator.mutate(Immutable.fromJS(['controller.child.age', null]));
        mutator.applyPendingMerges();
        expect(mutator.get('controller.child.age')).toBe(5);
      });

      it('should do nothing if second element of array is empty hash', function () {
        mutator.mutate(Immutable.fromJS(['controller.child.age', {}]));
        mutator.applyPendingMerges();
        expect(mutator.get('controller.child.age')).toBe(5);
      });

      it('should unwrap dot strings into objects', function () {
        mutator.mutate(Immutable.fromJS(['controller.child.age', 123]));
        mutator.applyPendingMerges();
        expect(mutator.get('controller.child.age')).toBe(123);
      });

      it('should work where the second argument is an array', function () {
        mutator.mutate(Immutable.fromJS(['controller.list', [1, 2, 3]]));
        mutator.applyPendingMerges();
        expect(mutator.get('controller.list').toJS()).toEqual([1, 2, 3]);
      });
    });
  });
});
