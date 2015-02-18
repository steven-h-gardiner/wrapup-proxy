// ==UserScript==
// @name Wrapup Access
// @description Applies a previously constructed wrapper, if found, to rewrite datasets on the page as more accessible tables.
// @require http://code.jquery.com/jquery-2.1.1.min.js
// @require https://raw.githubusercontent.com/steven-h-gardiner/jquery-xpath/master/jquery.xpath.js
// @require ./content/js/smartwrap-docmarker.js
// @require ./content/js/wrapup.js
// @require ./content/js/wrapup-tablify.js
// @resource wrapped ./skin/wrapped.css
// @resource access_template ./content/ui/accessTable_template.html
// @author Steve Gardiner
// @include *
// @grant GM_getResourceText
// @grant GM_addStyle
// @grant unsafeWindow
// ==/UserScript==

// this should not be active anymore
// @require http://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js
// @require https://wrapup-client.googlecode.com/hg/content/js/wrapup.js

jQuery(document).on('wrapup-applied-wrapper', function() {
  tablify.setTemplate(jQuery('.wrapup-table'));
  var tables = tablify.tablify();

  for (itemscope in tables) {
    var table = tables[itemscope];
    jQuery(table.table).insertBefore(jQuery(table.container));
    jQuery(table.container).hide();
  }

  jQuery("table:not(.wrapup-table) > tbody > tr > td").replaceWith(function() { return jQuery("<span/>").append(jQuery(this).contents()); });
  jQuery("table:not(.wrapup-table) > tbody > tr").replaceWith(function() { return jQuery("<div/>").append(jQuery(this).contents()); });
  jQuery("table:not(.wrapup-table)").replaceWith(function() { return jQuery("<div/>").append(jQuery(this).contents()); });
});
