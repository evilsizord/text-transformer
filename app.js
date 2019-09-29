//app.js


var presets = {
  'HTML': [
    {name: 'Normalize Spaces', lines: [
      '# Normalize spaces - consolidate and remove non-breaking spaces',
      's/(&#160;|&nbsp;)/ /g',
      's/[ \\t\\v]+/ /g'
    ]},
    {name: 'Add trailing slashes', lines: [
      '# Add trailing slashes to self-closing HTML elements - make them XHTML compliant',
      's/<(area|base|br|col|hr|img|input|link|meta|param)([^\\\/]*?)>/<$1$2\\\/>/g'
    ]},
    {name: 'Remove trailing slashes', lines: [
      '# Remove trailing slashes from self-closing HTML elements - make them HTML5',
      's/<(area|base|br|col|hr|img|input|link|meta|param)([^\\\/]*)\\\/>/<$1$2>/g'
    ]},
    {name: 'Refactor image source locations', lines:[
      '# Refactor image source locations',
      's/src="path\\/to\\/(.*)\\.(png|gif|jpg)"/src="new_path\\/$1.$2"/g'
    ]},
    {name:'Remove empty tags', lines: [
      '# Remove meaningless self-closing tags',
      's/<(span|i|em|b|strong|div)\\s*\\/>//g',
      '# Remove empty tags (except for p)',
      's/<(span|i|em|b|strong|div)><\\/\\1>//g'
    ]}

  ]

};



// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

// Define a custom parse mode for our text transformer
CodeMirror.defineMode("TextTransformer", function() {

  function startLine(stream, state) {
    var ch = stream.next();
    if (ch == '#') {
      stream.skipToEnd();
      return 'comment';
    }
    else if (ch == 's') {
      state.cur = slash;
      state.slashCount = 0;
      return 'start-operator';
    }
    else {
      stream.skipToEnd();
      return null;
    }
  }

  function flags(stream, state) {
    stream.skipToEnd();
    state.cur = startLine;
    return 'flags';
  }

  function nextline(stream, state) {
    stream.skipToEnd();
    state.cur = startLine;
    return null;
  }

  function slash(stream, state) {
    var ch = stream.next();
    if (ch == '/') {
      state.slashCount++;
      state.cur = (state.slashCount > 2) ? flags : subRule;
      return 'operator';
    }
    else {
      return nextline(stream, state);
    }
  }

  // substitution rule
  function subRule(stream, state) {
    var prev = null,
        ch;
    while (ch = stream.peek()) {
      if (ch == '/' && prev != '\\') {
        state.cur = slash;
        return 'variable';
      }
      stream.next();
      prev = ch;
    }
    return nextline(stream, state);
  }

  return {
    token: function(stream, state) {
      if (stream.sol()) state.cur = startLine;
      var cur = state.cur;
      return cur(stream, state);
    },
    startState: function() {
      return {cur: startLine};
    }
  };
});
});

var cmTransforms;


function Example()
{
  cmTransforms.setValue("# Simple Example\ns/cat/dog/\ns/love/❤/"); // heart is U+2764
  $('#input').val('I love my cat named Woofy!');
  Update();
}



$(function() {
  // populate presets
  var menu = '<option value="0">-- Examples --</option>';
  for (var p in presets) {
    menu += '<optgroup label="'+p+'">';
    for (var pp in presets[p]) {
      menu += '<option value="'+p+'__'+pp+'">'+presets[p][pp].name+'</option>';
    }
    menu += '</optgroup>';
  }

  $('#presets').html(menu);

  cmTransforms = CodeMirror.fromTextArea(document.getElementById('transforms'), {
    mode: 'TextTransformer',
    lineNumbers: true
  });


  $('#input').on('input', Update);
  cmTransforms.on('change', Update);

  // Start with example
  Example();

});


$('#presets').on('change', function() {
  // replace #transforms with selected script
  var val = $(this).val();
  if (val == '0') {
    cmTransforms.setValue('');
    return false;
  }

  var vparts = val.split('__');
  var lines = '';

  for (var p in presets) {
    if (p == vparts[0]) {
      for (var pp in presets[p]) {
        if (pp == Number(vparts[1])) {
          lines = presets[p][pp].lines.join("\n");
        }
      }
    }
  }

  if (lines) {
    cmTransforms.setValue(lines);
  }
  else {
    // print error not found?
  }

});




function Update() {

  //var transforms = $('#transforms').val();
  var transforms = cmTransforms.getValue();
  var input = $('#input').val();
  var error = null;
  var numReplaced = 0;

  $('#error').text('').hide();

  try {
    var text = input.trim();
    if (text == '') {
      $('#output').val('');
      return false;
    }

    transforms = transforms.split( /\r?\n/ );

    for (var t in transforms) {
      var search, replace, flags;
      var tt = transforms[t].trim();

      // skip blank lines
      if (tt == '') continue;

      // skip comments
      if (tt.substring(0,1) == '#') continue;

      // ensure substitutions tarts with 's/'
      if ('s/' != tt.substring(0,2)) {
        throw new Error('Invalid substitution ' + tt);
      }

      tt = tt.substring(2);

      // s/abc/123/gi
      var parts=[], part=0, mark=0;
      for (var i=0; i<tt.length; i++) {
        if (tt[i] == '/' && tt[i-1] != '\\') {
          parts[part] = tt.substring(mark, i);
          part++;
          mark = i+1;
        }
        else if (i == tt.length-1) {
          parts[part] = tt.substring(mark, i+1);
        }
      }

      if (parts.length < 2 || parts.length > 4) {
        throw new Error('Invalid substitution ' + tt);
      }

      search = parts[0];
      replace = parts[1];

      replace = replace.replace('\\/', '\/');
      replace = replace.replace('\\n', "\n");

      if (parts.length == 3) {
        flags = parts[2];
        search = new RegExp( search, flags );
      }
      else {
        search = new RegExp( search );
      }

      // get count of items to be replaced
      var matches = text.match(search);
      if (null !== matches) {
        numReplaced += matches.length;
      }

      // do the replacement
      text = text.replace(search, replace);
    }

    $('#output').val( text );
    $('#output-details').text(numReplaced + ' substitutions made.').show();
  }
  catch (ex) {
    $('#error').text(ex).show();
  }

}




/*********************************************************************
 TESTS  -- test with https://www.regextester.com


 ========== Add trailing slashes ==========
 <p>This is bananas!</p>
 <link rel="stylesheet" href="bananas.css"> <span class="potato">test</span>
 <br/><link rel="stylesheet" href="potato.css"/>
 <h1>Bananas!</h1>


 ========== Remove trailing slashes ==========
 <p>This is bananas!</p>
 <link rel="stylesheet" href="bananas.css"/> <span class="potato">test</span>
 <br/><link rel="stylesheet" href="potato.css">
 <h1>Bananas!</h1>


 <html>
 <p>This is a paragraph! It&#160;has non-standard&nbsp;&nbsp;&nbsp;spacing!</p>
 </html>



========== Remove empty tags ==========
 <p>this is test<b></b></p>
 <span/><hr/>
 <b  />
 <strong></strong>














 **********************************************************************/
