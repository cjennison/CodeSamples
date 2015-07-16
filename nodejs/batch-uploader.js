// Location Uploader

// Uploads Locations to the Database
// Arguments:
//   - file: object containing name and path attributes or a path as string
//   - config: configuration object
//   - user: user object
//   - agency: agency object
//   - cb: callback function

var fs = require('fs'),
    path = require('path'),
    _ = require('lodash'),
    async = require('async'),
    meltdata = require('melt-data'),
    csvParse = require('csv-parse'),
    moment = require('moment'),
    moment_timezone = require('moment-timezone'),
    colors = require('colors');

var db = require('../models');

var VALID_EXTENSIONS = ['.csv', '.json'];

var log = require('./logger.js')('batch-upload');

function upload(file, config, user, agency, cb) {

  log.info({file: file, config: config, userid: user.id, agencyid: agency.id}, 'Uploading batch file locations');

  async.waterfall([
    function validateParams (next) {
        log.info(config, 'validateParams');
        // Ensure that the mapping is valid
        
        if (config.map.id === null || typeof config.map.id != 'string') {
          log.info('ID is not a string');
          next('ID is not a string');
        }

        if (config.map.latitude === null || typeof config.map.latitude != 'string') {
          log.info('latitude is not a string');
          next('latitude is not a string');
        }

        if (config.map.longitude === null || typeof config.map.longitude != 'string') {
          log.info('longitude is not a string');
          next('longitude is not a string');
        }

        if (config.map.description) {
          if (config.map.description === null || typeof config.map.description != 'string') {
            log.info('description is not a string');
            next('description is not a string');
          }
        }

        next(null);
      },
    function validateFileInfo (next) {
      log.info('validateFileExtension');
      if (!file.path) {
        log.info('Missing path is file object');
        next('Missing path in file object');
      } else if (!file.name) {
        log.info('Missing name is file object');
        next('Missing name in file object');
      }
      var fileExtension = path.extname(file.name).toLowerCase();

      if (VALID_EXTENSIONS.indexOf(fileExtension) === -1) {
        log.info({fileExtension: fileExtension, validExtensions: VALID_EXTENSIONS}, 'Invalid File Extension');
        next('Invalid file extension ' + fileExtension + '. Valid extensions include: ' + VALID_EXTENSIONS);
      }
      next(null, fileExtension);
    },

    function readFile (fileExtension, next) {
      log.info({filepath: file.path}, 'readFile');
      fs.readFile(file.path, 'utf8', function (err, data) {
        if (err) {next(err); }
        next(null, data, fileExtension);
      });
    },
    function parseFile (data, fileExtension, next) {
      log.info({data: data}, 'parseFile');
      if (fileExtension === '.csv') {
        csvParse(data, {columns: true}, function (err, parsedData) {
          if (err) {next(err); }
          next(null, parsedData);
        });
      }
      if (fileExtension === '.json') {
        try {
          var parsedData = JSON.parse(data);
          next(null, parsedData);
        } catch (err) {
          next(err);
        }
      }
    },
    function matchColumns (data, next) {
      log.info({data: data}, 'Matching Columns');

      data = _.map(data, function (item) {
        return {
          name: item[config.map.id],
          latitude: item[config.map.latitude],
          longitude: item[config.map.longitude],
          description: item[config.map.description],
          agency_id: agency.id
        };
      });

      if(data.length == 0){
        //Throw an error but dont stop upload so we can view the file
        next('No data provided');
      }

      next(null, data);
    },
    function saveFileAndLocations(data, next){
      log.info({data: data}, 'Save file and locations');
      db.sequelize.transaction().then(function (t) {
        async.waterfall(
          [
          function saveFile(next) {
            log.info('Save file');
            db.file.create({
              user_id: user.id,
              agency_id: agency.id,
              config: JSON.stringify(config),
              filename: file.name,
              filepath: file.path
            }, {
              logging: false,
              transaction: t
            }).then(function (file) {
              log.info({values: file.values}, 'Succeeded saving file');
              next(null, file);
            }).catch(function (err) {
              log.error('Error saving file').
              next(err);
            });
          },

          function saveLocations (file, next) {
            log.info({data: data}, 'Save Locations');
            db.location.bulkCreate(data, {logging: false, transaction: t})
              .then(function () {
                log.info('Successfully batch uploaded locations');

                db.location.findAll({
                  where: {agency_id: agency.id},
                  include: [db.agency]
                }, {
                  logging: false,
                  transaction: t
                }).then(function (locations) {
                  next(null, {message: 'Success!', data: locations});
                }, function (err) {next(err); });

              })
              .catch(function (err) {
                log.error('Server error saving locations');
                next(err);
              });

          }
        ], function (err, result) {
          if (err) {
            log.info('ERROR after map, rollback');
            t.rollback()
              .then(function () {
                log.info('rollback success');
                next(err);
              }).catch(function (err) {
                log.info('rollback error');
                next(err);
              });
          } else {
            t.commit().then(function (x) {
              log.info({info: x}, 'commit success');
              next(null, result);
            }).catch(function (err) {
              log.info('commit error');
              next(err);
            });
          }
        }
        );
      });
    }
  ], function (err, result) {
      if (err) {
        log.error(err);
        cb(err);
      } else {
        log.info({result: result}, 'Upload Successful, returning results');
        cb(null, result);
      }
    }
  );
}

exports.upload = upload;
