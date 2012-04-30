(function() {
  var message;

  message = require("./message.js").message;

  message.store("zh-CN", {
    invalid: "是无效的",
    required: "必填",
    notEmpty: "不能留空",
    len: "长度为{{len}}",
    len_in: "长度为{{min}}到{{max}}",
    match: "应该{{expression}}",
    email: "必须是邮件地址",
    url: "必须是链接",
    min: "必须大于或等于 {{count}}",
    max: "必须小于或等于 {{count}}",
    taken: "已经被使用",
    "enum": "必须包含在({{items}})中"
  });

}).call(this);
