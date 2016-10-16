(function() {
  
   //var express = require(express);
   //var app = express();

  angular
    .module('meanApp')
    .controller('profileCtrl', profileCtrl);

  profileCtrl.$inject = ['$location', 'meanData', 'authentication'];
  function profileCtrl($location, meanData, authentication) {
    console.log("profileCtrl called")
    var vm = this;

    vm.user = {};

    meanData.getProfile()
      .success(function(data) {
        vm.user = data;
      })
      .error(function (e) {
        console.log(e);
      });
      
    vm.onLogout = function () {
      console.log('Logging out');
      authentication
        .logout()
        .error(function(err){
          alert(err);
        })
        .then(function(){
          $location.path('/');
        });
    };
    
    vm.onJoin = function () {
      console.log("Joining lobby")
      $location.path('/lobby');
    };
  
}

})();