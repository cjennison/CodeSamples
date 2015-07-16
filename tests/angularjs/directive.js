
describe('Directive: regionFilter', function () {
  beforeEach(module('sheds.api'));
  beforeEach(module('api/templates/region-filter.html'));

  var element;
  var outerScope;
  var innerScope;

  var data = {
    states: {
      data: [{id: 'MA', name: 'Massachusetts'}, {id: 'CT', name: 'Connecticut'}, {id: 'ME', name: 'Maine'}]
    },
    huc4: {
      data: [{id: '0001', name: '4River1'}, {id: '0002', name: '4River2'}, {id: '0003', name: '4River3'}]
    },
    huc6: {
      data: [{id: '000001', name: '6River1'}, {id: '000002', name: '6River2'}, {id: '000003', name: '6River3'}]
    },
    huc8: {
      data: [{id: '00000001', name: '8River1'}, {id: '00000002', name: '8River2'}, {id: '00000003', name: '8River3'}]
    },
    huc10: {
      data: [{id: '0000000001', name: '10River1'}, {id: '0000000002', name: '10River2'}, {id: '0000000003', name: '10River3'}]
    }
  };

  beforeEach(inject(function ($compile, $rootScope) {

    outerScope = $rootScope;
    element = angular.element('<region-filter region-query="myQuery" geo-data="geoData" ></region-filter>');
    element = $compile(element)(outerScope);

    outerScope.$digest();

    innerScope = element.isolateScope();
  }));

  describe('when compiled', function () {
    beforeEach(function () {
      outerScope.$apply(function () {
        outerScope.myQuery = {};
        outerScope.geoData = data;
        outerScope.rootOnlyVariable = 'Root';
      });
    });

    it('should compile', function () {
      expect(element).not.toEqual('<region-filter region-query="myQuery" geo-data="geoData" ></region-filter>');
    });

    it('should only see isolated attributes', function () {
      expect(innerScope.geoData).not.toBeUndefined();
      expect(innerScope.regionQuery).not.toBeUndefined();
      expect(innerScope.rootOnlyVariable).toBeUndefined();
    });

    it('should update controller variables from the innerScope', function () {
      innerScope.regionQuery = {
        mode: 'states',
        selection: [{id: 'CT', name: 'Connecticut'}]
      };

      outerScope.$digest();

      expect(outerScope.myQuery.mode).toEqual('states');
      expect(outerScope.myQuery.selection[0].id).toEqual('CT');
    });

  });

  describe('hucList', function () {
    beforeEach(function () {
      outerScope.$apply(function () {
        outerScope.geoData = data;
      });
    });

    it('should change hucList when huc_type is changed', function () {
      innerScope.hucTypes.forEach(function (h) {
        innerScope.selected.huc.type = h;
        innerScope.$digest();

        expect(innerScope.hucList).toEqual(innerScope.geoData['huc' + h].data);
      });
    });
  });

  describe('selected.huc', function () {
    beforeEach(function () {
      outerScope.$apply(function () {
        outerScope.geoData = data;
      });
    });

    it('should reset the selected huc to undefined when mode is changed', function () {
      innerScope.selected.huc.huc = innerScope.geoData.huc4[0];

      innerScope.selected.huc.type = 8;
      innerScope.$digest();
      expect(innerScope.selected.huc.huc).toBeUndefined();
    });
  });

  describe('regionQuery', function () {
    beforeEach(function () {
      outerScope.$apply(function () {
        outerScope.geoData = data;
      });
    });

    it('should create a map of all states when mode is states', function () {
      innerScope.selected.selection.push({id: 'MA', name: 'Massachusetts'}, {id: 'CT', name: 'Connecticut'});
      innerScope.$digest();

      expect(innerScope.regionQuery.selection).toContain('MA');
      expect(innerScope.regionQuery.selection).toContain('CT');

      outerScope.$digest();
      expect(outerScope.myQuery.selection).toContain('MA');
      expect(outerScope.myQuery.selection).toContain('CT');
    });

    it('should set the selection to the huc id when mode is huc', function () {
      innerScope.selected.mode = 'huc';

      innerScope.hucTypes.forEach(function (t) {
        innerScope.selected.huc.huc = innerScope.geoData['huc' + t].data[0];
        innerScope.$digest();

        expect(innerScope.regionQuery.selection).toEqual(innerScope.selected.selection);

        outerScope.$digest();
        expect(outerScope.myQuery.selection).toEqual(innerScope.selected.selection);
      });

    });

    it('should set selection to empty when mode is custom', function () {
      innerScope.selected.mode = 'custom';
      innerScope.$digest();

      expect(innerScope.regionQuery.selection).toEqual([]);

      outerScope.$digest();
      expect(outerScope.myQuery.selection).toEqual([]);
    });

  });

});
