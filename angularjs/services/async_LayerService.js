/**
  Asyncronous Layer Loading
  Loads Topojson files from a D3 Queue
  Prepares layers, applies parameters, and returns the layer to the list before continuing
*/

angular.module('sheds.viewer')
  .service('layerService', function () {

    function loadGeo(object, cb, next) {

      d3.json(object.url, function (err, data) {
        if (err) {console.log(err); }
        //Create the source
        var source    = new ol.source.Vector();
        var features  = (new ol.format[object.format]()).readFeatures(data, {
          featureProjection: 'EPSG:3857'
        });
        features = _.map(features, function (f) {
          f.set('layer', object.key);
          f.set('id', object.map.id.key ? f[object.map.id.method]()[object.map.id.key] : f[object.map.id.method]());
          //f.layer = object.key;
          return f;
        });
        source.addFeatures(features);

        //Save feature list/source/layer
        var layer         = new ol.layer.Vector({
          id: object.key,
          source: source
        });

        //Get Object Data
        object.data  = _.map(features, function (n) {
          //Id is either mapped to a method or mapped to a property of an object
          var id = object.map.id.key ? n[object.map.id.method]()[object.map.id.key] : n[object.map.id.method]();
          return {
            id: id,
            name: n.getProperties()[object.map.name]
          };
        });
        //Callback to apply to layers object
        cb(layer);

        //Complete defer
        next();

      });
    }

    //Processes the layers received in the parameters
    this.processLayers = function (layers, cb) {
      var layerObj = {};

      //Create queue and record keys
      var q = queue(1);
      var keys = Object.keys(layers);
      keys.forEach(function (k) {
        layers[k].key = k; //Attach key to object

        q.defer(loadGeo, layers[k], function (layer) {
          layerObj[k] = layer;
          //layers[k] = layer;
        });
      });

      q.awaitAll(function (err, res) {
        cb(layerObj);
      });
    };

  });
