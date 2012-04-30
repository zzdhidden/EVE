(function() {
  var Message, fn;

  Message = (function() {

    Message.prototype.msg = function(key, msg, args) {
      var str;
      str = (msg && ("" + msg)) || (this.dictionary[this._locale] && this.dictionary[this._locale][key]) || "is invalid";
      return str = str.replace(/\{\{(.*?)\}\}/g, function(a, b) {
        if (str && args) return args[b] || "";
      });
    };

    function Message() {
      this.dictionary = {};
      this._locale = 'en-US';
      this.store("en-US", {
        "invalid": "is invalid",
        "required": "is required",
        "notEmpty": "can't be empty",
        "len": "should have length {{len}}",
        "wrongType": "should be a {{type}}",
        "len_in": "should have max length {{max}} and min length {{min}}",
        "match": "should match {{expression}}",
        "email": "must be an email address",
        "url": "must be a url",
        "min": "must be greater than or equal to {{count}}",
        "max": "must be less than or equal to {{count}}",
        "taken": "has already been taken",
        "enum": "must be included in {{items}}"
      });
    }

    Message.prototype.locale = function(name) {
      var path;
      if (!arguments.length) return this._locale;
      path = __dirname + "/message-" + name + ".js";
      try {
        require(path);
      } catch (e) {

      }
      return this._locale = name;
    };

    Message.prototype.store = function(locale, data) {
      var key, val, _results;
      if (typeof this.dictionary[locale] !== "object") {
        this.dictionary[locale] = {};
      }
      if (data && typeof data === "object") {
        _results = [];
        for (key in data) {
          val = data[key];
          _results.push(this.dictionary[locale][key] = val);
        }
        return _results;
      }
    };

    return Message;

  })();

  fn = function(key, msg, args) {
    return fn.message.msg(key, msg, args);
  };

  fn.message = new Message();

  module.exports = fn;

}).call(this);
