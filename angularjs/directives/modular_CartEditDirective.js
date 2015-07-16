/**
  Ui Grid Modularity
  Uses Ui-Grid library to create a table for values. Allows for filtering, searching, selecting.
  Accepts 'keys' from a shopping cart service.
  Accepts 'columns' for various columns for data columns
  Can support 'modes' which are the last column(s) for functions.
*/

angular.module('sheds.cart')
  .directive('cartEdit', ['cartService', function (cartService) {
    return {
      resrict: 'E',
      replace: true,
      templateUrl: 'cart/templates/cart-edit.html',
      scope: {
        key: '=',
        columns: '=',
        modes: '='
      },
      link: function (scope, element) {

        //Add templates for each mode supported
        var templates = {
          remove: '<div class="ngCellText" style="text-align:center;margin:2px;" ng-class="col.colIndex()"><div style="width:100%; color:red" ng-click="grid.appScope.delete(row)" class="btn btn-link">Remove</div></div>'
        };

        scope.gridOptions = {
          enableRowSelection: false,
          enableFiltering: true,
          rowHeight: 35
        };

        scope.gridOptions.data = cartService.getFromCart(scope.key);

        scope.gridOptions.columnDefs = scope.columns;
        scope.modes.forEach(function (m) {
          if (templates[m] === undefined) {
            throw m + ' is not supported';
          }
          var mode = {
            field: m,
            displayName: '',
            width: '80',
            enableFiltering: false,
            enableSorting: false,
            enableColumnMenu: false,
            cellTemplate: templates[m]
          };
          scope.gridOptions.columnDefs.push(mode);
        });

        scope.delete = function (row) {
          cartService.removeFromCart(scope.key, 'id', row.entity.id);
        };
      }
    };
  }]);
