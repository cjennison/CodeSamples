describe('Service: locationService', function () {

  var $httpBackend;
  var $rootScope;
  var locationService;
  var locationResource;
  var $q;

  var locations = [
    makeLocation({id: 1, name: 'CTDEEP'}, '010900010601',
      Math.round(Math.random() * 100), 72, 74, 'LocationCT'),
    makeLocation({id: 2, name: 'MADEP'}, '010800010601',
      Math.round(Math.random() * 100), 72.1, 74.1, 'LocationMA'),
    makeLocation({id: 3, name: 'MEDEP'}, '010700010601',
      Math.round(Math.random() * 100), 72.2, 74.2, 'LocationME')
  ];

  function makeLocation(agency, huc12, id, lat, lon, name) {
    return {
      agency: agency,
      huc12: huc12,
      id: id,
      lat: lat,
      lon: lon,
      name: name
    };
  }

  beforeEach(function () {
    module('sheds.api');
  });

  beforeEach(inject(function ($injector) {
    $httpBackend = $injector.get('$httpBackend');
    $rootScope = $injector.get('$rootScope');
    locationResource = $injector.get('locations');
    locationService = $injector.get('locationService');
    $q = $injector.get('$q');
  }));

  describe('getLocations', function () {

    beforeEach(function () {
      $httpBackend.expect('GET', '/api/v1/locations');
      $httpBackend.whenGET('/api/v1/locations').respond(200, locations);
    });

    it('should have a method called getLocations', function () {
      expect(locationService.getLocations).not.toBeUndefined();
    });

    it('should return a promise', function () {
      expect(locationService.getLocations().$promise.then).toBeDefined();
    });

    it('should get a list of locations', function () {

      var deferred = $q.defer();
      var promise = deferred.promise;

      promise.then(function (response) {
        data = response;
      });

      locationService.getLocations().$promise.then(function (response) {
        deferred.resolve(response);
      });

      $rootScope.$digest();
      $httpBackend.flush();

      expect(data).toContain(jasmine.objectContaining({name: 'LocationCT'}));
      expect(data).toContain(jasmine.objectContaining({name: 'LocationMA'}));
      expect(data).toContain(jasmine.objectContaining({name: 'LocationME'}));

    });

    it('should maintain a list of locations', function () {

      var deferred = $q.defer();
      var promise = deferred.promise;

      promise.then(function (response) {
        data = response;
      });

      //First call
      locationService.getLocations().$promise.then(function (response) {
        deferred.resolve(response);
        spyOn(locationResource, 'query');
      });

      $rootScope.$digest();
      $httpBackend.flush();

      //Second call
      locationService.getLocations();

      expect(locationResource.query).not.toHaveBeenCalled();
    });

  });

  describe('filterLocations', function () {
    it('should have a method called filterLocations', function () {
      expect(locationService.filterLocations).not.toBeUndefined();
    });
  });
});
