'use strict';

import expect from 'expect';
import sinon from 'sinon';

import immutableCode from './immutable';
import nativeCode from './native';

const implementations = [
  { name: 'native', code: nativeCode, out: (res) => res },
  { name: 'immutable', code: immutableCode, out: (res) => (res && res.toJS) ? res.toJS() : res }
];

implementations.forEach(({name, code, out}) => {
  describe(`the ${name} implementation`, () => {
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

    describe('simple behaviour', function () {
      it('should allow a single value to mutate', function () {
        mutator.mutate({
          controller: {
            state: 'started',
            score: 0,
            child: {
              age: 123
            }
          }
        });

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.state'))).toBe('started');
        expect(out(mutator.get('controller.score'))).toBe(0);
        expect(out(mutator.get('controller.child.age'))).toBe(123);
      });

      it('should not allow _id to be mutated', function () {
        mutator.mutate({
          _id: 4,
          controller: {
            state: 'started',
            score: 0,
            child: {
              age: 123
            }
          }
        });

        mutator.applyPendingMerges();

        expect(out(mutator.get('_id'))).toEqual(undefined);
      });

      it('should work with adding to arrays', function () {
        mutator.mutate({
          controller: {
            list: [4, 3]
          }
        });

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.list'))).toEqual([4, 3]);
      });
    });

    describe('using functions to alter the current state', function () {
      function happyBirthday (age) {
        return age +1;
      }

      function addItem (items) {
        return items.concat([3]);
      }

      function resetList () {
        return [];
      }

      describe('simple behaviour', function () {
        it('should allow a function to be used to modify the existing value', () => {
          mutator.mutate(['controller.child.age', happyBirthday]);

          mutator.applyPendingMerges();

          expect(out(mutator.get('controller.child.age'))).toBe(6);
        });

        it('should work with adding to arrays', function () {
          mutator.mutate(['controller.list', addItem]);

          mutator.applyPendingMerges();

          expect(out(mutator.get('controller.list'))).toEqual([4, 3]);
        });

        it('should work with removing elements from arrays', function () {
          mutator.mutate(['controller.list', resetList]);

          mutator.applyPendingMerges();

          expect(out(mutator.get('controller.list'))).toEqual([]);
        });
      });

      describe('using shorthand notation', function () {
        beforeEach(() => {
          sinon.spy(console, 'error');
        });

        afterEach(() => {
          console.error.restore();
        });

        it('should support adding+ to arrays', function () {
          mutator.mutate(['controller.list+', addItem]);

          mutator.applyPendingMerges();

          expect(console.error.callCount).toBe(1);
          expect(console.error.firstCall.args[1]).toEqual('Using a function on the + operator is not supported. Remove the + operator to achieve desired effect.');
        });

        it('should support removing- from arrays', function () {
          mutator.mutate(['controller.idList-', addItem]);

          mutator.applyPendingMerges();

          expect(console.error.callCount).toBe(1);
          expect(console.error.firstCall.args[1]).toEqual('Using a function on the - operator is not supported. Remove the - operator to achieve desired effect.');
        });

        it('should support replacing! arrays', function () {
          mutator.mutate(['controller.idList!', addItem]);

          mutator.applyPendingMerges();

          expect(console.error.callCount).toBe(1);
          expect(console.error.firstCall.args[1]).toEqual('Using a function on the ! operator is not supported. Remove the ! operator to achieve desired effect.');
        });

        it('should support modifying arrays children', function () {
          function makeNZ (item) {
            expect(item).toBe(undefined);

            return 'z';
          }

          mutator.mutate(['controller.idList:4.n', makeNZ]);

          mutator.applyPendingMerges();

          expect(out(mutator.get('controller.idList'))).toEqual([
            {id: 4, n: 'z'},
            {id: 3}
          ]);
        });
      });
    });

    describe('using shorthand notation', function () {
      it('should support adding+ to arrays', function () {
        mutator.mutate(['controller.list+', 5]);

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.list'))).toEqual([4, 5]);
      });

      it('should support adding+ to arrays of arrays', function () {
        mutator.mutate(['controller.subPush:5.arr+', 5]);

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.subPush:5.arr'))).toEqual([5]);
      });

      it('should work with emptying arrays', function () {
        mutator.mutate({
          controller: {
            list: []
          }
        });

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.list'))).toEqual([]);
      });

      it('should support removing- from arrays', function () {
        mutator.mutate(['controller.idList-', {id: 3}]);

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.idList'))).toEqual([{id: 4}]);
      });

      it('should support modifying! arrays', function () {
        mutator.mutate(['controller.idList!', {id: 4, n: 'a'}]);

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.idList'))).toEqual([
          {id: 4, n: 'a'},
          {id: 3}
        ]);
      });

      it('should support modifying: arrays', function () {
        mutator.mutate(['controller.idList:4', {n: 'h'}]);

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.idList'))).toEqual([
          {id: 4, n: 'h'},
          {id: 3}
        ]);
      });

      it('should support modifying arrays children', function () {
        mutator.mutate(['controller.idList:4.n', 'z']);

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.idList'))).toEqual([
          {id: 4, n: 'z'},
          {id: 3}
        ]);
      });

      it('should handle multiple changes over multiple frames', () => {
        mutator.mutate(['controller.idList:4.n', 'z']);
        mutator.applyPendingMerges();

        mutator.mutate(['controller.idList:4.b', 'c']);
        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.idList'))).toEqual([
          {id: 4, n: 'z', b: 'c'},
          {id: 3}
        ]);
      })

      it('should handle multiple changes in a single frame', () => {
        mutator.mutate(['controller.idList:4.n', 'z']);
        mutator.mutate(['controller.idList:4.b', 'c']);

        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.idList'))).toEqual([
          {id: 4, n: 'z', b: 'c'},
          {id: 3}
        ]);
      })
    });

    describe('working with promises', function () {
      it('should work with promises', function (done) {
        mutator.mutate(Promise.resolve(['controller.score', 2]))
          .then(() => {
            mutator.applyPendingMerges();
            expect(out(mutator.get('controller.score'))).toEqual(2);
            done();
          });
      });

      it('should work with delayed promises', function (done) {
        mutator.mutate(new Promise((resolve) => {
          function delayedReaction () {
            resolve(2);
          }

          setTimeout(delayedReaction, 500);
        })
        .then((value) => {
          return ['controller.score', value];
        }))
        .then(() => {
          mutator.applyPendingMerges();

          expect(out(mutator.get('controller.score'))).toEqual(2);
          done();
        });
      });

      it('should work with rejected promises', function (done) {
        mutator.mutate(Promise.reject())
          .catch(() => {
            mutator.applyPendingMerges();

            expect(out(mutator.get('controller.score'))).toEqual(0);
            done();
          });
      });
    });

    describe('when you do not want to mutate state', function () {
      it('should do nothing with undefined', function () {
        mutator.mutate(undefined);
        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.state'))).toBe('ready');
      });

      it('should do nothing with null', function () {
        mutator.mutate(null);
        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.state'))).toBe('ready');
      });

      it('should do nothing with empty hashes', function () {
        mutator.mutate({});
        mutator.applyPendingMerges();

        expect(out(mutator.get('controller.state'))).toBe('ready');
      });
    });

    describe('arrays of arrays', function () {
      describe('arrays not of length 2', function () {
        it('should ignore anything that is not an array of arrays', function () {
          mutator.mutate([]);
          mutator.mutate(['controller.child.age']);
          mutator.mutate(['controller.child.age', 123, 'third']);

          mutator.applyPendingMerges();

          expect(out(mutator.get('controller.child.age'))).toBe(5);
        });

        it('should process arrays of arrays if the subarray is length 2', function () {
          mutator.mutate([['controller.child.age', 123]]);
          mutator.applyPendingMerges();
          expect(out(mutator.get('controller.child.age'))).toBe(123);

          mutator.mutate([
            ['controller.child.age', 2321],
            ['controller.start', 2],
            ['controller.score', 4]
          ]);

          mutator.applyPendingMerges();

          expect(out(mutator.get('controller.child.age'))).toBe(2321);
          expect(out(mutator.get('controller.start'))).toBe(2);
          expect(out(mutator.get('controller.score'))).toBe(4);
        });
      });

      describe('arrays of length 2', function () {
        it('should do nothing if first element of array is not string', function () {
          mutator.mutate([123, 'controller.child.age']);
          mutator.applyPendingMerges();
          expect(out(mutator.get('controller.child.age'))).toBe(5);
        });

        it('should do nothing if second element of array is undefined', function () {
          mutator.mutate(['controller.child.age', undefined]);
          mutator.applyPendingMerges();
          expect(out(mutator.get('controller.child.age'))).toBe(5);
        });

        it('should do nothing if second element of array is null', function () {
          mutator.mutate(['controller.child.age', null]);
          mutator.applyPendingMerges();
          expect(out(mutator.get('controller.child.age'))).toBe(5);
        });

        it('should do nothing if second element of array is empty hash', function () {
          mutator.mutate(['controller.child.age', {}]);
          mutator.applyPendingMerges();
          expect(out(mutator.get('controller.child.age'))).toBe(5);
        });

        it('should unwrap dot strings into objects', function () {
          mutator.mutate(['controller.child.age', 123]);
          mutator.applyPendingMerges();
          expect(out(mutator.get('controller.child.age'))).toBe(123);
        });

        it('should work where the second argument is an array', function () {
          mutator.mutate(['controller.list', [1, 2, 3]]);
          mutator.applyPendingMerges();
          expect(out(mutator.get('controller.list'))).toEqual([1, 2, 3]);
        });
      });
    });

    describe('specific error scenarios', () => {
      beforeEach(() => {
        mutator.mutate([ 'players+', {
          id: 1, pacman: { position: { x: 100, y: 100 } }
        }]);

        mutator.applyPendingMerges();
      });

      it('should not crash with entry.get is not a function', () => {
        mutator.mutate([['players:1.pacman.position', { x: 208, y: 368 }]] );

        mutator.applyPendingMerges();
      });
    });

    describe('changes', () => {
      it('should track each mutation', () => {
        mutator.mutate(['players+', {
          id: 1,
          pacman: {
            position: { x: 208, y: 368 }
          }
        }]);
        mutator.mutate(['controller.start', 50]);
        mutator.mutate({ something: 'darkside' });

        mutator.applyPendingMerges();

        expect(mutator.flushChanges().map((r) => out(r))).toEqual([
          {
            players: [
              {
                id: 1,
                pacman: {
                  position: { x: 208, y: 368 }
                }
              }
            ],
            controller: {
              start: 50
            },
            something: 'darkside'
          }
        ]);
      });

      it('should ignore null', () => {
        mutator.mutate(null);
        mutator.applyPendingMerges();

        expect(out(mutator.flushChanges())).toEqual([]);
      });

      it('should ignore undefined', () => {
        mutator.mutate(undefined);
        mutator.applyPendingMerges();

        expect(out(mutator.flushChanges())).toEqual([]);
      });

      it('should ignore empty arrays', () => {
        mutator.mutate([]);
        mutator.applyPendingMerges();

        expect(out(mutator.flushChanges())).toEqual([]);
      });

      it('should ignore empty objects', () => {
        mutator.mutate({});
        mutator.applyPendingMerges();

        expect(out(mutator.flushChanges())).toEqual([]);
      });

      it('should throw out changes once flushed', () => {
        expect(out(mutator.flushChanges())).toEqual([]);
      });

      it('can be disabled', () => {
        const initialState = {
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
        };

        const mutator2 = code(initialState, { trackChanges: false });

        mutator2.applyPendingMerges();

        mutator2.mutate(['controller.start', 50]);
        mutator2.mutate({ something: 'darkside' });

        expect(mutator2.flushChanges()).toEqual([]);
      })
    });
  })
});