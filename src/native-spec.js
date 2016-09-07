'use strict';

import expect from 'expect';
import code from './native';

describe('native specific tests', () => {
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
        expect(item).toEqual({id: 4});

        item.n = 'h';
        return item;
      }
      mutator.mutate(['controller.idList:4', addN]);

      mutator.applyPendingMerges();

      expect(mutator.get('controller.idList')).toEqual([
        {id: 4, n: 'h'},
        {id: 3}
      ]);
    });
  });
});