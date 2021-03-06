import express from 'express';

const routes = express.Router();

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var session = require('express-session');

import models from "../models";

// //*********************** API CODE DO NOT TOUCH UNLESS YOU ARE JACK OR ALEX *****************************//

// ******************* TRAIL **********************
routes.get('/trail', (req, res) => {
    models.Trail.all().then(function(trails) {
        res.json(trails);
    })
});

routes.post('/trail', (req, res) => {
    var data = req.body;
    var listOfTags = req.body.tags;
    models.Trail.create({name: data.name,
        description: data.description, date_created: new Date(),
        forked_from: data.forked_from, num_views: 0}).then(function(result){
            if(!(req.user)){
                res.status(401).send('Unauthorized');
            }
            req.user.addTrail(result);
            for(var tagName in listOfTags) {
                models.Tag.findOrCreate({where: {name: tagName}}).then(function(tag) {
                    models.Trail.find(result.id).then(function(trail){
                        trail.addTag(tag);
                    })
                });
            }
            res.json(result);
        });
});

routes.get('/trail/:id([0-9]+)', function(req, res){
    var trailId = req.params.id;
    models.Trail.find({ where: {id: trailId}, include: [{ all: true }]}).then(function(trail) {
        if (trail != null) {
            res.json(trail);
        } else {
            res.status(404).send('Sorry, we cannot find that!');
        }
    });
});

routes.post('/trail/:id([0-9]+)', function(req, res){
    var action = req.query.action;
    var trailId = req.params.id;
    if (action == 'fork') {
        if(!(req.user)){
            res.status(401).send('Unauthorized');
        }
        models.Trail.find(trailId).then(function(trail) {
            models.Trail.create({name: trail.name,
                description: trail.description, date_created: new Date(),
                forked_from: trail.getUsers()[0], num_views: 0
            }).then(function(result) {
                req.user.addTrail(result);
                trail.getResources().then(function(resources) {
                    resources.forEach(element => {
                        result.addResource(element);
                    });
                    res.json(result);
                });
            });
        });
    } else {
        res.status(400).send('Sorry, we cannot accept that action');
    }
});

routes.put('/trail/:id([0-9]+)', (req, res) =>{
    if(!(req.user)){
        res.status(401).send('Unauthorized');
    }

    var trailId = req.params.id;
    var data = req.body;
    var newListOfTags = req.body.newTags;
    var listOfDeletedTags = req.body.deletedTags;
    models.Trail.find(trailId).then(function(trail) {s
        if (trail) {
            trail.updateAttributes({
                name: data.name, description: data.description,
                    date_created: data.date_created, forked_from: data.forked_from,
                    num_views: data.num_views
                }).then(function() {
                    for(var tagName in newListOfTags) {
                        models.Tag.findOrCreate({where: {name: tagName}}).then(function(tag) {
                            trail.addTag(tag);
                        });
                    }
                    for(var tagName in listOfDeletedTags) {
                        models.Tag.findOrCreate({where: {name: tagName}}).then(function(tag) {
                            trail.removeTag(tag);
                        });
                    }
                res.send("Success!");
            });
        }
    });
});

routes.delete('/trail/:id([0-9]+)', (req, res) => {
    if(!(req.user)){
        res.status(401).send('Unauthorized');
    }

    var trailId = req.params.id;
    models.Trail.find(trailId).on('success', function(trail){
        trail.removeResource();
        trail.destroy().on('success', function(a) {
            if (a && a.deletedAt){
                res.send("SUCCESS!");
            }
        });
    });
});

// *********************** USER *******************************

routes.get('/user', function(req, res) {
    models.User.all().then(function(users) {
        res.json(users);
    })
});

routes.get('/user/:id([0-9]+)', function(req, res) {
    var userId = req.params.id;
    models.User.find({ where: {id: userId}, include: [{ all: true }]}).then(function(user) {
        if (user != null) {
            res.json(user);
        } else {
            res.status(404).send('Sorry, we cannot find that!');
        }
    });
});

routes.put('/user/:id([0-9]+)', function(req, res) {
    if(!(req.user)){
        res.status(401).send('Unauthorized');
    }

    var userId = req.params.id;
    var data = req.body;

    models.User.find(userId).then(function(user) {
        if (user) {
            user.updateAttributes({
                name: data.name, first_name: data.first_name,
                    last_name: data.last_name, email: data.email,
                    url: data.url, description: data.description, dob: data.dob,
                    education: data.education, field: data.field, gender: data.gender
            }).then(function() {
                res.send("Success!")
            })
        }
    });
});

routes.delete('/user/:id([0-9]+)', function(req, res) {
    if(!(req.user)){
        res.status(401).send('Unauthorized');
    }

    var userId = req.params.id;
    res.send(userId);
    models.User.find(userId).then(function(user) {
        user.getTrails().then(function(listOfTrails) {
            for (let trail in listOfTrails) {
                trail.removeResources(); //remove all Resources - check API
                trail.destroy();
            }
            user.destroy().then(function(action){
                res.send("Deleted!");
            });
        });

    });
});

// ************************ Resources & Steps *********************

routes.get('/resource', function(req, res) {
    models.Resource.all().then(function(resources) {
        res.json(resources);
    })
});

routes.post('/resource', function(req, res) {
    var data = req.body;
    var trailId = req.body.trailId;
    var annotations = req.body.annotations;
    if(!(req.user)){
        res.status(401).send('Unauthorized');
    }

    models.Resource.findOrCreate({ where: { data: data.data, type: data.type } })
        .then(function(resource){
            models.Trail.find(trailId).then(function(trail) {
                trail.getResources().then(function(resources) {
                    resource[0].order = resources.length + 1;
                    resource[0].annotations = annotations;
                    trail.addResource(resource[0]);
                    res.json(resource[0]);
                })
            });
        }
    );
});

routes.put('/step/:trailId([0-9]+)', function(req, res) {
    var trailId = req.params.trailId;
    var resources = req.body.resources; // array of lists
    if(!(req.user)){
        res.status(401).send('Unauthorized');
    }

    for (var i = 0; i < resources.length; i++) {
        resources[i].order = i;
    }
    models.Trail.find(trailId).then(function(trail) {
        trail.setResources(resources, {order: 0, annotations: ''}).then(function(el) {
            res.json(trail);
        });
    });
});

routes.delete('/step/:trailId([0-9]+)/:order([0-9]+)', function(req, res) {
    models.Step.find({where: { order: order, trailId: trailId}}).then(function(step) {
        step.remove()
    });
    //TODO: unlink with resource and trail, decrement/increment other steps in that trail, destroy
});

// *************************** Tags *******************************

routes.get('/tag', (req, res) => {
    var name = req.query.name;
    var arrayOfTags = req.split('+');
    var arrayOfTrails = [];
    arrayOfTags.forEach(function(element, index, array) {
        models.Tag.find({ where: { name: element }, include: [ Trail ], order: [ [ Trail, 'id' ] ] }).then(function(tag) {
            var listOfTrails = tag.getTrails();
            var arrayOfTrailIds = arrayOfTrails.map(function(trail) { return trail.id });
            for (let trail in listOfTrails) {
                if (arrayOfTrailIds.indexOf(trail.id) != -1) {
                    arrayOfTrails.push(trail);
                }
            }
        });
    });
    arrayOfTrails.sort(function(a, b) {
        a.getLikes().length - b.getLikes().length;
    });
    return arrayOfTrails;
});

// **************************** Login *******************************

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  models.User.find(id).then(function (user) {
    done(null, user);
  });
});

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  },
  function(username, password, done) {
    models.User.find({ where: {email: username} }).then(function(user) {
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!(user.password == password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
}));

routes.get('/isLoggedIn', (req, res) => {
    res.json({isLoggedIn: req.user != null});
});

routes.post('/login',
    passport.authenticate('local'), //returns 401 if fails
    (req, res) => {
        models.User.find(req.user.id).then(function(user) {
            if (user) {
                user.updateAttributes({
                    last_login: new Date()
                });
                res.json(req.user);
            }
        });
    }
);

routes.get('/logout', (req, res) => {
    req.logout();
    res.status(200).send("Success!");
});

routes.post('/signup', (req, res) => {
    var email = req.body.email;
    var password = req.body.password;
    models.User.create({email: email, password: password}).then(function(result) {
        var userId = result.dataValues.id;
        models.User.find(userId).then(function(user) {
            req.login(user, function() {
                res.json(req.user);
            })
        })
    });
});

export default routes;
