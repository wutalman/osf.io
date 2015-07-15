'use strict';

var $ = require('jquery');
var ko = require('knockout');
var bootbox = require('bootbox');
var Raven = require('raven-js');
var oop = require('js/oop');

var ConnectedProject = function(data) {
    var self = this;
    self.title = data.title;
    self.id = data.id;
    self.urls = data.urls;
};

var ExternalAccount = oop.defclass({
    constructor: function(data) {
        var self = this;
        self.name = data.display_name;
        self.id = data.id;
        self.profileUrl = data.profile_url;
        self.providerName = data.provider_name;

        self.connectedNodes = ko.observableArray();

        ko.utils.arrayMap(data.nodes, function(item) {
            self.connectedNodes.push(new ConnectedProject(item));
        });
    },
    _deauthorizeNodeConfirm: function(node) {
        var self = this;
        var url = node.urls.deauthorize;
        var request = $.ajax({
                url: url,
                type: 'DELETE'
            })
            .done(function(data) {
                self.connectedNodes.remove(node);
            })
            .fail(function(xhr, status, error) {
                Raven.captureMessage('Error deauthorizing node: ' + node.id, {
                    url: url,
                    status: status,
                    error: error
                });
            });
    },
    deauthorizeNode: function(node) {
        var self = this;
        bootbox.confirm({
            title: 'Remove addon?',
            message: 'Are you sure you want to remove the ' + self.providerName + ' authorization from this project?',
            callback: function(confirm) {
                if (confirm) {
                    self._deauthorizeNodeConfirm(node);
                }
            }
        });
    }
});

var OAuthAddonSettingsViewModel = oop.defclass({
    constructor: function(name, displayName) {
        var self = this;
        self.name = name;
        self.properName = displayName;
        self.accounts = ko.observableArray();
        self.message = ko.observable('');
        self.messageClass = ko.observable('');
    },
    setMessage: function(msg, cls) {
        var self = this;
        self.message(msg);
        self.messageClass(cls || 'text-info');
    },
    connectAccount: function() {
        var self = this;
        window.oauthComplete = function() {
            self.updateAccounts();
            self.setMessage('Add-on successfully authorized. To link this add-on to an OSF project, go to the settings page of the project, enable ' + self.properName + ', and choose content to connect.', 'text-success');
        };
        window.open('/oauth/connect/' + self.name + '/');
    },
    askDisconnect: function(account) {
        var self = this;
        bootbox.confirm({
            title: 'Delete account?',
            message: '<p class="overflow">' +
                'Are you sure you want to delete account <strong>' +
                account.name + '</strong>?' +
                '</p>',
            callback: function(confirm) {
                if (confirm) {
                    self.disconnectAccount(account);
                }
            }
        });
    },
    disconnectAccount: function(account) {
        var self = this;
        var url = '/api/v1/oauth/accounts/' + account.id + '/';
        var request = $.ajax({
            url: url,
            type: 'DELETE'
        });
        request.done(function(data) {
            self.updateAccounts();
        });
        request.fail(function(xhr, status, error) {
            Raven.captureMessage('Error while removing addon authorization for ' + account.id, {
                url: url,
                status: status,
                error: error
            });
        });
        return request;
    },
    updateAccounts: function() {
        var self = this;
        var url = '/api/v1/settings/' + self.name + '/accounts/';
        var request = $.get(url);
        request.done(function(data) {
            self.accounts($.map(data.accounts, function(account) {
                return new ExternalAccount(account);
            }));
        });
        request.fail(function(xhr, status, error) {
            Raven.captureMessage('Error while updating addon account', {
                url: url,
                status: status,
                error: error
            });
        });
        return request;
    }
});

module.exports = {
    ConnectedProject: ConnectedProject,
    ExternalAccount: ExternalAccount,
    OAuthAddonSettingsViewModel: OAuthAddonSettingsViewModel
};
