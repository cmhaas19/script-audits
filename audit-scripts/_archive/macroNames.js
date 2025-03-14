

var stringify = (function () {
  var toString = Object.prototype.toString;
  var isArray = Array.isArray || function (a) { return toString.call(a) === '[object Array]'; };
  var escMap = {'"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t'};
  var escFunc = function (m) { return escMap[m] || '\\u' + (m.charCodeAt(0) + 0x10000).toString(16).substr(1); };
  var escRE = /[\\"\u0000-\u001F\u2028\u2029]/g;
  return function stringify(value) {
    if (value == null) {
      return 'null';
    } else if (typeof value === 'number') {
      return isFinite(value) ? value.toString() : 'null';
    } else if (typeof value === 'boolean') {
      return value.toString();
    } else if (typeof value === 'object') {
      if (typeof value.toJSON === 'function') {
        return stringify(value.toJSON());
      } else if (isArray(value)) {
        var res = '[';
        for (var i = 0; i < value.length; i++)
          res += (i ? ', ' : '') + stringify(value[i]);
        return res + ']';
      } else if (toString.call(value) === '[object Object]') {
        var tmp = [];
        for (var k in value) {
          if (value.hasOwnProperty(k))
            tmp.push(stringify(k) + ': ' + stringify(value[k]));
        }
        return '{' + tmp.join(', ') + '}';
      }
    }
    return '"' + value.toString().replace(escRE, escFunc) + '"';
  };
})();

function getMacroVariableNames() {
	var map = {};

	var gr = new GlideAggregate("item_option_new");
	gr.addEncodedQuery("typeIN14,15,17^active=true");
	gr.addAggregate("count");
	gr.setWorkflow(false);
	gr.groupBy("type");
	gr.groupBy("name");
	gr.query();

	while(gr.next()) {
		var name = gr.getValue("name"),
			type = gr.type.getDisplayValue();

		if(map[type] == undefined)
			map[type] = [];

		map[type].push(name);
	}

	return map;

}

gs.print(stringify(getMacroVariableNames()));

