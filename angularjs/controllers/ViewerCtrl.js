/**
  View Controller
  Stores the most minimal amount of functionality
  Holds hardcoded values to be passed to directives
  See ecosheds.org:1337
*/

angular.module('sheds.viewer')
  .controller('ViewerCtrl',
    ['$http', '$rootScope', '$scope', '$state', '$filter',
      'localStorageService', 'locationService', 'agenciesList',
      'locationList', 'toastr', 'cartService',
    function ($http, $rootScope, $scope, $state, $filter,
        localStorageService, locationService, agenciesList,
        locationList, toastr, cartService) {

      $scope.agencyList = agenciesList;
      $scope.locationList =  locationList;
      $scope.filteredLocationList = $scope.locationList;
      $scope.regionQuery = {mode: 'states', selection: []};
      $scope.agencyQuery = [];
      $scope.timespanQuery = [];
      $scope.selectedLocation = {};
      $scope.mapLoading = true;
      $scope.selectedLocation = null;
      $scope.viewMode = false;

      $scope.addToCart = function () {
        if ($scope.downloadData.length === 0) {return; }
        cartService.addToCart($scope.downloadData, 'locations');
      };

      $scope.emptyCart = function () {
        cartService.emptyCart();
      };

      $scope.$watch('filteredLocationList', function (l) {
        console.log('Watch Filtered List', l);
      });

      $scope.layers = {
        huc4: {
          url: 'https://s3.amazonaws.com/sheds-ice/huc4.topojson',
          format: 'TopoJSON',
          data: [],
          map: {id: {method: 'getId', key: null}, name: 'name'}
        },
        huc6: {
          url: 'https://s3.amazonaws.com/sheds-ice/huc6.topojson',
          format: 'TopoJSON',
          data: [],
          map: {id: {method: 'getId', key: null}, name: 'name'}
        },
        huc8: {
          url: 'https://s3.amazonaws.com/sheds-ice/huc8.topojson',
          format: 'TopoJSON',
          data: [],
          map: {id: {method: 'getId', key: null}, name: 'name'}
        },
        huc10: {
          url: 'https://s3.amazonaws.com/sheds-ice/huc10.topojson',
          format: 'TopoJSON',
          data: [],
          map: {id: {method: 'getId', key: null}, name: 'name'}
        },
        states: {
          url: 'https://s3.amazonaws.com/sheds-ice/states.topojson',
          format: 'TopoJSON',
          data: [],
          map: {id: {method: 'getProperties', key: 'stusps'}, name: 'name'}
        }
      };
      
      $scope.$watchGroup(['regionQuery', 'agencyQuery', 'timespanQuery'], function (query) {
        $scope.queryLocations($scope.regionQuery,
          $scope.agencyQuery, $scope.timespanQuery);
      });

      $scope.$watch('selectedLocation', function (s) {
        console.log('Watch Selected', s);
        if (s === null) {return; }
        $scope.viewMode = true;
      });

      //Creates a worker object to query locations in another thread
      $scope.queryLocations = function (region, agency, timespan) {
        $scope.mapLoading = true;

        var query = {
          list: $scope.locationList,
          region: $scope.regionQuery,
          agency: $scope.agencyQuery,
          timespan: $scope.timespanQuery
        };

        locationService.filterLocations(query, '/worker/query.js',
          function (result) {
            if (result === null) {return; }
            $scope.filteredLocationList = result;
            $scope.mapLoading = false;
            $scope.$apply();
          });

      };

    }]
  );
