/**
  Multi Support Shopping Cart Service
  Stores a cart separated by keys for the storing of multple forms of data
  Adds items by unioning the sets
  Removes items by mutating the array
*/

angular.module('sheds.cart')
  .service('cartService', function ($rootScope, toastr) {

    var cart = {};

    function updateCartTotal () {
      var amt = 0;
      var keys = Object.keys(cart);
      keys.forEach(function (k) {
        amt += cart[k].length;
      });

      $rootScope.cartTotal = amt;
    }

    this.addToCart = function (data, key) {
      if (cart[key] === undefined) {
        cart[key] = [];
      }

      cart[key] = _.union(cart[key], data);

      toastr.info('Added ' + ' ' + key + ' to cart.');
      updateCartTotal();
    };

    //Gets data by key from cart
    this.getFromCart = function (key) {
      return cart[key] ? cart[key] : [];
    };

    this.removeFromCart = function (key, variable, value) {
      _.remove(cart[key], function (d) {
        return d[variable] == value;
      });
      updateCartTotal();
    };

    this.emptyCart = function () {
      var keys = Object.keys(cart);
      keys.forEach(function (k) {
        _.remove(cart[k], function (d) {
          return true;
        });
      });
      updateCartTotal();
    };

    this.getDataToDownload = function (key, variable) {
      return _.pluck(cart[key], variable);
    };
  });
