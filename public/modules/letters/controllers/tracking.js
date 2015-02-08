'use strict';

angular.module('letters').controller('AgencyController', 
	['$scope', '$stateParams', '$location', '$filter' ,'$timeout', 'Authentication', 'Articles', 'Agencies', 'Users',
	function($scope, $stateParams, $location, $filter, $timeout, Authentication, Articles, Agencies, Users) {
		$scope.user = Authentication.user;

		if (!$scope.user) $location.path('/');

		$scope.adminView = $scope.user.username === 'AAA' ? true : false;
		$scope.minAge = null;
		$scope.maxAge = null; 
		$scope.recipients = null;
		$scope.tabs = [];
		var Recipients = null;
		var blankRecords = null;
		var currentIndex = 0;

		//Helps initialize page by finding the appropriate letters
		$scope.find = function() {
			$scope.letters = Articles.query(function() {
				if($scope.adminView) {
					$scope.currentAgency = Agencies.get({agencyId: $stateParams.articleId}, function() {
						init();
					});
				}
				else {
					$scope.currentAgency = $scope.user;
					Agencies.query(function(users) {
						var admin = $filter('filter')(users, {username: 'AAA'});
						var due = $filter('date')(admin[0].due, 'MM/dd/yy');

						if($scope.currentAgency.status < 3) {
							var countdown = dateDiff(new Date(), new Date(admin[0].due));
							if(countdown === 14) {
								$scope.alert = {active: true, type: 'warning', msg: 'Two weeks left'};
							}
							else if(countdown === 7) {
								$scope.alert = {active: true, type: 'warning', msg: 'One week left'};
							}
							else if(countdown === 0) {
								$scope.alert = {active: true, type: 'danger', msg: 'Last day to submit'};
							}
							else if(countdown === 1) {
								$scope.alert = {active: true, type: 'danger', msg: 'One day left'};
							}
							else if(countdown < 0) {
								$scope.alert = {active: true, type: 'danger', msg: 'Past due -- please submit it ASAP'};
							}
							else if(countdown <= 3) {
								$scope.alert = {active: true, type: 'danger', msg: countdown + ' days left'};
							}
						}
						init();
					});
				}
			});
		};

		function init() {
			Recipients = $filter('filter')($scope.letters, {track: $scope.currentAgency.username});
			var myChildren = $filter('filter')(Recipients, {track: $scope.currentAgency.username + 'C'});
			var myTeens = $filter('filter')(Recipients, {track: $scope.currentAgency.username + 'T'});
			var mySeniors = $filter('filter')(Recipients, {track: $scope.currentAgency.username + 'S'});

			$scope.tabs = [
				{ title:'Children', content: myChildren, active: false },
				{ title:'Teens', content: myTeens, active: false },
				{ title:'Seniors', content: mySeniors, active: false }
			];

			$scope.activateTab(myChildren.length > 0 ? $scope.tabs[0] : (myTeens.length > 0 ? $scope.tabs[1] : $scope.tabs[2]));

			if((!$scope.adminView && $scope.currentAgency.status >= 3) || ($scope.adminView && $scope.currentAgency.status === 5)) downloadCSV();
		}
		
		//Allows user to work on another tab
		$scope.activateTab = function(clicked) {
			clicked.active = true;
			$scope.recipients = clicked.content;
			blankRecords = $filter('filter')($scope.recipients, function(rec) { return !rec.name; });
			currentIndex = blankRecords.length > 0 ? $scope.recipients.indexOf(blankRecords[0]) : 0;
			updateForm();
		};

		//Helps find how many days are left until the deadline
		function dateDiff(a, b) {
			var MS_PER_DAY = 1000 * 60 * 60 * 24;
			// Discard the time and time-zone information.
			var utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
			var utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
			return Math.floor((utc2 - utc1) / MS_PER_DAY);
		}

		//Allows user to clear the current slot
		$scope.clearForm = function(form) {
			$scope.current.name = '';
			$scope.current.age = '';
			$scope.current.gender = '';
			$scope.current.gift = '';
		};

		//Helps to show user appropriate age range of each recipient type
		function updateForm() {
			$scope.current = $scope.recipients[currentIndex];
			if($scope.current.track.match(/^...C/)) {
				$scope.minAge = 4;
				$scope.maxAge = 13;
			}
			else if($scope.current.track.match(/^...T/)) {
				$scope.minAge = 14;
				$scope.maxAge = 18;
			}
			else if($scope.current.track.match(/^...S/)) {
				$scope.minAge = 65;
				$scope.maxAge = 125;
			}
		}

		//Allow user to see/edit the next record if current letter is valid
		$scope.goToNext = function(form) {
			if(isValidLetter(form)) {
				if(currentIndex < $scope.recipients.length - 1) {
					currentIndex++;
					updateForm();
				}
				else {
					$scope.alert = {
						active: true,
						  type: 'info',
						   msg: 'You just entered the last letter on this page.'
					};
				}
			}
		};

		//Allow user to see the record they selected if current letter is valid
		$scope.goToSelected = function(selected, form) {
			if(isValidLetter(form)) {
				currentIndex = $scope.recipients.indexOf(selected);
				updateForm();
			}
		};

		//Make form more user-friendly, make required fields glow
		$scope.isUsed = function(form) {
			if($scope.current.name.length > 0) {
				$scope.blankName = false;
				form.age.$setTouched();
				form.gender.$setTouched();
				form.gift.$setTouched();
			}
			else {
				form.$setUntouched();
			}
		};

		//Check if age entered is within valid range
		$scope.isWithinRange = function(age) {
			age.$setValidity('inRange', $scope.current.age === null || ($scope.current.age >= $scope.minAge && $scope.current.age <= $scope.maxAge));
		};

		//Help validate user's data entry
		function isValidLetter(form) {
			//It's OK if no data was entered
			if(!$scope.current.name && !$scope.current.age && !$scope.current.gender && !$scope.current.gift) {
				return true;
			}
			//It's not OK if some fields are missing
			else if(!$scope.current.name || !$scope.current.age || !$scope.current.gender || !$scope.current.gift) {
				$scope.blankName = !$scope.current.name ? true : false;
				$scope.error = 'fields cannot be left blank';
				$timeout(function() {
					$scope.blankName = false;
					$scope.error = null;
				}, 2000);
				return false;
			}
			//It's great when all fields are entered properly
			else {
				addRecipient(form);
				return true;
			}
		}

		//Helps update/add recipient record
		function addRecipient(form) {
			$scope.current.name = cleanText($scope.current.name, 1).trim();
			$scope.current.gender = $scope.current.gender.toUpperCase();
			$scope.current.gift = cleanText($scope.current.gift, 2);

			//update Agency status
			if($scope.currentAgency.status === 0) {
				$scope.currentAgency.status = 1;
				var user = new Users($scope.currentAgency);
				user.$update(function(response) {
					$scope.currentAgency = response;
				});
			}

			$scope.current.$update();

			form.$setUntouched();
		}

		//Helps clean up sloppy user input
		function cleanText(text, priority) {
			if((text === text.toLowerCase() || text === text.toUpperCase()) && priority === 1) {
				return text.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
			}
			else if(text === text.toUpperCase()) {
				return text.toLowerCase();
			}
			else {
				return text;
			}
		}

		//Allows admin to complete the review of a tracking form
		//Allows community partner to submit their completed tracking form
		$scope.confirmCompletion = function () {
			var dblcheck = null;
			var user = null;
			if($scope.adminView) {
				dblcheck = confirm('Click OK to confirm that you have reviewed this tracking form.');
				if(dblcheck) {
					$scope.currentAgency.status = 5;
					user = new Agencies($scope.currentAgency);
					user.$update(function(response) {
						$scope.currentAgency = response;
						downloadCSV();
					}, function(response) {
						$scope.error = response.data.message;
					});
				}
			}
			else {
				dblcheck = confirm('Click OK to let the Winter Wishes Team know that your tracking form is ready. You will not be able to make any further changes.');
				if(dblcheck) {
					$scope.currentAgency.status = 3;
					user = new Users($scope.currentAgency);
					user.$update(function(response) {
						$scope.currentAgency = response;
						downloadCSV();
					}, function(response) {
						$scope.error = response.data.message;
					});
				}
			}
		};

		//Allows admin to start the review of a tracking form
		$scope.startReview = function() {
			$scope.currentAgency.status = 4;
			var user = new Agencies($scope.currentAgency);
			user.$update(function(response) {
				$scope.currentAgency = response;
			}, function(response) {
				$scope.error = response.data.message;
			});
		};

		//Allows admin to flag sub par letters during review
		$scope.flagLetter = function(selected) {
			selected.flagged = !selected.flagged;
			selected.$update();
		};

		//Allows admin to reject a tracking form with many sub par letters
		$scope.returnLetters = function() {
			$scope.currentAgency.status = 1;
			var user = new Agencies($scope.currentAgency);
			user.$update(function(response) {
				$scope.currentAgency = response;
			}, function(response) {
				$scope.error = response.data.message;
			});
		};

		//Helps create a downloadable csv version of the tracking form
		function downloadCSV() {
			var headers = ['track', 'name', 'age', 'gender', 'gift'];
			if($scope.adminView) {headers.push('flagged');}
			var csvString= headers.join(',') + '\r\n';
			for (var i=0; i < Recipients.length; i++) {
				if(Recipients[i].name) {
					for(var key in headers) {
						var line = Recipients[i][headers[key]];
						if(key === 4) {
							if(Recipients[i][headers[key]].indexOf(',') !== -1) {
								line = '"' + Recipients[i][headers[key]] + '"';
							}
						}
						csvString += line + ',';
					}
					csvString += '\r\n';
				}
			}

			var date = $filter('date')(new Date(), 'MM-dd');
			$scope.fileName = ( 'WishesToSF_' + date + '.csv' );
			var blob = new Blob([csvString], { type: 'text/csv;charset=UTF-8' }); 
			$scope.url = window.URL.createObjectURL( blob );
		}

		//Allows partner to let WWT know whether a gift has been received
		$scope.giftReceived = function(selected) {
			selected.received = !selected.received;
			selected.$update();
		};

}]);