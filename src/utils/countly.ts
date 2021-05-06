//some default pre init
var Countly: any = window['Countly'] = window['Countly'] || {};
Countly.q = Countly.q || [];

//provide countly initialization parameters
Countly.app_key = 'fc8e3af9946bd077740cb58dcac9088aad3069ec';
Countly.url = 'https://countly.deniz.co';

Countly.q.push(['track_sessions']);
Countly.q.push(['track_pageview']);
Countly.q.push(['track_errors']);

//load countly script asynchronously
(function () {
  var cly = document.createElement('script');
  cly.type = 'text/javascript';
  cly.async = true;
  //enter url of script here
  cly.src = 'https://countly.deniz.co/sdk/web/countly.min.js';
  cly.onload = function () {
    Countly.init();
  };
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(cly, s);
})();
