OpenRefine WS
=============

Code to enable OpenRefine to run as an authenticated web service. 

This library uses nodejs to create a server that can allow unique instances of OpenRefine to be provided to users in a sustainable way. Due to the fact that it creates a directory per user on the server it is not advisable to publisise your service too widely however it can be very useful in a limited capacity. 

The default number of concurrent instances this application will start is 5, this can be changed by adding ports to the servers.json config file. 

In order to only allow connections to refine from a single user, we add rules to the system firewall, currently this is only compabible with systems running ufw (ubuntu firewall)

To maintain service, servers are automatically terminated after 1 hour of use. To extend this the user can click a button in their interface with 10 minutes to go. 

License
-------

This code is open source under the MIT license. See the LICENSE.md file for full details.

Acknowledgements
----------------

Many thanks to Jared Hanson for the excellently simple OAuth example (available at https://github.com/jaredhanson/passport-google) on which this library is based. 

Requirements
------------

* Ubuntu > 10.04
* nodejs > 0.8.0
* npm > 1.3 
* OpenRefine (plus dependancies, e.g. java-jdk)
* ufw > 0.0.0 (must be enabled)


Installation
------------
1. Copy servers.json.template to servers.json and add/remove ports where you want to make refine available to users.
2. Install OpenRefine into a directory called OpenRefine at the top level of the code base
3. Create a users directory at the top level of the code base
4. Create an API access key for your application at Google code for OAuth authorisation (https://code.google.com/apis/console). The return url is /auth/google/return
5. Copy config.js.template to config.js and add your own config
6. Enable ubuntu firewall and don't lock yourself out. (sudo ufw enable && sudo ufw allow 22)
7. run "npm install" on the top level directory
8. run "nodejs app.js" (as root (port 80))
9. run "nodejs firewall-control.js" (as root)


TODO
----
*u All bugs now tracked in GitHub at http://github.com/theodi/OpenRefine-WS
