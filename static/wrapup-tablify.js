

var tablify = function() {
  "use strict";
  
  var self = {};

  self.scopes = {};
  self.props = {};
    
  self.setTemplate = function(template) {
    console.log("SETTEMPL!");
    self.tableTempl = jQuery(template);
    console.log("SETTEMPL: " + jQuery(self.tableTempl).length);
  };
  
  self.addColumn = function(itemprop, table) {
    var templateRow = jQuery(table).data("templateRow");
    var headerRow = jQuery(table).find("thead tr");

    if (! self.props[itemprop]) {
      self.props[itemprop] = {};
      if (itemprop.match(/^COL0/)) {
        self.props[itemprop].colhead = ['COLUMN',Object.keys(self.props).length].join(" ");
      } else {
        self.props[itemprop].colhead = itemprop;
      }
    }
      
    var headerCell = jQuery(self.tableTempl).find("thead tr th").first().clone();
    headerCell.attr("itemprop", itemprop);
    headerCell.empty();
    headerCell.text(self.props[itemprop].colhead || itemprop);
    headerCell.appendTo(jQuery(headerRow));
    
    var templateCell = jQuery(self.tableTempl).find("tbody tr td").first().clone();
    templateCell.empty();
    templateCell.attr("itemprop", itemprop);
    //templateCell.text(jQuery(cellElt).attr("itemprop"));
    templateCell.appendTo(jQuery(templateRow));
    
    return templateCell;    
  };

  self.tablifyTuple = function(tupleElt) {
    var tuplescope = jQuery(tupleElt).attr("tuplescope");
    if (! self.scopes[tuplescope]) {
      var injectTable = jQuery(self.tableTempl).clone();
      //jQuery(injectTable).appendTo(jQuery(div));

      var templateRow = jQuery(self.tableTempl).find("tbody tr").clone();
      jQuery(templateRow).append(jQuery(templateRow).find("td").clone());
      jQuery(templateRow).empty();
      jQuery(injectTable).data("templateRow", templateRow);

      jQuery(injectTable).find("thead tr, tbody").empty();

      var range = document.createRange();
      range.selectNode(jQuery(tupleElt).get(0));
      jQuery(injectTable).data("range", range);
      
      self.scopes[tuplescope] = injectTable;
    }

    var table = self.scopes[tuplescope];
    var templateRow = jQuery(table).data("templateRow");
    
    var range = jQuery(table).data("range");
    range.setEndAfter(jQuery(tupleElt).get(0));
      
    var newrow = jQuery(templateRow).clone();      
    jQuery(newrow).appendTo(jQuery(table).find("tbody"));

    jQuery(tupleElt).find("*[itemprop]").each(function(ix, cellElt) {
      var itemprop = jQuery(cellElt).attr("itemprop");
      var cell = jQuery(newrow).find("td[itemprop]").filter(function(ix,x) { return jQuery(x).attr("itemprop") === itemprop; });

      if (jQuery(cell).size() === 0) {
        var templateCell = self.addColumn(itemprop, table);
        
        cell = templateCell.clone();
        cell.appendTo(jQuery(newrow));
      }

      var cellContents = jQuery(cellElt).clone();
      
      jQuery(cell).empty();
      jQuery(cell).append(jQuery(cellContents));
    });

    return table;      
  };

  self.tablify = function() {
    var output = {};

    var tables = {};
    jQuery("*[itemscope]").each(function(ix, tupleElt) {
      //setTimeout(function() { tablifyTuple(tupleElt) }, 2000*ix);
      var itemscope = jQuery(tupleElt).attr("itemscope");
        
      tables[itemscope] = self.tablifyTuple(tupleElt);
    });

    for (var itemscope in tables) {
      output[itemscope] = {};
      output[itemscope].table = tables[itemscope];
      output[itemscope].range = jQuery(output[itemscope].table).data("range");
      //setTimeout(function() { range.deleteContents(); }, 5000);

      output[itemscope].container = output[itemscope].range.commonAncestorContainer;
      //jQuery(table).insertBefore(container);

      //jQuery(container).hide();
    
      //console.log("INJECT");
    }

    return output;
  };
  
  return self;
}();

