var Smartwrap;

if (!Smartwrap) {
  Smartwrap = {};
}

Smartwrap.DocumentMarker = (function () {
  "use strict";

  return function(spec) {
    var self = {};
    self.spec = spec || {};

    self.init = function(doc, params) {
      //alert("HOK");
      this.doc = doc;
      this.token = doc.defaultView.location.href;
      /*
      this.walker = doc.createTreeWalker(doc.documentElement,
                                         NodeFilter.SHOW_ALL,
                                         null,
                                         true);
      */

      this.params = params || {};
      this.params.chunkSize = this.params.chunkSize || 200;
      this.params.chunkDelay = this.params.chunkDelay || 10;
      
      this.nodes = jQuery(doc).find("*");
      //this.nodes.addClass("marking");
      this.offset = 0;
      this.checklist = {};
      this.nodelist = [];
      this.nodemap = {};
      this.styleids = {};
      this.smartwrap = this.params.smartwrap;
      this.logger = this.params.logger || this.smartwrap;
      this.chunkCount = 0;
      this.nodeCount = 0;

      this.callbacks = {};
      this.callbacks.finish = this.params.finishCallback;
      
      this.marktimes = [];

      var that = this;
      this.settings = function(params) {
	if (params.settings) { return params.settings; }
	var settings = {};
	["fixComments", "fixAttributes", "fixLinebreaks", "fixEltnames", "computeFeatures"].forEach(function(key) {
	  settings[key] = (that.smartwrap && that.smartwrap.getSetting(key)) || true;
	});
	return settings;
      }(params);
      
      this.fixstimuli = [];
      this.fixresponses = [];

      if (this.settings.fixComments) {
        this.fixstimuli.push(function () { return this.nodeType === this.COMMENT_NODE; });
        this.fixresponses.push(function (node) {
          node.textContent = node.textContent.replace(/\-/g, "- ");
        });
      }

      if (this.settings.fixAttributes) {
        var fixAtts = function (node) {
          var atts = node.attributes;
        
          var attnames = [];
          var i = 0;
          for (i = 0; i < atts.length; i += 1) {
            var attname = atts.item(i).localName;
            attnames.push(attname);
          
            if (!attname.match(/^[A-Za-z: _]/)) {
              node.removeAttribute(attname);
              this.logger.log({TRIMATT: attname, url: this.doc.documentURI});
              i -= 1; // atts is a live list, because the DOM is terrible
            } else if (attname.match(/[\",\';]/)) {
              node.removeAttribute(attname);
              this.logger.log({TRIMATT2: attname, url: this.doc.documentURI});
              i -= 1; // atts is a live list, because the DOM is terrible
            } else if (attname.match(/^onsubmit/)) {
              node.removeAttribute(attname);
              this.logger.log({TRIMATT3: attname, url: this.doc.documentURI});
              i -= 1; // atts is a live list, because the DOM is terrible
            } //else {
            //this.logger.log({KEEPATT: attname});
            // }

            var attval = atts.item(i).value;
            if (attval.match(/[<>]/)) {
              node.removeAttribute(attname);
              i -= 1;
              //setTimeout(function() { alert(JSON.stringify({badatt:'bad',key:attname,val:attval})); }, 1000);
            }
          }
          //alert("ATTS: " + JSON.stringify(attnames));
        }

        this.fixstimuli.push(function () { return this.nodeType === this.ELEMENT_NODE; });
        this.fixresponses.push(fixAtts);
      }

      if (this.settings.fixLinebreaks1) {
        var fixLinebreaks = function (node) {
          var kids = jQuery(node).contents();
          var newSpan = node.ownerDocument.createElement("span");
          newSpan.setAttribute("class", "sw_inserted");

          var i = 0;
          for (i = 0; i < kids.length; i += 1) {
            var kid = kids.get(i);
            if (jQuery(kid).filter("br").length) {              
              node.appendChild(newSpan);
              node.appendChild(kid);
              this.markNode(newSpan);
              newSpan = node.ownerDocument.createElement("span");
              newSpan.setAttribute("class", "sw_inserted");
            } else {
              newSpan.appendChild(kid);
            }            
          }
          node.appendChild(newSpan);
          this.markNode(newSpan);
        }

        this.fixstimuli.push(function () { return jQuery(this).children("br").length; });
        this.fixresponses.push(fixLinebreaks);
      }

      if (this.settings.fixLinebreaks) {
        var fixLinebreaks = function (node) {
          var kids = jQuery(node).contents();
          var newSpan = node.ownerDocument.createElement("span");
          newSpan.setAttribute("class", "sw_inserted");

          var i = 0;
          for (i = 0; i < kids.length; i += 1) {
            var kid = kids.get(i);
            if (jQuery(kid).filter("br").length) {              
              node.appendChild(newSpan);
              node.appendChild(kid);
              this.markNode(newSpan);
              newSpan = node.ownerDocument.createElement("span");
              newSpan.setAttribute("class", "sw_inserted");
            } else {
              newSpan.appendChild(kid);
            }            
          }
          node.appendChild(newSpan);
          this.markNode(newSpan);
        }

        var nontrivWhitespace = function(node) {
          if (this.nodeType !== this.TEXT_NODE) { 
            return false; 
          }
          var txt = jQuery(this).text();
          if ((/^\s*$/).test(txt)) {
            return false;
          }

          return true;
        };

        this.fixstimuli.push(function () { return jQuery(this).contents().filter(nontrivWhitespace).siblings("br").length });
        this.fixresponses.push(fixLinebreaks);
      }

      if (this.settings.fixEltnames) {
        this.fixstimuli.push(function() { return (this.nodeType === this.ELEMENT_NODE) && (this.nodeName.match(/[^a-zA-Z0-9]/)); });
        this.fixresponses.push(function (node) {
          var nodeName = node.nodeName.replace(/[^a-zA-Z0-9]/g, '');
          this.logger.log({PREFIX: node.nodeName, POSTFIX: nodeName});
          jQuery(node).contents().unwrap().wrapAll("<" + nodeName + "/>");
        });
      }
    };
    self.fixNode1 = function() {
      self.fixNode(this);
    };
    self.mark = function () {
      try {
        this.logger.log({MARKTIMES0: this.marktimes});
        this.marktimes.push(new Date());
        this.mark0();
        this.offset += this.params.chunkSize;        
        this.marktimes.push(new Date());

        //this.logger.log({MARKTIMES: this.marktimes});
      } catch (exception) {
        this.logger.log({
          exception: {name: exception.name, message: exception.message, stack: exception.stack},
          context: "marking doc",
          nodeCount: this.nodeCount,
          url: this.doc.documentURI
        });
      }
    };
    self.mark0 = function () {
      this.chunkCount += 1;
      this.logger.log({chunkNo: this.chunkCount, nodeCount: this.nodeCount, url: this.doc.documentURI});

      var that = this;

      var detail = {};
      detail.inprogress = true;
      detail.token = this.token;
      detail.logger = this.smartwrap;
      detail.offset = this.offset;
      detail.ub = this.nodes.length;

      var evt = this.doc.createEvent("CustomEvent");
      evt.initCustomEvent("sw_markingstatus", true, true, detail);
      this.doc.dispatchEvent(evt);

      //this.logger.log({post:"markingstat", token: detail.token});

      var i = 0;
      while (i < this.params.chunkSize) {
        //this.logger.log({where: "prexpath", nodeCount: this.nodeCount, i: i, url: this.doc.documentURI});
        //var node = this.walker.currentNode;
        if ((this.offset + i) >= this.nodes.length) {
          this.logger.log({lastxpath: this.xpath, nodeCount: this.nodeCount, i: i, offset: this.offset, ll: this.nodes.length, url: this.doc.documentURI, checklist: this.checklist});
          if (Object.keys(this.checklist).length) {
            this.logger.log({leftbehind: Object.keys(this.checklist)});
          }

          this.finish();

          return;
        }
        var node = this.nodes.get(this.offset + i);
        //this.logger.log({where: "postnode", nodeCount: this.nodeCount, i: i, url: this.doc.documentURI});

        this.markNode(node);

        try {
          /*
          if (node.nodeName.match(/[^a-zA-Z0-9]/)) {
            this.logger.log({PREFIX: node.nodeName});
            jQuery(node).contents().unwrap().wrapAll("<li/>");
              //node = newNode.get(0);
            this.logger.log({POSTFIX: node.nodeName});            
          }
          */
          this.fixNode(node);
          //this.markElement(node);

          var nonelts = jQuery(node).contents().filter(this.isNonElt);

          nonelts.each(this.fixNode1);

          /*
          this.wrapKids(node);
          this.wrapKeyedValues(node);
          */
        } catch (exception) {
          this.logger.log({
            exception: {name: exception.name, message: exception.message, stack: exception.stack},
            context: "processing node",
            nodeCount: this.nodeCount,
            i: i,
            url: this.doc.documentURI,
            node: node
          });
        }

        //this.logger.log({markedxpath: xpath, nodeCount: this.nodeCount, i: i, url: this.doc.documentURI});

        this.nodeCount += 1;

        /*
        try {
          var nextNode = this.walker.nextNode();
          if (nextNode === null) {
            this.logger.log({lastxpath: this.xpath, nodeCount: this.nodeCount, i: i, url: this.doc.documentURI, checklist: this.checklist});
            if (Object.keys(this.checklist).length) {
              this.logger.log({leftbehind: Object.keys(this.checklist)});
            }

            this.finish();

            return;
          }
        } catch (exception2) {
          this.logger.log({
            exception: {name: exception2.name, message: exception2.message, stack: exception2.stack},
            context: "finishingdom",
            nodeCount: this.nodeCount,
            i: i,
            url: this.doc.documentURI,
            node: node
          });
        }
        */

        i += 1;
      }

      window.setTimeout(function () { that.mark(); }, this.params.chunkDelay);
    };
    self.markNode = function (node) {
      if (false) { return; }
      
      if (node.localName) {
        var tag = node.localName.toLowerCase();
        //this.logger.log({MARKTAG: tag});

        if (tag.match(/\:/)) {
          return;
        }
        if (tag.match(/[^A-Za-z0-9]/)) {
          return;
        }

        var ord = 1 + jQuery(node).prevAll(tag).length;
        var xpathParts = {prefix: (jQuery(node.parentNode).data("xpath") || ""),
                          lname: tag,
                          ord: ord};
        var xpath0 = [xpathParts.prefix,xpathParts.lname].join("/");
        this.xpath = [xpath0,
                      (ord ? ["[",xpathParts.ord,"]"].join("") : "")].join("");

        jQuery(node).data("xpath", this.xpath);
        //this.logger.log({MARKTAG: tag, PREFIX: node.prefix, NS: node.namespaceURI, xpath: this.xpath});
        
        //node.setAttribute("MARKED", "true");

        this.checklist[this.xpath] = node;
        
        var nodeinfo = {};
        this.nodelist.push(nodeinfo);
        this.nodemap[this.xpath] = nodeinfo;
        
        nodeinfo.xpath = this.xpath;
        nodeinfo.node = node;

        this.markElement(node);
      }
    };
    self.markElement = function (node) {
      if (node.nodeType !== node.ELEMENT_NODE) {
        return;
      }

      var xpath = jQuery(node).data("xpath");

      if (! xpath) { return; }

      if (this.settings.computeFeatures) {      
	var depth = 1 + (jQuery(node.parentNode).data("treedepth") || 0);
	jQuery(node).data("treedepth", depth);
	var taglen = 1 + node.localName.length + (jQuery(node.parentNode).data("taglen") || 0);
	jQuery(node).data("taglen", taglen);
	
	//alert("STYLES: " + JSON.stringify(this.styles));
	
	//this.logger.log({MARKELT: xpath + "!!"});
	
	var features = {};
	features.depth = jQuery(node).data("treedepth");
	features.taglen = jQuery(node).data("taglen");
	features.child_count = node.childNodes.length;
	features.attr_count = node.attributes.length;
	
	var style = this.getPresentedStyle(node);
	
	var position = this.getLayoutPosition(node);
	
	this.nodemap[xpath].position = position;
	this.nodemap[xpath].style = style;
	this.nodemap[xpath].features = features;
	
	jQuery(node).data("style", style);
      }
      
      /*
      var bfg = jQuery(node).css("backgroundColor");
      jQuery(node).data("bg", bfg);
      jQuery(node).css({backgroundColor: "green"});
      window.setTimeout(function () {
        jQuery(node).css({backgroundColor: bfg});
      }, 50);
      */

      window.setTimeout(function () {
        jQuery(node).removeClass("marking");
      }, 1000);
      jQuery(node).data("marked", true);

      delete this.checklist[xpath];
    };
    self.getLayoutPosition = function (node) {
      var crect = node.getBoundingClientRect();
      var position = {};

      position.relx = 1 * Math.round(crect.x);
      position.rely = 1 * Math.round(crect.y);
      position.width = 1 * Math.round(crect.width);
      position.height = 1 * Math.round(crect.height);

      position.absx = 1 * position.relx + 1 * Math.round(window.scrollX);
      position.absy = 1 * position.rely + 1 * Math.round(window.scrollY);

      return position;
    };
    self.getPresentedStyle = function (node) {
      var cStyle = window.getComputedStyle(node);
      var summ = {};
      var i = 0;
      for (i = 0; i < this.styles.length; i += 1) {
        var attr = this.styles[i];
        var val = cStyle.getPropertyValue(attr);
        summ[attr] = val;

        if (!this.params.noids) {
          if (!this.styleids[attr]) {
            this.styleids[attr] = {};
          }
          var idmap = this.styleids[attr];
          var styleid = idmap[val] || Object.keys(idmap).length;
          summ[attr + "_id"] = styleid;
        }
      }
      return summ;
    };

    self.styles = ["font-size", "color", "background-color", "font-family",
             "text-align", "text-transform", "font-style",
             "word-spacing", "font-weight"];
    self.isNonElt = function () {
      return this.nodeType !== this.ELEMENT_NODE;
    };

    self.fixNode = function (node) {
      
      var i = 0;
      for (i = 0; i < this.fixstimuli.length; i++) {
        var stimulus = this.fixstimuli[i];

        if (jQuery(node).filter(stimulus).length) {
          var response = this.fixresponses[i];

          response.call(this, node);
        }
      }
    };

    self.finish = function () {
      //alert("DONEDONEDONE!");

      var that = this;

      that.marktimes.push(new Date());
      that.logger.log({FINISHDOM: new Date() - that.marktimes[0], url: that.doc.documentURI});

      try {

        var metadata = {};

        var doc1 = this.doc.cloneNode(true);
        var doctype = doc1.doctype;
        if (doctype) {
          doctype.parentNode.removeChild(doctype);
        }
        var domstr = "";
        if (this.smartwrap) {
          var stream = {
            write: function (string, count) {
              domstr += string;
            }
          };
          var ser = new XMLSerializer();
          ser.serializeToStream(doc1, stream, "UTF-8");
        }
          
        metadata.docClone = doc1;
        metadata.domxml = domstr;
        metadata.bwdominfo = this.nodelist;
        metadata.nodemap = this.nodemap;

        that.logger.log({"METAKEYS": Object.keys(metadata)});

        if (this.smartwrap && this.smartwrap.scrapeTarget) {
          that.logger.log({"USEMETAKEYS": Object.keys(metadata)});
          Object.keys(metadata).forEach(function (key) {
            that.smartwrap[key] = metadata[key];
          });

          //alert("SETDOM: " + JSON.stringify({url: this.doc.defaultView.location.href, tgt: this.smartwrap.scrapeTarget}));
        } else {
          //alert("SQUIRRELDOM: " + JSON.stringify({url: this.doc.defaultView.location.href, tgt: this.smartwrap.scrapeTarget}));
          that.logger.log({"UNUSEMETAKEYS": Object.keys(metadata)});
        }

        jQuery(this.doc).data("metadata", metadata);

        var detail = {};

        if (this.smartwrap) {
          detail.smartwrap = this.smartwrap;
          this.smartwrap.status.fresh = false;
        }

        var evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("sw_status", true, false, detail);
        document.dispatchEvent(evt);

        detail = {};
        detail.inprogress = false;
        detail.finished = true;
        detail.token = this.token;
        detail.logger = this.logger || this.smartwrap;

        evt = document.createEvent("CustomEvent");
        evt.initCustomEvent("sw_markingstatus", true, true, detail);
        this.doc.dispatchEvent(evt);

	if (this.callbacks.finish) {
	  this.callbacks.finish.call(null, detail);
	}
      } catch (exception) {
        this.logger.log({
          exception: {name: exception.name, message: exception.message, stack: exception.stack},
          context: "finish dom",
          nodeCount: this.nodeCount,
          url: this.doc.documentURI
        });
      }

      this.logger.log({finisheddom: true, nodeCount: this.nodeCount, url: this.doc.documentURI});
      //alert("DIDDONE: " + JSON.stringify(this.nodelist));
    }


    self.init(self.spec.doc, self.spec.params); 
      console.log("INITTED marker");
    return self;
  };
    
}());
