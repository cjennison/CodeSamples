/**
  GIS Directive
  Large code snippet for displaying a map with locations
  Accepts any list of layers
  Driven by the filter -> mode, each mode corresponds to a matching layer object key
  Sends a selected object, and area back to the controller
*/

angular.module('sheds.viewer')
  .directive('locationsMap', ['layerService', function (layerService) {
    return {
      restrict: 'E',
      replace: true,
      template: "<div class='map' style='height:450px;margin-bottom:10px;'><div id='info'></div><div class='loader' ng-show='loading'>Loading...</div></div>",
      scope: {
        //Array of location objects
        locations: '=',

        //Array of layer objects {name, url, format}
        layers: '=',

        //Object associated with filtering regions {mode, selection}
        filter: '=',

        //Selected location
        selected: '=',

        //Selected area
        selectedArea: '=',

        //notify when to show loading button
        loading: '='
      },
      link: function (scope, element) {

        //Boolean Value used to check if a location has been clicked
        var clicked = false;

        //Tooltip
        var info = $('#info');
        info.tooltip({
          animation: false,
          trigger: 'manual'
        });

        //Map Variables
        var mapLayers;

        var view = new ol.View({
          center: [-7807094.620180023, 5467474.037380246],
          zoom: 6
        });

        var basemap = new ol.layer.Tile({
          source: new ol.source.OSM(),
          opacity: 0.6
        });

        var defaultStyle = new ol.style.Style({
          image: new ol.style.Circle({
            radius: 5,
            fill: new ol.style.Fill({
              color: [0, 153, 255, 1]
            }),
            stroke: new ol.style.Stroke({
              color: [255, 255, 255, 0.75],
              width: 1.5
            })
          })
        });

        //Location Layer
        var locationSource = new ol.source.Vector({
          features: []
        });
        var locationLayer = new ol.layer.Vector({
          id: 'locations',
          source: locationSource,
          style: defaultStyle
        });

        //Map
        var map = new ol.Map({
          layers: [
            basemap, locationLayer
          ],
          view: view
        });

        scope.map = map;
        map.setTarget(element[0]);

        // --------------------------------------
        // ---------- Select Locations ----------
        // --------------------------------------
        //Selection
        var select = new ol.interaction.Select({
          style: new ol.style.Style({
            image: new ol.style.Circle({
              radius: 7,
              fill: new ol.style.Fill({
                color: [200, 90, 90, 1]
              }),
              stroke: new ol.style.Stroke({
                color: [255, 255, 255, 0.75],
                width: 1.5
              })
            })
          }),
          layers: [locationLayer]
        });
        map.addInteraction(select);

        //Watch Selected
        var watchSelected = null;
        scope.selectedList = select.getFeatures();
        scope.selectedList.on('change:length', function (e) {
          if (e.target.getArray().length === 0) {return; } //No selections
          if (e.target.item(0) === undefined) {return; } //No valid items
          if (highlightSite) {highlightSite.setStyle(null); } //Dump highlight
          //Reset watch selected location
          if (watchSelected) {
            watchSelected.setStyle(null);
            watchSelected = null;
          }

          //Set highlight to null
          highlightSite = null;

          //Find item in the array
          var res = _.find(scope.locations, function (l) {
            return l.id == e.target.item(0).getProperties().id;
          });

          scope.selected = res;

          setTimeout(function () {scope.$apply();}, 1);
        });

        // ------------------------------------
        // ---------- Select Regions ----------
        // ------------------------------------
        var selectedFeatureList = []; //For use with states (multiple)
        var selectedFeatureStyle = new ol.style.Style({
          fill: new ol.style.Fill({
            color: [121, 219, 107, 0.5]
          }),
          stroke: new ol.style.Stroke({
            color: '#3399CC',
            width: 1.25
          })
        });
        map.on('click', function (evt) {
          var feature = map.forEachFeatureAtPixel(evt.pixel,
            function (feature, layer) {
              return feature;
            });
          if (feature && feature.get('layer') != 'locationLayer') {
            //remove the highlight
            highlight = null;
            //Find the feature in the list
            var found = _.remove(selectedFeatureList, function (f) {
              return f.get('id') == feature.get('id');
            });

            if (found.length === 0) {
              var newSelection = feature;
              newSelection.setStyle(selectedFeatureStyle);
              selectedFeatureList.push(newSelection);
            } else {feature.setStyle(null); }

            scope.selectedArea = _.map(selectedFeatureList, function (f) {
              return {
                id: f.get('id'),
                name: f.get('name')
              };
            });

            scope.$apply();
          }
        });

        // ------------------------------------
        // ---------- Hover Features ----------
        // ------------------------------------
        var highlight;
        var highlightStyle = new ol.style.Style({
          fill: new ol.style.Fill({
            color: [225, 159, 102, 0.5]
          }),
          stroke: new ol.style.Stroke({
            color: '#3399CC',
            width: 1.25
          })
        });
        var highlightSiteStyle = new ol.style.Style({
            image: new ol.style.Circle({
              radius: 5,
              fill: new ol.style.Fill({
                color: [250, 148, 32, 1]
              }),
              stroke: new ol.style.Stroke({
                color: [255, 255, 255, 0.75],
                width: 1.5
              })
            })
          });
        var highlightSite = null;

        map.on('pointermove', function (evt) {
          if (highlight) {highlight.setStyle(null); }
          if (highlightSite) {highlightSite.setStyle(null); }
          var feature = map.forEachFeatureAtPixel(evt.pixel,
            function (feature, layer) {
              return feature;
            });
          //Move tooltip
          info.css({
              left: evt.pixel[0] + 'px',
              top: (evt.pixel[1] - 15) + 'px'
            });

          //if the feature is a region
          if (feature && feature.get('layer') != 'locationLayer') {

            var string = feature.get('name') + (!isNaN(parseInt(feature.get('id'))) ? ' - ' + feature.get('id') : '');

            info.tooltip('hide')
              .attr('data-original-title', string)
              .tooltip('fixTitle')
              .tooltip('show');

            var find = _.find(selectedFeatureList, function (f) {
              return f.get('id') == feature.get('id');
            });
            if (find === undefined) {
              highlight = feature;
              highlight.setStyle(highlightStyle);
            }
          } else if (feature && feature.get('layer') == 'locationLayer') {
            //if the feature is a site and not selected
            if (watchSelected != feature) {
              highlightSite = feature; //Set the site and style
              highlightSite.setStyle(highlightSiteStyle);
            }

            //and show the data on the tooltip
            info.tooltip('hide')
              .attr('data-original-title', feature.get('agency') + ': ' + feature.get('name') +
                    (feature.get('description') ? ' - ' + feature.get('description') : ''))
              .tooltip('fixTitle')
              .tooltip('show');
          } else {
            //Otherwise, hide the tooltip
            info.tooltip('hide');
          }
        });

        // ------------------------------------
        // ---------- Watch Locations ---------
        // ------------------------------------
        scope.$watch('locations', function (locations) {
          locationSource.clear();
          scope.loading = false;
          if (locations === undefined) {return; }
          if (locations.length === 0) {return; }
          var features = [];

          locations.forEach(function (location) {
            var wgsCoords = [location.longitude, location.latitude];
            var mapCoords = ol.proj.transform(wgsCoords,
                'EPSG:4326', 'EPSG:3857');

            features.push(new ol.Feature({
              'geometry': new ol.geom.Point(mapCoords),
              'id': location.id,
              'size': 3,
              'name': location.name,
              'agency': location.agency.name,
              'description': location.description,
              'state': null,
              'layer': 'locationLayer'
            }));

          });
          locationSource.addFeatures(features);
        }, true);

        // ------------------------------------
        // ----------- Watch Layers -----------
        // ------------------------------------
        var layerWatch = scope.$watch('layers', function (layers) {
          if (layers !== undefined) {

            //Process Layers
            layerService.processLayers(scope.layers, scope.addFilterLayers);
            layerWatch(); //close watcher
          }
        });

        scope.addFilterLayers = function (layers) {
          //Store map layers
          mapLayers = layers;

          var keys = Object.keys(mapLayers);
          keys.forEach(function (k) {
            //Insert at lowest level
            map.getLayers().insertAt(1, mapLayers[k]);
            mapLayers[k].setVisible(false);
          });
          mapLayers[scope.filter.mode].setVisible(true);
        };

        // -----------------------------------------------
        // ----------- Watch Selected Location -----------
        // -----------------------------------------------
        scope.$watch('selected', function (d) {
          //If the event was fired from a click, dump it
          if (d === null || d === undefined) {return; }

          //Get the location and set the style
          var location = _.find(locationSource.getFeatures(), function (f) {
            return f.get('id') == d.id;
          });
          if (location === undefined) {return; }

          //If there is a selected feature, remove that feature
          if (select.getFeatures().getArray().length > 0) {
            select.getFeatures().removeAt(0);
          }

          select.getFeatures().insertAt(0, location);

          //Hide Tooltip
          info.tooltip('hide');
        }, true);

        // ----------------------------------------------
        // ----------- Watch Filter Selection -----------
        // ----------------------------------------------
        scope.$watch('filter.selection', function (f) {
          if (f === undefined || f === null) {return; }

          if (highlight) {
            highlight.setStyle(null);
            highlight = null;
          }

          //Dump all current features
          selectedFeatureList.forEach(function (n) {
            n.setStyle(null);
          });
          selectedFeatureList = [];

          //Create an array of features
          f.forEach(function (n) {
            var newFeature = mapLayers[scope.filter.mode].getSource().getFeatureById(n);
            if (newFeature) {
              newFeature.setStyle(selectedFeatureStyle);
              selectedFeatureList.push(newFeature);
            }
          });
        });

        // -----------------------------------------
        // ----------- Watch Filter Mode -----------
        // -----------------------------------------
        scope.$watch('filter.mode', function (f) {
          if (!mapLayers) {
            return;
          }

          var keys = Object.keys(mapLayers);
          keys.forEach(function (k) {
            //Set all layers not visible
            mapLayers[k].setVisible(false);
          });

          //Set
          if (scope.filter.mode != 'custom') {
            mapLayers[scope.filter.mode].setVisible(true);
          }
        }, true);

      }
    };
  }]);
