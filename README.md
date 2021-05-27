<h1 align="center">
  <img width="96" height="96" src="./assets/icons/128x128.png"> <br/>
  Stalk
</h1>

**Stalk** is an experimental, highly-flexible (distributed) trace analysis tool.

- Visualize & inspect **multiple traces** on the same timeline
- [Jaeger](https://www.jaegertracing.io/) and [Zipkin](https://zipkin.io/) support out of the box

Available on: https://deniz.co/stalk/

![Screenshot](./docs/readme-images/screenshot.png)

# Background & Motivation

At work, we had a nasty bug in a highly event-driven, consensus-based distributed system. And it was occurring randomly on some specific cluster setups that we don't have physical access for debugging. We thought, why not use distributed tracing for debugging the whole cluster? The main problem was Jaeger and Zipkin's built-in UI are built just for visualizing a single trace, since it's the most common use case of distributed (request) tracing. That's the motivation behind Stalk, providing an alternative way to inspect distributed traces, especially for non-traditional use cases.

Also check out [the demo app](https://github.com/dgurkaynak/stalk-demo-raft-consensus) that I've built simulating [Raft distributed consensus algorithm](https://en.wikipedia.org/wiki/Raft_(computer_science)), instrumented with OpenTelemetry. You can play with it and export generated traces to Stalk.

## :vulcan_salute: Jaeger and Zipkin support

![Trace searching in Jaeger and Zipkin backends](./docs/readme-images/trace-search.png)

- Add & save your Jaeger and Zipkin APIs as data sources
- Search & import traces directly from Jaeger and Zipkin
- Drag & drop JSON trace files that are exported from Jaeger or Zipkin

## :gear: High Customizability

![High Customizability](./docs/readme-images/highly-customizability.gif)

Stalk is built for being as flexible as possible to cover your changing needs when analyzing different traces.
- **Flexible panes**: Split views can be handy.
- **Table view**: Pinpoint interesting spans quickly in table view with customizable & sortable columns.
- **Timeline layout**: Change how the spans are grouped and rendered vertically. Uninteresting groups can be collapsed to prevent visual clutter.
- **Span coloring & labelling**: Change span bar colors and the text rendered on it.
- **Tooltip**: Change the contents of the tooltip displayed when you hover a span bar. You can add/remove interested span tags, logs, and process tags.

## :woman_technologist: Built for developers in mind

![Built for developers in mind](./docs/readme-images/custom-code.gif)

If the built-in customization options don't fill your needs, you can always write your own custom JavaScript / TypeScript code to do the following:
- Filter spans
- Change span grouping
- Change span labeling
- Change span coloring

# Building & Development

### Development

You must have node.js >= 12 installed on your machine.

- Clone the repo
- Install dependencies: `npm i`
- Get started with webpack-dev-server w/ live-reload: `npm start`

### Building

- Build the project in production mode: `npm run build`
- Check out `/build` folder for output
