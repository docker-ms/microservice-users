'use strict';

module.exports = {
  jwt: require('jsonwebtoken'),
  bcrypt: require('bcrypt'),
  Promise: require('bluebird'),
  moment: require('moment'),
  shortid: require('shortid'),
  events: require('events'),

  protos: require('microservice-protos'),
  errors: require('microservice-errors'),
  utils: require('microservice-utils'),
  i18n: require('microservice-i18n')
};


