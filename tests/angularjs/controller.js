describe('Controller: ViewerCtrl', function () {
  var scope;
  var controller;

  var locationList = [
    {agency: {name: 'A1'}, huc12: '000101000101', id: 1, latitude: 1,
      longitude: 1, name: 'TestLocation_1', state: 'TESTX',
      description: 'test description 1',
      series: [
        {start_datetime: new Date('1/1/2000'),
        end_datetime: new Date('1/1/2001')}
      ]},
    {agency: {name: 'A2'}, huc12: '000000010101', id: 2, latitude: 2,
      longitude: 2, name: 'TestLocation_2', state: 'TESTY',
      description: 'test description 2',
      series: [
        {start_datetime: new Date('1/1/2000'),
        end_datetime: new Date('1/1/2010')}
      ]},
    {agency: {name: 'A3'}, huc12: '000101010101', id: 2, latitude: 3,
      longitude: 3, name: 'TestLocation_3', state: 'TESTZ',
      description: 'test description 3',
      series: [
        {start_datetime: new Date('1/1/2003'),
        end_datetime: new Date('1/1/2004')},
         {start_datetime: new Date('1/1/2007'),
        end_datetime: new Date('1/1/20010')}
      ]}
  ];

  var agenciesList = [];

  beforeEach(module('sheds.viewer'));

  beforeEach(inject(function ($rootScope, $controller) {
    scope = $rootScope;
    controller = $controller('ViewerCtrl',
      {$scope: scope, agenciesList: agenciesList, locationList: locationList});
  }));

  describe('filter', function () {
    describe('regionQuery', function () {
      describe('states', function () {
        it('should return nothing if there are no matching locations',
          function () {
            var regionQuery = {
              mode: 'states',
              selection: ['TESTN']
            };

            var filteredList = filter({list: scope.locationList,
              region: regionQuery});

            expect(filteredList).toEqual([]);
          }
        );

        it('should return everything if all possible states are selected',
          function () {
            var regionQuery = {
              mode: 'states',
              selection: ['TESTX', 'TESTY', 'TESTZ']
            };

            var filteredList = filter({list: scope.locationList,
              region: regionQuery});

            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_1'}));
            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_2'}));
            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_3'}));
          }
        );

        it('should return matching locations', function () {
          var regionQuery = {
            mode: 'states',
            selection: ['TESTX', 'TESTY']
          };

          var filteredList = filter({list: scope.locationList,
            region: regionQuery});

          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_1'}));
          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_2'}));
          expect(filteredList).not.toContain(jasmine.objectContaining(
            {name: 'TestLocation_3'}));
        });
      });

      describe('huc', function () {
        describe('huc4', function () {
          it('should return nothing if there are no matching locations',
            function () {
              var regionQuery = {
                mode: 'huc4',
                selection: '1000'
              };

              var filteredList = filter({list: scope.locationList,
                region: regionQuery});

              expect(filteredList).toEqual([]);
            }
          );

          it('should return matching huc12 locations', function () {
            var regionQuery = {
              mode: 'huc4',
              selection: ['0001']
            };

            var filteredList = filter({list: scope.locationList,
              region: regionQuery});

            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_1'}));
            expect(filteredList).not.toContain(jasmine.objectContaining(
              {name: 'TestLocation_2'}));
            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_3'}));

          });
        });

        describe('huc6', function () {
          it('should return nothing if there are no matching locations',
            function () {
              var regionQuery = {
                mode: 'huc6',
                selection: ['100101']
              };

              var filteredList = filter({list: scope.locationList,
                region: regionQuery});

              expect(filteredList).toEqual([]);
            }
          );

          it('should return matching huc12 locations', function () {
            var regionQuery = {
              mode: 'huc6',
              selection: ['000101']
            };

            var filteredList = filter({list: scope.locationList,
              region: regionQuery});

            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_1'}));
            expect(filteredList).not.toContain(jasmine.objectContaining(
              {name: 'TestLocation_2'}));
            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_3'}));
          });
        });

        describe('huc8', function () {
          it('should return nothing if there are no matching locations',
            function () {
              var regionQuery = {
                mode: 'huc8',
                selection: ['10010100']
              };

              var filteredList = filter({list: scope.locationList,
                region: regionQuery});

              expect(filteredList).toEqual([]);
            }
          );

          it('should return matching huc12 locations', function () {
            var regionQuery = {
              mode: 'huc8',
              selection: ['00010100']
            };

            var filteredList = filter({list: scope.locationList,
              region: regionQuery});

            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_1'}));
            expect(filteredList).not.toContain(jasmine.objectContaining(
              {name: 'TestLocation_2'}));
            expect(filteredList).not.toContain(jasmine.objectContaining(
              {name: 'TestLocation_3'}));

          });
        });

        describe('huc10', function () {
          it('should return nothing if there are no matching locations',
            function () {
              var regionQuery = {
                mode: 'huc8',
                selection: '1000000101'
              };

              var filteredList = filter({list: scope.locationList,
                region: regionQuery});

              expect(filteredList).toEqual([]);
            }
          );

          it('should return matching huc12 locations', function () {
            var regionQuery = {
              mode: 'huc10',
              selection: ['0000000101']
            };

            var filteredList = filter({list: scope.locationList,
              region: regionQuery});

            expect(filteredList).not.toContain(jasmine.objectContaining(
              {name: 'TestLocation_1'}));
            expect(filteredList).toContain(jasmine.objectContaining(
              {name: 'TestLocation_2'}));
            expect(filteredList).not.toContain(jasmine.objectContaining(
              {name: 'TestLocation_3'}));
          });
        });
      });

      describe('custom', function () {
        //TODO: Add tests
      });

    });

    describe('agencyQuery', function () {
      it('should return nothing if there are no matching locations',
        function () {
          var agencyQuery = [{name: 'AZ'}];

          var filteredList = filter({list: scope.locationList,
            agency: agencyQuery});

          expect(filteredList).toEqual([]);
        }
      );

      it('should return matching locations', function () {
        var agencyQuery = [{name: 'A1'}, {name: 'A2'}];

        var filteredList = filter({list: scope.locationList,
          agency: agencyQuery});

        expect(filteredList).toContain(jasmine.objectContaining(
          {name: 'TestLocation_1'}));
        expect(filteredList).toContain(jasmine.objectContaining(
          {name: 'TestLocation_2'}));
        expect(filteredList).not.toContain(jasmine.objectContaining(
          {name: 'TestLocation_3'}));
      });

    });

    describe('timespanQuery', function () {

      it('should return nothing if there are no matching locations',
        function () {
          var timespanQuery = [new Date('1/1/1001'), new Date('1/1/1001')];

          var filteredList = filter({list: scope.locationList,
          timespan: timespanQuery});

          expect(filteredList).toEqual([]);
        }
      );

      it('should return matching locations with data in the bounds',
        function () {
          var timespanQuery = [new Date('1/1/2001'), new Date('6/1/2001')];

          var filteredList = filter({list: scope.locationList,
          timespan: timespanQuery});

          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_1'}));
          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_2'}));
          expect(filteredList).not.toContain(jasmine.objectContaining(
            {name: 'TestLocation_3'}));
        }
      );

      it('should return matching locations with data in a large bound',
        function () {
          var timespanQuery = [new Date('1/1/2000'), new Date('6/1/2011')];

          var filteredList = filter({list: scope.locationList,
          timespan: timespanQuery});

          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_1'}));
          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_2'}));
          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_3'}));
        }
      );

      it('should return matching locations with data spanning multiple series',
        function () {
          var timespanQuery = [new Date('1/1/2003'), new Date('1/1/2008')];

          var filteredList = filter({list: scope.locationList,
          timespan: timespanQuery});

          expect(filteredList).not.toContain(jasmine.objectContaining(
            {name: 'TestLocation_1'}));
          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_2'}));
          expect(filteredList).toContain(jasmine.objectContaining(
            {name: 'TestLocation_3'}));
        }
      );
    });
  });

});
