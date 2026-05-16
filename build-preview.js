/**
 * Builds preview.html for local browser testing.
 * Combines Index.html + Style.html + Script.html and injects a
 * google.script.run mock backed by localStorage.
 *
 * Usage:  node build-preview.js
 * Then:   open preview.html   (or npx serve .)
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const dir    = __dirname;
const style  = fs.readFileSync(path.join(dir, 'Style.html'),  'utf8');
const script = fs.readFileSync(path.join(dir, 'Script.html'), 'utf8');
let   html   = fs.readFileSync(path.join(dir, 'Index.html'),  'utf8');

// Expand Apps Script template tags
html = html.replace("<?!= include('Style') ?>",  style);
html = html.replace("<?!= include('Script') ?>", script);

// Inject mock immediately after <body> so it's available before any JS runs
const mock = `
<script>
/* ── google.script.run mock (local dev only) ────────────────────────── */
(function () {
  var KEY = 'trip-mgr-trips';
  var SAMPLE = [
    { id:'TRIP-1', name:'Tokyo Adventure',  destination:'Tokyo, Japan',      startDate:'2025-07-01', endDate:'2025-07-14', status:'Planning',  notes:'Cherry blossom season' },
    { id:'TRIP-2', name:'Bali Retreat',     destination:'Bali, Indonesia',   startDate:'2025-03-10', endDate:'2025-03-17', status:'Completed', notes:'Beach and temples' },
    { id:'TRIP-3', name:'Paris Weekend',    destination:'Paris, France',     startDate:'2025-09-05', endDate:'2025-09-08', status:'Active',    notes:'Visit the Louvre' },
    { id:'TRIP-4', name:'New York Trip',    destination:'New York, USA',     startDate:'2025-11-20', endDate:'2025-11-25', status:'Planning',  notes:'' },
    { id:'TRIP-5', name:'Chiang Mai Slow',  destination:'Chiang Mai, Thailand', startDate:'2024-12-01', endDate:'2024-12-15', status:'Cancelled', notes:'Postponed' },
  ];

  function load() {
    var raw = localStorage.getItem(KEY);
    if (!raw) { localStorage.setItem(KEY, JSON.stringify(SAMPLE)); return SAMPLE.slice(); }
    return JSON.parse(raw);
  }
  function save(trips) { localStorage.setItem(KEY, JSON.stringify(trips)); }

  function makeRunner() {
    var _ok, _err;
    var r = {
      withSuccessHandler: function (fn) { _ok  = fn; return r; },
      withFailureHandler: function (fn) { _err = fn; return r; },
      getTrips: function () {
        setTimeout(function () { _ok && _ok(load()); }, 300);
      },
      addTrip: function (trip) {
        setTimeout(function () {
          trip.id = 'TRIP-' + Date.now();
          var trips = load(); trips.push(trip); save(trips);
          _ok && _ok({ success: true, id: trip.id });
        }, 250);
      },
      updateTrip: function (trip) {
        setTimeout(function () {
          var trips = load();
          for (var i = 0; i < trips.length; i++) {
            if (trips[i].id === trip.id) { trips[i] = trip; break; }
          }
          save(trips);
          _ok && _ok({ success: true });
        }, 250);
      },
      deleteTrip: function (id) {
        setTimeout(function () {
          save(load().filter(function (t) { return t.id !== id; }));
          _ok && _ok({ success: true });
        }, 250);
      }
    };
    return r;
  }

  window.google = {
    script: {
      run: {
        withSuccessHandler: function (fn) { return makeRunner().withSuccessHandler(fn); },
        withFailureHandler: function (fn) { return makeRunner().withFailureHandler(fn); }
      }
    }
  };
}());
</script>`;

html = html.replace('<body>', '<body>\n' + mock);

fs.writeFileSync(path.join(dir, 'preview.html'), html, 'utf8');
console.log('✅  preview.html built — open it in your browser');
console.log('    Tip: npx serve . then visit http://localhost:3000/preview.html');
