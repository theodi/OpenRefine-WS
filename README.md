OpenRefine WS
=============

Code to enable OpenRefine to run as an authenticated web service. 

This library uses nodejs to create a server that can allow unique instances of OpenRefine to be provided to users in a sustainable way. Due to the fact that it creates a directory per user on the server it is not advisable to publisise your service too widely however it can be very useful in a limited capacity. 

The default number of concurrent instances this application will start is 5, this can be changed by adding ports to the servers.json config file. 

License
-------

This code is open source under theMIT license. See the LICENSE.md file for full details.

Requirements
------------
Due to the unique way that refine spawns child processes, this version is Unix only sorry!

* nodejs > 0.8.0
* npm > 1.3 
* OpenRefine (plus dependancies, e.g. java-jdk)

Installation
------------
1. Copy servers.json.template to servers.json and add/remove ports where you want to make refine available to users.
2. Install OpenRefine into a directory called OpenRefine at the top level of the code base
4. run "npm install" on the top level directory
5. run "nodejs app.js"

TODO
----
* Fix code to use data directories created in ./user
* Add firewall control code to restrict access to single user
* Added 1 hour timeout for servers 
* Add interface to update time with 5 minutes left
* Brand
