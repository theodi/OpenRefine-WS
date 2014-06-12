var express = require('express')
  , passport = require('passport')
  , util = require('util')
  , OAuth2Strategy = require('passport-google-oauth').OAuth2Strategy
  , fs = require('fs')
  , sys = require('sys')
  , exec = require('child_process').exec
  , os = require('os')
  , http = require('http')
  , dns = require('dns')
;

var config = require('./config');
if (!config.ip) {
	var ifaces=os.networkInterfaces();
	for (var dev in ifaces) {
  		var alias=0;
		ifaces[dev].forEach(function(details){
		  if (details.family=='IPv4') {
			if (details.address != "127.0.0.1" && !config.ip) {
      				config.ip=details.address;	
			}
    		  }
  		});
	}
}

if (!config.host) {
	var options = {
	    host: 'odinprac.theodi.org',
	    path: '/getIP.php'
	}
	var request = http.request(options, function (res) {
	    var data = '';
	    res.on('data', function (chunk) {
        	data += chunk;
	    });
	    res.on('end', function () {
		dns.reverse(data,function(err,domains) {
			if (!err) {
				domains.forEach(function(a) {
					config.host=a;
					console.log(config.host);
				});
			}
		});
	    });
	});
	request.on('error', function (e) {
	    console.log(e.message);
	});
	request.end();
}

// Limit the number of copy processes to 1

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
passport.use(new OAuth2Strategy({
    authorizationURL: 'https://accounts.google.com/o/oauth2/auth',
    tokenURL: 'https://accounts.google.com/o/oauth2/token',
    clientID: config.googleAuth.clientID,
    clientSecret: config.googleAuth.clientSecret,
    callbackURL: "/auth/google/return"
  },
  function(accessToken, refreshToken, profile, done) {
//    User.findOrCreate({ exampleId: profile.id }, function (err, user) {
      process.nextTick(function() {
	      profile.identifier = accessToken;
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
  req.user.ip = req.connection.remoteAddress;
  req.user = getProxy(req.user);
  if (req.user.expire) {
	  var ts = Math.round((new Date()).getTime() / 1000); 
	  var remaining = req.user.expire - ts;
	  req.user.remaining = remaining;
	  console.log(req.user.expire + " EX " + remaining + "\n\n");
	  if (remaining < 0) {
		exitRefine(req.user);
  		res.redirect('/logout');
  	  } else {
  		res.render('index', { user: req.user, page: "Home" });
	  }
  } else {
	  res.render('index', { user: req.user, page: "Home" });
  }
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user, page: "Account" });
});

app.get('/home', function(req, res){
  res.render('home', { user: req.user, page: "Home" });
});

app.get('/shutdown', ensureAuthenticated, function(req,res) {
  req.user = exitRefine(req.user);
  res.redirect('/logout');
});

app.get('/extend_time', ensureAuthenticated, function(req,res) {
  if (req.user.expire) {
	  var ts = Math.round((new Date()).getTime() / 1000); 
	  var remaining = req.user.expire - ts;
	  if (remaining < 600) {
		req.user = updateExpireTime(req.user);
	  }
  }
  res.redirect('/');
});

app.get('/img/logo.png', function(req,res) {
	var img = fs.readFileSync('./img/logo.png');
	res.writeHead(200, {'Content-Type': 'image/png' });
	res.end(img, 'binary');
});

app.get('/img/logo_cc_80x15.png', function(req,res) {
	var img = fs.readFileSync('./img/logo_cc_80x15.png');
	res.writeHead(200, {'Content-Type': 'image/png' });
	res.end(img, 'binary');
});

app.get('/js/countdown.js', function(req,res) {
	var js = fs.readFileSync('./js/countdown.js');
	res.writeHead(200, {'Content-Type': 'text/javascript' });
	res.end(js, 'binary');
});

// GET /auth/google
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Google authentication will involve redirecting
//   the user to google.com.  After authenticating, Google will redirect the
//   user back to this application at /auth/google/return
app.get('/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'], failureRedirect: '/home' }),
  function(req, res) {
    res.redirect('/');
  });

// GET /auth/google/return
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/google/return', 
  passport.authenticate('google', { scope: ['profile', 'email'], failureRedirect: '/home' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.user = exitRefine(req.user);
  req.logout();
  delete req;
  res.redirect('/home');
});

app.listen(80);
console.log('App running on port 80');

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
	return next(); 
  }
  res.redirect('/home')
}

function getProxy(user) {
//	console.log("\n\n" + user.emails[0].value + "\n\n");
	var servers = loadServerData();
	if (!servers) {
		console.log("\n\nNO SERVERS LOADED\n\n");
		return false;
	}
	for (var i = 0; i<servers.length; i++) {
		proxy = servers[i];
//		console.log("\n\nInspecting " + proxy.port + "\n\n");

		// Find a port to run a server on
		if (proxy.user == "" || proxy.user == user.emails[0].value) {
			servers[i].user = user.emails[0].value;
			servers[i].ip = user.ip;

			// Set the timeout 1 hour from now:
			if (servers[i].expire == "" || !servers[i].expire) {
				var expire = Math.round((new Date()).getTime() / 1000) + 3600;
				servers[i].expire = expire;
			}
			if (!user.itterator) {
				setInterval(function(){ checkExpire(user) }, 10000);
				user.itterator = true;
			}

			saveServerData(servers);
			user.proxy_port = proxy.port;
			user.host = config.host;
			user.expire = servers[i].expire;
			
			// Find or create users data directory

			fs.readdir('./users/' + user.emails[0].value, 
				function (err,list) {
					if (err) {
						fs.mkdirSync('./users/' + user.emails[0].value);
					} 
					// Run Refine
					var child = launchRefine(user);
					user.child = child;
				}
			);
			return user;
		}
	}
	user.proxy_port = "0";
	return user;
}

function releaseProxyPort(port) {
	var servers = loadServerData();
	if (!servers) {
		console.log("\n\nNO SERVERS LOADED\n\n");
		return false;
	}
	for (var i = 0; i<servers.length; i++) {
		proxy = servers[i];

		// Find a port to run a server on
		if (proxy.port == port) {
			servers[i].user = "";
			servers[i].ip = "";
			servers[i].expire = "";
			saveServerData(servers);
		}
	}
}

function updateExpireTime(user) {
	var servers = loadServerData();
	if (!servers) {
		console.log("\n\nNO SERVERS LOADED\n\n");
		return false;
	}
	for (var i = 0; i<servers.length; i++) {
		proxy = servers[i];
		
		if (proxy.user == user.emails[0].value) {
			var expire = Math.round((new Date()).getTime() / 1000) + 3600;
			servers[i].expire = expire;
			user.expire = servers[i].expire;
			saveServerData(servers);
		}
	}
	return user;
}

function checkExpire(user) {
	var servers = loadServerData();
	if (!servers) {
		console.log("\n\nNO SERVERS LOADED\n\n");
		return false;
	}
	for (var i = 0; i<servers.length; i++) {
		proxy = servers[i];
		
		if (proxy.user == user.emails[0].value) {
			user.expire = servers[i].expire;
			var ts = Math.round((new Date()).getTime() / 1000); 
			var remaining = user.expire - ts;
			if (remaining < 0) {
//				console.log("\n\nShutting down server!\n\n");
				exitRefine(user);
			}
		}
	}
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
//		console.log('\n\nConfig Saved\n\n');
	});
}

function launchRefine(user) {
	path = process.cwd() + '/users/' + user.emails[0].value;
	port = user.proxy_port;
//	console.log("\n\nLauching Refine with data " + path + " on port " + port + "\n\n");
	user.child = exec("./OpenRefine/refine -d " + path + " -i " + config.ip + " -p " + port, 
		function (error, stdout, strerr) {
		}
	);
	return user.child;
}

function exitRefine(user) {	
//	console.log("\n\nShutting down server!\n\n");
	exec("ps aux | grep refine.port=" + user.proxy_port + " | grep -v grep | awk '{split($0,a,\" \"); print a[2]}'", 
		function (error, stdout, strerr) {
			exec('kill -15 ' + stdout,
				function (error, stdout, strerr) {
				}
			);
		}
	);
	releaseProxyPort(user.proxy_port);
	delete user.child;
	delete user.proxy_port;
	return user;
}

//Countdown images


app.get('/images/flipper00.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper00.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper01.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper01.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper02.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper02.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper10.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper10.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper11.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper11.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper12.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper12.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper20.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper20.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper21.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper21.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper22.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper22.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper30.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper30.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper31.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper31.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper32.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper32.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper40.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper40.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper41.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper41.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper42.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper42.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper50.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper50.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper51.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper51.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper52.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper52.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper60.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper60.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper61.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper61.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper62.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper62.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper70.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper70.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper71.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper71.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper72.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper72.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper80.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper80.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper81.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper81.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper82.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper82.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper90.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper90.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper91.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper91.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
app.get('/images/flipper92.png', function(req,res) { var img = fs.readFileSync('./img/countdown/flipper92.png'); res.writeHead(200, {'Content-Type': 'image/png' }); res.end(img, 'binary');});
