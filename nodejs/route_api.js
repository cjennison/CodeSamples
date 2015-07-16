var express = require('express'),
    router = express.Router(),
    async = require('async'),
    uuid = require('node-uuid'),
    fs = require('fs'),
    expressJwt = require('express-jwt'),
    mkdirp = require('mkdirp'),
    kue = require('kue'),
    _ = require('lodash');

var env = process.env.NODE_ENV || 'development';

var db = require('../models'),
    uploader = require("../lib/uploader"),
    batch_uploader = require("../lib/batch-upload"),
    config = require("../config/config")[env];

var serializers = {
  req: function reqSerializer(req) {
    return {
      method: req.method,
      url: req.url,
      query: req.query,
      headers: req.headers
    };
  }
};

var log = require('../lib/logger.js')('api', serializers);

var jobs = kue.createQueue();

var secret = config.secret;
if (!secret) {
  log.error('Missing secret token');
}

function restrictAdmin (req, res, next) {
  if (!req.user.is_admin) {
    req.log.warn('Unauthorized request, requires administrative privileges');
    return res.send(401, "Requires administrative privileges.");
  }
  next();
}

function send405(req, res) {
  return res.send(405);
}

router.use(function(req, res, next){
  req.log = log.child({req: req, reqId: uuid()});
  next();
});

// AUTHENTICATION
// this requires all users to have a valid token
router.use(expressJwt({secret: secret}));

router.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    var message;
    if (err.message === 'jwt expired') {
      message = 'Unauthorized request, token is expired.';
    } else if (err.message === 'invalid signature') {
      message = 'Unauthorized request, token is invalid.';
    } else if (err.message === 'No Authorization header was found') {
      message = 'Unauthorized request, token is missing.';
    } else {
      message = 'Unauthorized request, valid token not found.';
    }
    return res.json(401, {
      code: err.code,
      message: message,
      status: err.status
    });
  }
  next();
});


router.use(function (req, res, next) {
  req.restrict = {};
  if (req.user.agency_id && !req.user.is_admin) {
    req.agency_id = req.user.agency_id;
  }
  next();
});

// test route
router.route('/admin')
  .get(restrictAdmin, function (req, res) {
    req.log.info('GET /admin');
    res.json({message: 'hello admin'});
  });

// AGENCIES
router.route("/agencies")
  .get(function (req, res){
    var qry = _.pick(req.query, _.keys(db.agency.rawAttributes));
    req.log.info('GET /agencies');

    db.agency
      .findAll({where: qry})
      .then(function (agencies){
        res.json(agencies);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message});
      });
    })
  .post(restrictAdmin, function (req, res){
    req.log.info('POST /agencies');
    var obj = _.pick(req.body, _.keys(db.agency.rawAttributes));
    var agency = db.agency.build(obj);


    agency.save()
      .then(function (agency) {
        res.json(201, agency);
      }).catch(function (err) {
        res.send(err);
      });
  });

router.route("/agencies/:id")
  .all(function (req, res, next) {

    db.agency
      .find({where: {id: req.params.id}})
      .then(function (agency) {
        if (agency) {
          req.agency = agency;
          next();
        } else {
          res.json(404, {message: "Could not find agency with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error({agencyid:req.params.id}, err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /agencies/:id');
    res.json(req.agency);
  })
  .put(restrictAdmin, function (req, res){
    req.log.info('PUT /agencies/:id');

    var attrs = _.pick(req.body, _.keys(db.agency.rawAttributes));

    req.agency
      .updateAttributes(attrs)
      .then(function (agency) {
        res.json(agency);
      }).catch(function (err) {
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .delete(restrictAdmin, function(req, res){
    req.log.info('DELETE /agencies/:id');

    req.agency
      .destroy()
      .then(function () {
        res.send(200, {message: 'Agency deleted.'});
      }).catch(function (err) {
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

// LOCATIONS
router.route("/locations")
  .get(function (req, res){
    req.log.info('GET /locations');
    var qry = _.pick(req.query, _.keys(db.location.rawAttributes));

    if (req.agency_id) {
      qry.agency_id = req.agency_id;
    }

    db.location.findAll({
        where: qry,
        include: [db.agency]
      }).then(function (locations){
        res.json(locations);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
    })
  .post(function (req, res){
    req.log.info('POST /locations');
    var obj = _.pick(req.body, _.keys(db.location.rawAttributes));
    var location = db.location.build(obj);

    location.save()
      .then(function (location) {
        db.location.find({
          where: {id: location.id},
          include: [db.agency]
        }).then(function (location) {
          res.json(201, location);
        }).catch(function (err) {
          req.log.error(err);
          res.send(400, {message: err.message || 'Unknown error'});
        });
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/locations/:id")
  .all(function (req, res, next) {
    db.location.find({
        where: {id: req.params.id},
        include: [db.agency]
      }).then(function (location) {
        if (location) {
          if (req.agency_id && location.agency_id !== req.agency_id) {
            return res.json(403, {message: "Not authorized for this location"});
          }
          req.location = location;
          next();
        } else {
          res.json(404, {message:"Could not find location with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /locations/:id');
    res.json(req.location);
  })
  .put(function (req, res) {
    req.log.info('PUT /locations/:id');
    var attrs = _.pick(req.body, _.keys(db.location.rawAttributes));

    req.location
      .updateAttributes(attrs)
      .then(function (location) {
        res.json(location);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .delete(function(req, res){
    req.log.info('DELETE /locations/:id');
    req.location
      .destroy()
      .then(function () {
        res.send(200, {message: 'Location deleted.'});
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/locations/:id/series")
  .all(function (req, res, next) {
    db.location.find({
        where: {id: req.params.id},
        include: [db.agency]
      }).then(function (location) {
        if (location) {
          if (req.agency_id && location.agency_id !== req.agency_id) {
            return res.json(403, {message: "Not authorized for this location"});
          }

          req.location = location;
          next();
        } else {
          res.json(404, {message:"Could not find location with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /locations/:id/series');
    req.location.getSerieses({
        include: [db.agency, db.variable, db.location]
      }).then(function (serieses) {
        var location = req.location.dataValues;
        async.map(serieses, function(series, next) {
          var seriesValues = series.dataValues;
          db.sequelize.query([
                "SELECT min(values.datetime) as start_date,",
                "  max(values.datetime) as end_date,",
                "  count(values.*) as count",
                "from values",
                "where values.series_id=:id"
              ].join(' '),
              null,
              { raw: true, replacements: { id: seriesValues.id } })
            .spread(function(dates, metadata) {
              seriesValues.start_date = dates[0].start_date;
              seriesValues.end_date = dates[0].end_date;
              seriesValues.count = dates[0].count;
              next(null, seriesValues);
            }).catch(function (err) {
              req.log.error(err);
              next(err);
            });
        }, function(err, series) {
          if (err) return res.send(400, {message: err.message || 'Unknown error'});

          location.series = series;
          res.send(location);
        });
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/locations/:id/series/daily")
  .all(function (req, res, next) {
    db.location.find({
        where: {id: req.params.id},
        include: [db.agency]
      }).then(function (location) {
        if (location) {
          if (req.agency_id && location.agency_id !== req.agency_id) {
            return res.json(403, {message: "Not authorized for this location"});
          }

          req.location = location;
          next();
        } else {
          res.json(404, {message:"Could not find location with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /locations/:id/series/daily');
    req.location.getSerieses({
        include: [db.agency, db.variable, db.location]
      }).then(function (serieses) {
        var location = req.location.dataValues;
        async.map(serieses, function(series, next) {
          var seriesValues = series.dataValues;
          db.sequelize.query([
                "SELECT date_trunc('day', values.datetime) as date,",
                "  avg(value) as mean,",
                "  min(value) as min,",
                "  max(value) as max,",
                "  count(value) as n",
                "from values",
                "where values.series_id=:id",
                "and values.flagged=false",
                "group by date",
                "order by date;"
              ].join(' '),
              null,
              { raw: true, replacements: { id: seriesValues.id } })
            .spread(function(values, metadata) {
              seriesValues.values = values;
              next(null, seriesValues);
            }).catch(function (err) {
              next(err);
            });
        }, function(err, series) {
          if (err) {
            req.log.error(err);
            res.send(400, {message: err.message || 'Unknown error'});
          } else {
            location.series = series;
            res.send(location);
          }
        });
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

// VARIABLES
router.route("/variables")
  .get(function (req, res){
    req.log.info('GET /variables');
    db.variable.findAll({where: req.query})
      .then(function (variables){
        res.json(variables);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
    })
  .post(restrictAdmin, function (req, res){
    req.log.info('POST /variables');
    var variable = db.variable.build(req.body);

    variable.save()
      .then(function (variable) {
        res.json(201, variable);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/variables/:id")
  .all(function (req, res, next) {
    db.variable.find(req.params.id)
      .then(function (variable) {
        if (variable) {
          req.variable = variable;
          next();
        } else {
          return res.json(404, {message:"Could not find variable with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /variables/:id');
    res.json(req.variable);
  })
  .put(restrictAdmin, function (req, res){
    req.log.info('PUT /variables/:id');
    req.variable
      .updateAttributes(req.body)
      .then(function (variable) {
        res.json(variable);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .delete(restrictAdmin, function(req, res){
    req.log.info('DELETE /variables/:id');
    req.variable
      .destroy()
      .then(function () {
        res.send(200, {message: 'Variable deleted.'});
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/variables/:id/series")
  .all(function (req, res, next) {
    db.variable.find(req.params.id)
      .then(function (variable) {
        if (variable) {
          req.variable = variable;
          next();
        } else {
          res.json(404, {message:"Could not find variable with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /variables/:id/series');
    req.variable.getSerieses({
      include: [db.agency, db.variable, db.location]
    }).then(function (series) {
      res.json(series);
    }).catch(function (err) {
      req.log.error(err);
      res.send(400, {message: err.message || 'Unknown error'});
    });
  });

// VALUES
router.route("/values")
  .get(function (req, res){
    req.log.info('GET /values');
    db.value.findAll({where: req.query})
      .then(function (values){
        res.send(values);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
    })
  .post(function (req, res){
    req.log.info('POST /values');
    var value = db.value.build(req.body);

    value.save()
      .then(function (value) {
        res.send(201, value);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/values/:id")
  .all(function (req, res, next) {
    db.value.find(req.params.id)
      .then(function (value) {
        if (value) {
          req.value = value;
          next();
        } else {
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /values/:id');
    res.json(req.value);
  })
  .put(function (req, res){
    req.log.info('PUT /values/:id');
    req.value
      .updateAttributes(req.body)
      .then(function (value) {
        res.json(value);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .delete(function(req, res){
    req.log.info('DELETE /values/:id');
    req.value
      .destroy()
      .then(function () {
        res.send(200, {message: 'Value deleted.'});
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

// SERIES
router.route("/series")
  .get(function (req, res){
    req.log.info('GET /series');
    db.series.findAll({
        include: [db.agency, db.variable, db.location],
        where: req.query
      }).then(function (series){
        res.json(series);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
    })
  .post(function (req, res){
    req.log.info('POST /series');
    var series = db.series.build(req.body);

    series.save()
      .then(function (series) {
        res.json(201, series);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/series/:id")
  .all(function (req, res, next) {
    db.series.find({
        where: {id: req.params.id},
        include: [db.agency, db.variable, db.location]
      }).then(function (series) {
        if (series) {
          req.series = series;
          next();
        } else {
          res.json(404, {message:"Could not find series with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /series/:id');
    res.json(req.series);
  })
  .put(function (req, res){
    req.log.info('PUT /series/:id');
    req.series.updateAttributes(req.body)
      .then(function (series) {
        res.json(series);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .delete(function(req, res){
    req.log.info('DELETE /series/:id');
    req.series
      .destroy()
      .then(function () {
        res.send(200, {message: 'Series deleted.'});
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/series/:id/values")
  .all(function (req, res, next) {
    db.series.find({
        where: { id: req.params.id },
        include: [db.agency, db.variable, db.location]
      }).then(function (series) {
        if (series) {
          req.series = series;
          next();
        } else {
          return res.json(404, {message:"Could not find series with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /series/:id/values');
    req.series.getValues({ order: 'datetime' })
      .then(function(values) {
        var series = req.series.dataValues;
        series.values = values;
        res.json(series);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/series/:id/daily")
  .all(function (req, res, next) {
    db.series.find({
        where: { id: req.params.id },
        include: [db.agency, db.variable, db.location]
      }).then(function (series) {
        if (series) {
          req.series = series;
          next();
        } else {
          res.json(404, {message:"Could not find series with id " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /series/:id/daily');
    var series = req.series.dataValues;
    db.sequelize.query([
        "SELECT date_trunc('day', values.datetime) as date,",
        "  avg(value) as mean,",
        "  min(value) as min,",
        "  max(value) as max,",
        "  count(value) as n",
        "from values",
        "where values.series_id=:id",
        "and values.flagged=false",
        "group by date",
        "order by date;"
      ].join(' '),
      null,
      { raw: true, replacements: { id: series.id } })
    .spread(function(values, metadata) {
      series.values = values;
      res.json(series);
    }).catch(function (err) {
      req.log.error(err);
      res.send(400, {message: err.message || 'Unknown error'});
    });
  });

// CATCHMENTS
router.route("/catchments")
  .get(function (req, res) {
    req.log.info('GET /catchments');
    db.catchment.findAll(req.query)
      .then(function (catchments) {
        res.json(catchments);
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/catchments/location")
  // get catchment from lat/lon location point
  // example: GET /catchments/location?latitude=42&longitude=-72
  .get(function (req, res) {
    req.log.info('GET /catchments/location');
    var where;

    var lat = +req.query.latitude,
        lon = +req.query.longitude;

    if (!isNaN(lat) && !isNaN(lon)) {
      where = 'ST_Contains(geom, ST_SetSRID(ST_MakePoint('+lon+','+lat+'),4326))';
    } else {
      return res.json(400, {message: 'Invalid latitude and longitude'});
    }

    db.catchment
      .find({
        where: where,
        attributes: ['gid', 'featureid', ['ST_AsGeoJSON(geom)', 'geom']]
      }, {
        raw: true
      })
      .then(function(catchment) {
        catchment.geom = JSON.parse(catchment.geom);
        return res.json(catchment);
      }).catch(function (err) {
        req.log.error(err);
        return res.send(400, {message: err.message || 'Unknown error'});
      });
  });

router.route("/catchments/:id")
  .all(function (req, res, next) {
    db.catchment
      .find({
          where: {featureid: req.params.id},
          attributes: ['gid', 'featureid', ['ST_AsGeoJSON(geom)', 'geom']]
        }, {
          raw: true
        })
      .then(function(catchment) {
        if (catchment) {
          catchment.geom = JSON.parse(catchment.geom);
          req.catchment = catchment;
          next();
        } else {
          req.log.error("Could not find catchment with featureid " + req.params.id);
          res.json(404, {message:"Could not find catchment with featureid " + req.params.id});
        }
      }).catch(function (err) {
        req.log.error(err);
        res.send(400, {message: err.message || 'Unknown error'});
      });
  })
  .get(function (req, res) {
    req.log.info('GET /catchments/"id');
    res.json(req.catchment);
  });

// UPLOAD
router.route('/upload')
  .get(send405)
  .post(function(req, res) {
    req.log.info('POST /upload');
    if (!req.files.file) {
      req.log.error({filepath:req.files.file},"Missing file");
      return res.json(400, {message: "Missing file"});
    }

    if (!req.body.config) {
      req.log.error({config:req.body.config},"Missing config object");
      return res.json(400, {message: "Missing config object"});
    }

    var config;
    try {
      config = JSON.parse(req.body.config);
    } catch (e) {
      req.log.error({config:req.body.config}, "Config object is not valid JSON");
      return res.json(400, {message: "Config object is not valid JSON"});
    }

    var user = req.user;

    var agency;
    if (user.agency) {
      agency = user.agency;
    } else if (user.is_admin) {
      try {
        agency = JSON.parse(req.body.agency);
      } catch (e) {
        req.log.error({agency:req.body.agency}, "Agency object is not valid JSON");
        return res.json(400, {message: "Agency object is not valid JSON"});
      }
    }

    if (!agency || !agency.name) {
      req.log.error({agency:req.body.agency}, "Could not find agency");
      return res.json(400, {message: "Could not find agency"});
    }

    uploader.upload({name: req.files.file.originalname, path: req.files.file.path},
                    config, user, agency)
      .then(function(results) {
        res.json(201, {message: "Upload successful", results: results});
      }).catch(function(err) {
        req.log.error({name: req.files.file.originalname, path: req.files.file.path, config:config, user:user, agency:agency}, (err.message || err));
        res.json(400, {message: (err.message || err), error: err});
      });
  });

router.route('/locations-upload')
  .get(send405)
  .post(function(req, res){
    req.log.info('POST /locations-upload');
    if (!req.files.file) {
      res.json(400, {message: "Missing file"});
    }

    if (!req.body.config) {
      res.json(400, {message: "Missing config object"});
    }

    var config;
    try {
      config = JSON.parse(req.body.config);
    } catch (e) {
      req.log.error({config:req.body.config}, "Config object is not valid JSON");
      res.json(400, {message: "Config object is not valid JSON"});
    }

    var user = req.user;
    var agency;

    if (user.agency) {
      agency = user.agency;
    } else if (user.is_admin) {
      agency = JSON.parse(req.body.agency);
    }

    if (!agency || !agency.name) {
      req.log.info({agency:req.body.agency}, "Could not find agency");
      res.json(400, {message: "Could not find agency"});
    }

    batch_uploader.upload({
        name: req.files.file.originalname,
        path: req.files.file.path
      },
      config,
      user,
      agency,
      function(err, results) {
        if (err) {
          if(typeof err === 'string'){
            res.log.error({
              name: req.files.file.originalname,
              path: req.files.file.path,
              config:config,
              user:user,
              agency:agency},  "Unable to upload file: " + err);
            res.json(400, {message: "Unable to upload file: " + err});
          } else {
            res.log.error({
              name: req.files.file.originalname,
              path: req.files.file.path,
              config:config,
              user:user,
              agency:agency}, err);
            res.json(400, {message: "Database error: Unable to upload file.", error: err});
          }
        }

        res.json(201, {message: "Upload successful", results: results});
      });
  });

//RUNS
router.route('/runs')
  .get(function(req, res){
    req.log.info('GET /runs');
    db.run.findAll({
      where:req.query,
      include:[db.model]
    })
    .then(function(runs){
      res.json(runs);
    }, function(err){
      req.log.error({query:req.query}, (err.message || 'Unknown error'));
      res.send(400, {message: err.message || 'Unknown error'});
    });
  });

router.route('/runs/:id')
  .all(function(req, res, next){
    db.run.find({
      where: {id: req.params.id},
      include:[db.model]
    })
    .then(function(run){
      if(run){
        req.run = run;
        next();
      } else {
        req.log.info("Could not find run with id " + req.params.id);
        res.json(404, {message:"Could not find run with id " + req.params.id});
      }
    }).catch(function (err) {
      req.log.error({id:req.params.id}, (err.message || 'Unknown error'));
      res.send(400, {message: err.message || 'Unknown error'});
    });
  })
  .get(function(req, res){
    req.log.info('GET /runs/:id');
    res.json([req.run]);
  });

// MODELS
router.route("/models")
  .get(function (req, res){
    req.log.info('GET /models');
    db.model.findAll({
      where: req.query
    }).then(function (models){
      res.json(models);
    }).catch(function (err){
      req.log.error({query:req.query}, err.message || 'Unknown error');
      res.send(400, {message: err.message || 'Unknown error'});
    });
  });

router.route("/models/:id")
  .all(function (req, res, next){
    req.log.info('GET /models/:id');
    db.model.find({
      where: {id: req.params.id}
    }).then(function (model){
      if(model){
        req.model = model;
        next();
      } else {
        req.log.info({id:req.params.id}, "Could not find model with id " + req.params.id);
        res.json(404, {message:"Could not find model with id " + req.params.id});
      }
    }).catch(function (err){
      req.log.error({id:req.params.id}, err.message || 'Unknown error');
      res.send(400, {message: err.message || 'Unknown error'});
    });
  });

// JOBS
router.route('/jobs')
  .post(function(req, res){
    req.log.info('POST /jobs');
    var run;
    var update_run = {};
    var job;
    var uuid_dir = uuid.v4();
    var directory = config.runs_dir;

    mkdirp(directory + uuid_dir + "/", function(err){
      if (err) {
        req.log.error(err.message || 'Unknown error');
        return res.json(500, {message: err.message || 'Unknown error'});
      }

      fs.writeFile(directory + "input.json", JSON.stringify(req.body.input, null), function(err){
        if (err)  {
          req.log.error({directory: directory + "input.json"},err.message || 'Unknown error');
          return res.json(500, {message: err.message || 'Unknown error'});
        }  
        var model_script;

        db.model.find({
            where: { id: req.body.model_id }
          }).then(function (model){
            if (model) {
              model_script = model.script_path;
              createJob(model_script);
            } else {
              req.log.info({id:req.body.model_id}, "Model does not exist.");
              return res.json(404, { message: "Model does not exist" });
            }
          }).catch(function (err){
            req.log.error({id:req.body.model_id}, err.message || 'Unknown error');
            res.send(400, {message: err.message || 'Unknown error'});
          });
      });
    });

    function createJob(script){
      job = jobs.create(req.body.type, {
        model_script: script,
        wd: directory
      });

      run = db.run.build({
        user_id: req.body.user_id,
        model_id: req.body.model_id,
        job_id: 9999,
        input: req.body.input,
        output: null,
        uuid: uuid_dir,
        wd: directory,
        failed: false,
        stdout: null,
        stderr: null,
        error: null,
        start_time: null,
        end_time: null
      }).save().then(function(inst){
        run = inst;

        job = job.save(function(){
          run.job_id = job.id;
          run.save().then(function(){
            res.json(run);
          });
        }).on('progress', function(){
          run.start_time = Date.now();
          run.save();
        }).on('complete', function(){
          var output = fs.readFile(directory + "output.json", 'utf8', function(err, data){
            //Set end time and output, then save
            run.end_time = Date.now();
            run.output = JSON.parse(data);
            run.save();

          });
        }).on('failed', function(){
          //Set the end time and failed
          run.end_time = Date.now();
          run.failed = true;
          run.save();
        });
      });
    }
  });

// AUTH
router.route("/auth/email")
  .get(send405)
  .put(function (req, res){
    req.log.info('PUT /auth/email');
    db.user.find({
      include: [db.agency],
      where: { username: req.body.username }
    }).then(function (user){
      user.email = req.body.email;

      user.save()
        .then(function (e_user){
          res.json(e_user);
        }).catch(function (err){
          req.log.error({user:user}, err.message || 'Unknown error');
          res.json(500, { message: err.message || 'Unknown error' });
        });
    }).catch(function (err){
      req.log.error({username:req.body.username}, err.message || 'Unknown error');
      res.json(500, { message: err.message || 'Unknown error' });
    });
  });

router.route("/auth/password")
  .get(send405)
  .post(send405)
  .put(function(req, res){
    req.log.info('PUT /auth/password');
    db.user.find({
      include: [db.agency],
      where: {username:req.body.username}
    }).then(function(user){
      if (!user) {
        req.log.error({username:req.body.username}, "No user found");
        return res.json(404, {message: 'No user found'});
      }

      user.comparePassword(req.body.form.currentpw, function(err, isMatch) {
        if (err) {
          req.log.error(err);
          return res.json(500, {message: 'Server error', error: err});
        }

        if (isMatch) {
          user.setPassword(req.body.form.newpw, function(err){
            if (err) {
              req.log.error(err);
              return res.json(500, {message: 'Server error', error: err});
            }

            user.save()
              .then(function (user) {
                return res.json(200, user);
              }).catch(function (err) {
                req.log.error({user:user}, err.message || 'Unknown error');
                return res.json(500, { message: err.message || 'Unknown error'});
              });
          });
        } else {
          return res.json(400, {message: 'Current password is incorrect.'});
        }
      });
    });

  });

// Catch any unknown routes.
// IMPORTANT: this must be the last route in this file
router.route('/*')
  .all(function(req, res) {
    req.log.info('get /*');
    req.log.error("Accessed unknown route");
    res.send(404);
  });

module.exports = router;