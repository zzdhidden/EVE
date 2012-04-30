(function() {
  var eve, statusSchema, statuses, type;

  eve = require("../index");

  type = eve.type;

  statuses = require("./fixtures/public_timeline.json");

  statusSchema = type.object({
    created_at: type.date(),
    user: {
      "profile_link_color": type.string(),
      "created_at": type.date()
    }
  });

  statuses = type.array(statusSchema).val(statuses).val();

  statuses.forEach(function(status) {
    console.log(status.created_at + " " + status.text.slice(0, 21));
    return console.log(status.created_at.constructor);
  });

}).call(this);
