"use strict";

var Smartwrap = Smartwrap || {};

var wrapup = wrapup || {};
wrapup.env = window.env || {};

wrapup.env.server = {};
wrapup.env.server.prefix = wrapup.env.serverprefix || "https://gae-wrapup-server.appspot.com";
wrapup.env.server.querypath = wrapup.env.querypath || "/query";
wrapup.env.server.contrapath = wrapup.env.contrapath || "/contra";
wrapup.env.format = wrapup.env.format || "microdata";

console.log(JSON.stringify({ENV: wrapup.env}));

wrapup.microdata = {
  "wrapup-tuple": function(event,detail) {
    //console.log("wrapup: tuple fire");

    detail = detail || event.detail || (event.originalEvent && event.originalEvent.detail);
    detail.format = detail.format || "";
    if (wrapup.env.format !== 'microdata') {
      if (detail.format !== 'microdata') {
        return;
      }
    }
    jQuery(event.target).attr("itemscope", "true");
  },
  "wrapup-attr": function(event,detail) {
    //console.log("wrapup: attr fire");

    detail = detail || event.detail || (event.originalEvent && event.originalEvent.detail);
    detail.format = detail.format || "";
    if (wrapup.env.format !== 'microdata') {
      if (detail.format !== 'microdata') {
        return;
      }
    }

    detail.target = detail.wrapupTarget || event.target;
    if (detail.target.nodeType === detail.target.TEXT_NODE) {
      jQuery(detail.target).wrap(detail.target.ownerDocument.createElement("span"));
      detail.target = detail.target.parentNode;
    }
    jQuery(detail.target).attr("itemprop", detail.name);
  },
};

wrapup.rdfa_lite = {
  "wrapup-tuple": function(event,detail) {
    detail = detail || event.detail || (event.originalEvent && event.originalEvent.detail);
    detail.format = detail.format || "";
    if (wrapup.env.format !== 'rdfa_lite') {
      if (detail.format !== 'rdfa_lite') {
        return;
      }
    }
    jQuery(event.target).attr("typeof", detail.name);
  },
  "wrapup-attr": function(event,detail) {
    detail = detail || event.detail || (event.originalEvent && event.originalEvent.detail);
    detail.format = detail.format || "";
    if (wrapup.env.format !== 'rdfa_lite') {
      if (detail.format !== 'rdfa_lite') {
        return;
      }
    }
    detail.target = detail.wrapupTarget || event.target;
    if (detail.target.nodeType === detail.target.TEXT_NODE) {
      jQuery(detail.target).wrap(detail.target.ownerDocument.createElement("span"));
      detail.target = detail.target.parentNode;
    }
    jQuery(detail.target).attr("property", detail.name);
  },
};

wrapup.emit = function(element, eventName, detail) {
  if (false) {
    element.dispatchEvent(new CustomEvent(eventName, {bubbles:true,detail:detail}));
  } else {
    jQuery(element).trigger(eventName, [detail]);
  }
};

wrapup.watcher = function(doc) {
  switch (doc.location.protocol) {
    case "chrome:":
      switch (doc.location.hostname) {
        case "wrapup-client":
        case wrapup.env.extname:
          break;
        default:
          return;
      } 
      break;
    case "about:":
      return;
    default:
  }

  var self = {};
  self.document = doc;

  self.done = false;

  [wrapup.rdfa_lite, wrapup.microdata].forEach(function(formatter) {
    jQuery(self.document.documentElement).on("wrapup-tuple", formatter["wrapup-tuple"]);
    jQuery(self.document.documentElement).on("wrapup-attr", formatter["wrapup-attr"]);
  });

  self.applySelector = function(obj, context) {
    if (obj.xpathSelector) {
      self.resolver = self.resolver || self.document.createNSResolver(self.document.documentElement);
      self.defaultNamespace = self.defaultNamespace || self.document.lookupNamespaceURI(null);
      obj.resolver = function(prefix) {
        //console.log("RESOLVE! " + prefix);
        if (prefix === '_') {
          //console.log("RESOLVE1 " + prefix + " --> " + self.defaultNamespace);
          return self.defaultNamespace;
        }
        //console.log("RESOLVE2 " + prefix + " --> " + (self.resolver.lookupNamespaceURI(prefix) ||self.defaultNamespace));
        return self.resolver.lookupNamespaceURI(prefix) || self.defaultNamespace;
      };

      //console.log("XPATH: " + obj.xpathSelector);
      var tuples = jQuery(context).xpath(obj.xpathSelector, obj.resolver);
      //console.log("FOUND: " + tuples.length);
      if (tuples.length > 0) {
        return tuples;
      }
    }
    if (obj.xpathSelector) {
      var xpathSelector = obj.xpathSelector.replace(/(\/)_:/, '${1}*:');
      console.log("RETRY: " + obj.xpathSelector + " --> " + xpathSelector);
      var tuples = jQuery(context).xpath(obj.xpathSelector, obj.resolver);
      //console.log("FOUND: " + tuples.length);
      if (tuples.length > 0) {
        return tuples;
      }      
    }
    if (obj.cssSelector) {
      console.log("CSS: " + obj.cssSelector);
      var tuples = jQuery(context).find(obj.cssSelector);
      return tuples;
      if (tuples.length > 0) {
        return tuples;
      }      
    }
    console.log("NONESUCH");    
    return jQuery();
  };

  self.applyWrapper = function(wrapper, context) {
    if (wrapper instanceof Array) {
      wrapper.forEach(function(part) {
        self.applyWrapper(part, context);
      });
      return;
    }

    wrapper.attributes = wrapper.attributes || [];
    wrapper.children = wrapper.children || [];

    context = context || jQuery(self.document.documentElement);

    console.log("APPLY: " + JSON.stringify(wrapper));
    console.log("APPLYTO: " + context.get(0).outerHTML.slice(0,200));

    var nsr = self.document.createNSResolver(self.document.documentElement);
    var def = nsr.lookupNamespaceURI("");
    var resolver = function(prefix) {
      //console.log("ALSO " + nsr.lookupNamespaceURI("")); 
      var output = nsr.lookupNamespaceURI(prefix) || def;
      console.log("PREFIX: " + prefix + " --> " + output);
      return output || def;
    };

    var wrapped = {};
    wrapped.tuples = self.applySelector(wrapper, context);
    console.log("#TUPLED: " + wrapped.tuples.length);

    // check if the wrapper found results in the page
    if (wrapped.tuples.length > 0) {
      console.log("Valid wrapper!");         
    } else {
      console.log("Invalid wrapper!");
      self.sendRequest({
        url: [wrapup.env.server.prefix,wrapup.env.server.contrapath].join(""),
        querydata: {url:self.document.URL},
        success: function(data){
          console.log("CONTRA: " + JSON.stringify(data));
        }
      });

      // return if invalid
      return;   
    }
   
    var detail = {};
    detail.name = wrapper.name;
    detail.type = wrapper.type;
    wrapped.tuples.each(function(ix, elt) {
      //console.log("TUPLE#: " + ix);

      //wrapup.emit(elt, "wrapup-tuple", detail);
      //console.log("TUPLED#: " + ix);

      if (wrapper.attributes instanceof Array) {
        wrapper.attributes.forEach(function(attributeWrapper) {
          var attrElts = self.applySelector(attributeWrapper, jQuery(elt));
          var detail2 = Object.create(detail);

          attrElts.each(function(ix2, attrElt) {
            detail2.wrapupTarget = attrElt;
            wrapup.emit(attrElt, "wrapup-attr", detail2);
          });
        });
      } else {
        Object.keys(wrapper.attributes).forEach(function(key) {
          var attributeWrapper = wrapper.attributes[key];
          var attrElts = self.applySelector(attributeWrapper, jQuery(elt));
          var detail2 = Object.create(detail);
          detail2.name = key;

          attrElts.each(function(ix2, attrElt) {
            detail2.wrapupTarget = attrElt;
            wrapup.emit(attrElt, "wrapup-attr", detail2);
          });
        });
      }

      wrapup.emit(elt, "wrapup-tuple", detail);

      wrapper.children.forEach(function(kid) {
        self.applyWrapper(kid, jQuery(elt));
      });
    });
  };

  self.processWrapper = function(data, statusText, jqxhr) {

    console.log("RESPONSE");
    //console.log("RESPONSE: " + statusText + ":: " + JSON.stringify(data));
    if (! data) {
      return;
    }
    console.log("RESPONSE: " + JSON.stringify({url:data.url}));
    //console.log("RESPONSE w DATA: " + statusText + ":: " + JSON.stringify(data));
    if (! data.wrappers) {
      return;
    }

    console.log("RESPONSE w WRAPPER: " + [this.url, this.data].join("?"));

    self.done = true;

    self.applyWrapper(data.wrappers);

    wrapup.emit(self.document, "wrapup-applied-wrapper", {});
    // apply wrapper to doc
  };

  self.logError = function(jqxhr, statusText) {
    console.log("ERROR: " + statusText);
  };

  self.sendQuery = function(spec) {
    if (self.done) { 
      console.log("IGNORING REQUEST; WRAPPER ALREADY APPLIED");
      return; 
    }

    self.sendRequest(spec);
  };

  self.sendRequest = function(spec) {
    spec.querydata.xo = "true"; // enable CORS

    //console.log("SENDING REQUEST: " + JSON.stringify({qdata:Object.keys(spec.querydata),env:wrapup.env}));
    var req = jQuery.ajax({
      url: spec.url || [wrapup.env.server.prefix,wrapup.env.server.querypath].join(""),
      type: spec.type || "POST",
      xhrFields: {
        withCredentials: spec.useCredentials || false
      },
      dataType: spec.dataType || "json",
      data: spec.querydata,
      success: spec.success || self.processWrapper,
      error: spec.error || self.logError
    });
  };

  self.queryByURL = function() {
    var queryurl = self.document.location.href;
    if (queryurl.match(/^https?:\/\/wrapup-proxy/i)) {
      queryurl = ['http:',''].concat(queryurl.split(/\//).slice(3)).join("/");
    }
    console.log("QURL: " + queryurl);
    self.sendQuery({querydata:{url:queryurl}});
  };
  
  self.queryBySignature = function() {
    var copy = jQuery(self.document.documentElement).clone().get(0);
    var treeWalker = self.document.createTreeWalker(copy,NodeFilter.SHOW_TEXT, null, false);
    
    //var nodeList = [];

    //console.log("WALK!");

    while(treeWalker.nextNode()) {
      //nodeList.push(treeWalker.currentNode)
      jQuery(treeWalker.currentNode).detach();
    }

    //console.log("WALKED");

    var sig = new XMLSerializer().serializeToString(copy);

    //console.log("SIG: " + sig);

    self.sendQuery({querydata:{signature:sig}});
  };

  self.requeries = 0;
  self.requeryTimeout = 5000;
  self.requery = function() {
    if (self.done) {
      return;
    }

    self.requeries--;

    if (self.requeries < 0) {
      return;
    }

    self.queryBySignature();
    setTimeout(self.requery, self.requeryTimeout);  
    
  };

  self.queryServer = function() {
    //console.log("QUERY SERVER!");

    this.queryByURL();

    this.requery();
  };

  self.wrap = function() {
    //console.log(JSON.stringify({WRAP: 1}));
    //console.log(JSON.stringify({WRAP: 2, SW: (!!Smartwrap), SWDM: (Smartwrap && !!Smartwrap.DocumentMarker)}));

    // CHANGE following line to "...&& false)" to disable span insertions, etc.
    if (Smartwrap && Smartwrap.DocumentMarker && true) {
      var that = this;
      this.markParams = {};
      this.markParams.chunkSize = 100;
      this.markParams.chunkDelay = 5;
      this.markParams.logger = {log: function(obj) { console.log(JSON.stringify(obj)); }};
      this.markParams.settings = this.markSettings = {};
      this.markSettings.fixComments = true;
      this.markSettings.fixAttribute = true;
      this.markSettings.fixLinebreaks = true;
      this.markSettings.fixEltnames = true;
      this.markSettings.computeFeatures = false;      
      this.markParams.finishCallback = function() { that.queryServer(); };
      this.marker = new Smartwrap.DocumentMarker({doc:this.document, params: this.markParams});
      setTimeout(function() { that.marker.mark(); }, 10);
    } else {
      this.queryServer();
    }
  };

  return self;
};

jQuery(document).ready(function() { 
  console.log("WRAPUP READY!");
  //wrapup.wrap(document);

  var watcher = new wrapup.watcher(document);
  if (watcher && watcher.wrap) {
    watcher.wrap();
  }
});

console.log("WRAPUP!");
