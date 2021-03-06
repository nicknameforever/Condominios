/**
*	CoTag Condo
*	Direct to cloud resumable uploads
*	
*   Copyright (c) 2012 CoTag Media.
*	
*	@author 	Stephen von Takach <steve@cotag.me>
* 	@copyright  2012 cotag.me
* 
* 	
* 	References:
*		* http://ericterpstra.com/2012/09/angular-cats-part-3-communicating-with-broadcast/
*		* http://docs.angularjs.org/api/ng.$rootScope.Scope#$watch
*
**/


(function ($, undefined) {
	'use strict';
	
	//
	// Create a controller for managing the upload states
	//
	angular.module('Condo', ['CondoBroadcaster', 'CondoUploader', 'CondoConfig']).
		controller('Condo.Controller', ['$scope', 'Condo.Api', 'Condo.Broadcast', 'Condo.Config', function($scope, api, broadcaster, config) {
		
			$scope.uploads = [];
			$scope.upload_count = 0;
			
			
			//
			// See Condo.Config for configuration options
			//
			$scope.endpoint = config.endpoint;
			$scope.autostart = config.autostart;
			$scope.ignore_errors = config.ignore_errors;			// Continue to autostart after an error?
			$scope.parallelism = config.parallelism;				// number of uploads at once
			
			
			$scope.add = function(files) {
				var length = files.length,
					i = 0,
					ret = 0,		// We only want to check for auto-start after the files have been added
					file;
				
				for (; i < length; i += 1) {
					file = files[i];
					
					if(file.size <= 0 || file.type == '')
						continue;
						
					//
					// check file size is acceptable
					//
					if(!config.file_checker(file) || (config.size_limit != undefined && file.size > config.size_limit)) {
						broadcaster.broadcast('coNotice', {
							type: 'warn',
							number: 0,
							file: file
						});
						continue;
					}
					
					$scope.upload_count += 1;
					
					var upl = api.check_provider($scope.endpoint, files[i]);
					ret += 1;
					$scope.uploads.push(upl);
					if(ret == length)
						$scope.check_autostart();
				}
			};
			
			
			$scope.abort = function(upload) {
				upload.abort();
				$scope.check_autostart();
			};
			
			
			$scope.remove = function(upload) {
				//
				// Splice(upload, 1) was unreliable. This is better
				//
				for (var i = 0, length = $scope.uploads.length; i < length; i += 1) {
					if($scope.uploads[i] === upload) {
						$scope.uploads.splice(i, 1);
						$scope.upload_count -= 1;
						break;
					}
				}
			};
			
			
			$scope.playpause = function(upload) {
				if (upload.state == 3)					// Uploading
					upload.pause();
				else
					upload.start();
			};
			
			
			//
			// Watch autostart and trigger a check when it is changed
			//
			$scope.$watch('autostart', function(newValue, oldValue) {
				if (newValue === true)
					$scope.check_autostart();
			});
			
			
			//
			// Autostart more uploads as this is bumped up
			//
			$scope.$watch('parallelism', function(newValue, oldValue) {
				if(newValue > oldValue)
					$scope.check_autostart();
			});
			
			
			$scope.check_autostart = function() {
				//
				// Check if any uploads have been started already
				//	If there are no active uploads we'll auto-start
				//
				// PENDING = 0,
				// STARTED = 1,
				// PAUSED = 2,
				// UPLOADING = 3,
				// COMPLETED = 4,
				// ABORTED = 5
				//

				if ($scope.autostart) {
					var shouldStart = true,
						state, i, length, started = 0;
						
					for (i = 0, length = $scope.uploads.length; i < length; i += 1) {
						state = $scope.uploads[i].state;
						
						//
						// Count started uploads (that don't have errors if we are ignoring errors)
						//	Up until we've reached our parallel limit, then stop
						//
						if (state > 0 && state < 4 && !($scope.uploads[i].error && $scope.ignore_errors)) {
							started += 1;
							if(started >= $scope.parallelism) {
								shouldStart = false;
								break;
							}
						}
					}
					
					if (shouldStart) {
						started = $scope.parallelism - started;		// How many can we start
						
						for (i = 0; i < length; i += 1) {
							if ($scope.uploads[i].state == 0) {
								$scope.uploads[i].start();
								
								started -= 1;
								if(started <= 0)	// Break if we can't start anymore
									break;
							}
						}
					}
				}
			};
			
		}]);
	
})(jQuery);