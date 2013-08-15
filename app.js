var express = require('express')
  , passport = require('passport')
  , util = require('util')
  , GoogleStrategy = require('passport-google').Strategy
  , fs = require('fs')
  , sys = require('sys')
  , exec = require('child_process').exec
  , ncp = require('ncp').ncp
;

// Limit the number of copy processes to 1
ncp.limit = 1;

var user = {};
// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Google profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the GoogleStrategy within Passport.
//   Strategies in passport require a `validate` function, which accept
//   credentials (in this case, an OpenID identifier and profile), and invoke a
//   callback with a user object.
passport.use(new GoogleStrategy({
    returnURL: 'http://localhost:3000/auth/google/return',
    realm: 'http://localhost:3000/'
  },
  function(identifier, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's Google profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the Google account with a user record in your database,
      // and return that user instead.
      profile.identifier = identifier;
      return done(null, profile);
    });
  }
));




var app = express.createServer();

// configure Express
app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.logger());
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({ secret: 'keyboard cat' }));
  // Initialize Passport!  Also use passport.session() middleware, to support
  // persistent login sessions (recommended).
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
  app.use(express.static(__dirname + '/../../public'));
});


app.get('/', ensureAuthenticated, function(req, res){
  if (req.isAuthenticated()) {
	if (!user.identifier) {
		user = req.user;
	}
  	getProxy();
	console.log(util.inspect(user));
  }
  res.render('index', { user: user });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: user });
});

app.get('/login', function(req, res){
  res.render('login', { user: user });
});

app.get('/shutdown', ensureAuthenticated, function(req,res) {
  if (user.child) {
	exitRefine();
  }
  res.redirect('/logout');
});

// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve redirecting
//   the user to google.com.  After authenticating, Google will redirect the
//   user back to this application at /auth/google/return
app.get('/auth/google', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

// GET /auth/google/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/google/return', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  if (user.child) {
	exitRefine();
  }
  req.logout();
  delete user;
  delete req;
  res.redirect('/');
});

app.listen(3000);


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { 
	return next(); 
  }
  res.redirect('/login')
}

function getProxy() {
	console.log("\n\n" + user.emails[0].value + "\n\n");
	var servers = loadServerData();
	if (!servers) {
		console.log("\n\nNO SERVERS LOADED\n\n");
		return false;
	}
	for (var i = 0; i<servers.length; i++) {
		proxy = servers[i];
		console.log("\n\nInspecting " + proxy.port + "\n\n");

		// Check to see if there is a server running
		//if (proxy.user == user.emails[0].value && proxy.child != "") {
		//	user.proxy_port = proxy.port;
		//	return user;
		//}

		// Find a port to run a server on
		if (proxy.user == "" || proxy.user == user.emails[0].value) {
			servers[i].user = user.emails[0].value;
			saveServerData(servers);
			user.proxy_port = proxy.port;
			
			// Find or create users directory

			fs.readdir('./users/' + user.emails[0].value, 
				function (err,list) {
					if (err) { 
						fs.readdir('./users/RefineReady/',
							function (err,list) {
								if (!err) {

									console.log('\n\nCan create ' + user.emails[0].value + ' directory\n\n');
									fs.renameSync('./users/RefineReady/','./users/' + user.emails[0].value);
									var child = launchRefine('./users/' + user.emails[0].value);
									user.child = child;
										
									makeNewRefineReady();
								} else {
									console.log('\n\nNo resource ready to copy from\n\n');
								}
							}
						);
					} else {
						var child = launchRefine('./users/' + user.emails[0].value, proxy.port);
						user.child = child;
					}
				}
			);
			return user;
		}
	}
	user.proxy_port = "0";
	return user;
}

function loadServerData() {
	var data = fs.readFileSync('./servers.json'), servers;
	try {
		servers = JSON.parse(data);
	} catch (err) {
		console.log('\n\nCould not read config file for servers\n\n');
		console.log(err.message);
		return false;
	}
	return servers;
}

function saveServerData(data) {
	data = JSON.stringify(data);
	fs.writeFile('./servers.json',data, function (err) {
		if (err) {
			console.log('\n\nCould not save config data\n\n');
			console.log(err.message);
			return;
		}
		console.log('\n\nConfig Saved\n\n');
	});
}

function makeNewRefineReady() {
	ncp('./users/OpenRefine/','./users/RefineTemp/', 
		function (err) {
			if (err) {
				console.log(err.message);
			} else {
				fs.renameSync('./users/RefineTemp','./users/RefineReady/');
			}
		}
	);
}
									
function launchRefine(path,port) {
	user.child = exec(path + "/refine -p " + port, 
		function (error, stdout, strerr) {
		}
	);
	return user.child;
}

function exitRefine() {	
	user.child.kill();
	exec("ps aux | grep refine.port=" + user.proxy_port + " | grep -v grep | awk '{split($0,a,\" \"); print a[2]}'", 
		function (error, stdout, strerr) {
			exec('kill -9 ' + stdout,
				function (error, stdout, strerr) {
				}
			);
		}
	);
	delete user.child;
}
