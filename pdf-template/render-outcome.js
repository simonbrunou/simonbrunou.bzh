// The render outcome of the CV, written on <html> for scripts/build-pdf.js:
// data-render-complete once the pages are ready to print, or
// data-render-error with the reason the render failed. The first outcome
// stands.
//
// index.html lists this module before the others, so its listeners are in
// place before profile.js runs: building the Profile checks the shape of
// data.js and throws while profile.js is imported, before app.js runs.

var root = document.documentElement;
var settled = false;

function settle(name, value) {
    if (settled) return;
    settled = true;
    root.setAttribute(name, value);
}

function fail(reason) {
    settle('data-render-error', reason);
}

// The build's static server picks a new port on every build, so reasons
// name "/profile.js" rather than "http://127.0.0.1:41235/profile.js".
function withoutOrigin(url) {
    return url.replace(location.origin, '');
}

// No preventDefault() in these listeners: Chrome would count the error as
// handled, and build-pdf.js would get no pageerror for it.
window.addEventListener('error', function (event) {
    var where = event.filename
        ? ' at ' + withoutOrigin(event.filename) + ':' + event.lineno + ':' + event.colno
        : '';
    fail(event.message + where);
});
window.addEventListener('unhandledrejection', function (event) {
    fail('Uncaught (in promise) ' + event.reason);
});

// app.js calls this once it has filled the pages. The PDF is printed as soon
// as the render completes, so it waits for:
//   - every image to load and decode, or the PDF ships without the photo;
//   - every web font in pdf-template/styles.css to load. The woff2 files load
//     lazily, so DOMContentLoaded is not enough: without this gate the PDF
//     can ship with system fallback glyphs instead of Big Shoulders Display
//     and Besley.
// Then it checks that no page overflows.
export function recordOutcome() {
    var images = Array.from(document.images, function (img) {
        return img.decode().catch(function () {
            throw new Error('image failed to load: ' + withoutOrigin(img.currentSrc || img.src));
        });
    });
    var faces = Array.from(document.fonts);
    var fonts = !faces.length
        ? Promise.reject(new Error('no web fonts declared; did pdf-template/styles.css load?'))
        : Promise.all(faces.map(function (face) {
              return face.load().catch(function () {
                  throw new Error('font failed to load: ' + face.family + ' ' + face.weight);
              });
          })).then(function () { return document.fonts.ready; });

    Promise.all(images.concat([fonts]))
        .then(function () {
            // Each .page has a fixed A4 height with overflow hidden, so
            // content that outgrows a page would be clipped silently.
            var overflowing = Array.from(document.querySelectorAll('.page'))
                .map(function (page, i) { return page.scrollHeight > page.clientHeight + 1 ? i + 1 : 0; })
                .filter(Boolean);
            if (overflowing.length) {
                fail('page ' + overflowing.join(', ') + ' overflows A4; move content between pages in pdf-template/');
                return;
            }
            settle('data-render-complete', '');
        })
        .catch(function (err) {
            fail(err.message || String(err));
        });
}
