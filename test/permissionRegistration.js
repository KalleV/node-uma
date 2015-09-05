/**
 * Copyright 2015-present Atricore Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var express = require('express'),
  bodyParser = require('body-parser'),
  request = require('supertest'),
  should = require('should');

var umaserver = require('../');

var bootstrap = function (umaConfig) {
  if (umaConfig === 'mockValid') {
    umaConfig = {
      model: {
        getAccessToken: function (token, callback) {
          token.should.equal('thom');
          var expires = new Date();
          expires.setSeconds(expires.getSeconds() + 20);
          callback(false, {user: {id: '123'}, expires: expires});
        },
        getClient: function (clientId, clientSecret, callback) {
          callback(false, {
            clientId: 'thom',
            redirectUri: 'http://nightworld.com'
          });
        },
        getResourceSet: function (id, callback) {
          callback(false, {
            id: id, name: 'MyPicture', iconUri: '/mypicture.ico', type: 'photograph',
            scopes: 'read_family', uri: '/mypicture.png', owner: '123'
          })
        },
        saveResourceSet: function (id, name, iconUri, type, scopes, uri, owner, policies, callback) {
          callback(false);
        },
        savePermissionTicket: function (ticket, callback) {
          callback(false);
        }
      },
      restrictedAndReservedScopes: ['restricted_scope_1', 'restricted_scope_2']
    };
  }

  var app = express();
  app.uma = umaserver(umaConfig || {model: {}});

  app.use(bodyParser());
  app.all('/', app.uma.authorise());

  app.all('/', app.uma.permissionRegistration());

  app.use(app.uma.errorHandler());

  return app;
};

var validBody = {
  resource_set_id: 'resourceset_1',
  scopes: 'uma_authorization'
};

describe('PermissionRegistration', function () {

  it('should detect no access token', function (done) {
    var app = bootstrap('mockValid');

    request(app)
      .get('/')
      .expect(400, /the access token was not found/i, done);
  });

  it('should allow valid token in header', function (done) {
    var app = bootstrap('mockValid');

    request(app)
      .post('/')
      .set('Authorization', 'Bearer thom')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(validBody)
      .expect(201, done)
  });

  it('should detect missing required fields', function (done) {
    var app = bootstrap('mockValid');

    request(app)
      .get('/')
      .set('Authorization', 'Bearer thom')
      .expect(500, /Permission request was missing one or more required fields/i, done);
  });

  it('should return an UMA compatible response', function (done) {
    var app = bootstrap('mockValid');

    request(app)
      .post('/')
      .set('Authorization', 'Bearer thom')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .expect(201)
      .expect('Cache-Control', 'no-store')
      .expect('Pragma', 'no-cache')
      .send(validBody).end(function (err, res) {
        if (err) return done(err);
        res.body.should.have.keys(['ticket']);
        res.body.ticket.should.match(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i);
        done();
      });

  });

});