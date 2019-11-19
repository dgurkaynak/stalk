/**
 * Just critical javascript allowed here for initial html/css rendering.
 * The real application js file (app) will be load async.
 */

import Split from 'split.js';

async function main() {
  // Get elements from the dom
  const els = {
    container: document.getElementById('app') as HTMLDivElement,
    mainSplitContainer: document.getElementById(
      'main-split-container'
    ) as HTMLDivElement,
    bodySplitContainer: document.getElementById(
      'body-split-container'
    ) as HTMLDivElement,
    bodyLeft: document.getElementById('body-left') as HTMLDivElement,
    bodyRight: document.getElementById('body-right') as HTMLDivElement,
    bottomSplitContainer: document.getElementById(
      'bottom-split-container'
    ) as HTMLDivElement,
    bottomLeft: document.getElementById('bottom-left') as HTMLDivElement,
    bottomCenter: document.getElementById('bottom-center') as HTMLDivElement,
    bottomRight: document.getElementById('bottom-right') as HTMLDivElement
  };

  // Init split.js
  // We do this here, because layouting stuff is important for initial render
  const bottomSplitContainerHeightInPercentage =
    (200 / els.mainSplitContainer.offsetHeight) * 100;
  const mainSplit = Split([els.bodySplitContainer, els.bottomSplitContainer], {
    direction: 'vertical',
    sizes: [
      100 - bottomSplitContainerHeightInPercentage,
      bottomSplitContainerHeightInPercentage
    ],
    minSize: [200, 0],
    gutterSize: 2,
    onDrag: function() {
      app && app.throttled.handleMainSplitDrag(mainSplit.getSizes());
    },
    onDragEnd: function(sizes: number[]) {
      app && app.throttled.handleMainSplitDragEnd(sizes);
    }
  });
  const bodySplit = Split([els.bodyLeft, els.bodyRight], {
    sizes: [0, 100],
    minSize: [0, 400],
    gutterSize: 2,
    onDrag: function() {
      app && app.throttled.handleBodySplitDrag(mainSplit.getSizes());
    },
    onDragEnd: function(sizes: number[]) {
      app && app.throttled.handleBodySplitDragEnd(sizes);
    }
  });
  const bottomSplit = Split(
    [els.bottomLeft, els.bottomCenter, els.bottomRight],
    {
      sizes: [25, 25, 50],
      gutterSize: 2,
      onDrag: function() {
        app && app.throttled.handleBottomSplitDrag(mainSplit.getSizes());
      },
      onDragEnd: function(sizes: number[]) {
        app && app.throttled.handleBottomSplitDragEnd(sizes);
      }
    }
  );

  // Lazy-load app and init it
  const { App } = await import(/* webpackChunkName: "app" */ './app');
  const app = new App({
    mainSplit,
    bodySplit,
    bottomSplit,
    element: els.container
  });
  await app.init();
}

main().catch(err => console.error(err));
